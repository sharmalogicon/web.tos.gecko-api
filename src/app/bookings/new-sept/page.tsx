"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useApi, useApiList } from '@/lib/api/use-api';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';

/**
 * LIVE: POST /api/tos/bookings (gecko_tos batch B).
 *
 * The order type is the whole story: it sets direction, booking type and cargo
 * class, and its steps decide whether a vessel call is required (any step with
 * the MDM gate rule "require vessel/voyage" — EXP CY/CY's FULL_IN, for one).
 * The depot's booking number (BK-SCT-LCB01-2609-00017) is issued by the server
 * from the TOS number series; the line's own number goes in Carrier Ref.
 *
 * What the mock had and the API does not, so it is gone rather than faked:
 *  - the hard-coded EXPORT / IMPORT order-type catalogue and its movement lists
 *    — order types now come from master data, with their real steps.
 *  - booking date — the server stamps the creation time; the release window is
 *    Valid from / Valid to (branch-local dates, what EXPIRED is judged on).
 *  - Sub-B/L / sub-booking numbers and party NAME search — parties are codes the
 *    server checks for their role (a line must be a shipping line, a customer a
 *    customer). There is no party list endpoint yet, so codes are typed.
 *  - vessel / voyage typed by hand — the booking points at a vessel call on the
 *    schedule, and the line's voyage on that call is taken from there.
 */

interface OrderType { orderTypeCode: string; descriptionEn: string; directionCode: string; serviceCode: string | null; isActive: boolean }
interface OrderTypeDetail { orderType: OrderType; movements: { movementCode: string; sequenceNo: number; requireVesselVoyage: boolean }[] }
interface Branch { branchId: string; branchCode: string; displayName: string; isActive: boolean }
interface EquipmentType { typeCode: string; descriptionEn: string; isReefer: boolean; isActive: boolean }
interface Grade { gradeCode: string; descriptionEn: string; isActive: boolean }
interface CallSummary { vesselCallId: string; callRef: string; etd: string; status: string; lines: string[] }

interface ReqRow { equipmentTypeCode: string; qty: string; reeferSetTempC: string; minGradeCode: string; imdgClass: string; unNumber: string; declaredGrossWeightKg: string; remarks: string }
interface BoxRow { containerNo: string; lineNo: string; declaredSealNo: string; declaredVgmKg: string }

const EMPTY_REQ: ReqRow = { equipmentTypeCode: '', qty: '1', reeferSetTempC: '', minGradeCode: '', imdgClass: '', unNumber: '', declaredGrossWeightKg: '', remarks: '' };
const EMPTY_BOX: BoxRow = { containerNo: '', lineNo: '1', declaredSealNo: '', declaredVgmKg: '' };

const num = (v: string) => (v.trim() === '' ? null : Number(v));
const txt = (v: string) => (v.trim() === '' ? null : v.trim());

// ── module-level pieces (never declared inside render: inputs would lose focus) ──

function Field({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="gecko-form-group">
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
      {error
        ? <div style={{ fontSize: 11, color: 'var(--gecko-error-600)', marginTop: 3 }}>{error}</div>
        : hint && <div className="gecko-helper-text" style={{ fontSize: 10.5 }}>{hint}</div>}
    </div>
  );
}

function Section({ title, icon, children, action }: { title: string; icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="gecko-card" style={{ padding: 20 }}>
      <div className="gecko-row gecko-row-between" style={{ marginBottom: 14 }}>
        <div className="gecko-row" style={{ gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
          <Icon name={icon} size={16} style={{ color: 'var(--gecko-primary-600)' }} /> {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function RowError({ message }: { message?: string }) {
  return message ? <div style={{ fontSize: 11, color: 'var(--gecko-error-600)', marginTop: 4 }}>{message}</div> : null;
}

export default function NewBookingPage() {
  const router = useRouter();

  const [branchId, setBranchId] = useState('');
  const [orderTypeCode, setOrderTypeCode] = useState('');
  const [lineCode, setLineCode] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [forwarderCode, setForwarderCode] = useState('');
  const [haulierCode, setHaulierCode] = useState('');
  const [vesselCallId, setVesselCallId] = useState('');
  const [polPortCode, setPol] = useState('');
  const [podPortCode, setPod] = useState('');
  const [fpdPortCode, setFpd] = useState('');
  const [cargoCategoryCode, setCargoCategory] = useState('');
  const [commodityCode, setCommodity] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [carrierRef, setCarrierRef] = useState('');
  const [customerRef, setCustomerRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [reqs, setReqs] = useState<ReqRow[]>([{ ...EMPTY_REQ }]);
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // server row index → form row index, for rows skipped when blank
  const [boxIndexMap, setBoxIndexMap] = useState<number[]>([]);

  const { data: branches } = useApiList<Branch>('/api/branches?pageSize=100');
  const { data: orderTypes } = useApiList<OrderType>('/api/master/order-types?pageSize=200');
  const { data: types } = useApiList<EquipmentType>('/api/master/equipment-types?pageSize=200');
  const { data: grades } = useApi<Grade[]>('/api/master/container-grades');
  const callsPath = useMemo(() => {
    const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
    return `/api/tos/vessel-calls?from=${encodeURIComponent(from)}&pageSize=200`;
  }, []);
  const { data: calls } = useApiList<CallSummary>(callsPath);
  const { data: otDetail } = useApi<OrderTypeDetail>(orderTypeCode ? `/api/master/order-types/${encodeURIComponent(orderTypeCode)}` : null);

  const detail = otDetail && otDetail.orderType.orderTypeCode === orderTypeCode ? otDetail : null;
  const vesselSteps = detail?.movements.filter(m => m.requireVesselVoyage).map(m => m.movementCode) ?? [];
  const needsCall = vesselSteps.length > 0;
  const selectedOt = (orderTypes ?? []).find(o => o.orderTypeCode === orderTypeCode);
  const liveCalls = (calls ?? []).filter(c => c.status !== 'CANCELLED');
  const isReefer = (code: string) => (types ?? []).find(t => t.typeCode === code)?.isReefer ?? false;

  const fe = (name: string) => error?.forField(name);
  const boxErr = (formIndex: number, field?: string) => {
    const serverIndex = boxIndexMap.indexOf(formIndex);
    if (serverIndex < 0) return undefined;
    return field ? error?.forField(`containers[${serverIndex}].${field}`) : error?.forField(`containers[${serverIndex}]`);
  };

  const setReq = (i: number, patch: Partial<ReqRow>) => setReqs(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setBox = (i: number, patch: Partial<BoxRow>) => setBoxes(bs => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const canSubmit = !saving && branchId && orderTypeCode && lineCode.trim() && reqs.length > 0 && (!needsCall || vesselCallId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const sentBoxes = boxes.map((b, i) => ({ b, i })).filter(x => x.b.containerNo.trim() !== '');
    setBoxIndexMap(sentBoxes.map(x => x.i));
    const body = {
      branchId,
      orderTypeCode,
      lineCode: lineCode.trim(),
      carrierRef: txt(carrierRef),
      agentCode: txt(agentCode),
      customerCode: txt(customerCode),
      forwarderCode: txt(forwarderCode),
      haulierCode: txt(haulierCode),
      vesselCallId: vesselCallId || null,
      polPortCode: txt(polPortCode),
      podPortCode: txt(podPortCode),
      fpdPortCode: txt(fpdPortCode),
      cargoCategoryCode: txt(cargoCategoryCode),
      commodityCode: txt(commodityCode),
      validFrom: validFrom || null,
      validTo: validTo || null,
      customerRef: txt(customerRef),
      remarks: txt(remarks),
      requirements: reqs.map((r, i) => ({
        lineNo: i + 1,
        equipmentTypeCode: r.equipmentTypeCode,
        qty: Number(r.qty) || 0,
        reeferSetTempC: isReefer(r.equipmentTypeCode) ? num(r.reeferSetTempC) : null,
        minGradeCode: txt(r.minGradeCode),
        imdgClass: txt(r.imdgClass),
        unNumber: txt(r.unNumber),
        declaredGrossWeightKg: num(r.declaredGrossWeightKg),
        remarks: txt(r.remarks),
      })),
      containers: sentBoxes.map(({ b }) => ({
        containerNo: b.containerNo.trim(),
        lineNo: Number(b.lineNo) || null,
        declaredSealNo: txt(b.declaredSealNo),
        declaredVgmKg: num(b.declaredVgmKg),
      })),
    };

    setSaving(true);
    setError(null);
    try {
      const created = await apiSend<{ booking: { bookingId: string } }>('POST', '/api/tos/bookings', body);
      router.push(`/bookings/${created.booking.bookingId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'Could not reach the Gecko API.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const errorCount = error ? Object.keys(error.fieldErrors).length : 0;

  return (
    <form className="gecko-stack" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }} onSubmit={submit} noValidate>

      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <div className="gecko-row" style={{ gap: 8 }}>
            <Link href="/bookings" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="chevronLeft" size={14} /> Bookings</Link>
            <h1 className="gecko-page-title">New Booking</h1>
          </div>
          <p className="gecko-page-subtitle">The depot number is issued on save. Everything here is checked against master data by the server.</p>
        </div>
        <div className="gecko-page-header-actions gecko-row">
          <Link href="/bookings" className="gecko-btn gecko-btn-outline gecko-btn-sm">Cancel</Link>
          <button type="submit" className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!canSubmit} style={!canSubmit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            <Icon name="save" size={14} /> {saving ? 'Creating…' : 'Create Booking'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <Icon name="alertCircle" size={16} />
          <div>
            <div style={{ fontWeight: 700 }}>{error.status === 409 ? 'Refused' : 'The booking was not created'}</div>
            <div>{error.message}{errorCount > 1 ? ` (${errorCount} fields need attention — marked below)` : ''}</div>
          </div>
        </div>
      )}

      <Section title="Order" icon="clipboardList">
        <div className="gecko-grid-3" style={{ gap: 16 }}>
          <Field label="Depot" required error={fe('branchId')}>
            <select className="gecko-input" value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">— choose the depot —</option>
              {(branches ?? []).filter(b => b.isActive).map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
            </select>
          </Field>
          <Field label="Order type" required error={fe('orderTypeCode')}
            hint={selectedOt ? `${selectedOt.directionCode}${selectedOt.serviceCode ? ` · ${selectedOt.serviceCode}` : ''} · ${selectedOt.descriptionEn}` : undefined}>
            <select className="gecko-input" value={orderTypeCode} onChange={e => { setOrderTypeCode(e.target.value); }}>
              <option value="">— choose —</option>
              {(orderTypes ?? []).filter(o => o.isActive).map(o => (
                <option key={o.orderTypeCode} value={o.orderTypeCode}>{o.orderTypeCode} — {o.directionCode}{o.serviceCode ? ` · ${o.serviceCode}` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Carrier ref" hint="The line's booking / D/O / release number — what the driver quotes" error={fe('carrierRef')}>
            <input className="gecko-input gecko-text-mono" maxLength={40} value={carrierRef} onChange={e => setCarrierRef(e.target.value.toUpperCase())} />
          </Field>
        </div>
        {detail && (
          <div className="gecko-row gecko-row-wrap gecko-mt-3" style={{ gap: 6, fontSize: 11 }}>
            <span className="gecko-cell-meta" style={{ fontWeight: 600 }}>Each box will go through:</span>
            {detail.movements.map(m => (
              <span key={m.sequenceNo} className="gecko-badge gecko-badge-xs gecko-badge-gray gecko-text-mono">
                {m.sequenceNo}. {m.movementCode}{m.requireVesselVoyage ? ' · needs vessel' : ''}
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Parties" icon="users">
        <div className="gecko-grid-3" style={{ gap: 16 }}>
          <Field label="Line" required hint="Party code of the shipping line, e.g. MAEU" error={fe('lineCode')}>
            <input className="gecko-input gecko-text-mono" maxLength={30} value={lineCode} onChange={e => setLineCode(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Customer" hint="Shipper (export) / consignee (import)" error={fe('customerCode')}>
            <input className="gecko-input gecko-text-mono" maxLength={30} value={customerCode} onChange={e => setCustomerCode(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Agent" error={fe('agentCode')}>
            <input className="gecko-input gecko-text-mono" maxLength={30} value={agentCode} onChange={e => setAgentCode(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Forwarder" error={fe('forwarderCode')}>
            <input className="gecko-input gecko-text-mono" maxLength={30} value={forwarderCode} onChange={e => setForwarderCode(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Nominated haulier" error={fe('haulierCode')}>
            <input className="gecko-input gecko-text-mono" maxLength={30} value={haulierCode} onChange={e => setHaulierCode(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Customer ref" hint="The shipper's own PO / job number" error={fe('customerRef')}>
            <input className="gecko-input" maxLength={50} value={customerRef} onChange={e => setCustomerRef(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Vessel & routing" icon="ship">
        <div className="gecko-grid-3" style={{ gap: 16 }}>
          <div style={{ gridColumn: 'span 3' }}>
            <Field label="Vessel call" required={needsCall} error={fe('vesselCallId')}
              hint={needsCall
                ? `Required: ${orderTypeCode}'s ${vesselSteps.join(', ')} step needs the vessel/voyage. The line must be on the call.`
                : 'Optional for this order type. The line\'s voyage on the call is used; nothing is copied from it.'}>
              <select className="gecko-input" value={vesselCallId} onChange={e => setVesselCallId(e.target.value)}>
                <option value="">{needsCall ? '— choose the call —' : '— none —'}</option>
                {liveCalls.map(c => (
                  <option key={c.vesselCallId} value={c.vesselCallId}>
                    {c.callRef} · ETD {new Date(c.etd).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })} · {c.lines.join(', ') || 'no lines'}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Port of loading" error={fe('polPortCode')}>
            <input className="gecko-input gecko-text-mono" maxLength={20} placeholder="THLCH" value={polPortCode} onChange={e => setPol(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Port of discharge" error={fe('podPortCode')}>
            <input className="gecko-input gecko-text-mono" maxLength={20} placeholder="SGSIN" value={podPortCode} onChange={e => setPod(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Final destination" error={fe('fpdPortCode')}>
            <input className="gecko-input gecko-text-mono" maxLength={20} value={fpdPortCode} onChange={e => setFpd(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Cargo category" hint="A price axis (CARGO_CATEGORY code list)" error={fe('cargoCategoryCode')}>
            <input className="gecko-input gecko-text-mono" maxLength={20} value={cargoCategoryCode} onChange={e => setCargoCategory(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Commodity" error={fe('commodityCode')}>
            <input className="gecko-input gecko-text-mono" maxLength={30} value={commodityCode} onChange={e => setCommodity(e.target.value.toUpperCase())} />
          </Field>
          <div />
          <Field label="Valid from" error={fe('validFrom')}>
            <input type="date" className="gecko-input" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
          </Field>
          <Field label="Valid to" hint="Depot-local date; after it the release is EXPIRED and the gate refuses it" error={fe('validTo')}>
            <input type="date" className="gecko-input" value={validTo} onChange={e => setValidTo(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Equipment required" icon="box"
        action={<button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setReqs(rs => [...rs, { ...EMPTY_REQ }])}><Icon name="plus" size={13} /> Add line</button>}>
        {fe('requirements') && <RowError message={fe('requirements')} />}
        <div className="gecko-stack" style={{ gap: 10 }}>
          {reqs.map((r, i) => {
            const reefer = isReefer(r.equipmentTypeCode);
            return (
              <div key={i} style={{ border: '1px solid var(--gecko-border)', borderRadius: 8, padding: 12, background: 'var(--gecko-bg-subtle)' }}>
                <div className="gecko-row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', paddingTop: 30, width: 24 }}>{i + 1}</div>
                  <div style={{ width: 200 }}>
                    <Field label="Equipment type" required error={fe(`requirements[${i}].equipmentTypeCode`)}>
                      <select className="gecko-input" value={r.equipmentTypeCode} onChange={e => setReq(i, { equipmentTypeCode: e.target.value })}>
                        <option value="">— type —</option>
                        {(types ?? []).filter(t => t.isActive).map(t => <option key={t.typeCode} value={t.typeCode}>{t.typeCode} · {t.descriptionEn}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ width: 80 }}>
                    <Field label="Qty" required error={fe(`requirements[${i}].qty`)}>
                      <input type="number" min={1} max={999} className="gecko-input" value={r.qty} onChange={e => setReq(i, { qty: e.target.value })} />
                    </Field>
                  </div>
                  {reefer && (
                    <div style={{ width: 110 }}>
                      <Field label="Set temp °C" required error={fe(`requirements[${i}].reeferSetTempC`)}>
                        <input type="number" step="0.1" className="gecko-input" value={r.reeferSetTempC} onChange={e => setReq(i, { reeferSetTempC: e.target.value })} />
                      </Field>
                    </div>
                  )}
                  <div style={{ width: 120 }}>
                    <Field label="Min grade" error={fe(`requirements[${i}].minGradeCode`)}>
                      <select className="gecko-input" value={r.minGradeCode} onChange={e => setReq(i, { minGradeCode: e.target.value })}>
                        <option value="">any</option>
                        {(grades ?? []).filter(g => g.isActive).map(g => <option key={g.gradeCode} value={g.gradeCode} title={g.descriptionEn}>{g.gradeCode}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ width: 90 }}>
                    <Field label="IMDG" error={fe(`requirements[${i}].imdgClass`)}>
                      <input className="gecko-input gecko-text-mono" maxLength={10} value={r.imdgClass} onChange={e => setReq(i, { imdgClass: e.target.value })} />
                    </Field>
                  </div>
                  <div style={{ width: 90 }}>
                    <Field label="UN no." error={fe(`requirements[${i}].unNumber`)}>
                      <input className="gecko-input gecko-text-mono" maxLength={4} value={r.unNumber} onChange={e => setReq(i, { unNumber: e.target.value })} />
                    </Field>
                  </div>
                  <div style={{ width: 130 }}>
                    <Field label="Gross kg" hint="Leave blank if unknown" error={fe(`requirements[${i}].declaredGrossWeightKg`)}>
                      <input type="number" min={1} className="gecko-input" value={r.declaredGrossWeightKg} onChange={e => setReq(i, { declaredGrossWeightKg: e.target.value })} />
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <Field label="Remarks" error={fe(`requirements[${i}].remarks`)}>
                      <input className="gecko-input" maxLength={500} value={r.remarks} onChange={e => setReq(i, { remarks: e.target.value })} />
                    </Field>
                  </div>
                  <button type="button" aria-label={`Remove line ${i + 1}`} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ marginTop: 26 }}
                    disabled={reqs.length === 1}
                    onClick={() => { setReqs(rs => rs.filter((_, j) => j !== i)); setBoxes(bs => bs.map(b => (Number(b.lineNo) > i + 1 ? { ...b, lineNo: String(Number(b.lineNo) - 1) } : b))); }}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                <RowError message={fe(`requirements[${i}]`)} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Pre-advised boxes (optional)" icon="clipboardList"
        action={<button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setBoxes(bs => [...bs, { ...EMPTY_BOX }])}><Icon name="plus" size={13} /> Add box</button>}>
        <div className="gecko-cell-meta" style={{ marginBottom: 10 }}>
          An import D/O lists its boxes; an empty release usually picks them at the gate. Each box gets the order type's steps as it is assigned.
        </div>
        {boxes.length === 0 ? (
          <div className="gecko-cell-meta" style={{ textAlign: 'center', padding: 12 }}>No boxes named yet.</div>
        ) : (
          <div className="gecko-stack" style={{ gap: 8 }}>
            {boxes.map((b, i) => (
              <div key={i}>
                <div className="gecko-row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ width: 170 }}>
                    <Field label="Container no." required error={boxErr(i, 'containerNo')}>
                      <input className="gecko-input gecko-text-mono" maxLength={13} placeholder="MSKU1234565" value={b.containerNo}
                        onChange={e => setBox(i, { containerNo: e.target.value.toUpperCase() })} />
                    </Field>
                  </div>
                  <div style={{ width: 150 }}>
                    <Field label="Requirement line" error={boxErr(i, 'lineNo')}>
                      <select className="gecko-input" value={b.lineNo} onChange={e => setBox(i, { lineNo: e.target.value })}>
                        {reqs.map((r, j) => <option key={j} value={String(j + 1)}>{j + 1}. {r.equipmentTypeCode || '—'}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ width: 150 }}>
                    <Field label="Declared seal" error={boxErr(i, 'declaredSealNo')}>
                      <input className="gecko-input gecko-text-mono" maxLength={20} value={b.declaredSealNo} onChange={e => setBox(i, { declaredSealNo: e.target.value.toUpperCase() })} />
                    </Field>
                  </div>
                  <div style={{ width: 130 }}>
                    <Field label="Declared VGM kg" error={boxErr(i, 'declaredVgmKg')}>
                      <input type="number" min={1} className="gecko-input" value={b.declaredVgmKg} onChange={e => setBox(i, { declaredVgmKg: e.target.value })} />
                    </Field>
                  </div>
                  <button type="button" aria-label={`Remove box ${i + 1}`} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ marginTop: 26 }}
                    onClick={() => setBoxes(bs => bs.filter((_, j) => j !== i))}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                <RowError message={boxErr(i)} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Remarks" icon="fileText">
        <textarea className="gecko-input" rows={3} maxLength={1000} value={remarks} onChange={e => setRemarks(e.target.value)} style={{ resize: 'vertical' }} />
        <RowError message={fe('remarks')} />
      </Section>
    </form>
  );
}
