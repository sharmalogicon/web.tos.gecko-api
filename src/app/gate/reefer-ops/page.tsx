"use client";

/**
 * REEFER PLUG LOG — live against gecko_tos `yard.reefer_power_session`.
 *
 * When each reefer in the yard was plugged in and out: the physical fact a power
 * charge is priced from. TOS keeps the times and the hours so far (per started
 * hour); Revenue prices the power per container visit
 * (GET /api/revenue/reefer/power). This screen never computes a price.
 *
 * Tabs: plugged in now (OPEN) and the closed log. A box that goes out of the gate
 * is unplugged by the gate itself (close reason GATE_OUT).
 *
 * Readings, alarms, PTI and pre-cool are not recorded anywhere yet, so they are
 * not on this screen.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { DateField } from '@/components/ui/DateField';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useApi, useApiList, type Paged } from '@/lib/api/use-api';
import { useServerList } from '@/lib/api/use-server-list';
import { ApiError } from '@/lib/api/problem';
import { useSession } from '@/lib/auth/session';
import { formatContainerNo, formatDateTime } from '@/lib/api/tos';
import {
  REEFER_PERMISSIONS, REEFER_SESSIONS_PATH, closeReasonLabel, correctSession, dayBound, durationLabel,
  fromLocalInput, parseSetPoint, plugOut, powerLabel, powerPath, sessionsPath, setPointLabel,
  toLocalInput, voidSession,
  type ReeferPower, type ReeferSession,
} from '@/lib/api/reefer';

interface Branch { branchId: string; branchCode: string; displayName: string }

type TabId = 'OPEN' | 'CLOSED';

export default function ReeferPlugLogPage() {
  const { user, can, branchesFor } = useSession();
  const [tab, setTab] = useState<TabId>('OPEN');
  const [branchId, setBranchId] = useState('');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [pluggingOut, setPluggingOut] = useState<ReeferSession | null>(null);
  const [editing, setEditing] = useState<ReeferSession | null>(null);
  const [voiding, setVoiding] = useState<ReeferSession | null>(null);

  const mayManage = can(REEFER_PERMISSIONS.manage);
  const { data: branchRows } = useApiList<Branch>('/api/branches?pageSize=100');
  const mine = new Set(branchesFor(REEFER_PERMISSIONS.view));
  const depots = (branchRows ?? []).filter(b => mine.size === 0 || mine.has(b.branchId));

  // KPIs: every box plugged in now (the API pages at 200), and the size of the log.
  const open = useApi<Paged<ReeferSession>>(sessionsPath({ status: 'OPEN', branchId, pageSize: 200 }));
  const closed = useApi<Paged<ReeferSession>>(sessionsPath({ status: 'CLOSED', branchId, pageSize: 1 }));

  const list = useServerList<ReeferSession>(REEFER_SESSIONS_PATH, {
    status: tab, branchId,
    from: tab === 'CLOSED' ? dayBound(fromDay, false) : undefined,
    to: tab === 'CLOSED' ? dayBound(toDay, true) : undefined,
  }, 'sessions');
  const rows = list.rows ?? [];

  // Revenue prices the power per container visit. A failure (not deployed yet, no
  // permission) shows "—" and nothing else.
  const power = useApi<ReeferPower[]>(powerPath(rows.map(r => r.containerVisitId)));
  const powerByVisit = new Map((power.error ? [] : power.data ?? []).map(p => [p.containerVisitId, p]));

  const openRows = open.data?.items ?? [];
  const pluggedNow = open.data?.totalCount;
  const hoursSoFar = open.data ? openRows.reduce((n, s) => n + s.billableHours, 0) : undefined;
  const truncated = open.data ? open.data.totalCount > openRows.length : false;
  const longest = openRows.reduce<ReeferSession | null>((a, s) => (!a || s.minutesPlugged > a.minutesPlugged ? s : a), null);

  const reload = () => { open.reload(); closed.reload(); list.reload(); power.reload(); };
  const error = list.error ?? open.error;
  const filtered = !!(list.search.trim() || branchId || (tab === 'CLOSED' && (fromDay || toDay)));

  return (
    <div className="gecko-page-container">
      {/* Header */}
      <div className="gecko-reefer-header">
        <div className="gecko-reefer-header-left">
          <div className="gecko-reefer-header-icon">
            <Icon name="zap" size={20} />
          </div>
          <div>
            <div className="gecko-row gecko-row-baseline" style={{ gap: 10 }}>
              <h1 className="gecko-reefer-header-title">Reefer plug log</h1>
              <span className="gecko-badge gecko-badge-success">LIVE</span>
            </div>
            <p className="gecko-reefer-header-sub">
              When each reefer in the yard was plugged in and out — the hours its power is charged on
            </p>
          </div>
        </div>
        <div className="gecko-toolbar">
          <select className="gecko-input gecko-input-sm" aria-label="Depot" value={branchId} onChange={e => setBranchId(e.target.value)} style={{ minWidth: 170 }}>
            <option value="">All my depots</option>
            {depots.map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
          </select>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={14} /> Refresh
          </button>
          {mayManage && (
            <Link href="/gate/reefer-ops/new" className="gecko-btn gecko-btn-primary gecko-btn-sm">
              <Icon name="plus" size={14} /> Plug in
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{error.title}</div>
            {error.explanation && <div>{error.explanation}</div>}
          </div>
        </div>
      )}

      {/* KPI strip — only what the log itself says */}
      <div className="gecko-reefer-kpi-strip">
        <KPI icon="zap" tone="primary" label="Plugged in now" value={pluggedNow} />
        <KPI icon="clock" tone="info" label="Hours so far, plugged-in boxes"
             value={hoursSoFar} suffix={truncated ? '+' : ''} foot={truncated ? 'first 200 boxes' : 'per started hour'} />
        <KPI icon="thermometer" tone={longest && longest.minutesPlugged >= 72 * 60 ? 'warning' : 'neutral'} label="Longest on power"
             text={open.data ? (longest ? durationLabel(longest.minutesPlugged) : '—') : undefined}
             foot={longest ? formatContainerNo(longest.containerNo) : undefined} />
        <KPI icon="clipboardList" tone="success" label="Closed sessions in the log" value={closed.data?.totalCount} />
      </div>

      {/* Tabs */}
      <div className="gecko-tabs gecko-reefer-tabs" role="tablist">
        {(['OPEN', 'CLOSED'] as TabId[]).map(t => (
          <button key={t} role="tab" aria-selected={tab === t}
                  className={`gecko-tab${tab === t ? ' gecko-tab-active' : ''}`} onClick={() => setTab(t)}>
            <Icon name={t === 'OPEN' ? 'zap' : 'clipboardList'} size={14} />
            {t === 'OPEN' ? 'Plugged in now' : 'Closed log'}
            <span className="gecko-reefer-tab-count">{(t === 'OPEN' ? pluggedNow : closed.data?.totalCount) ?? '…'}</span>
          </button>
        ))}
      </div>

      <div className="gecko-reefer-body">
        <div className="gecko-card" style={{ padding: 14, marginBottom: 14 }}>
          <div className="gecko-row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="gecko-form-group" style={{ flex: '1 1 240px' }}>
              <label className="gecko-form-label">Container</label>
              <input className="gecko-input gecko-input-sm" value={list.search} placeholder="ABCU1234567"
                     onChange={e => list.setSearch(e.target.value.toUpperCase())} />
            </div>
            {tab === 'CLOSED' && (
              <>
                <div className="gecko-form-group">
                  <label className="gecko-form-label">Plugged in from</label>
                  <DateField size="sm" value={fromDay} onChange={setFromDay} max={toDay || undefined} aria-label="Plugged in from" />
                </div>
                <div className="gecko-form-group">
                  <label className="gecko-form-label">to</label>
                  <DateField size="sm" value={toDay} onChange={setToDay} min={fromDay || undefined} aria-label="Plugged in to" />
                </div>
              </>
            )}
          </div>
        </div>

        {!list.loading && rows.length === 0 && !list.error ? (
          <EmptyState
            icon="zap"
            title={tab === 'OPEN' ? (filtered ? 'No plugged-in box matches' : 'Nothing plugged in') : 'No closed sessions'}
            description={tab === 'OPEN'
              ? 'A reefer appears here the moment it is plugged in. It leaves when it is plugged out, or when it goes out of the gate.'
              : 'No closed session matches these filters.'}
            action={tab === 'OPEN' && mayManage && !filtered
              ? <Link href="/gate/reefer-ops/new" className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={14} /> Plug in a reefer</Link>
              : undefined}
          />
        ) : (
          <div className="gecko-table-wrapper">
            <table className="gecko-table">
              <thead>
                <tr>
                  <th>Container</th>
                  <th>Depot</th>
                  <th>Type</th>
                  <th>Plug</th>
                  <th className="gecko-num">Set point</th>
                  <th>Plugged in</th>
                  {tab === 'CLOSED' && <th>Plugged out</th>}
                  <th className="gecko-num">{tab === 'OPEN' ? 'Hours so far' : 'Hours'}</th>
                  <th className="gecko-num" title="Priced by Revenue for the whole container visit — every session, rounded up to the started hour once">Power charge</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id}>
                    <td>
                      <strong className="gecko-mono">{formatContainerNo(s.containerNo)}</strong>
                      {s.remarks && <div className="gecko-cell-meta" style={{ maxWidth: 240 }}>{s.remarks}</div>}
                    </td>
                    <td>{s.branchCode ?? '—'}</td>
                    <td>
                      {s.equipmentTypeCode ?? '—'}
                      {s.isoTypeCode && <div className="gecko-cell-meta">{s.isoTypeCode}</div>}
                    </td>
                    <td className="gecko-mono">{s.plugPointCode ?? '—'}</td>
                    <td className="gecko-num gecko-mono">{setPointLabel(s.setPointC)}</td>
                    <td>
                      {formatDateTime(s.pluggedInAt)}
                      <div className="gecko-cell-meta">{byWhom(s.pluggedInBy, user?.userId)}</div>
                    </td>
                    {tab === 'CLOSED' && (
                      <td>
                        {formatDateTime(s.pluggedOutAt)}
                        <div className="gecko-cell-meta">
                          {s.closeReason === 'GATE_OUT'
                            ? <span className="gecko-badge gecko-badge-info gecko-badge-xs">Gate-out</span>
                            : `${closeReasonLabel(s.closeReason)} ${byWhom(s.pluggedOutBy, user?.userId)}`}
                        </div>
                      </td>
                    )}
                    <td className="gecko-num gecko-mono">
                      {s.billableHours} h
                      <div className="gecko-cell-meta">{durationLabel(s.minutesPlugged)}</div>
                    </td>
                    <td className="gecko-num"><PowerCell p={powerByVisit.get(s.containerVisitId)} loading={power.loading && !power.error} /></td>
                    <td>
                      {s.canManage && (
                        <div className="gecko-reefer-actions">
                          {s.isOpen && (
                            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setPluggingOut(s)}>Plug out</button>
                          )}
                          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setEditing(s)} title="Correct times or details">
                            <Icon name="edit" size={14} />
                          </button>
                          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setVoiding(s)} title="Delete — entered by mistake">
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.footer}
          </div>
        )}
      </div>

      {pluggingOut && (
        <PlugOutModal session={pluggingOut} onClose={() => setPluggingOut(null)} onDone={() => { setPluggingOut(null); reload(); }} />
      )}
      {editing && (
        <CorrectModal session={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />
      )}
      {voiding && (
        <VoidModal session={voiding} onClose={() => setVoiding(null)} onDone={() => { setVoiding(null); reload(); }} />
      )}
    </div>
  );
}

function byWhom(userId: string | null, me: string | undefined): string {
  if (!userId) return 'by the gate';
  return me && userId.toLowerCase() === me.toLowerCase() ? 'by you' : 'by hand';
}

function PowerCell({ p, loading }: { p: ReeferPower | undefined; loading: boolean }) {
  if (!p) return <span className="gecko-cell-meta">{loading ? '…' : '—'}</span>;
  const { text, priced } = powerLabel(p);
  if (priced) {
    return (
      <span className="gecko-mono" title={p.chargeCode ? `${p.chargeCode} · ${p.billableHours} h for the visit` : undefined}>
        {text}
        <div className="gecko-cell-meta">{p.billableHours} h visit</div>
      </span>
    );
  }
  return <span className="gecko-badge gecko-badge-gray gecko-badge-xs" title={p.message ?? undefined}>{text}</span>;
}

function KPI({ icon, tone, label, value, text, suffix, foot }: {
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  label: string;
  value?: number;
  text?: string;
  suffix?: string;
  foot?: string;
}) {
  const shown = text ?? (value === undefined ? undefined : `${value.toLocaleString()}${suffix ?? ''}`);
  return (
    <div className="gecko-kpi-tile">
      <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${tone}`}>
        <Icon name={icon} size={16} />
      </div>
      <div>
        <div className="gecko-kpi-tile-value">{shown ?? '…'}</div>
        <div className="gecko-kpi-tile-label">{label}{foot ? ` · ${foot}` : ''}</div>
      </div>
    </div>
  );
}

/* ── dialogs ─────────────────────────────────────────────────────────────── */

/** Heading + explanation for anything not tied to a field; 409 in amber with a reload. */
function Failure({ failure, fields }: { failure: ApiError | null; fields: string[] }) {
  if (!failure || fields.some(f => failure.forField(f))) return null;
  const stale = failure.status === 409;
  return (
    <div className={`gecko-alert gecko-alert-${stale ? 'warning' : 'error'}`}>
      <Icon name="alertCircle" size={18} />
      <div>
        <div style={{ fontWeight: 600 }}>{failure.title}</div>
        {failure.explanation && <div>{failure.explanation}</div>}
        {stale && <div className="gecko-cell-meta" style={{ marginTop: 4 }}>Reload the log to see it as it is now.</div>}
      </div>
    </div>
  );
}

function FieldError({ failure, field }: { failure: ApiError | null; field: string }) {
  const m = failure?.forField(field);
  return m ? <div className="gecko-field-error">{m}</div> : null;
}

function asApiError(e: unknown): ApiError {
  return e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
}

function Footer({ busy, stale, label, disabled, onClose, onSubmit, onReload, danger }: {
  busy: boolean; stale: boolean; label: string; disabled?: boolean; danger?: boolean;
  onClose: () => void; onSubmit: () => void; onReload: () => void;
}) {
  return (
    <>
      <button className="gecko-btn gecko-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
      {stale
        ? <button className="gecko-btn gecko-btn-primary" onClick={onReload}>Reload the log</button>
        : <button className={`gecko-btn ${danger ? 'gecko-btn-danger' : 'gecko-btn-primary'}`} onClick={onSubmit} disabled={busy || disabled}>
            {busy ? 'Saving…' : label}
          </button>}
    </>
  );
}

function PlugOutModal({ session, onClose, onDone }: { session: ReeferSession; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [at, setAt] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const box = formatContainerNo(session.containerNo);

  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const done = await plugOut(session.id, {
        pluggedOutAt: fromLocalInput(at), remarks: remarks.trim() || undefined, rowVersion: session.rowVersion,
      });
      toast({ variant: 'success', title: `${box} plugged out`, message: `${done?.billableHours ?? session.billableHours} h on power.` });
      onDone();
    } catch (e: unknown) {
      setFailure(asApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Plug out ${box}`}
           subtitle={`Plugged in ${formatDateTime(session.pluggedInAt)}${session.plugPointCode ? ` at ${session.plugPointCode}` : ''} · ${durationLabel(session.minutesPlugged)} so far`}
           footer={<Footer busy={busy} stale={failure?.status === 409} label="Plug out" onClose={onClose} onSubmit={submit} onReload={onDone} />}>
      <div className="gecko-stack" style={{ gap: 14 }}>
        <Failure failure={failure} fields={['pluggedOutAt', 'remarks']} />
        <div className="gecko-form-group">
          <label className="gecko-form-label">Plugged out at</label>
          <DateField withTime value={at} onChange={setAt} aria-label="Plugged out at" />
          <div className="gecko-cell-meta">Leave blank for now.</div>
          <FieldError failure={failure} field="pluggedOutAt" />
        </div>
        <div className="gecko-form-group">
          <label className="gecko-form-label">Remarks</label>
          <input className="gecko-input" maxLength={500} value={remarks} onChange={e => setRemarks(e.target.value)}
                 placeholder={session.remarks ? `Replaces: ${session.remarks}` : 'Optional'} />
          <FieldError failure={failure} field="remarks" />
        </div>
      </div>
    </Modal>
  );
}

function CorrectModal({ session, onClose, onDone }: { session: ReeferSession; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [inAt, setInAt] = useState(toLocalInput(session.pluggedInAt));
  const [outAt, setOutAt] = useState(toLocalInput(session.pluggedOutAt));
  const [plugPoint, setPlugPoint] = useState(session.plugPointCode ?? '');
  const [setPoint, setSetPoint] = useState(session.setPointC === null ? '' : String(session.setPointC));
  const [remarks, setRemarks] = useState(session.remarks ?? '');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const box = formatContainerNo(session.containerNo);
  const setPointC = parseSetPoint(setPoint);
  const badSetPoint = Number.isNaN(setPointC);

  const submit = async () => {
    const pluggedInAt = fromLocalInput(inAt);
    if (!pluggedInAt) return;
    setBusy(true);
    setFailure(null);
    try {
      await correctSession(session.id, {
        pluggedInAt,
        pluggedOutAt: session.isOpen ? null : fromLocalInput(outAt),
        plugPointCode: plugPoint.trim() || null,
        setPointC,
        remarks: remarks.trim() || null,
        rowVersion: session.rowVersion,
      });
      toast({ variant: 'success', title: `${box} corrected`, message: 'The change is journalled on the container visit.' });
      onDone();
    } catch (e: unknown) {
      setFailure(asApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Correct session — ${box}`}
           subtitle={session.isOpen ? 'Still plugged in. Plug it out to close it; a correction does not.' : `Closed — ${closeReasonLabel(session.closeReason).toLowerCase()}`}
           footer={<Footer busy={busy} stale={failure?.status === 409} label="Save correction"
                           disabled={!inAt || (!session.isOpen && !outAt) || badSetPoint}
                           onClose={onClose} onSubmit={submit} onReload={onDone} />}>
      <div className="gecko-stack" style={{ gap: 14 }}>
        <Failure failure={failure} fields={['pluggedInAt', 'pluggedOutAt', 'plugPointCode', 'setPointC', 'remarks']} />
        <div className="gecko-reefer-form-grid">
          <label className="gecko-form-row">
            <span>Plugged in at *</span>
            <DateField withTime size="sm" value={inAt} onChange={setInAt} aria-label="Plugged in at" />
            <FieldError failure={failure} field="pluggedInAt" />
          </label>
          {!session.isOpen && (
            <label className="gecko-form-row">
              <span>Plugged out at *</span>
              <DateField withTime size="sm" value={outAt} onChange={setOutAt} aria-label="Plugged out at" />
              <FieldError failure={failure} field="pluggedOutAt" />
            </label>
          )}
          <label className="gecko-form-row">
            <span>Plug point</span>
            <input className="gecko-input gecko-input-sm" maxLength={20} value={plugPoint} onChange={e => setPlugPoint(e.target.value.toUpperCase())} />
            <FieldError failure={failure} field="plugPointCode" />
          </label>
          <label className="gecko-form-row">
            <span>Set point (°C)</span>
            <input type="number" step="0.1" min={-40} max={40} className="gecko-input gecko-input-sm" value={setPoint} onChange={e => setSetPoint(e.target.value)} />
            {badSetPoint && <div className="gecko-field-error">Enter a number of degrees.</div>}
            <FieldError failure={failure} field="setPointC" />
          </label>
          <label className="gecko-form-row gecko-form-row-full">
            <span>Remarks</span>
            <input className="gecko-input gecko-input-sm" maxLength={500} value={remarks} onChange={e => setRemarks(e.target.value)} />
            <FieldError failure={failure} field="remarks" />
          </label>
        </div>
      </div>
    </Modal>
  );
}

function VoidModal({ session, onClose, onDone }: { session: ReeferSession; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const box = formatContainerNo(session.containerNo);

  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await voidSession(session.id, session.rowVersion);
      toast({ variant: 'success', title: `Session deleted`, message: `${box} — plugged in ${formatDateTime(session.pluggedInAt)}.` });
      onDone();
    } catch (e: unknown) {
      setFailure(asApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen size="sm" onClose={onClose} title={`Delete session — ${box}?`}
           subtitle="Only for a session entered by mistake. Once the box has gone out of the gate, correct its times instead."
           footer={<Footer busy={busy} stale={failure?.status === 409} label="Delete session" danger onClose={onClose} onSubmit={submit} onReload={onDone} />}>
      <div className="gecko-stack" style={{ gap: 14 }}>
        <Failure failure={failure} fields={[]} />
        <div>
          Plugged in {formatDateTime(session.pluggedInAt)}
          {session.pluggedOutAt ? `, out ${formatDateTime(session.pluggedOutAt)}` : ', still plugged in'}
          {' '}· {durationLabel(session.minutesPlugged)}.
        </div>
      </div>
    </Modal>
  );
}
