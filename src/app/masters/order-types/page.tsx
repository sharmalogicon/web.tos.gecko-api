"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/problem';
import { useCommercialVocabulary } from '@/lib/api/charge-codes';
import {
  deleteOrderType, replaceCharges, replaceSteps, updateOrderType, useOrderTypeVocabulary,
  type OrderType, type OrderTypeCharge, type OrderTypeDetail, type OrderTypeStep,
} from '@/lib/api/order-types';
import { isPathAvailable } from '@/lib/edition';
import { OrderTypeForm, formFromOrderType, orderTypeErrors, requestFromOrderType, type OrderTypeFormValue } from './_components/OrderTypeForm';
import { StepsEditor, requestFromSteps, rowsFromSteps, stepErrors, type StepRow } from './_components/StepsEditor';
import { ChargesEditor, chargeRowErrors, requestFromCharges, rowsFromCharges, type ChargeRow } from './_components/ChargesEditor';

/**
 * LIVE against gecko_master (commercial.order_type + order_type_movement +
 * order_type_charge). The seed carries SCT's REAL Vector order types
 * ('EXP CY/CY', 'IMP LOLO CR', 'EXP CY-IN (NON-NOMINATING)'…) next to a few
 * invented fixtures — codes are human phrases, so they are URL-encoded and the
 * API turns %2F back into '/'.
 *
 * What the API has and the mock did not:
 *  - THE FIVE GATE RULES ARE PER STEP. The mock carried one `rules` block per
 *    order type; Vector's data proves that wrong — 'EXP CY/CY' checks gross
 *    weight on the empty-out and the laden-in but not on the laden-out, and
 *    'IMP CY/CY' allows a damaged release on every step. Hence the matrix.
 *  - pick-up / drop-off mode and billable / required per step.
 *  - charges belong to the ORDER TYPE, optionally pinned to one step, with a
 *    payer (bill-to role), default-vs-optional, cargo / VAS / raise-at-gate-in.
 *
 * What the mock had and the API does not, so it is gone rather than faked:
 * per-step EDI message lists (COPARN/CODECO…) — EDI is one flag, `skipEdi`;
 * which messages go out is the EDI profile's business, not the order type's —
 * and the click-to-toggle charge checkboxes, which changed nothing anywhere.
 *
 * Editing (mdm.commercial.manage, tenant-wide): the header, the steps and the
 * charges are edited one section at a time, each sent with the order type's
 * rowVersion (steps and charges are whole-set replaces). A 409 means someone
 * else saved first — reload, never overwrite. Deactivate is the normal way out;
 * Delete is confirmed. Export is gone: it was a toast, not a file.
 */

/** The API's page-size ceiling (Gecko.Data PagingExtensions.MaxPageSize). */
const MAX_PAGE = 200;

/** The API's words for a lost race — distinct from other 409s. */
const isStale = (e: ApiError | null) => e?.status === 409 && /changed since you loaded/i.test(e.title);

type Step = OrderTypeStep;
type Charge = OrderTypeCharge;

// ── Design tokens ─────────────────────────────────────────────────────────────
const SEQ_COLORS = [
  { bg: '#2563EB', light: '#EFF6FF', border: '#BFDBFE' },
  { bg: '#16A34A', light: '#F0FDF4', border: '#BBF7D0' },
  { bg: '#D97706', light: '#FFFBEB', border: '#FDE68A' },
  { bg: '#7C3AED', light: '#F5F3FF', border: '#DDD6FE' },
  { bg: '#DC2626', light: '#FEF2F2', border: '#FECACA' },
];

const DIRECTION: Record<string, { bg: string; text: string; label: string }> = {
  EXPORT:         { bg: '#D1FAE5', text: '#065F46', label: 'EXP' },
  IMPORT:         { bg: '#DBEAFE', text: '#1D4ED8', label: 'IMP' },
  INTRA_TERMINAL: { bg: '#F3F4F6', text: '#374151', label: 'INT' },
  DOMESTIC:       { bg: '#FEF3C7', text: '#92400E', label: 'DOM' },
  TRANSSHIPMENT:  { bg: '#EDE9FE', text: '#6D28D9', label: 'T/S' },
};
const directionOf = (code: string) =>
  DIRECTION[code] ?? { bg: 'var(--gecko-bg-subtle)', text: 'var(--gecko-text-secondary)', label: code.slice(0, 3) };

// Movement codes as seeded in master.movement (Vector's plus the generic set).
const MOVE_ICON: Record<string, string> = {
  MTY_OUT: 'upload', MTY_IN: 'download', FULL_IN: 'download', FULL_OUT: 'upload',
  GIE: 'arrowDown', GIF: 'download', GOE: 'truck', GOF: 'upload',
  STF: 'layers', SURV: 'search', MNRI: 'edit', TRO: 'transferH',
};

/** The five gate rules, in Vector's column order. */
const RULES: { key: keyof Step; label: string; short: string; hint: string }[] = [
  { key: 'checkSealNo',         label: 'Seal no.',        short: 'Seal',  hint: 'Gate clerk must capture / match the seal number' },
  { key: 'checkGrossWeight',    label: 'Gross weight',    short: 'Wgt',   hint: 'Gross weight required and checked against max gross' },
  { key: 'requireVesselVoyage', label: 'Vessel / voyage', short: 'V/V',   hint: 'The move must name a vessel call' },
  { key: 'allowDamagedRelease', label: 'Damaged release', short: 'DM ok', hint: 'A box flagged damaged may still pass this step' },
  { key: 'skipEdi',             label: 'Skip EDI',        short: 'No EDI', hint: 'No gate message is sent to the line for this step' },
];

const humanize = (code: string | null) => code ? code.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) : '—';

// ── Flow Connector ────────────────────────────────────────────────────────────
function FlowConnector() {
  return (
    <div style={{ flex: '0 0 48px', position: 'relative', display: 'flex', alignItems: 'center', alignSelf: 'center', height: 40 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--gecko-border)', borderRadius: 1 }} />
      <div style={{
        position: 'absolute', right: -1, width: 0, height: 0,
        borderTop: '5px solid transparent', borderBottom: '5px solid transparent',
        borderLeft: '8px solid var(--gecko-border)',
      }} />
    </div>
  );
}

// ── Movement Node ─────────────────────────────────────────────────────────────
function MovementNode({ step, chargeCount, isSelected, onClick }: {
  step: Step; chargeCount: number; isSelected: boolean; onClick: () => void;
}) {
  const col = SEQ_COLORS[(step.sequenceNo - 1) % SEQ_COLORS.length];
  const on = RULES.filter(r => step[r.key]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      style={{
        width: 196, flexShrink: 0, cursor: 'pointer', overflow: 'hidden', textAlign: 'left', padding: 0,
        fontFamily: 'inherit', borderRadius: 14, border: `2px solid ${isSelected ? col.bg : 'var(--gecko-border)'}`,
        background: isSelected ? col.light : 'var(--gecko-bg-surface)',
        boxShadow: isSelected ? `0 0 0 4px ${col.bg}1A, 0 8px 24px ${col.bg}18` : '0 1px 3px rgba(0,0,0,0.07)',
        transition: 'all 160ms ease',
      }}
    >
      <div style={{ height: 4, background: col.bg }} />

      <div className="gecko-row gecko-row-between" style={{ padding: '12px 14px 0' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, fontSize: 14, fontWeight: 800, background: col.bg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{step.sequenceNo}</div>
        <div className="gecko-row" style={{ gap: 4 }}>
          {step.pudoMode && <span className="gecko-badge gecko-badge-xs gecko-badge-gray">{step.pudoMode}</span>}
          {!step.isBillable && <span className="gecko-badge gecko-badge-xs gecko-badge-warning" title="This step raises no charge">no bill</span>}
          {!step.isRequired && <span className="gecko-badge gecko-badge-xs gecko-badge-gray">optional</span>}
        </div>
      </div>

      <div className="gecko-row" style={{ padding: '10px 14px', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, border: `1.5px solid ${col.border}`, background: col.light, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={MOVE_ICON[step.movementCode] ?? 'activity'} size={15} style={{ color: col.bg }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 800, color: 'var(--gecko-text-primary)', lineHeight: 1.2 }}>{step.movementCode}</div>
          <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.movementDescription}</div>
        </div>
      </div>

      <div style={{ padding: '0 14px 8px', display: 'flex', flexWrap: 'wrap', gap: 3, minHeight: 18 }}>
        {on.length === 0
          ? <span style={{ fontSize: 9, color: 'var(--gecko-text-disabled)' }}>no gate checks</span>
          : on.map(r => (
            <span key={r.key} title={r.hint} style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3, background: col.light, color: col.bg, border: `1px solid ${col.border}` }}>{r.short}</span>
          ))}
      </div>

      <div className="gecko-row" style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--gecko-border)', gap: 4, fontSize: 10, fontWeight: 600, color: isSelected ? col.bg : 'var(--gecko-text-secondary)' }}>
        <Icon name="fileText" size={10} />
        {chargeCount} step charge{chargeCount !== 1 ? 's' : ''}
      </div>
    </button>
  );
}

// ── Gate rules matrix ─────────────────────────────────────────────────────────
function RulesMatrix({ steps, selectedSeq, onSelect }: {
  steps: Step[]; selectedSeq: number | null; onSelect: (seq: number) => void;
}) {
  return (
    <table className="gecko-table gecko-table-compact">
      <thead>
        <tr>
          <th style={{ width: 44 }}>#</th>
          <th>Step</th>
          <th style={{ width: 90 }}>Mode</th>
          {RULES.map(r => <th key={r.key} title={r.hint} style={{ width: 96, textAlign: 'center' }}>{r.label}</th>)}
          <th style={{ width: 70, textAlign: 'center' }}>Billable</th>
        </tr>
      </thead>
      <tbody>
        {steps.map(s => {
          const col = SEQ_COLORS[(s.sequenceNo - 1) % SEQ_COLORS.length];
          return (
            <tr key={s.orderTypeMovementId} onClick={() => onSelect(s.sequenceNo)}
              style={{ cursor: 'pointer', background: selectedSeq === s.sequenceNo ? col.light : undefined }}>
              <td><span style={{ fontWeight: 800, color: col.bg }}>{s.sequenceNo}</span></td>
              <td>
                <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{s.movementCode}</span>
                <span className="gecko-cell-meta" style={{ marginLeft: 8 }}>{s.movementDescription}</span>
              </td>
              <td className="gecko-page-subtitle">{humanize(s.pudoMode)}</td>
              {RULES.map(r => (
                <td key={r.key} style={{ textAlign: 'center' }}>
                  {s[r.key]
                    ? <Icon name="check" size={14} style={{ color: 'var(--gecko-success-600)' }} />
                    : <span style={{ color: 'var(--gecko-text-disabled)' }}>—</span>}
                </td>
              ))}
              <td style={{ textAlign: 'center' }}>
                {s.isBillable
                  ? <Icon name="check" size={14} style={{ color: 'var(--gecko-success-600)' }} />
                  : <span style={{ color: 'var(--gecko-warning-700)', fontSize: 11, fontWeight: 600 }}>no</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Charges table ─────────────────────────────────────────────────────────────
function ChargesTable({ charges, selectedStep }: { charges: Charge[]; selectedStep: string | null }) {
  const shown = selectedStep ? charges.filter(c => c.movementCode === null || c.movementCode === selectedStep) : charges;

  if (charges.length === 0) {
    return (
      <EmptyState
        icon="invoice"
        title="No charges configured"
        description="Nothing is raised automatically for this order type — every charge will come from the tariff at invoicing, or be added by hand."
      />
    );
  }

  return (
    <table className="gecko-table gecko-table-compact">
      <thead>
        <tr>
          <th style={{ width: 130 }}>Charge</th>
          <th>Description</th>
          <th style={{ width: 110 }}>Step</th>
          <th style={{ width: 110 }}>Bill to</th>
          <th style={{ width: 90 }}>Term</th>
          <th style={{ width: 90 }}>Raised</th>
          <th style={{ width: 150 }}>Flags</th>
          <th style={{ width: 60, textAlign: 'right' }}>Qty</th>
        </tr>
      </thead>
      <tbody>
        {shown.map(c => (
          <tr key={c.orderTypeChargeId}>
            <td>
              {isPathAvailable(`/masters/charge-codes/${c.chargeCode}`)
                ? <Link href={`/masters/charge-codes/${encodeURIComponent(c.chargeCode)}`} className="gecko-id-link">{c.chargeCode}</Link>
                : <span className="gecko-id-link" style={{ cursor: 'default' }}>{c.chargeCode}</span>}
            </td>
            <td style={{ fontWeight: 500, color: 'var(--gecko-text-primary)' }}>{c.chargeDescription}</td>
            <td>
              {c.movementCode
                ? <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700 }}>{c.movementCode}</span>
                : <span className="gecko-cell-meta">every step</span>}
            </td>
            <td><span className="gecko-badge gecko-badge-xs gecko-badge-gray">{c.paymentTo}</span></td>
            <td className="gecko-page-subtitle">{c.paymentTermCode ?? '—'}</td>
            <td>
              {c.isOptional
                ? <span className="gecko-badge gecko-badge-xs gecko-badge-info" title="Offered to the clerk, not raised unless picked">optional</span>
                : <span className="gecko-badge gecko-badge-xs gecko-badge-success" title="Raised automatically">default</span>}
            </td>
            <td>
              <div className="gecko-row gecko-row-wrap" style={{ gap: 3 }}>
                {c.isCargoCharge && <span className="gecko-badge gecko-badge-xs gecko-badge-gray">cargo</span>}
                {c.isValueAddedService && <span className="gecko-badge gecko-badge-xs gecko-badge-warning">VAS</span>}
                {c.raiseAtGateIn && <span className="gecko-badge gecko-badge-xs gecko-badge-info" title="Raised when the box gates in, not at invoicing">at gate-in</span>}
                {!c.isCargoCharge && !c.isValueAddedService && !c.raiseAtGateIn && <span className="gecko-cell-meta">—</span>}
              </div>
            </td>
            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.defaultQty ?? '—'}</td>
          </tr>
        ))}
        {shown.length === 0 && (
          <tr><td colSpan={8} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 20 }}>No charges on {selectedStep}.</td></tr>
        )}
      </tbody>
    </table>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrderTypeMasterPage() {
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const { user } = useSession();
  const { toast } = useToast();
  const canManage = user?.permissions.includes('mdm.commercial.manage') ?? false;

  const listPath = useMemo(() => {
    const params = new URLSearchParams({ pageSize: String(MAX_PAGE) });
    if (includeInactive) params.set('includeInactive', 'true');
    return `/api/master/order-types?${params.toString()}`;
  }, [includeInactive]);
  const { data: all, error, loading, reload, totalCount } = useApiList<OrderType>(listPath);

  const directions = useMemo(() => [...new Set((all ?? []).map(o => o.directionCode))].sort(), [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (all ?? []).filter(o =>
      (!direction || o.directionCode === direction) &&
      (!q || o.orderTypeCode.toLowerCase().includes(q) || o.descriptionEn.toLowerCase().includes(q)
        || (o.descriptionLocal ?? '').includes(search.trim())));
  }, [all, search, direction]);

  // The shown order type: the one picked, or the first in the list when none is
  // picked (or the pick was filtered out / deleted). Derived, not set in an effect.
  const activeCode = selectedCode && filtered.some(o => o.orderTypeCode === selectedCode)
    ? selectedCode
    : filtered[0]?.orderTypeCode ?? null;

  const detailPath = activeCode ? `/api/master/order-types/${encodeURIComponent(activeCode)}` : null;
  const { data: detail, error: detailError, loading: detailLoading, reload: reloadDetail } = useApi<OrderTypeDetail>(detailPath);
  // useApi keeps the previous answer while the next one loads; never show one order type's steps under another's name.
  const current = detail && detail.orderType.orderTypeCode === activeCode ? detail : null;

  const steps = current?.movements ?? [];
  const charges = current?.charges ?? [];
  const selectedStep = selectedSeq !== null ? steps.find(s => s.sequenceNo === selectedSeq)?.movementCode ?? null : null;
  const ot = current?.orderType;
  const dir = ot ? directionOf(ot.directionCode) : null;

  // ── editing: one section at a time ──────────────────────────────────────
  const { data: vocabulary } = useOrderTypeVocabulary();
  const { data: commercial } = useCommercialVocabulary();
  const [mode, setMode] = useState<'view' | 'header' | 'steps' | 'charges'>('view');
  const [form, setForm] = useState<OrderTypeFormValue | null>(null);
  const [stepRows, setStepRows] = useState<StepRow[]>([]);
  const [chargeRows, setChargeRows] = useState<ChargeRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canEdit = canManage && mode === 'view' && !!vocabulary && !!commercial;

  const begin = (next: 'header' | 'steps' | 'charges') => {
    if (!current) return;
    setForm(formFromOrderType(current.orderType));
    setStepRows(rowsFromSteps(current.movements));
    setChargeRows(rowsFromCharges(current.charges));
    setSubmitted(false);
    setActionError(null);
    setMode(next);
  };
  const cancel = () => { setMode('view'); setActionError(null); };

  const run = async (work: () => Promise<unknown>, done: string) => {
    if (!current) return;
    setBusy(true);
    setActionError(null);
    try {
      await work();
      toast({ variant: 'success', title: done, message: current.orderType.orderTypeCode });
      setMode('view');
      reloadDetail();
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setBusy(false);
    }
  };

  const savedStepCodes = [...(current?.movements ?? [])].sort((a, b) => a.sequenceNo - b.sequenceNo).map(m => m.movementCode);
  const headerErrors = submitted && form ? orderTypeErrors(form) : {};
  const stepRowErrors = submitted ? stepErrors(stepRows) : {};
  const chargeErrors = submitted ? chargeRowErrors(chargeRows, savedStepCodes) : {};

  const saveHeader = () => {
    if (!current || !form) return;
    setSubmitted(true);
    if (Object.keys(orderTypeErrors(form)).length > 0) return;
    run(() => updateOrderType(current.orderType.orderTypeCode, requestFromOrderType(form, current.orderType.rowVersion)), 'Order type saved');
  };
  const saveSteps = () => {
    if (!current) return;
    setSubmitted(true);
    if (Object.keys(stepErrors(stepRows)).length > 0) return;
    run(() => replaceSteps(current.orderType.orderTypeCode, requestFromSteps(stepRows), current.orderType.rowVersion), 'Gate steps saved');
  };
  const saveCharges = () => {
    if (!current) return;
    setSubmitted(true);
    if (Object.keys(chargeRowErrors(chargeRows, savedStepCodes)).length > 0) return;
    run(() => replaceCharges(current.orderType.orderTypeCode, requestFromCharges(chargeRows), current.orderType.rowVersion), 'Charges saved');
  };
  const toggleActive = () => {
    if (!current) return;
    const next = { ...formFromOrderType(current.orderType), isActive: !current.orderType.isActive };
    run(() => updateOrderType(current.orderType.orderTypeCode, requestFromOrderType(next, current.orderType.rowVersion)),
      next.isActive ? 'Order type reactivated' : 'Order type deactivated');
  };
  const remove = async () => {
    if (!current) return;
    setConfirmDelete(false);
    const code = current.orderType.orderTypeCode;
    setBusy(true);
    setActionError(null);
    try {
      await deleteOrderType(code, current.orderType.rowVersion);
      toast({ variant: 'success', title: 'Order type deleted', message: code });
      setSelectedCode(null);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setBusy(false);
    }
  };

  const select = (code: string) => { setSelectedCode(code); setSelectedSeq(null); setMode('view'); setActionError(null); };
  const toggleSeq = (seq: number) => setSelectedSeq(prev => (prev === seq ? null : seq));

  return (
    <div className="gecko-stack" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', gap: 20, paddingBottom: 40 }}>

      {/* Page header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Order Types</h1>
            <span className="gecko-count-badge">{loading && !all ? '…' : `${(all ?? []).length} types`}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            What the depot is asked to do. Each order type expands into gate steps, and each step carries the checks the gate enforces.
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={15} /> Refresh
          </button>
          {canManage && isPathAvailable('/masters/order-types/new') && (
            <Link href="/masters/order-types/new" className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={15} /> New Order Type</Link>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} />
          <span>{error.message}</span>
          {error.status === 401 && <Link href="/login" className="gecko-link">Sign in</Link>}
        </div>
      )}

      {totalCount > (all?.length ?? 0) && (
        <div role="status" className="gecko-alert gecko-alert-info gecko-row">
          <Icon name="alertCircle" size={16} />
          <span>Showing the first {all?.length} of {totalCount} order types — search to find the rest.</span>
        </div>
      )}

      <div className="gecko-row gecko-row-start" style={{ gap: 20 }}>

        {/* LEFT: Order type list */}
        <div className="gecko-flex-shrink-0" style={{ width: 264, background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 80 }}>
          <div className="gecko-stack" style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--gecko-border)', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
              <input
                className="gecko-input gecko-input-sm"
                placeholder="Search code or description…"
                aria-label="Search order types"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 28 }}
              />
            </div>
            <div className="gecko-row gecko-row-wrap" style={{ gap: 4 }}>
              {['', ...directions].map(d => (
                <button key={d || 'all'} type="button" onClick={() => setDirection(d)}
                  className={`gecko-btn gecko-btn-sm ${direction === d ? 'gecko-btn-primary' : 'gecko-btn-ghost'}`}>
                  {d ? directionOf(d).label : 'All'}
                </button>
              ))}
            </div>
            <label className="gecko-row gecko-cell-meta" style={{ gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" className="gecko-checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
              Show inactive
            </label>
          </div>
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {loading && !all ? (
              <div className="gecko-cell-meta" style={{ padding: 20, textAlign: 'center' }}>Loading order types…</div>
            ) : filtered.length === 0 ? (
              <div className="gecko-cell-meta" style={{ padding: 20, textAlign: 'center' }}>
                {all && all.length === 0 ? 'No order types yet.' : 'Nothing matches.'}
              </div>
            ) : filtered.map(o => {
              const b = directionOf(o.directionCode);
              const active = o.orderTypeCode === activeCode;
              return (
                <button
                  key={o.orderTypeId}
                  type="button"
                  onClick={() => select(o.orderTypeCode)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px', opacity: o.isActive ? 1 : 0.55,
                    background: active ? 'var(--gecko-primary-50)' : 'transparent',
                    border: 'none', fontFamily: 'inherit', cursor: 'pointer',
                    borderLeft: `3px solid ${active ? 'var(--gecko-primary-600)' : 'transparent'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 700, color: active ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)' }}>
                      {o.orderTypeCode}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1.5px 5px', borderRadius: 3, background: b.bg, color: b.text, flexShrink: 0 }}>{b.label}</span>
                  </div>
                  <div className="gecko-cell-meta" style={{ lineHeight: 1.3 }}>{o.descriptionEn}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 9, color: 'var(--gecko-text-disabled)' }}>
                    <span>{o.serviceCode ?? '—'}</span>
                    <span>·</span>
                    <span>{humanize(o.cargoClassCode)}</span>
                    {!o.isActive && <span style={{ marginLeft: 'auto' }}>inactive</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {all && all.length > 0 && (
            <div className="gecko-cell-meta" style={{ padding: '8px 14px', borderTop: '1px solid var(--gecko-border)' }}>
              {filtered.length} of {all.length}
            </div>
          )}
        </div>

        {/* RIGHT: Detail area */}
        <div className="gecko-flex-1 gecko-stack gecko-stack-lg" style={{ minWidth: 0 }}>

          {detailError && (
            <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
              <Icon name="alertCircle" size={16} /><span>{detailError.message}</span>
            </div>
          )}

          {!ot ? (
            <div className="gecko-card" style={{ borderRadius: 14, padding: 32, textAlign: 'center', color: 'var(--gecko-text-secondary)' }}>
              {activeCode && detailLoading ? `Loading ${activeCode}…` : 'Pick an order type on the left.'}
            </div>
          ) : (
            <>
              {/* Order type header */}
              <div className="gecko-card" style={{ borderRadius: 14, padding: '20px 24px' }}>
                <div className="gecko-row gecko-mb-3" style={{ gap: 12 }}>
                  <h2 style={{ margin: 0, fontFamily: 'var(--gecko-font-mono)', fontSize: 20, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>{ot.orderTypeCode}</h2>
                  {dir && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: dir.bg, color: dir.text }}>{humanize(ot.directionCode)}</span>}
                  {ot.serviceCode && <span className="gecko-badge gecko-badge-xs gecko-badge-gray">{ot.serviceCode}</span>}
                  <div className="gecko-row gecko-ml-auto">
                    <span className={`gecko-status-dot gecko-status-dot-${ot.isActive ? 'active' : 'neutral'}`}>{ot.isActive ? 'Active' : 'Inactive'}</span>
                    {canEdit && (
                      <>
                        <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => begin('header')} disabled={busy}>
                          <Icon name="edit" size={14} /> Edit
                        </button>
                        <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={toggleActive} disabled={busy}>
                          <Icon name={ot.isActive ? 'eyeOff' : 'check'} size={14} /> {ot.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setConfirmDelete(true)} disabled={busy}>
                          <Icon name="trash" size={14} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {mode === 'header' && form && vocabulary ? (
                  <div className="gecko-stack gecko-stack-md gecko-mt-4">
                    <OrderTypeForm value={form} onChange={setForm} vocabulary={vocabulary} localErrors={headerErrors} apiError={actionError} mode="edit" />
                    <div className="gecko-row gecko-row-right">
                      <button className="gecko-btn gecko-btn-outline" onClick={cancel} disabled={busy}>Cancel</button>
                      <button className="gecko-btn gecko-btn-primary" onClick={saveHeader} disabled={busy}>
                        <Icon name="save" size={16} /> {busy ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 14, color: 'var(--gecko-text-secondary)' }}>{ot.descriptionEn}</div>
                    {ot.descriptionLocal && <div className="gecko-cell-meta gecko-mt-1">{ot.descriptionLocal}</div>}
                    <div className="gecko-row gecko-row-wrap gecko-mt-4" style={{ gap: 20, fontSize: 12 }}>
                      <div><span className="gecko-eyebrow">Cargo class</span><div>{humanize(ot.cargoClassCode)}</div></div>
                      <div><span className="gecko-eyebrow">Booking type</span><div>{humanize(ot.bookingTypeCode)}</div></div>
                      <div><span className="gecko-eyebrow">Steps</span><div>{steps.length}</div></div>
                      <div><span className="gecko-eyebrow">Charges</span><div>{charges.length}</div></div>
                    </div>
                  </>
                )}
              </div>

              {actionError && (
                <div role="alert" className="gecko-alert gecko-alert-error gecko-row">
                  <Icon name="alertCircle" size={16} />
                  <span>
                    {isStale(actionError)
                      ? 'Someone else saved this order type while you were working. Reload to see their change, then make yours again.'
                      : actionError.status === 400 && Object.keys(actionError.fieldErrors).length > 0
                        ? 'Some values were refused — see the marked fields and rows.'
                        : actionError.explanation ? `${actionError.title} ${actionError.explanation}` : actionError.message}
                  </span>
                  {isStale(actionError) && (
                    <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => { cancel(); reloadDetail(); }}>
                      <Icon name="refresh" size={14} /> Reload
                    </button>
                  )}
                </div>
              )}

              {/* Workflow canvas */}
              <div className="gecko-table-card" style={{ borderRadius: 14 }}>
                <div className="gecko-row" style={{ padding: '14px 20px', borderBottom: '1px solid var(--gecko-border)', gap: 10 }}>
                  <Icon name="activity" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Gate steps</span>
                  <span className="gecko-page-subtitle">— walked in order; a box cannot skip a required step</span>
                  {selectedSeq !== null && mode === 'view' && (
                    <button onClick={() => setSelectedSeq(null)} className="gecko-row gecko-ml-auto gecko-cell-meta"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', gap: 4, fontFamily: 'inherit' }}>
                      <Icon name="x" size={13} /> Clear selection
                    </button>
                  )}
                  {canEdit && (
                    <button className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-ml-auto" onClick={() => begin('steps')} disabled={busy}>
                      <Icon name="edit" size={14} /> Edit steps &amp; gate rules
                    </button>
                  )}
                </div>
                <div style={{ padding: '24px 24px 20px', overflowX: 'auto' }}>
                  {mode === 'steps' && vocabulary ? (
                    <div className="gecko-stack gecko-stack-md">
                      <StepsEditor rows={stepRows} onChange={setStepRows} vocabulary={vocabulary} localErrors={stepRowErrors} apiError={actionError} requiresVesselSchedule={ot?.requiresVesselSchedule ?? true} />
                      <div className="gecko-row gecko-row-right">
                        <button className="gecko-btn gecko-btn-outline" onClick={cancel} disabled={busy}>Cancel</button>
                        <button className="gecko-btn gecko-btn-primary" onClick={saveSteps} disabled={busy}>
                          <Icon name="save" size={16} /> {busy ? 'Saving…' : 'Save steps'}
                        </button>
                      </div>
                    </div>
                  ) : steps.length === 0 ? (
                    <div className="gecko-cell-meta" style={{ textAlign: 'center' }}>No steps defined — the gate cannot process this order type yet.</div>
                  ) : (
                    <div className="gecko-row" style={{ minWidth: 'max-content' }}>
                      {steps.map((s, idx) => (
                        <React.Fragment key={s.orderTypeMovementId}>
                          <MovementNode
                            step={s}
                            chargeCount={charges.filter(c => c.movementCode === s.movementCode).length}
                            isSelected={selectedSeq === s.sequenceNo}
                            onClick={() => toggleSeq(s.sequenceNo)}
                          />
                          {idx < steps.length - 1 && <FlowConnector />}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Gate rules, per step */}
              {steps.length > 0 && mode !== 'steps' && (
                <div className="gecko-table-card" style={{ borderRadius: 14 }}>
                  <div className="gecko-row" style={{ padding: '14px 20px', borderBottom: '1px solid var(--gecko-border)', gap: 10 }}>
                    <Icon name="shieldCheck" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Gate rules</span>
                    <span className="gecko-page-subtitle">— set per step, not per order type: the same box is weighed at one gate and not at the next</span>
                  </div>
                  <RulesMatrix steps={steps} selectedSeq={selectedSeq} onSelect={toggleSeq} />
                </div>
              )}

              {/* Charges */}
              <div className="gecko-table-card" style={{ borderRadius: 14 }}>
                <div className="gecko-row" style={{ padding: '14px 20px', borderBottom: '1px solid var(--gecko-border)', gap: 10 }}>
                  <Icon name="fileText" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Charges raised</span>
                  <span className="gecko-page-subtitle">
                    {selectedStep ? `— on ${selectedStep}, plus those on every step` : '— the price comes from the tariff; this says who pays and when'}
                  </span>
                  {canEdit && (
                    <button className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-ml-auto" onClick={() => begin('charges')} disabled={busy}>
                      <Icon name="edit" size={14} /> Edit charges
                    </button>
                  )}
                </div>
                {mode === 'charges' && vocabulary && commercial ? (
                  <div className="gecko-stack gecko-stack-md gecko-card-padded">
                    <ChargesEditor rows={chargeRows} onChange={setChargeRows} stepCodes={savedStepCodes}
                      vocabulary={vocabulary} commercial={commercial} localErrors={chargeErrors} apiError={actionError} />
                    <div className="gecko-row gecko-row-right">
                      <button className="gecko-btn gecko-btn-outline" onClick={cancel} disabled={busy}>Cancel</button>
                      <button className="gecko-btn gecko-btn-primary" onClick={saveCharges} disabled={busy}>
                        <Icon name="save" size={16} /> {busy ? 'Saving…' : 'Save charges'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <ChargesTable charges={charges} selectedStep={selectedStep} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        variant="danger"
        title={`Delete ${ot?.orderTypeCode ?? 'order type'}?`}
        message="It disappears from every list, with its steps and charges. Bookings already made keep the steps they copied, and the history keeps every version. To stop using it without deleting it, Deactivate instead."
        confirmLabel="Delete order type"
      />
    </div>
  );
}
