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
import { DateField } from '@/components/ui/DateField';
import { PartyPicker } from '@/app/tariff/_components/PartyPicker';
import { apiSend, newIdempotencyKey } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useApiList } from '@/lib/api/use-api';
import { useFacility } from '@/lib/api/facility';
import { useCodeList, codeLabel } from '@/lib/api/lookups';

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

interface CreatedBooking { bookingId: string; orderNo: string }

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
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [lineCode, setLineCode] = useState<string | null>(null);
  const [agentCode, setAgentCode] = useState<string | null>(null);
  const [customerCode, setCustomerCode] = useState<string | null>(null);
  const [forwarderCode, setForwarderCode] = useState<string | null>(null);
  const [showForwarder, setShowForwarder] = useState(false);
  const [equipmentTypeCode, setEquipmentTypeCode] = useState('');
  const [qty, setQty] = useState('1');
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

  const selected = shown.find(t => t.orderTypeCode === orderTypeCode)
    ?? active.find(t => t.orderTypeCode === orderTypeCode)
    ?? null;

  // The API's three: branch, order type, line. Plus one requirement, or it refuses.
  const canCreate = !!branch && !!orderTypeCode && !!lineCode && !!equipmentTypeCode
    && Number(qty) > 0 && !saving;

  const missing = !branch ? 'No depot is assigned to this account.'
    : !orderTypeCode ? 'Choose a work order type.'
    : !lineCode ? 'Choose the shipping line.'
    : !equipmentTypeCode ? 'Choose the equipment and how many.'
    : Number(qty) > 0 ? null : 'How many boxes?';

  async function create() {
    if (!canCreate || !branch) return;
    setSaving(true);
    setError(null);
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
        validFrom: validFrom || null,
        validTo: validTo || null,
        remarks: remarks.trim() || null,
        // The promise. The boxes themselves are assigned on the detail page,
        // one transaction each, which is what survives a dropped connection.
        requirements: [{ equipmentTypeCode, qty: Number(qty) }],
      }, idempotencyKey);
      router.push(`/bookings/${made.bookingId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'The booking could not be created.'));
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

      <div className="gecko-newbk-steps">
        {[
          { n: 1, label: 'Booking Identity', active: true },
          { n: 2, label: 'Voyage & Ports', active: false },
          { n: 3, label: 'Containers', active: false },
          { n: 4, label: 'Cargo & Docs', active: false },
        ].map(s => (
          <div key={s.n} className={`gecko-newbk-step ${s.active ? 'gecko-newbk-step-on' : ''}`}>
            <span className="gecko-newbk-step-n">{s.n}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="gecko-card gecko-newbk-card">

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

        <div className="gecko-newbk-body">

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

          {/* ── what it asks for ──────────────────────────────────────────── */}
          <div>
            <div className="gecko-eyebrow gecko-mb-3">What this booking asks for</div>
            <div className="gecko-newbk-grid">
              <FieldGroup label="Equipment" required error={fieldError('requirements[0].equipmentTypeCode')}>
                <select className="gecko-select" value={equipmentTypeCode}
                  onChange={e => setEquipmentTypeCode(e.target.value)}>
                  <option value="">Choose…</option>
                  {(equipment ?? []).filter(t => t.isActive).map(t => (
                    <option key={t.equipmentTypeId} value={t.typeCode}>{t.typeCode} — {t.descriptionEn}</option>
                  ))}
                </select>
              </FieldGroup>
              <FieldGroup label="How many" required
                hint="The boxes themselves are assigned later — they need not be known now."
                error={fieldError('requirements[0].qty')}>
                <input className="gecko-input" type="number" min={1} value={qty}
                  onChange={e => setQty(e.target.value)} />
              </FieldGroup>
            </div>
            {fieldError('requirements') && <div className="gecko-field-error">{fieldError('requirements')}</div>}
          </div>

          {/* ── references and validity ───────────────────────────────────── */}
          <div className="gecko-newbk-grid">
            <FieldGroup label="Carrier reference" hint="The line's booking or B/L number."
              error={fieldError('carrierRef')}>
              <input className="gecko-input gecko-mono" value={carrierRef} placeholder="e.g. EGLV149602390729"
                onChange={e => setCarrierRef(e.target.value.toUpperCase())} />
            </FieldGroup>
            <FieldGroup label="Customer reference" error={fieldError('customerRef')}>
              <input className="gecko-input" value={customerRef} placeholder="Optional"
                onChange={e => setCustomerRef(e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Valid from" error={fieldError('validFrom')}>
              <DateField value={validFrom} onChange={setValidFrom} />
            </FieldGroup>
            <FieldGroup label="Valid to" hint="After this the gate refuses the move."
              error={fieldError('validTo')}>
              <DateField value={validTo} onChange={setValidTo} />
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
        </div>

        <div className="gecko-newbk-foot">
          <div className="gecko-page-subtitle">
            {selected
              ? <>Creates a <strong>{selected.orderTypeCode}</strong> booking at {branch?.displayName ?? 'this depot'} — containers and voyage are added next.</>
              : missing}
          </div>
          <div className="gecko-row" style={{ gap: 10 }}>
            <Link href="/bookings" className="gecko-btn gecko-btn-outline gecko-btn-sm">Cancel</Link>
            {/* Disabled while in flight: the API has no idempotency key yet, so a
                second click would raise a second booking. */}
            <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm"
              onClick={create} disabled={!canCreate}>
              {saving ? 'Creating…' : <>Create booking <Icon name="arrowRight" size={14} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
