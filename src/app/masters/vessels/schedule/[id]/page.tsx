"use client";
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/lib/api/use-api';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';

/**
 * LIVE against gecko_tos (vessel.vessel_call + vessel_call_line +
 * vessel_call_cutoff) through /api/tos/vessel-calls/{id}. `id` is the call's GUID.
 *
 * ONE ROW PER PHYSICAL CALL (PLAN D-1). The lines loading on it carry their own
 * voyages; cut-offs are child rows, some per line, yard ones per depot branch.
 * Status is DERIVED (vw_vessel_call_status) — never typed in. Bookings will
 * point at this call and copy nothing (D-2).
 *
 * What the mock had and the API does not, so it is gone rather than faked:
 *  - the bookings tab and its KPIs (TEU booked, reefer / hazmat counts) —
 *    bookings are batch B; the tab comes back when they exist.
 *  - POL → POD and "inbound / outbound": a call is ONE port; direction belongs
 *    to the booking, not the ship.
 *  - TEU capacity / fill %, berth and wharf — no source for any of them yet
 *    (the terminal is known; the berth is the terminal's business).
 *  - the invented history timeline — temporal history exists in the database
 *    but has no endpoint yet.
 *  - Print Manifest — there is no manifest without bookings.
 */

interface VesselCall {
  vesselCallId: string;
  callRef: string;
  vesselCode: string;
  vesselName: string | null;
  portCode: string;
  terminalCode: string | null;
  operatorVoyageIn: string | null;
  operatorVoyageOut: string | null;
  eta: string;
  etb: string | null;
  etd: string;
  ata: string | null;
  atb: string | null;
  atd: string | null;
  status: string;
  isCancelled: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  source: string;
  remarks: string | null;
  rowVersion: string;
}

interface Line {
  vesselCallLineId: string;
  lineCode: string;
  agentCode: string | null;
  voyageIn: string | null;
  voyageOut: string | null;
  serviceCode: string | null;
}

interface Cutoff {
  vesselCallCutoffId: string;
  kind: string;
  lineCode: string | null;
  branchId: string | null;
  at: string;
  source: string;
  derivedLeadHours: number | null;
  remarks: string | null;
}

interface Detail { call: VesselCall; lines: Line[]; cutoffs: Cutoff[] }
interface Effective { kind: string; at: string; source: string; appliesTo: string }

const KINDS = ['PORT_DRY', 'PORT_REEFER', 'PORT_DG', 'YARD_DRY', 'YARD_REEFER', 'YARD_DG', 'VGM', 'SI'];

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  OPEN:                 { bg: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)', label: 'Open' },
  CLOSED_FOR_RECEIVING: { bg: 'var(--gecko-warning-50)', color: 'var(--gecko-warning-700)', label: 'Closed for receiving' },
  ARRIVED:              { bg: 'var(--gecko-info-50)',    color: 'var(--gecko-info-700)',    label: 'Arrived' },
  WORKING:              { bg: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', label: 'Working' },
  DEPARTED_UNCONFIRMED: { bg: 'var(--gecko-warning-50)', color: 'var(--gecko-warning-700)', label: 'Departed? (no ATD)' },
  DEPARTED:             { bg: 'var(--gecko-gray-100)',   color: 'var(--gecko-gray-600)',    label: 'Departed' },
  CANCELLED:            { bg: 'var(--gecko-error-50)',   color: 'var(--gecko-error-700)',   label: 'Cancelled' },
};

// ── time helpers ────────────────────────────────────────────────────────────
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const fmt = (iso: string | null) => iso
  ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  : '—';
/** ISO → value for <input type="datetime-local"> in the browser's zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** datetime-local value (browser zone) → full ISO instant. */
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { bg: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', label: status };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${s.color}33` }}>
      {s.label}
    </span>
  );
}

function ErrorBox({ error }: { error: ApiError | null }) {
  if (!error) return null;
  const fields = Object.entries(error.fieldErrors);
  return (
    <div role="alert" className="gecko-alert gecko-alert-error" style={{ display: 'block' }}>
      <div className="gecko-row" style={{ gap: 8 }}><Icon name="alertCircle" size={16} /><span>{error.message}</span></div>
      {fields.length > 1 && (
        <ul style={{ margin: '6px 0 0 24px', padding: 0, fontSize: 12 }}>
          {fields.map(([k, v]) => <li key={k}><code>{k}</code>: {v.join(' ')}</li>)}
        </ul>
      )}
    </div>
  );
}

function TimeCell({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  return (
    <div>
      <div className="gecko-eyebrow" style={{ marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: strong ? 700 : 600, fontFamily: 'var(--gecko-font-mono)', color: value ? 'var(--gecko-text-primary)' : 'var(--gecko-text-disabled)' }}>
        {fmt(value)}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' };
const cardHead: React.CSSProperties = { padding: '12px 20px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', display: 'flex', alignItems: 'center', gap: 10 };

// ── actuals ─────────────────────────────────────────────────────────────────
function ActualsForm({ call, onDone }: { call: VesselCall; onDone: () => void }) {
  const [ata, setAta] = useState(toLocalInput(call.ata));
  const [atb, setAtb] = useState(toLocalInput(call.atb));
  const [atd, setAtd] = useState(toLocalInput(call.atd));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { toast } = useToast();

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await apiSend('POST', `/api/tos/vessel-calls/${call.vesselCallId}/actuals`, {
        rowVersion: call.rowVersion, ata: fromLocalInput(ata), atb: fromLocalInput(atb), atd: fromLocalInput(atd),
      });
      toast({ variant: 'success', title: 'Actuals recorded', message: call.callRef });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="gecko-stack" style={{ gap: 12, padding: '16px 20px' }}>
      <ErrorBox error={error} />
      <div className="gecko-grid-3" style={{ gap: 12 }}>
        {([['Arrived (ATA)', ata, setAta, 'ata'], ['Berthed (ATB)', atb, setAtb, 'atb'], ['Departed (ATD)', atd, setAtd, 'atd']] as const).map(([label, value, set, key]) => (
          <div key={key} className="gecko-form-group">
            <label className="gecko-label">{label}</label>
            <input type="datetime-local" className="gecko-input" value={value} onChange={e => set(e.target.value)} />
            {error?.forField(key) && <div style={{ fontSize: 11, color: 'var(--gecko-error-600)', marginTop: 3 }}>{error.forField(key)}</div>}
          </div>
        ))}
      </div>
      <div className="gecko-row" style={{ gap: 8 }}>
        <span className="gecko-cell-meta">Times are in {TZ}. Clear a field to remove an actual entered by mistake.</span>
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm" style={{ marginLeft: 'auto' }} onClick={save} disabled={busy}>
          <Icon name="save" size={14} /> {busy ? 'Saving…' : 'Save actuals'}
        </button>
      </div>
    </div>
  );
}

// ── cancel ──────────────────────────────────────────────────────────────────
function CancelForm({ call, onDone }: { call: VesselCall; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { toast } = useToast();
  const ok = reason.trim().length >= 5;

  const cancel = async () => {
    if (!ok) return;
    setBusy(true); setError(null);
    try {
      await apiSend('POST', `/api/tos/vessel-calls/${call.vesselCallId}/cancel`, { reason: reason.trim(), rowVersion: call.rowVersion });
      toast({ variant: 'success', title: 'Call cancelled', message: call.callRef });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="gecko-stack" style={{ gap: 10, padding: '16px 20px' }}>
      <ErrorBox error={error} />
      <div className="gecko-form-group">
        <label className="gecko-label gecko-label-required">Reason</label>
        <textarea className="gecko-input" rows={2} maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Blank sailing announced by the line" style={{ resize: 'vertical' }} />
        <div className="gecko-cell-meta" style={{ marginTop: 3 }}>
          Bookings on this call are not moved — they will show up as needing a new call.
        </div>
      </div>
      <div className="gecko-row">
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ marginLeft: 'auto', color: 'var(--gecko-error-600)' }}
          onClick={cancel} disabled={!ok || busy}>
          <Icon name="x" size={14} /> {busy ? 'Cancelling…' : 'Cancel this call'}
        </button>
      </div>
    </div>
  );
}

// ── cut-off editor ──────────────────────────────────────────────────────────
interface EditRow { key: string; kind: string; lineCode: string; branchId: string | null; at: string; remarks: string }

function CutoffEditor({ call, lines, cutoffs, onDone, onClose }: {
  call: VesselCall; lines: Line[]; cutoffs: Cutoff[]; onDone: () => void; onClose: () => void;
}) {
  // DERIVED rows are not sent: the server re-derives them from the port cut-offs.
  const [rows, setRows] = useState<EditRow[]>(() => cutoffs.filter(c => c.source !== 'DERIVED').map(c => ({
    key: c.vesselCallCutoffId, kind: c.kind, lineCode: c.lineCode ?? '', branchId: c.branchId,
    at: toLocalInput(c.at), remarks: c.remarks ?? '',
  })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { toast } = useToast();

  const set = (key: string, patch: Partial<EditRow>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const add = () => setRows(rs => [...rs, { key: `new-${Date.now()}`, kind: 'PORT_DRY', lineCode: '', branchId: null, at: '', remarks: '' }]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await apiSend('PUT', `/api/tos/vessel-calls/${call.vesselCallId}/cutoffs`, {
        cutoffs: rows.map(r => ({
          kind: r.kind, lineCode: r.lineCode || null, branchId: r.branchId,
          at: fromLocalInput(r.at), remarks: r.remarks.trim() || null,
        })),
      });
      toast({ variant: 'success', title: 'Cut-offs saved', message: call.callRef });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally { setBusy(false); }
  };

  const rowError = (i: number) => error
    ? Object.entries(error.fieldErrors).filter(([k]) => k.toLowerCase().startsWith(`cutoffs[${i}]`)).flatMap(([, v]) => v).join(' ')
    : '';

  return (
    <div className="gecko-stack" style={{ gap: 12, padding: '16px 20px' }}>
      <ErrorBox error={error} />
      <table className="gecko-table gecko-table-compact" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ width: 150 }}>Kind</th>
            <th style={{ width: 130 }}>Line</th>
            <th style={{ width: 110 }}>Branch</th>
            <th style={{ width: 200 }}>At ({TZ})</th>
            <th>Remarks</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <React.Fragment key={r.key}>
              <tr>
                <td>
                  <select className="gecko-input gecko-input-sm" value={r.kind} onChange={e => set(r.key, { kind: e.target.value })}>
                    {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </td>
                <td>
                  <select className="gecko-input gecko-input-sm" value={r.lineCode} onChange={e => set(r.key, { lineCode: e.target.value })}>
                    <option value="">every line</option>
                    {lines.map(l => <option key={l.lineCode} value={l.lineCode}>{l.lineCode}</option>)}
                  </select>
                </td>
                <td className="gecko-cell-meta" title={r.branchId ?? undefined}>{r.branchId ? 'one branch' : 'every branch'}</td>
                <td><input type="datetime-local" className="gecko-input gecko-input-sm" value={r.at} onChange={e => set(r.key, { at: e.target.value })} /></td>
                <td><input className="gecko-input gecko-input-sm" maxLength={300} value={r.remarks} onChange={e => set(r.key, { remarks: e.target.value })} /></td>
                <td>
                  <button type="button" aria-label="Remove cut-off" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-disabled)' }}>
                    <Icon name="trash" size={14} />
                  </button>
                </td>
              </tr>
              {rowError(i) && (
                <tr><td colSpan={6} style={{ color: 'var(--gecko-error-600)', fontSize: 11, paddingTop: 0 }}>{rowError(i)}</td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="gecko-row" style={{ gap: 8 }}>
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={add}><Icon name="plus" size={14} /> Add cut-off</button>
        <span className="gecko-cell-meta">A port cut-off with no whole-call yard cut-off gets one derived automatically.</span>
        <div className="gecko-row" style={{ gap: 8, marginLeft: 'auto' }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Close</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={save} disabled={busy}>
            <Icon name="save" size={14} /> {busy ? 'Saving…' : 'Save cut-offs'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── effective cut-offs ──────────────────────────────────────────────────────
function EffectivePanel({ callId, lines }: { callId: string; lines: Line[] }) {
  const [lineCode, setLineCode] = useState('');
  const path = `/api/tos/vessel-calls/${callId}/effective-cutoffs${lineCode ? `?lineCode=${encodeURIComponent(lineCode)}` : ''}`;
  const { data, error, loading } = useApi<Effective[]>(path);

  return (
    <div style={card}>
      <div style={cardHead}>
        <Icon name="clock" size={15} style={{ color: 'var(--gecko-primary-600)' }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>What applies</span>
        <select className="gecko-input gecko-input-sm" style={{ marginLeft: 'auto', width: 130 }} aria-label="Line"
          value={lineCode} onChange={e => setLineCode(e.target.value)}>
          <option value="">whole call</option>
          {lines.map(l => <option key={l.lineCode} value={l.lineCode}>{l.lineCode}</option>)}
        </select>
      </div>
      {error ? <div style={{ padding: 16 }}><ErrorBox error={error} /></div> : (
        <table className="gecko-table gecko-table-compact" style={{ fontSize: 12 }}>
          <tbody>
            {loading && !data ? (
              <tr><td className="gecko-cell-meta" style={{ padding: 16 }}>Loading…</td></tr>
            ) : (data ?? []).map(e => (
              <tr key={e.kind}>
                <td style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{e.kind}</td>
                <td style={{ fontFamily: 'var(--gecko-font-mono)' }}>{fmt(e.at)}</td>
                <td className="gecko-cell-meta">{e.appliesTo}{e.source === 'DERIVED' ? ' · derived' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="gecko-cell-meta" style={{ padding: '8px 20px', borderTop: '1px solid var(--gecko-border)' }}>
        The most specific row wins: line + branch › line › branch › whole call. The gate reads the same rule.
      </div>
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────────────
type Panel = 'none' | 'actuals' | 'cancel' | 'cutoffs';

export default function VesselCallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Detail>(`/api/tos/vessel-calls/${id}`);
  const [panel, setPanel] = useState<Panel>('none');

  const cutoffs = useMemo(() => [...(data?.cutoffs ?? [])].sort((a, b) => a.at.localeCompare(b.at) || a.kind.localeCompare(b.kind)), [data]);
  useEffect(() => { if (data?.call.isCancelled) setPanel('none'); }, [data?.call.isCancelled]);

  const done = () => { setPanel('none'); reload(); };

  if (loading && !data) {
    return <div className="gecko-cell-meta" style={{ padding: 60, textAlign: 'center' }}>Loading vessel call…</div>;
  }
  if (!data) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <Icon name="alertCircle" size={40} style={{ color: 'var(--gecko-text-disabled)' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{error?.status === 404 ? 'Vessel call not found' : 'Could not load the call'}</h2>
        <p style={{ color: 'var(--gecko-text-secondary)', margin: 0 }}>{error?.message}</p>
        {error?.status === 401 && <Link href="/login" className="gecko-link">Sign in</Link>}
        <Link href="/masters/vessels/schedule" className="gecko-btn gecko-btn-primary gecko-btn-sm">
          <Icon name="chevronLeft" size={14} /> Back to Schedule
        </Link>
      </div>
    );
  }

  const { call, lines } = data;
  const frozen = call.isCancelled;
  const toggle = (p: Panel) => setPanel(cur => (cur === p ? 'none' : p));

  return (
    <div className="gecko-stack" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', gap: 22, paddingBottom: 40 }}>

      <nav className="gecko-breadcrumb">
        <Link href="/masters" className="gecko-breadcrumb-item">Masters</Link>
        <span className="gecko-breadcrumb-sep" />
        <Link href="/masters/vessels/schedule" className="gecko-breadcrumb-item">Vessel Call Schedule</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">{call.callRef}</span>
      </nav>

      {/* Header */}
      <div className="gecko-row gecko-row-between gecko-row-start" style={{ paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <div className="gecko-row" style={{ gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--gecko-primary-50)', border: '2px solid var(--gecko-primary-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="ship" size={22} style={{ color: 'var(--gecko-primary-600)' }} />
          </div>
          <div>
            <div className="gecko-row" style={{ gap: 12 }}>
              <h1 className="gecko-page-title" style={{ fontFamily: 'var(--gecko-font-mono)' }}>{call.callRef}</h1>
              <StatusBadge status={call.status} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
              {call.vesselName ?? call.vesselCode} <span className="gecko-cell-meta">({call.vesselCode})</span>
              &nbsp;·&nbsp;<span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{call.portCode}</span>
              {call.terminalCode && <>&nbsp;·&nbsp;terminal <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{call.terminalCode}</span></>}
              {(call.operatorVoyageIn || call.operatorVoyageOut) && (
                <>&nbsp;·&nbsp;operator voyage {call.operatorVoyageIn ?? '—'} / {call.operatorVoyageOut ?? '—'}</>
              )}
            </div>
          </div>
        </div>
        <div className="gecko-row" style={{ gap: 8 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}><Icon name="refreshCcw" size={15} /> Refresh</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={frozen} onClick={() => toggle('actuals')}>
            <Icon name="anchor" size={15} /> Record actuals
          </button>
          {!call.ata && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={frozen} onClick={() => toggle('cancel')} style={{ color: frozen ? undefined : 'var(--gecko-error-600)' }}>
              <Icon name="x" size={15} /> Cancel call
            </button>
          )}
        </div>
      </div>

      {frozen && (
        <div role="status" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} />
          <span>
            Cancelled {fmt(call.cancelledAt)} — {call.cancelReason}. A cancelled call is read-only.
          </span>
        </div>
      )}

      {panel === 'actuals' && !frozen && (
        <div style={card}>
          <div style={cardHead}><Icon name="anchor" size={15} /><span style={{ fontSize: 13, fontWeight: 700 }}>Record actuals</span></div>
          <ActualsForm call={call} onDone={done} />
        </div>
      )}
      {panel === 'cancel' && !frozen && !call.ata && (
        <div style={{ ...card, borderColor: 'var(--gecko-error-200)' }}>
          <div style={cardHead}><Icon name="x" size={15} style={{ color: 'var(--gecko-error-600)' }} /><span style={{ fontSize: 13, fontWeight: 700 }}>Cancel {call.callRef}</span></div>
          <CancelForm call={call} onDone={done} />
        </div>
      )}

      {/* Timing */}
      <div style={card}>
        <div style={cardHead}>
          <Icon name="calendar" size={15} style={{ color: 'var(--gecko-primary-600)' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Port call timing</span>
          <span className="gecko-cell-meta" style={{ marginLeft: 'auto' }}>times in {TZ}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, padding: '16px 20px' }}>
          <TimeCell label="ETA" value={call.eta} />
          <TimeCell label="ETB" value={call.etb} />
          <TimeCell label="ETD" value={call.etd} strong />
          <TimeCell label="ATA" value={call.ata} />
          <TimeCell label="ATB" value={call.atb} />
          <TimeCell label="ATD" value={call.atd} strong />
        </div>
        {call.remarks && <div className="gecko-cell-meta" style={{ padding: '0 20px 14px' }}>{call.remarks}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
        <div className="gecko-stack" style={{ gap: 20 }}>

          {/* Lines */}
          <div style={card}>
            <div style={cardHead}>
              <Icon name="layers" size={15} style={{ color: 'var(--gecko-primary-600)' }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Lines on this call</span>
              <span className="gecko-cell-meta">— each with its own voyage; bookings and EDI match on line + voyage</span>
            </div>
            <table className="gecko-table gecko-table-compact" style={{ fontSize: 12.5 }}>
              <thead>
                <tr><th>Line</th><th>Voyage in</th><th>Voyage out</th><th>Agent</th><th>Service</th></tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr><td colSpan={5} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 20 }}>No lines — nobody can book against this call.</td></tr>
                ) : lines.map(l => (
                  <tr key={l.vesselCallLineId}>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{l.lineCode}</td>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)' }}>{l.voyageIn ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)' }}>{l.voyageOut ?? '—'}</td>
                    <td>{l.agentCode ?? <span className="gecko-cell-meta">—</span>}</td>
                    <td>{l.serviceCode ?? <span className="gecko-cell-meta">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cut-offs */}
          <div style={card}>
            <div style={cardHead}>
              <Icon name="clock" size={15} style={{ color: 'var(--gecko-primary-600)' }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Cut-offs</span>
              <span className="gecko-cell-meta">— yard before port before ETD, refused otherwise</span>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ marginLeft: 'auto' }} disabled={frozen} onClick={() => toggle('cutoffs')}>
                <Icon name="edit" size={14} /> {panel === 'cutoffs' ? 'Editing…' : 'Edit cut-offs'}
              </button>
            </div>
            {panel === 'cutoffs' && !frozen ? (
              <CutoffEditor call={call} lines={lines} cutoffs={cutoffs} onDone={done} onClose={() => setPanel('none')} />
            ) : (
              <table className="gecko-table gecko-table-compact" style={{ fontSize: 12.5 }}>
                <thead>
                  <tr><th style={{ width: 130 }}>Kind</th><th>Applies to</th><th style={{ width: 150 }}>At</th><th style={{ width: 190 }}>Source</th><th>Remarks</th></tr>
                </thead>
                <tbody>
                  {cutoffs.length === 0 ? (
                    <tr><td colSpan={5} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 20 }}>No cut-offs yet.</td></tr>
                  ) : cutoffs.map(c => (
                    <tr key={c.vesselCallCutoffId}>
                      <td style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{c.kind}</td>
                      <td>
                        {c.lineCode ? <>line <strong>{c.lineCode}</strong></> : c.branchId ? null : 'whole call'}
                        {c.branchId && <span title={c.branchId}>{c.lineCode ? ' · ' : ''}one branch</span>}
                      </td>
                      <td style={{ fontFamily: 'var(--gecko-font-mono)' }}>{fmt(c.at)}</td>
                      <td>
                        {c.source === 'DERIVED'
                          ? <span className="gecko-badge gecko-badge-xs gecko-badge-info" title="Computed from the port cut-off">DERIVED · −{c.derivedLeadHours} h from port</span>
                          : <span className="gecko-badge gecko-badge-xs gecko-badge-gray">{c.source}</span>}
                      </td>
                      <td className="gecko-cell-meta">{c.remarks ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <EffectivePanel callId={call.vesselCallId} lines={lines} />
      </div>
    </div>
  );
}
