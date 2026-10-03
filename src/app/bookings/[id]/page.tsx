"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/lib/api/use-api';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { defaultHandoverMode, handoverModeLabel, handoverModeText, handoverModesFor } from '@/lib/api/tos';

/**
 * LIVE against gecko_tos (booking.booking + equipment_requirement +
 * booking_container + movement_plan), batch B. The route param is the bookingId.
 *
 * Stored status is only what a person decided (OPEN / CANCELLED / CLOSED); the
 * progress badge is DERIVED (NOT_STARTED / IN_PROGRESS / COMPLETED, and EXPIRED
 * from the depot's own calendar). The booking POINTS at its vessel call and
 * copies nothing — ETD and cut-offs are read through the call (D-2).
 *
 * What the mock (bookings/EGLV149602390729) had and the API cannot back, so it
 * is gone rather than faked:
 *  - charges / invoice / payment tabs: prices are Revenue's, invoicing is Phase 6.
 *  - gate-in / gate-out timestamps, EIR numbers, truck plates, yard slots: there
 *    is no gate yet (Phase 5). A step is DONE only when a gate transaction says
 *    so; the step chain shows PENDING until then.
 *  - EDI message log (COPARN/CODECO): the EDI context is not built.
 *  - activity timeline / audit trail: temporal history exists in the database
 *    but no endpoint exposes it yet.
 *  - documents & attachments, cargo description per box, hold list: holds are
 *    batch C; attachments are Phase 5.
 */

interface Booking {
  bookingId: string; orderNo: string; branchId: string; branchCode: string | null; carrierRef: string | null;
  orderTypeCode: string; bookingTypeCode: string; directionCode: string; cargoClassCode: string;
  lineCode: string; agentCode: string | null; customerCode: string | null; forwarderCode: string | null; haulierCode: string | null;
  vesselCallId: string | null; callRef: string | null; vesselCode: string | null; etd: string | null; callStatus: string | null;
  voyageIn: string | null; voyageOut: string | null;
  polPortCode: string | null; podPortCode: string | null; fpdPortCode: string | null;
  cargoCategoryCode: string | null; commodityCode: string | null; validFrom: string | null; validTo: string | null;
  status: string; progress: string; cancelledAt: string | null; cancelReason: string | null; closedAt: string | null; closeReason: string | null;
  source: string; customerRef: string | null; remarks: string | null; createdAt: string; rowVersion: string;
}
interface Requirement {
  equipmentRequirementId: string; lineNo: number; equipmentTypeCode: string; qty: number; qtyAssigned: number; qtyCompleted: number;
  minGradeCode: string | null; reeferSetTempC: number | null; reeferVentPct: number | null; reeferHumidityPct: number | null;
  imdgClass: string | null; unNumber: string | null;
  oogOverHeightCm: number | null; oogOverWidthLeftCm: number | null; oogOverWidthRightCm: number | null;
  oogOverLengthFrontCm: number | null; oogOverLengthBackCm: number | null;
  declaredGrossWeightKg: number | null; remarks: string | null;
}
interface Step { movementPlanId: string; sequenceNo: number; movementCode: string; isRequired: boolean; status: string; gateTransactionId: string | null; skipReason: string | null }
interface Box {
  bookingContainerId: string; equipmentRequirementId: string; lineNo: number; containerNo: string; inRegistry: boolean; isCheckDigitValid: boolean;
  source: string; declaredSealNo: string | null; declaredVgmKg: number | null; assignedAt: string; endedAt: string | null; endReason: string | null;
  /** Vector's P/U or D/O mode. Fixed at assignment — unassign and assign again to change it. */
  handoverMode: string | null;
  steps: Step[];
}
interface Detail {
  booking: Booking; qtyRequired: number; qtyAssigned: number; qtyCompleted: number; stepsDone: number;
  requirements: Requirement[]; containers: Box[];
}

// ── vocab ─────────────────────────────────────────────────────────────────────

const PROGRESS: Record<string, { label: string; bg: string; text: string }> = {
  NOT_STARTED: { label: 'Not started', bg: '#F3F4F6', text: '#374151' },
  IN_PROGRESS: { label: 'In progress', bg: '#EFF6FF', text: '#1E40AF' },
  COMPLETED:   { label: 'Completed',   bg: '#F0FDF4', text: '#166534' },
  EXPIRED:     { label: 'Expired',     bg: '#FFFBEB', text: '#92400E' },
  CANCELLED:   { label: 'Cancelled',   bg: '#FEF2F2', text: '#991B1B' },
  CLOSED:      { label: 'Closed',      bg: '#F5F3FF', text: '#5B21B6' },
};
const STEP_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  PENDING:   { bg: '#F9FAFB', text: '#4B5563', border: '#D1D5DB' },
  DONE:      { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
  SKIPPED:   { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  CANCELLED: { bg: '#F3F4F6', text: '#9CA3AF', border: '#E5E7EB' },
};

const fmt = (iso: string | null) => iso
  ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  : '—';
const humanize = (s: string | null) => s ? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) : '—';
const errorOf = (e: unknown) => e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');

// ── small pieces ─────────────────────────────────────────────────────────────

function Pill({ bg, text, children, title }: { bg: string; text: string; children: React.ReactNode; title?: string }) {
  return <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: bg, color: text, whiteSpace: 'nowrap' }}>{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="gecko-eyebrow" style={{ marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--gecko-text-primary)', fontWeight: 500, overflowWrap: 'anywhere' }}>{children ?? '—'}</div>
    </div>
  );
}

function ErrorBox({ error }: { error: ApiError | null }) {
  if (!error) return null;
  const fields = Object.entries(error.fieldErrors);
  return (
    <div role="alert" className="gecko-alert gecko-alert-error" style={{ display: 'block' }}>
      <div className="gecko-row" style={{ gap: 8 }}><Icon name="alertCircle" size={15} /><strong>{error.message}</strong></div>
      {fields.length > 1 && (
        <ul style={{ margin: '6px 0 0 22px', padding: 0, fontSize: 12 }}>
          {fields.map(([k, v]) => <li key={k}><span className="gecko-text-mono">{k}</span>: {v.join(' ')}</li>)}
        </ul>
      )}
    </div>
  );
}

function StepChain({ steps }: { steps: Step[] }) {
  return (
    <div className="gecko-row gecko-row-wrap" style={{ gap: 4 }}>
      {steps.map((s, i) => {
        const c = STEP_COLOR[s.status] ?? STEP_COLOR.PENDING;
        return (
          <React.Fragment key={s.movementPlanId}>
            {i > 0 && <Icon name="chevronRight" size={11} style={{ color: 'var(--gecko-text-disabled)' }} />}
            <span
              title={`${s.sequenceNo}. ${s.movementCode} — ${s.status}${s.isRequired ? '' : ' (optional)'}${s.gateTransactionId ? ` · gate transaction ${s.gateTransactionId}` : ''}${s.skipReason ? ` · ${s.skipReason}` : ''}`}
              style={{
                fontSize: 10, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', padding: '2px 6px', borderRadius: 4,
                background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                textDecoration: s.status === 'CANCELLED' ? 'line-through' : undefined,
                borderStyle: s.isRequired ? 'solid' : 'dashed',
              }}>
              {s.status === 'DONE' && '✓ '}{s.movementCode}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Section({ title, icon, right, children }: { title: string; icon: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="gecko-table-card" style={{ borderRadius: 12 }}>
      <div className="gecko-row gecko-row-between" style={{ padding: '12px 18px', borderBottom: '1px solid var(--gecko-border)', gap: 10 }}>
        <div className="gecko-row" style={{ gap: 8 }}>
          <Icon name={icon} size={15} style={{ color: 'var(--gecko-primary-600)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ── assign form ──────────────────────────────────────────────────────────────

interface AssignRow { containerNo: string; lineNo: string; declaredSealNo: string; declaredVgmKg: string; handoverMode: string }
const EMPTY_ASSIGN: AssignRow = { containerNo: '', lineNo: '', declaredSealNo: '', declaredVgmKg: '', handoverMode: '' };

function AssignForm({ detail, onDone }: { detail: Detail; onDone: () => void }) {
  // Vector's P/U or D/O mode, per box. The list depends on the booking's
  // direction — a value from another direction's list is a 400.
  const modes = handoverModesFor(detail.booking.directionCode);
  const blankRow = (): AssignRow => ({ ...EMPTY_ASSIGN, handoverMode: defaultHandoverMode(detail.booking.directionCode) });
  const [rows, setRows] = useState<AssignRow[]>([blankRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { toast } = useToast();
  const set = (i: number, patch: Partial<AssignRow>) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));

  const submit = async () => {
    const containers = rows.filter(r => r.containerNo.trim()).map(r => ({
      containerNo: r.containerNo.trim(),
      lineNo: r.lineNo ? Number(r.lineNo) : null,
      declaredSealNo: r.declaredSealNo.trim() || null,
      declaredVgmKg: r.declaredVgmKg ? Number(r.declaredVgmKg) : null,
      // Omitted when blank: no mode means today's behaviour and no extra
      // yard check, which is what an operator who does not use it expects.
      handoverMode: r.handoverMode || null,
    }));
    if (containers.length === 0) return;
    setBusy(true); setError(null);
    try {
      await apiSend('POST', `/api/tos/bookings/${detail.booking.bookingId}/containers`, { containers });
      toast({ variant: 'success', title: 'Boxes assigned', message: `${containers.length} box(es) on ${detail.booking.orderNo}` });
      setRows([blankRow()]);
      onDone();
    } catch (e) { setError(errorOf(e)); } finally { setBusy(false); }
  };

  return (
    <div className="gecko-stack" style={{ padding: '14px 18px', gap: 10, borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
      <ErrorBox error={error} />
      {rows.map((r, i) => {
        const fe = (f: string) => error?.forField(`containers[${i}].${f}`);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1fr 0.8fr 0.9fr auto', gap: 8, alignItems: 'start' }}>
            <div>
              <input className="gecko-input gecko-input-sm gecko-text-mono" placeholder="Container no, e.g. MSKU1234565" aria-label="Container number"
                value={r.containerNo} onChange={e => set(i, { containerNo: e.target.value.toUpperCase() })} maxLength={13} />
              {fe('containerNo') && <div style={{ fontSize: 11, color: 'var(--gecko-error-600)', marginTop: 2 }}>{fe('containerNo')}</div>}
            </div>
            <div>
              <select className="gecko-input gecko-input-sm" aria-label="Requirement line" value={r.lineNo} onChange={e => set(i, { lineNo: e.target.value })}>
                <option value="">Line: pick for me</option>
                {detail.requirements.map(q => <option key={q.lineNo} value={q.lineNo}>Line {q.lineNo} · {q.equipmentTypeCode} ({q.qtyAssigned + q.qtyCompleted}/{q.qty})</option>)}
              </select>
              {fe('lineNo') && <div style={{ fontSize: 11, color: 'var(--gecko-error-600)', marginTop: 2 }}>{fe('lineNo')}</div>}
            </div>
            <input className="gecko-input gecko-input-sm" placeholder="Declared seal (optional)" aria-label="Declared seal" maxLength={20}
              value={r.declaredSealNo} onChange={e => set(i, { declaredSealNo: e.target.value.toUpperCase() })} />
            <input className="gecko-input gecko-input-sm" type="number" min={1} placeholder="VGM kg" aria-label="Declared VGM kg"
              value={r.declaredVgmKg} onChange={e => set(i, { declaredVgmKg: e.target.value })} />
            <div>
              <select className="gecko-input gecko-input-sm" aria-label={handoverModeLabel(detail.booking.directionCode)}
                value={r.handoverMode} onChange={e => set(i, { handoverMode: e.target.value })}>
                <option value="">{handoverModeLabel(detail.booking.directionCode)}: none</option>
                {modes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {fe('handoverMode') && <div style={{ fontSize: 11, color: 'var(--gecko-error-600)', marginTop: 2 }}>{fe('handoverMode')}</div>}
            </div>
            <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" aria-label="Remove row" disabled={rows.length === 1}
              onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
          </div>
        );
      })}
      <div className="gecko-row" style={{ gap: 8 }}>
        <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setRows(rs => [...rs, blankRow()])}>
          <Icon name="plus" size={14} /> Another box
        </button>
        <span className="gecko-cell-meta" style={{ flex: 1 }}>
          Each box is checked against the registry, the ISO 6346 check digit and every other booking, and gets this order type&apos;s steps as PENDING.
        </span>
        <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={submit} disabled={busy}>
          <Icon name="save" size={14} /> {busy ? 'Assigning…' : 'Assign'}
        </button>
      </div>
    </div>
  );
}

// ── requirement editor ───────────────────────────────────────────────────────

interface ReqRow { lineNo: string; equipmentTypeCode: string; qty: string; minGradeCode: string; reeferSetTempC: string; remarks: string }
const toRow = (r: Requirement): ReqRow => ({
  lineNo: String(r.lineNo), equipmentTypeCode: r.equipmentTypeCode, qty: String(r.qty),
  minGradeCode: r.minGradeCode ?? '', reeferSetTempC: r.reeferSetTempC?.toString() ?? '', remarks: r.remarks ?? '',
});

function RequirementEditor({ detail, onDone, onCancel }: { detail: Detail; onDone: () => void; onCancel: () => void }) {
  const [rows, setRows] = useState<ReqRow[]>(detail.requirements.map(toRow));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { toast } = useToast();
  const set = (i: number, patch: Partial<ReqRow>) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));

  // Keep the original requirement's other attributes (vent, DG, OOG, weight) — this editor does not touch them.
  const byLine = new Map(detail.requirements.map(r => [String(r.lineNo), r]));

  const submit = async () => {
    const requirements = rows.map(r => {
      const orig = byLine.get(r.lineNo);
      return {
        lineNo: r.lineNo ? Number(r.lineNo) : null,
        equipmentTypeCode: r.equipmentTypeCode.trim().toUpperCase(),
        qty: Number(r.qty),
        minGradeCode: r.minGradeCode.trim() || null,
        reeferSetTempC: r.reeferSetTempC === '' ? null : Number(r.reeferSetTempC),
        reeferVentPct: orig?.reeferVentPct ?? null,
        reeferHumidityPct: orig?.reeferHumidityPct ?? null,
        imdgClass: orig?.imdgClass ?? null,
        unNumber: orig?.unNumber ?? null,
        oogOverHeightCm: orig?.oogOverHeightCm ?? null,
        oogOverWidthLeftCm: orig?.oogOverWidthLeftCm ?? null,
        oogOverWidthRightCm: orig?.oogOverWidthRightCm ?? null,
        oogOverLengthFrontCm: orig?.oogOverLengthFrontCm ?? null,
        oogOverLengthBackCm: orig?.oogOverLengthBackCm ?? null,
        declaredGrossWeightKg: orig?.declaredGrossWeightKg ?? null,
        remarks: r.remarks.trim() || null,
      };
    });
    setBusy(true); setError(null);
    try {
      await apiSend('PUT', `/api/tos/bookings/${detail.booking.bookingId}/requirements`, { rowVersion: detail.booking.rowVersion, requirements });
      toast({ variant: 'success', title: 'Requirement lines saved', message: detail.booking.orderNo });
      onDone();
    } catch (e) { setError(errorOf(e)); } finally { setBusy(false); }
  };

  return (
    <div className="gecko-stack" style={{ padding: '14px 18px', gap: 10, background: 'var(--gecko-bg-subtle)' }}>
      <ErrorBox error={error} />
      <div style={{ display: 'grid', gridTemplateColumns: '60px 110px 80px 100px 110px 1fr 36px', gap: 8 }} className="gecko-eyebrow">
        <span>Line</span><span>Type</span><span>Qty</span><span>Min grade</span><span>Reefer °C</span><span>Remarks</span><span />
      </div>
      {rows.map((r, i) => {
        const fe = (f: string) => error?.forField(`requirements[${i}].${f}`);
        const msg = fe('equipmentTypeCode') ?? fe('qty') ?? fe('reeferSetTempC') ?? fe('minGradeCode') ?? fe('lineNo');
        return (
          <div key={i}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 110px 80px 100px 110px 1fr 36px', gap: 8 }}>
              <input className="gecko-input gecko-input-sm" aria-label="Line number" placeholder="new" value={r.lineNo} onChange={e => set(i, { lineNo: e.target.value.replace(/\D/g, '') })} />
              <input className="gecko-input gecko-input-sm gecko-text-mono" aria-label="Equipment type" placeholder="20GP" value={r.equipmentTypeCode} onChange={e => set(i, { equipmentTypeCode: e.target.value.toUpperCase() })} />
              <input className="gecko-input gecko-input-sm" type="number" min={1} max={999} aria-label="Quantity" value={r.qty} onChange={e => set(i, { qty: e.target.value })} />
              <input className="gecko-input gecko-input-sm" aria-label="Minimum grade" placeholder="—" value={r.minGradeCode} onChange={e => set(i, { minGradeCode: e.target.value.toUpperCase() })} />
              <input className="gecko-input gecko-input-sm" type="number" step="0.1" aria-label="Reefer set temperature" placeholder="—" value={r.reeferSetTempC} onChange={e => set(i, { reeferSetTempC: e.target.value })} />
              <input className="gecko-input gecko-input-sm" aria-label="Remarks" value={r.remarks} maxLength={500} onChange={e => set(i, { remarks: e.target.value })} />
              <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" aria-label="Remove line" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><Icon name="trash" size={13} /></button>
            </div>
            {msg && <div style={{ fontSize: 11, color: 'var(--gecko-error-600)', marginTop: 2 }}>{msg}</div>}
          </div>
        );
      })}
      <div className="gecko-row" style={{ gap: 8 }}>
        <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setRows(rs => [...rs, { lineNo: '', equipmentTypeCode: '', qty: '1', minGradeCode: '', reeferSetTempC: '', remarks: '' }])}>
          <Icon name="plus" size={14} /> Add line
        </button>
        <span className="gecko-cell-meta" style={{ flex: 1 }}>A line with boxes on it can grow, but not shrink below them, change type or disappear.</span>
        <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={submit} disabled={busy || rows.length === 0}>
          <Icon name="save" size={14} /> {busy ? 'Saving…' : 'Save lines'}
        </button>
      </div>
    </div>
  );
}

// ── end booking (cancel / close) ─────────────────────────────────────────────

function EndBookingPanel({ detail, mode, onDone, onCancel }: { detail: Detail; mode: 'cancel' | 'close'; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { toast } = useToast();
  const ok = reason.trim().length >= 5;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await apiSend('POST', `/api/tos/bookings/${detail.booking.bookingId}/${mode}`, { reason: reason.trim(), rowVersion: detail.booking.rowVersion });
      toast({ variant: 'success', title: mode === 'cancel' ? 'Booking cancelled' : 'Booking closed', message: detail.booking.orderNo });
      onDone();
    } catch (e) { setError(errorOf(e)); } finally { setBusy(false); }
  };

  return (
    <div className="gecko-card gecko-stack" style={{ gap: 10, borderColor: mode === 'cancel' ? 'var(--gecko-error-200)' : 'var(--gecko-warning-200)' }}>
      <div style={{ fontWeight: 700 }}>{mode === 'cancel' ? 'Cancel this booking' : 'Close this booking'}</div>
      <div className="gecko-cell-meta">
        {mode === 'cancel'
          ? 'For a booking no box has worked on. Every box is released and its steps are cancelled. Once a box has passed the gate, close it instead.'
          : 'Ends a part-used booking. Boxes still open are released; boxes with gate history keep it.'}
      </div>
      <ErrorBox error={error} />
      <textarea className="gecko-input" rows={2} placeholder="Reason (at least 5 characters)" aria-label="Reason" maxLength={500}
        value={reason} onChange={e => setReason(e.target.value)} style={{ resize: 'vertical' }} />
      <div className="gecko-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel} disabled={busy}>Back</button>
        <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={submit} disabled={!ok || busy}>
          {busy ? 'Saving…' : mode === 'cancel' ? 'Cancel booking' : 'Close booking'}
        </button>
      </div>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

function specialOf(r: Requirement): string[] {
  const out: string[] = [];
  if (r.reeferSetTempC != null) out.push(`Reefer ${r.reeferSetTempC} °C${r.reeferVentPct != null ? ` · vent ${r.reeferVentPct}%` : ''}${r.reeferHumidityPct != null ? ` · RH ${r.reeferHumidityPct}%` : ''}`);
  if (r.imdgClass) out.push(`DG class ${r.imdgClass}${r.unNumber ? ` · UN ${r.unNumber}` : ''}`);
  const oog = [['H', r.oogOverHeightCm], ['WL', r.oogOverWidthLeftCm], ['WR', r.oogOverWidthRightCm], ['LF', r.oogOverLengthFrontCm], ['LB', r.oogOverLengthBackCm]]
    .filter(([, v]) => v != null && v !== 0).map(([k, v]) => `${k} ${v}`);
  if (oog.length) out.push(`OOG cm ${oog.join(' ')}`);
  if (r.declaredGrossWeightKg != null) out.push(`${r.declaredGrossWeightKg.toLocaleString()} kg`);
  if (r.minGradeCode) out.push(`grade ≥ ${r.minGradeCode}`);
  return out;
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Detail>(id ? `/api/tos/bookings/${id}` : null);
  const [panel, setPanel] = useState<'none' | 'assign' | 'lines' | 'cancel' | 'close'>('none');
  const [boxError, setBoxError] = useState<ApiError | null>(null);
  const [busyBox, setBusyBox] = useState<string | null>(null);
  const { toast } = useToast();

  const done = () => { setPanel('none'); reload(); };

  if (loading && !data) return <div className="gecko-card" style={{ padding: 32, textAlign: 'center', color: 'var(--gecko-text-secondary)' }}>Loading booking…</div>;
  if (!data) {
    return (
      <div className="gecko-stack" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', gap: 16 }}>
        <Link href="/bookings" className="gecko-link"><Icon name="arrowLeft" size={14} /> Booking register</Link>
        <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>{error?.status === 404 ? 'No such booking.' : error?.message ?? 'Could not load the booking.'}</span>
          {error?.status === 401 && <Link href="/login" className="gecko-link">Sign in</Link>}
        </div>
      </div>
    );
  }

  const b = data.booking;
  const open = b.status === 'OPEN';
  const p = PROGRESS[b.progress] ?? { label: b.progress, bg: '#F3F4F6', text: '#374151' };

  const unassign = async (box: Box) => {
    if (!window.confirm(`Take ${box.containerNo} off ${b.orderNo}? Its pending steps are cancelled and its place on line ${box.lineNo} is freed.`)) return;
    setBusyBox(box.bookingContainerId); setBoxError(null);
    try {
      await apiSend('DELETE', `/api/tos/bookings/${b.bookingId}/containers/${box.bookingContainerId}`);
      toast({ variant: 'success', title: 'Box unassigned', message: box.containerNo });
      reload();
    } catch (e) { setBoxError(errorOf(e)); } finally { setBusyBox(null); }
  };

  return (
    <div className="gecko-stack" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', gap: 18, paddingBottom: 48 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <Link href="/bookings" className="gecko-cell-meta gecko-row" style={{ gap: 4, textDecoration: 'none' }}><Icon name="arrowLeft" size={13} /> Booking register</Link>
          <div className="gecko-row gecko-row-wrap gecko-mt-1" style={{ gap: 10 }}>
            <h1 className="gecko-page-title gecko-text-mono" style={{ margin: 0 }}>{b.orderNo}</h1>
            <Pill bg={b.status === 'OPEN' ? '#ECFDF5' : '#F3F4F6'} text={b.status === 'OPEN' ? '#065F46' : '#374151'} title="Stored status — what a person decided">{b.status}</Pill>
            {b.progress !== b.status && <Pill bg={p.bg} text={p.text} title="Derived from requirements, boxes and steps (EXPIRED from the depot's calendar)">{p.label}</Pill>}
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            {b.orderTypeCode} · {humanize(b.directionCode)} · {humanize(b.bookingTypeCode)} · {b.branchCode ?? 'branch'}
            {b.carrierRef && <> · carrier ref <span className="gecko-text-mono">{b.carrierRef}</span></>}
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}><Icon name="refreshCcw" size={15} /> Refresh</button>
          {open && (
            <>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setPanel(panel === 'close' ? 'none' : 'close')}>Close…</button>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ color: 'var(--gecko-error-600)' }} onClick={() => setPanel(panel === 'cancel' ? 'none' : 'cancel')}>Cancel…</button>
            </>
          )}
        </div>
      </div>

      {(b.cancelledAt || b.closedAt) && (
        <div className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
          <Icon name="info" size={16} />
          <span>
            {b.cancelledAt ? `Cancelled ${fmt(b.cancelledAt)}: ${b.cancelReason}` : `Closed ${fmt(b.closedAt)}: ${b.closeReason}`} — the booking is read-only.
          </span>
        </div>
      )}

      {(panel === 'cancel' || panel === 'close') && <EndBookingPanel detail={data} mode={panel} onDone={done} onCancel={() => setPanel('none')} />}

      {/* KPIs */}
      <div className="gecko-kpi-strip gecko-kpi-strip-5">
        {[
          { label: 'Boxes required', value: data.qtyRequired, sub: `${data.requirements.length} line(s)` },
          { label: 'On the booking', value: data.qtyAssigned, sub: 'assigned, not finished' },
          { label: 'Completed', value: data.qtyCompleted, sub: 'every step done' },
          { label: 'Still open', value: Math.max(data.qtyRequired - data.qtyAssigned - data.qtyCompleted, 0), sub: 'no box yet' },
          { label: 'Gate steps done', value: data.stepsDone, sub: 'from gate transactions' },
        ].map(k => (
          <div key={k.label} className="gecko-kpi-cell">
            <div className="gecko-stat-label">{k.label}</div>
            <div className="gecko-stat-num">{k.value}</div>
            <div className="gecko-card-subtitle">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="gecko-grid-2" style={{ gap: 18, alignItems: 'start' }}>
        {/* Parties & routing */}
        <div className="gecko-card">
          <div className="gecko-eyebrow gecko-mb-3">Parties &amp; routing</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
            <Field label="Line">{b.lineCode}</Field>
            <Field label="Agent">{b.agentCode}</Field>
            <Field label="Customer">{b.customerCode}</Field>
            <Field label="Forwarder">{b.forwarderCode}</Field>
            <Field label="Haulier">{b.haulierCode}</Field>
            <Field label="Cargo class">{humanize(b.cargoClassCode)}</Field>
            <Field label="POL">{b.polPortCode}</Field>
            <Field label="POD">{b.podPortCode}</Field>
            <Field label="FPD">{b.fpdPortCode}</Field>
            <Field label="Valid from">{b.validFrom}</Field>
            <Field label="Valid to">{b.validTo}</Field>
            <Field label="Source">{humanize(b.source)}</Field>
            <Field label="Cargo category">{b.cargoCategoryCode}</Field>
            <Field label="Commodity">{b.commodityCode}</Field>
            <Field label="Customer ref">{b.customerRef}</Field>
          </div>
          {b.remarks && <div className="gecko-mt-3"><Field label="Remarks">{b.remarks}</Field></div>}
          <div className="gecko-cell-meta gecko-mt-3">Created {fmt(b.createdAt)}</div>
        </div>

        {/* Vessel call */}
        <div className="gecko-card">
          <div className="gecko-eyebrow gecko-mb-3">Vessel call</div>
          {b.vesselCallId ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                <Field label="Call"><Link href={`/masters/vessels/schedule/${b.vesselCallId}`} className="gecko-id-link">{b.callRef}</Link></Field>
                <Field label="Vessel">{b.vesselCode}</Field>
                <Field label="Voyage in / out"><span className="gecko-text-mono">{b.voyageIn ?? '—'} / {b.voyageOut ?? '—'}</span></Field>
                <Field label="ETD">{fmt(b.etd)}</Field>
                <Field label="Call status">{humanize(b.callStatus)}</Field>
              </div>
              <div className="gecko-cell-meta gecko-mt-3">
                The booking points at the call and copies nothing — ETD and cut-offs are read from the call, so a changed schedule never leaves a stale copy here.
              </div>
            </>
          ) : (
            <div className="gecko-cell-meta">No vessel call — this order type&apos;s steps do not require a vessel/voyage.</div>
          )}
        </div>
      </div>

      {/* Requirement lines */}
      <Section title="Requirement lines" icon="layers"
        right={open && panel !== 'lines' && <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setPanel('lines')}><Icon name="edit" size={14} /> Edit lines</button>}>
        {panel === 'lines' ? (
          <RequirementEditor detail={data} onDone={done} onCancel={() => setPanel('none')} />
        ) : (
          <table className="gecko-table gecko-table-compact" style={{ fontSize: 12.5 }}>
            <thead>
              <tr><th style={{ width: 60 }}>Line</th><th style={{ width: 90 }}>Type</th><th style={{ width: 70, textAlign: 'right' }}>Qty</th>
                <th style={{ width: 90, textAlign: 'right' }}>Assigned</th><th style={{ width: 100, textAlign: 'right' }}>Completed</th><th>Special</th><th>Remarks</th></tr>
            </thead>
            <tbody>
              {data.requirements.map(r => (
                <tr key={r.equipmentRequirementId}>
                  <td>{r.lineNo}</td>
                  <td className="gecko-text-mono" style={{ fontWeight: 700 }}>{r.equipmentTypeCode}</td>
                  <td style={{ textAlign: 'right' }}>{r.qty}</td>
                  <td style={{ textAlign: 'right' }}>{r.qtyAssigned}</td>
                  <td style={{ textAlign: 'right' }}>{r.qtyCompleted}</td>
                  <td>{specialOf(r).length ? specialOf(r).map(s => <span key={s} className="gecko-badge gecko-badge-xs gecko-badge-gray" style={{ marginRight: 4 }}>{s}</span>) : <span className="gecko-cell-meta">—</span>}</td>
                  <td className="gecko-cell-meta">{r.remarks ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Boxes */}
      <Section title={`Boxes (${data.containers.length})`} icon="box"
        right={open && <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setPanel(panel === 'assign' ? 'none' : 'assign')}><Icon name="plus" size={14} /> Assign boxes</button>}>
        {panel === 'assign' && <AssignForm detail={data} onDone={done} />}
        {boxError && <div style={{ padding: '10px 18px 0' }}><ErrorBox error={boxError} /></div>}
        <div className="gecko-cell-meta" style={{ padding: '10px 18px' }}>
          Steps are the order type&apos;s list, snapshotted when the box was assigned. Only the gate (Phase 5) can mark a step DONE — nothing on this page can.
          Dashed = optional step.
        </div>
        {data.containers.length === 0 ? (
          <div className="gecko-cell-meta" style={{ padding: '0 18px 18px' }}>No boxes yet. An import D/O lists them in advance; an export empty release picks one at the gate.</div>
        ) : (
          <table className="gecko-table gecko-table-compact" style={{ fontSize: 12.5 }}>
            <thead>
              <tr><th style={{ width: 50 }}>Line</th><th style={{ width: 150 }}>Container</th><th style={{ width: 100 }}>Source</th>
                <th style={{ width: 110 }}>{handoverModeLabel(data.booking.directionCode)}</th>
                <th style={{ width: 130 }}>Declared</th><th style={{ width: 140 }}>Assigned</th><th>Steps</th><th style={{ width: 130 }}>Ended</th><th style={{ width: 44 }} /></tr>
            </thead>
            <tbody>
              {data.containers.map(x => (
                <tr key={x.bookingContainerId} style={{ opacity: x.endedAt && x.endReason !== 'COMPLETED' ? 0.6 : 1 }}>
                  <td>{x.lineNo}</td>
                  <td>
                    <div className="gecko-text-mono" style={{ fontWeight: 700 }}>{x.containerNo}</div>
                    <div className="gecko-row gecko-row-wrap" style={{ gap: 3, marginTop: 2 }}>
                      {!x.inRegistry && <span className="gecko-badge gecko-badge-xs gecko-badge-warning" title="The equipment registry does not know this box yet">not in registry</span>}
                      {!x.isCheckDigitValid && <span className="gecko-badge gecko-badge-xs gecko-badge-warning" title="ISO 6346 check digit fails">check digit</span>}
                    </div>
                  </td>
                  <td className="gecko-cell-meta">{humanize(x.source)}</td>
                  {/* Set when the box was assigned; it cannot be edited here. */}
                  <td className="gecko-cell-meta">{handoverModeText(x.handoverMode)}</td>
                  <td className="gecko-cell-meta">
                    {x.declaredSealNo ? <>seal <span className="gecko-text-mono">{x.declaredSealNo}</span></> : '—'}
                    {x.declaredVgmKg != null && <div>VGM {x.declaredVgmKg.toLocaleString()} kg</div>}
                  </td>
                  <td className="gecko-cell-meta">{fmt(x.assignedAt)}</td>
                  <td><StepChain steps={x.steps} /></td>
                  <td className="gecko-cell-meta">{x.endedAt ? <>{humanize(x.endReason)}<div>{fmt(x.endedAt)}</div></> : 'active'}</td>
                  <td>
                    {open && !x.endedAt && (
                      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" title="Unassign" aria-label={`Unassign ${x.containerNo}`}
                        disabled={busyBox === x.bookingContainerId} onClick={() => unassign(x)}>
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
