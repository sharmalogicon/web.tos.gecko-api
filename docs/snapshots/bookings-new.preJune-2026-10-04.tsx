"use client";
/**
 * NEW BOOKING — the June 2026 layout, live against Gecko.Api.
 *
 * WHAT A BOOKING IS, AT CREATION. The header plus at least one REQUIREMENT:
 * what equipment, how many. The API refuses anything less ("A booking needs at
 * least one requirement line"), and rightly — a booking with no equipment line
 * cannot be gated against or priced.
 *
 * It does NOT need containers. The requirement is the promise (20 x 40HC); the
 * containers are what actually turned up, assigned later on the detail page,
 * each in its own transaction. For KORAKIT that gap is the normal case: 99.7%
 * of their bookings are raised at the gate as the truck arrives. A booking
 * sitting with a requirement and no boxes is business as usual, not an orphan.
 *
 * So this screen creates and hands over — create-then-enrich, as Navis, SAP and
 * Oracle TM do it. Lose the connection while assigning the 60th box and the
 * first 59 are safely on; save-it-all-at-the-end would lose the lot.
 *
 * NOTHING HERE IS HARDCODED. The order types, the booking types used as
 * filters, the lines, parties and equipment all come from master data, because
 * the next depot's list will not look like this one's.
 */
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { PartyPicker } from '@/app/tariff/_components/PartyPicker';
import { apiSend, newIdempotencyKey } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useFacility } from '@/lib/api/facility';
import { useCodeList, codeLabel } from '@/lib/api/lookups';
import { ContainerEntryGrid } from '../_components/ContainerEntryGrid';
import { OtherInfoPanel, type OtherInfo } from '../_components/OtherInfoPanel';
import { VoyagePanel } from '../_components/VoyagePanel';

interface OrderTypeRow {
  orderTypeCode: string;
  descriptionEn: string;
  directionCode: string | null;
  serviceCode: string | null;
  cargoClassCode: string | null;
  bookingTypeCode: string | null;
  isActive: boolean;
}

interface EquipmentTypeRow {
  equipmentTypeId: string;
  typeCode: string;
  descriptionEn: string;
  isActive: boolean;
}

/**
 * The 201 is a BookingDetailResponse: the booking is NESTED under `booking`,
 * not at the top level. Reading it flat gave /bookings/undefined.
 */
interface CreatedBooking { booking: { bookingId: string; orderNo: string; rowVersion: string } }

interface RequirementRow { equipmentTypeCode: string; qty: string }

/** A vessel call the booking can point at (step 2). */
interface CallSummary { vesselCallId: string; callRef: string; etd: string; status: string; lines: string[] }

/**
 * Vessel calls from a week back. Read once when the module loads rather than
 * per render: a clock read during render is impure, and a dropdown's lookback
 * window does not need to be to the millisecond.
 */
const CALLS_PATH = `/api/tos/vessel-calls?from=${encodeURIComponent(new Date(Date.now() - 7 * 86_400_000).toISOString())}&pageSize=200`;

/** A requirement line as the server returns it — what the box grid fills up. */
interface SavedLine { lineNo: number; equipmentTypeCode: string; qty: number; qtyAssigned: number; qtyCompleted: number }

/** Only the part of the order type that decides whether step 2 is mandatory. */
interface OrderTypeDetail { movements: { movementCode: string; requireVesselVoyage: boolean }[] }

/**
 * The 409 when this depot already has a live booking on the same carrier
 * reference. It names the one that exists, so the answer is to open it rather
 * than to raise a second — which is the whole point of the guard.
 */
interface DuplicateBooking { existingOrderNo: string; existingBookingId: string; carrierRef: string }

/** Tiles are only worth filtering once there are enough to hunt through. */
const FILTER_THRESHOLD = 6;

function FieldGroup({ label, required, children, hint, error }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string; error?: string;
}) {
  return (
    <div className="gecko-form-group">
      <label className={`gecko-form-label${required ? ' gecko-form-label-required' : ''}`}>{label}</label>
      {children}
      {error
        ? <div className="gecko-field-error">{error}</div>
        : hint && <div className="gecko-cell-meta gecko-mt-1">{hint}</div>}
    </div>
  );
}

export default function NewBookingPage() {
  const router = useRouter();
  const { branch } = useFacility();

  // ── master data ───────────────────────────────────────────────────────────
  const { data: orderTypes, loading: loadingTypes } = useApiList<OrderTypeRow>('/api/master/order-types?pageSize=200');
  const { data: equipment } = useApiList<EquipmentTypeRow>('/api/master/equipment-types?pageSize=200');
  const bookingTypes = useCodeList('BOOKING_TYPE');

  // ── filters over the order types ──────────────────────────────────────────
  const [direction, setDirection] = useState('');
  const [bookingTypeFilter, setBookingTypeFilter] = useState('');

  const active = useMemo(() => (orderTypes ?? []).filter(t => t.isActive), [orderTypes]);
  const directions = useMemo(
    () => Array.from(new Set(active.map(t => t.directionCode).filter(Boolean) as string[])).sort(),
    [active],
  );
  /** Only the booking types this depot's order types actually use. */
  const usedBookingTypes = useMemo(
    () => Array.from(new Set(active.map(t => t.bookingTypeCode).filter(Boolean) as string[])).sort(),
    [active],
  );
  const shown = useMemo(() => active.filter(t =>
    (!direction || t.directionCode === direction)
    && (!bookingTypeFilter || t.bookingTypeCode === bookingTypeFilter)), [active, direction, bookingTypeFilter]);
  const showFilters = active.length >= FILTER_THRESHOLD;

  // ── the booking ───────────────────────────────────────────────────────────
  const [orderTypeCode, setOrderTypeCode] = useState('');
  const [carrierRef, setCarrierRef] = useState('');
  const [customerRef, setCustomerRef] = useState('');
  const [lineCode, setLineCode] = useState<string | null>(null);
  const [agentCode, setAgentCode] = useState<string | null>(null);
  const [customerCode, setCustomerCode] = useState<string | null>(null);
  const [forwarderCode, setForwarderCode] = useState<string | null>(null);
  const [showForwarder, setShowForwarder] = useState(false);
  // A booking routinely asks for more than one kind of box — "3 x 20GP and
  // 2 x 40HC" is one booking, not two. Each row is a requirement line, and the
  // API numbers them in the order they are sent.
  const [lines, setLines] = useState<RequirementRow[]>([{ equipmentTypeCode: '', qty: '1' }]);
  const setLine = (i: number, patch: Partial<RequirementRow>) =>
    setLines(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const filledLines = lines.filter(r => r.equipmentTypeCode && Number(r.qty) > 0);
  const [remarks, setRemarks] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fieldError = (name: string) => error?.forField(name);
  // 409 with the existing booking named — offer it rather than a dead end.
  const duplicate = error?.status === 409 && error.extension<string>('existingOrderNo')
    ? {
        existingOrderNo: error.extension<string>('existingOrderNo')!,
        existingBookingId: error.extension<string>('existingBookingId')!,
        carrierRef: error.extension<string>('carrierRef') ?? carrierRef,
      } satisfies DuplicateBooking
    : null;

  /**
   * One key for this form, minted when it opens and kept for every retry.
   * A failed POST does not spend it, so correcting a field and pressing Save
   * again reuses it — which is exactly what stops a lost response becoming a
   * second booking. It is only replaced when the clerk starts a NEW booking.
   */
  const [idempotencyKey] = useState(newIdempotencyKey);
  // Set the moment the header lands, so the order number is on screen before
  // the lines are attempted — and stays there if they fail.
  const [created, setCreated] = useState<CreatedBooking['booking'] | null>(null);

  /**
   * THE FOUR STEPS. Step 1 creates the booking (§16a), so steps 2–4 are edits
   * to a booking that already exists and has an order number. Nothing is held
   * hostage in the browser waiting for a Finish button.
   *
   * `reached` is the furthest step the clerk has got to, so the bar can be
   * walked back and forth without letting anyone skip ahead of the create.
   */
  const [step, setStep] = useState(1);
  const [reached, setReached] = useState(1);
  /**
   * The lines as the server has them. The box grid cannot run before these
   * exist — the API answers 409 "has no requirement lines yet" (§16a) — so this
   * doubles as the gate on showing it.
   */
  const [savedLines, setSavedLines] = useState<SavedLine[]>([]);
  const linesSaved = savedLines.length > 0;

  // step 2 — voyage & ports
  const [vesselCallId, setVesselCallId] = useState('');
  const [polPortCode, setPol] = useState('');
  const [podPortCode, setPod] = useState('');
  const [fpdPortCode, setFpd] = useState('');
  const [allowLateGateIn, setAllowLate] = useState(false);
  const [paperlessCode, setPaperless] = useState('');

  // step 4 — Vector's "Other information". Six of these have no API field yet
  // (docs/BOOKING_VECTOR_PARITY_FOR_API.md §3); they are collected so the shape
  // is right, and sent the moment the API takes them.
  const [other, setOther] = useState<OtherInfo>({
    totalQty: '', uomCode: '', totalVolumeCbm: '', totalWeightKg: '',
    commodityCode: '', marksAndNos: '', specialInstruction: '',
    remarks: '', cargoCategoryCode: '', validFrom: '', validTo: '',
  });

  const { data: calls } = useApiList<CallSummary>(CALLS_PATH);
  // The order type decides whether a vessel call is required at all: a movement
  // carrying the MDM rule "require vessel/voyage" makes step 2 mandatory.
  const { data: otDetail } = useApi<OrderTypeDetail>(
    orderTypeCode ? `/api/master/order-types/${encodeURIComponent(orderTypeCode)}` : null);
  const needsCall = (otDetail?.movements ?? []).some(m => m.requireVesselVoyage);

  const selected = shown.find(t => t.orderTypeCode === orderTypeCode)
    ?? active.find(t => t.orderTypeCode === orderTypeCode)
    ?? null;

  // The API's three: branch, order type, line. Plus one requirement, or it refuses.
  const canCreate = !!branch && !!orderTypeCode && !!lineCode && filledLines.length > 0 && !saving;

  const missing = !branch ? 'No depot is assigned to this account.'
    : !orderTypeCode ? 'Choose a work order type.'
    : !lineCode ? 'Choose the shipping line.'
    : filledLines.length === 0 ? 'Choose the equipment and how many.'
    : null;

  /**
   * PUT /api/tos/bookings/{id} REPLACES THE WHOLE HEADER — a field left out is
   * CLEARED, not kept (proved against the running API). So every step sends
   * EVERY field, not just the ones it owns. A step-shaped patch here would have
   * step 2 wipe the customer and step 4 wipe the ports.
   */
  async function putHeader(b: CreatedBooking['booking']): Promise<boolean> {
    const nil = (v: string) => (v.trim() === '' ? null : v.trim());
    try {
      const next = await apiSend<CreatedBooking>('PUT', `/api/tos/bookings/${b.bookingId}`, {
        branchId: branch!.branchId,
        orderTypeCode,
        lineCode,
        rowVersion: b.rowVersion,
        agentCode, customerCode, forwarderCode,
        carrierRef: nil(carrierRef),
        customerRef: nil(customerRef),
        vesselCallId: vesselCallId || null,
        polPortCode: nil(polPortCode),
        podPortCode: nil(podPortCode),
        fpdPortCode: nil(fpdPortCode),
        cargoCategoryCode: nil(other.cargoCategoryCode),
        commodityCode: nil(other.commodityCode),
        validFrom: other.validFrom || null,
        validTo: other.validTo || null,
        // Step 4's remarks box is the booking's remarks; step 1 seeds it.
        remarks: nil(other.remarks || remarks),
        // Sent as soon as the API takes them; harmless until then because the
        // server ignores what it does not bind.
        allowLateGateIn,
        paperlessCode: nil(paperlessCode),
        totalQty: other.totalQty ? Number(other.totalQty) : null,
        uomCode: nil(other.uomCode),
        totalVolumeCbm: other.totalVolumeCbm ? Number(other.totalVolumeCbm) : null,
        totalWeightKg: other.totalWeightKg ? Number(other.totalWeightKg) : null,
        marksAndNos: nil(other.marksAndNos),
        specialInstruction: nil(other.specialInstruction),
      });
      setCreated(next.booking ?? b);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'The booking could not be updated.'));
      return false;
    }
  }

  /** Move on, saving whatever this step owns first. */
  async function advance() {
    setSaving(true);
    setError(null);
    try {
      if (step === 1) {
        const b = created ? (await putHeader(created) ? created : null) : await createHeader();
        if (!b) return;
        go(2);
        return;
      }
      if (!created) return;
      if (step === 2 || step === 4) {
        if (!await putHeader(created)) return;
      }
      if (step === 4) { router.push(`/bookings/${created.bookingId}`); return; }
      go(step + 1);
    } finally {
      setSaving(false);
    }
  }

  const go = (n: number) => { setStep(n); setReached(r => Math.max(r, n)); };

  /** Step 3's first half: what the booking asks for, before any box. */
  async function saveRequirements() {
    if (!created) return;
    setSaving(true);
    setError(null);
    try {
      const answer = await apiSend<{ booking?: { rowVersion: string }; requirements?: SavedLine[] }>(
        'PUT', `/api/tos/bookings/${created.bookingId}/requirements`,
        {
          rowVersion: created.rowVersion,
          requirements: filledLines.map(r => ({ equipmentTypeCode: r.equipmentTypeCode, qty: Number(r.qty) })),
        });
      setSavedLines(answer.requirements ?? []);
      // The PUT bumps the booking's rowVersion; keeping it means step 4's
      // header save does not come back 409.
      if (answer.booking?.rowVersion) setCreated({ ...created, rowVersion: answer.booking.rowVersion });
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'The equipment lines could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function createHeader(): Promise<CreatedBooking['booking'] | null> {
    if (!canCreate || !branch) return null;
    try {
      const made = await apiSend<CreatedBooking>('POST', '/api/tos/bookings', {
        branchId: branch.branchId,
        orderTypeCode,
        lineCode,
        agentCode,
        customerCode,
        forwarderCode,
        carrierRef: carrierRef.trim() || null,
        customerRef: customerRef.trim() || null,
        // Validity is not asked for on this form (his call, 2026-10-03). The
        // API still accepts it; a booking raised here simply has no expiry, so
        // the gate will not refuse the move on a date.
        validFrom: null,
        validTo: null,
        remarks: remarks.trim() || null,
        // HEADER FIRST (GATE_API_FOR_UI.md §16a): no lines yet. They are step 3,
        // against a booking that already has an order number — so a line the
        // server refuses never costs the clerk the whole form.
        requirements: [],
      }, idempotencyKey);
      setCreated(made.booking);
      return made.booking;
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'The booking could not be created.'));
      return null;
      setSaving(false);
    }
  }

  return (
    <div className="gecko-newbk-page">
      <div className="gecko-row gecko-mb-5" style={{ gap: 14 }}>
        <Link href="/bookings" className="gecko-newbk-back" aria-label="Back to bookings">
          <Icon name="arrowLeft" size={16} />
        </Link>
        <div>
          <h1 className="gecko-page-title">New Booking</h1>
          <div className="gecko-page-subtitle">
            Create the booking and what it asks for; containers and voyage are added after.
            {branch && <> · {branch.displayName}</>}
          </div>
        </div>
      </div>

      {/* A real bar now: step 1 creates the booking, so anything already
          reached can be walked back to. Nothing may be skipped ahead of the
          create, because steps 2-4 edit a booking that has to exist. */}
      <div className="gecko-newbk-steps">
        {[
          { n: 1, label: 'Booking Identity' },
          { n: 2, label: 'Voyage & Ports' },
          { n: 3, label: 'Containers' },
          { n: 4, label: 'Cargo & Docs' },
        ].map(s => (
          /* UNLOCKED 2026-10-03 so every step can be walked and reviewed before
             a booking exists. The SAVES are still gated: steps 2-4 write to a
             booking, so they do nothing until step 1 has run. Restore
             `disabled={s.n > reached}` on the button to re-lock the order. */
          <button
            key={s.n}
            type="button"
            onClick={() => setStep(s.n)}
            className={`gecko-newbk-step ${step === s.n ? 'gecko-newbk-step-on' : ''} ${s.n <= reached ? 'gecko-newbk-step-done' : ''}`}>
            <span className="gecko-newbk-step-n">{s.n}</span>
            <span>{s.label}</span>
          </button>
        ))}
        {created && (
          <span className="gecko-newbk-step-order">
            <Icon name="check" size={12} /> {created.orderNo}
          </span>
        )}
      </div>

      <div className="gecko-card gecko-newbk-card">
        {step === 1 && (<>

        {/* ── the work order type: everything else follows from it ─────────── */}
        <div className="gecko-newbk-head">
          <div className="gecko-row gecko-row-between gecko-row-baseline">
            <div className="gecko-eyebrow">Work order type</div>
            {showFilters && (
              <div className="gecko-row gecko-newbk-filters">
                <select className="gecko-select" aria-label="Direction"
                  value={direction} onChange={e => setDirection(e.target.value)}>
                  <option value="">Any direction</option>
                  {directions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className="gecko-select" aria-label="Booking type"
                  value={bookingTypeFilter} onChange={e => setBookingTypeFilter(e.target.value)}>
                  <option value="">Any booking type</option>
                  {usedBookingTypes.map(b => (
                    <option key={b} value={b}>{codeLabel(bookingTypes.values, b)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loadingTypes
            ? <div className="gecko-dash-placeholder">Loading…</div>
            : shown.length === 0
              ? <div className="gecko-dash-placeholder">
                  {active.length === 0
                    ? 'This depot has no active work order types. One is needed before a booking can be raised.'
                    : 'No order type matches these filters.'}
                </div>
              : (
                <div className="gecko-newbk-tiles">
                  {shown.map(t => (
                    <button
                      key={t.orderTypeCode}
                      type="button"
                      className={`gecko-newbk-tile ${orderTypeCode === t.orderTypeCode ? 'gecko-newbk-tile-on' : ''}`}
                      onClick={() => setOrderTypeCode(t.orderTypeCode)}
                    >
                      <div className="gecko-newbk-tile-code">{t.orderTypeCode}</div>
                      <div className="gecko-newbk-tile-desc">{t.descriptionEn}</div>
                      <div className="gecko-newbk-tile-meta">
                        {[t.directionCode, t.serviceCode, t.cargoClassCode].filter(Boolean).join(' · ')}
                        {t.bookingTypeCode && <> · {codeLabel(bookingTypes.values, t.bookingTypeCode)}</>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
          {fieldError('orderTypeCode') && <div className="gecko-field-error">{fieldError('orderTypeCode')}</div>}
        </div>

        </>)}

        <div className="gecko-newbk-body">

          {step === 1 && (<>
          {/* ── who ───────────────────────────────────────────────────────── */}
          <div className="gecko-newbk-grid">
            <FieldGroup label="Shipping line" required
              hint="Whose box it is. The gate and the tariff both resolve through it."
              error={fieldError('lineCode')}>
              <PartyPicker role="SHIPPING_LINE" value={lineCode} onChange={setLineCode}
                placeholder="Search line code or name…" error={fieldError('lineCode')} />
            </FieldGroup>

            <FieldGroup label="Agent" hint="The line's agent, when one acts for them."
              error={fieldError('agentCode')}>
              <PartyPicker role="SHIPPING_LINE" value={agentCode} onChange={setAgentCode}
                placeholder="Search agent…" error={fieldError('agentCode')} />
            </FieldGroup>

            <FieldGroup label="Customer" hint="Who the depot bills."
              error={fieldError('customerCode')}>
              <PartyPicker role="CUSTOMER" value={customerCode} onChange={setCustomerCode}
                placeholder="Search customer…" error={fieldError('customerCode')} />
            </FieldGroup>

            {showForwarder || forwarderCode ? (
              <FieldGroup label="Freight forwarder" error={fieldError('forwarderCode')}>
                <PartyPicker role="FORWARDER" value={forwarderCode} onChange={setForwarderCode}
                  placeholder="Search forwarder…" error={fieldError('forwarderCode')} />
              </FieldGroup>
            ) : (
              <div className="gecko-form-group gecko-newbk-addfwd">
                <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm"
                  onClick={() => setShowForwarder(true)}>
                  <Icon name="plus" size={13} /> Add freight forwarder
                </button>
              </div>
            )}
          </div>

          {/* ── references ───────────────────────────────────────────────── */}
          <div className="gecko-newbk-grid">
            {/* The line's own number for this booking. Vector calls it the
                Booking / BL No, and so does every clerk, so the label does too. */}
            <FieldGroup label="Booking No / BL No" hint="The line's booking or B/L number."
              error={fieldError('carrierRef')}>
              <input className="gecko-input gecko-mono" value={carrierRef} placeholder="e.g. EGLV149602390729"
                onChange={e => setCarrierRef(e.target.value.toUpperCase())} />
            </FieldGroup>
            <FieldGroup label="Sub Booking No / BL No" error={fieldError('customerRef')}>
              <input className="gecko-input" value={customerRef} placeholder="Optional"
                onChange={e => setCustomerRef(e.target.value)} />
            </FieldGroup>
          </div>


          <FieldGroup label="Remarks" error={fieldError('remarks')}>
            <input className="gecko-input" value={remarks} placeholder="Optional"
              onChange={e => setRemarks(e.target.value)} />
          </FieldGroup>

          {duplicate ? (
            <div className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
              <Icon name="alertCircle" size={18} />
              <div>
                <div>That booking already exists: <strong>{duplicate.existingOrderNo}</strong></div>
                <div className="gecko-cell-meta">
                  Carrier reference {duplicate.carrierRef} is already on it at this depot.
                </div>
                <Link href={`/bookings/${duplicate.existingBookingId}`} className="gecko-link">
                  Open {duplicate.existingOrderNo} →
                </Link>
              </div>
            </div>
          ) : error && !error.forField('orderTypeCode') && (
            <div className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
              <Icon name="alertCircle" size={18} />
              <div>
                <div>{error.title}</div>
                {error.status !== 400 && error.explanation && (
                  <div className="gecko-cell-meta">{error.explanation}</div>
                )}
              </div>
            </div>
          )}
        </>)}

        {step === 2 && (
          <VoyagePanel
            bookingId={created?.bookingId ?? null}
            lineCode={lineCode || null}
            calls={calls ?? []}
            vesselCallId={vesselCallId}
            onVesselCall={setVesselCallId}
            polPortCode={polPortCode}
            podPortCode={podPortCode}
            fpdPortCode={fpdPortCode}
            onPort={(which, v) => (which === 'pol' ? setPol(v) : which === 'pod' ? setPod(v) : setFpd(v))}
            allowLateGateIn={allowLateGateIn}
            onAllowLate={setAllowLate}
            paperlessCode={paperlessCode}
            onPaperless={setPaperless}
            fieldError={fieldError} />
        )}

        {step === 3 && (
          <div className="gecko-stack">
            <div className="gecko-eyebrow">Containers</div>
            <div className="gecko-page-subtitle">
              First what the booking asks for, then the boxes themselves. The boxes save as you type.
            </div>
          {/* ── what it asks for ──────────────────────────────────────────── */}
          <div>
            <div className="gecko-eyebrow gecko-mb-3">What this booking asks for</div>
            <div className="gecko-stack gecko-stack-sm">
              {lines.map((row, i) => (
                <div key={i} className="gecko-newbk-reqrow">
                  <FieldGroup label={i === 0 ? 'Equipment' : ''} required={i === 0}
                    error={fieldError(`requirements[${i}].equipmentTypeCode`)}>
                    <select className="gecko-select" value={row.equipmentTypeCode}
                      onChange={e => setLine(i, { equipmentTypeCode: e.target.value })}>
                      <option value="">Choose…</option>
                      {(equipment ?? []).filter(t => t.isActive).map(t => (
                        <option key={t.equipmentTypeId} value={t.typeCode}>{t.typeCode} — {t.descriptionEn}</option>
                      ))}
                    </select>
                  </FieldGroup>
                  <FieldGroup label={i === 0 ? 'How many' : ''} required={i === 0}
                    error={fieldError(`requirements[${i}].qty`)}>
                    <input className="gecko-input" type="number" min={1} value={row.qty}
                      onChange={e => setLine(i, { qty: e.target.value })} />
                  </FieldGroup>
                  <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                    aria-label="Remove this line" disabled={lines.length === 1}
                    onClick={() => setLines(rs => rs.filter((_, j) => j !== i))}>
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="gecko-row gecko-row-between gecko-mt-3">
              <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm"
                onClick={() => setLines(rs => [...rs, { equipmentTypeCode: '', qty: '1' }])}>
                <Icon name="plus" size={13} /> Another equipment type
              </button>
              <span className="gecko-cell-meta">
                The boxes themselves are assigned later — they need not be known now.
              </span>
            </div>
            {fieldError('requirements') && <div className="gecko-field-error">{fieldError('requirements')}</div>}
          </div>
            <div className="gecko-row" style={{ gap: 10 }}>
              <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm"
                disabled={saving || !created || filledLines.length === 0} onClick={() => void saveRequirements()}>
                <Icon name="save" size={14} /> {saving ? 'Saving…' : 'Save equipment lines'}
              </button>
              {linesSaved && <span className="gecko-cell-meta">Saved — now add the boxes below.</span>}
            </div>

            {/* The boxes need the lines to exist first: the API answers 409
                "has no requirement lines yet" until they do. */}
            {created && linesSaved ? (
              <ContainerEntryGrid
                bookingId={created.bookingId}
                directionCode={selected?.directionCode ?? null}
                requirements={savedLines}
                onSaved={() => {}} />
            ) : (
              <div className="gecko-cell-meta">
                {created
                  ? 'Save the equipment lines to start entering boxes.'
                  : 'The box grid needs a booking: create it on step 1 first. Everything above is what it will look like.'}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <OtherInfoPanel
            value={other}
            onChange={patch => setOther(o => ({ ...o, ...patch }))}
            fieldError={fieldError} />
        )}

        </div>

        <div className="gecko-newbk-foot">
          <div className="gecko-page-subtitle">
            {step === 1 && (selected
              ? <>Creates a <strong>{selected.orderTypeCode}</strong> booking at {branch?.displayName ?? 'this depot'}. You stay here and carry on to the voyage.</>
              : missing)}
            {step === 2 && (needsCall && !vesselCallId
              ? 'This work order type needs a vessel call.'
              : <>Saved against <strong>{created?.orderNo}</strong>.</>)}
            {step === 3 && <>Boxes save themselves as you type. <strong>{created?.orderNo}</strong></>}
            {step === 4 && <>Finishing opens <strong>{created?.orderNo}</strong>.</>}
          </div>
          <div className="gecko-row" style={{ gap: 10 }}>
            {step > 1
              ? <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={saving} onClick={() => setStep(step - 1)}>
                  <Icon name="arrowLeft" size={14} /> Back
                </button>
              : <Link href="/bookings" className="gecko-btn gecko-btn-outline gecko-btn-sm">Cancel</Link>}
            {/* The booking already exists from step 2 on, so leaving part-way
                loses nothing — the clerk can reopen it from the register. */}
            {created && step > 1 && step < 4 && (
              <Link href={`/bookings/${created.bookingId}`} className="gecko-btn gecko-btn-ghost gecko-btn-sm">
                Finish later
              </Link>
            )}
            <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm"
              onClick={() => void advance()}
              disabled={saving
                || (step === 1 && !canCreate)
                || (step === 2 && needsCall && !vesselCallId)
                || (step === 3 && !linesSaved)}>
              {saving ? 'Saving…' : step === 1 ? <>Create booking <Icon name="arrowRight" size={14} /></>
                : step === 4 ? <>Finish <Icon name="check" size={14} /></>
                : <>Save &amp; continue <Icon name="arrowRight" size={14} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
