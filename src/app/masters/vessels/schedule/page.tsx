"use client";
import React, { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ExportButton } from '@/components/ui/ExportButton';
import { useApiList } from '@/lib/api/use-api';

/**
 * LIVE against gecko_tos (vessel.vessel_call + lines + cut-offs), batch A.
 *
 * One chip = one PHYSICAL call, placed on its ETD. Several lines share a call,
 * each with its own voyage (slot charters) — the mock drew one voyage per line,
 * which is exactly Vector's mistake (12,291 real calls stored as 15,515 rows).
 * Chips are coloured by the DERIVED status (vw_vessel_call_status), because a
 * status somebody has to remember to set is the IsClosed flag Vector never set.
 *
 * What the mock had and the API does not, so it is gone rather than faked:
 *  - inbound / outbound: a call at Laem Chabang both discharges and loads; the
 *    direction belongs to the BOOKING (batch B), not to the ship.
 *  - POL / POD: the call is at one port; the booking carries its destination.
 *  - TEU filled: that is the sum of bookings on the call — batch B.
 *  - berth / wharf: the terminal is stored (LCB-A0, LCB-C1C2 …); a berth
 *    number is not.
 */

interface CallSummary {
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
  lastYardCutoffAt: string | null;
  status: string;
  lines: string[];
}

// ── Status vocabulary (vessel.vw_vessel_call_status) ─────────────────────────

const STATUS: Record<string, { label: string; dot: string; bg: string; text: string; hint: string }> = {
  OPEN:                 { label: 'Open',                  dot: '#16A34A', bg: '#F0FDF4', text: '#166534', hint: 'Receiving export boxes' },
  CLOSED_FOR_RECEIVING: { label: 'Closed for receiving',  dot: '#D97706', bg: '#FFFBEB', text: '#92400E', hint: 'Past every yard cut-off' },
  ARRIVED:              { label: 'Arrived',               dot: '#2563EB', bg: '#EFF6FF', text: '#1E40AF', hint: 'At anchor / in port, not berthed' },
  WORKING:              { label: 'Working',               dot: '#7C3AED', bg: '#F5F3FF', text: '#5B21B6', hint: 'Berthed, loading and discharging' },
  DEPARTED:             { label: 'Departed',              dot: '#6B7280', bg: '#F3F4F6', text: '#374151', hint: 'ATD recorded' },
  DEPARTED_UNCONFIRMED: { label: 'Departed (unconfirmed)', dot: '#9CA3AF', bg: '#F9FAFB', text: '#4B5563', hint: 'ETD passed over 24 h ago and nobody recorded the ATD' },
  CANCELLED:            { label: 'Cancelled',             dot: '#DC2626', bg: '#FEF2F2', text: '#991B1B', hint: 'Will not call' },
};
const statusOf = (s: string) => STATUS[s] ?? { label: s, dot: '#6B7280', bg: '#F3F4F6', text: '#374151', hint: '' };

// ── Dates: the calendar is in the viewer's local time ────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const localDayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDateTime = (iso: string | null) => iso
  ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  : '—';
const hoursUntil = (iso: string | null) => iso ? (new Date(iso).getTime() - Date.now()) / 3_600_000 : null;

// ── Popover ───────────────────────────────────────────────────────────────────

function CallPopover({ call, anchorRect, containerRect }: { call: CallSummary; anchorRect: DOMRect; containerRect: DOMRect }) {
  const s = statusOf(call.status);
  const CARD_W = 290;
  const CARD_H = 240 + call.lines.length * 18;
  const midX = anchorRect.left - containerRect.left + anchorRect.width / 2;
  const below = anchorRect.bottom - containerRect.top + 8;
  const above = anchorRect.top - containerRect.top - 8;
  const flipUp = below + CARD_H > containerRect.height - 20;
  const left = Math.min(Math.max(midX - CARD_W / 2, 8), containerRect.width - CARD_W - 8);
  const closesIn = call.status === 'OPEN' ? hoursUntil(call.lastYardCutoffAt) : null;

  return (
    <div style={{
      position: 'absolute', zIndex: 100, left, top: flipUp ? above - CARD_H : below, width: CARD_W,
      background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12,
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)', overflow: 'hidden', pointerEvents: 'none',
    }}>
      <div style={{ background: s.bg, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 13, fontWeight: 700, color: s.text }}>{call.callRef}</div>
          <div style={{ fontSize: 11, color: s.text, opacity: 0.85, marginTop: 1 }}>{call.vesselName ?? call.vesselCode}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'var(--gecko-bg-surface)', color: s.text, border: `1px solid ${s.dot}55`, whiteSpace: 'nowrap' }}>
          {s.label.toUpperCase()}
        </span>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><div className="gecko-eyebrow">ETA</div><div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>{fmtDateTime(call.eta)}</div></div>
          <div><div className="gecko-eyebrow">ETD</div><div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>{fmtDateTime(call.etd)}</div></div>
        </div>
        <div>
          <div className="gecko-eyebrow" style={{ marginBottom: 4 }}>Lines on this call</div>
          {call.lines.length === 0
            ? <div className="gecko-cell-meta">none — nobody can book against it</div>
            : call.lines.map(l => (
              <div key={l} style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11.5, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{l}</div>
            ))}
        </div>
        <div className="gecko-row gecko-row-wrap" style={{ gap: 6 }}>
          {call.terminalCode && (
            <span style={{ fontSize: 11, color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-50)', padding: '3px 8px', borderRadius: 6, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="anchor" size={11} /> {call.terminalCode}
            </span>
          )}
          {call.lastYardCutoffAt && (
            <span style={{ fontSize: 11, color: closesIn !== null && closesIn < 48 ? 'var(--gecko-warning-700)' : 'var(--gecko-text-secondary)', background: 'var(--gecko-bg-subtle)', padding: '3px 8px', borderRadius: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="clock" size={11} /> Yard closes {fmtDateTime(call.lastYardCutoffAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Calendar pieces ───────────────────────────────────────────────────────────

function CallChip({ call, onHover, onLeave }: { call: CallSummary; onHover: (c: CallSummary, r: DOMRect) => void; onLeave: () => void }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const s = statusOf(call.status);
  return (
    <Link
      ref={ref}
      href={`/masters/vessels/schedule/${call.vesselCallId}`}
      onMouseEnter={() => ref.current && onHover(call, ref.current.getBoundingClientRect())}
      onMouseLeave={onLeave}
      onFocus={() => ref.current && onHover(call, ref.current.getBoundingClientRect())}
      onBlur={onLeave}
      aria-label={`${call.callRef}, ${s.label}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 5, minWidth: 0,
        background: s.bg, border: `1px solid ${s.dot}55`, textDecoration: 'none',
        textDecorationLine: call.status === 'CANCELLED' ? 'line-through' : 'none',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: s.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {call.vesselCode}
      </span>
    </Link>
  );
}

function DayCell({ day, isToday, calls, onHover, onLeave }: {
  day: number; isToday: boolean; calls: CallSummary[];
  onHover: (c: CallSummary, r: DOMRect) => void; onLeave: () => void;
}) {
  const MAX = 3;
  return (
    <div style={{
      minHeight: 92, padding: '8px 6px 6px', border: '1px solid var(--gecko-border)', borderRadius: 8,
      background: isToday ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
    }}>
      <div style={{
        fontSize: 12, fontWeight: isToday ? 700 : 500, lineHeight: 1,
        color: isToday ? '#fff' : 'var(--gecko-text-secondary)',
        ...(isToday ? { width: 22, height: 22, background: 'var(--gecko-primary-600)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}),
      }}>{day}</div>
      {calls.slice(0, MAX).map(c => <CallChip key={c.vesselCallId} call={c} onHover={onHover} onLeave={onLeave} />)}
      {calls.length > MAX && <div className="gecko-cell-meta" style={{ fontSize: 10, fontWeight: 700 }}>+{calls.length - MAX} more</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VesselSchedulePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [status, setStatus] = useState('');
  const [hovered, setHovered] = useState<{ call: CallSummary; rect: DOMRect } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One month of calls by ETD, local month boundaries sent as instants.
  const path = useMemo(() => {
    const params = new URLSearchParams({
      from: new Date(year, month, 1).toISOString(),
      to: new Date(year, month + 1, 1).toISOString(),
      pageSize: '200',
    });
    if (status) params.set('status', status);
    return `/api/tos/vessel-calls?${params.toString()}`;
  }, [year, month, status]);
  const { data, error, loading, reload } = useApiList<CallSummary>(path);
  const calls = useMemo(() => data ?? [], [data]);

  const byDay = useMemo(() => {
    const map = new Map<string, CallSummary[]>();
    for (const c of calls) {
      const key = localDayKey(new Date(c.etd));
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return map;
  }, [calls]);

  const kpis = useMemo(() => {
    const live = calls.filter(c => c.status !== 'CANCELLED');
    return {
      total: live.length,
      open: calls.filter(c => c.status === 'OPEN').length,
      closingSoon: calls.filter(c => c.status === 'OPEN' && (hoursUntil(c.lastYardCutoffAt) ?? Infinity) < 48).length,
      stale: calls.filter(c => c.status === 'DEPARTED_UNCONFIRMED').length,
      lines: new Set(live.flatMap(c => c.lines.map(l => l.split(' ')[0]))).size,
    };
  }, [calls]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = new Date(year, month, 1).getDay();
  const totalCells = Math.ceil((blanks + daysInMonth) / 7) * 7;
  const todayKey = localDayKey(now);

  const onHover = (call: CallSummary, rect: DOMRect) => { if (leaveTimer.current) clearTimeout(leaveTimer.current); setHovered({ call, rect }); };
  const onLeave = () => { leaveTimer.current = setTimeout(() => setHovered(null), 80); };
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const containerRect = containerRef.current?.getBoundingClientRect() ?? null;

  return (
    <div className="gecko-stack" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', gap: 20, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Vessel Call Schedule</h1>
            <span className="gecko-count-badge">{loading && !data ? '…' : `${calls.length} calls in ${MONTH_NAMES[month]}`}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            One entry per ship call, on its ETD. Each line on the call keeps its own voyage — that is what bookings and EDI match on.
          </div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton resource="Vessel schedule" variant="outline" iconSize={16} />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={16} /> Refresh
          </button>
          <Link href="/masters/vessels/schedule/new" className="gecko-btn gecko-btn-primary gecko-btn-sm">
            <Icon name="plus" size={16} /> New Call
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} />
          <span>{error.message}</span>
          {error.status === 401 && <Link href="/login" className="gecko-link">Sign in</Link>}
        </div>
      )}

      {/* KPIs for the visible month */}
      <div className="gecko-kpi-strip gecko-kpi-strip-5">
        {[
          { label: 'Calls', value: kpis.total, sub: 'excluding cancelled', color: 'var(--gecko-text-primary)' },
          { label: 'Open for receiving', value: kpis.open, sub: 'yard still accepting', color: 'var(--gecko-success-700)' },
          { label: 'Yard closes < 48 h', value: kpis.closingSoon, sub: 'chase late exports now', color: 'var(--gecko-warning-700)' },
          { label: 'ATD not recorded', value: kpis.stale, sub: 'ETD passed > 24 h ago', color: 'var(--gecko-text-secondary)' },
          { label: 'Lines calling', value: kpis.lines, sub: 'distinct carriers', color: 'var(--gecko-primary-700)' },
        ].map(k => (
          <div key={k.label} className="gecko-kpi-cell">
            <div className="gecko-stat-label">{k.label}</div>
            <div className="gecko-stat-num" style={{ color: k.color }}>{loading && !data ? '…' : k.value}</div>
            <div className="gecko-card-subtitle">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, boxShadow: 'var(--gecko-shadow-sm)', overflow: 'hidden' }}>
        <div className="gecko-row gecko-row-between gecko-row-wrap" style={{ padding: '14px 20px', borderBottom: '1px solid var(--gecko-border)', gap: 12 }}>
          <div className="gecko-row" style={{ gap: 10 }}>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" onClick={prevMonth} aria-label="Previous month"><Icon name="chevronLeft" size={16} /></button>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--gecko-text-primary)', minWidth: 160, textAlign: 'center' }}>{MONTH_NAMES[month]} {year}</span>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" onClick={nextMonth} aria-label="Next month"><Icon name="chevronRight" size={16} /></button>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => { setMonth(now.getMonth()); setYear(now.getFullYear()); }}>Today</button>
            <select className="gecko-input gecko-input-sm" aria-label="Status" value={status} onChange={e => setStatus(e.target.value)} style={{ width: 200 }}>
              <option value="">All statuses</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="gecko-row gecko-row-wrap" style={{ gap: 10 }}>
            {Object.entries(STATUS).map(([k, v]) => (
              <span key={k} title={v.hint} className="gecko-row" style={{ gap: 5, fontSize: 11, fontWeight: 600, color: v.text }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: v.dot }} />{v.label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, padding: '12px 16px 4px', background: 'var(--gecko-bg-subtle)' }}>
          {DAY_LABELS.map(d => <div key={d} className="gecko-eyebrow" style={{ textAlign: 'center', padding: '4px 0' }}>{d}</div>)}
        </div>
        <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, padding: '4px 16px 16px', background: 'var(--gecko-bg-subtle)', position: 'relative' }}>
          {Array.from({ length: totalCells }).map((_, idx) => {
            const day = idx - blanks + 1;
            if (day < 1 || day > daysInMonth) return <div key={idx} style={{ minHeight: 92 }} />;
            const key = localDayKey(new Date(year, month, day));
            return <DayCell key={idx} day={day} isToday={key === todayKey} calls={byDay.get(key) ?? []} onHover={onHover} onLeave={onLeave} />;
          })}
          {hovered && containerRect && <CallPopover call={hovered.call} anchorRect={hovered.rect} containerRect={containerRect} />}
        </div>
      </div>

      {/* The month as a list — what the planner actually works down */}
      <div className="gecko-table-card">
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={{ width: 120 }}>ETD</th>
              <th style={{ width: 190 }}>Call</th>
              <th>Vessel</th>
              <th style={{ width: 100 }}>Terminal</th>
              <th>Lines &amp; voyages</th>
              <th style={{ width: 130 }}>Yard closes</th>
              <th style={{ width: 170 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--gecko-text-secondary)' }}>Loading calls…</td></tr>
            ) : calls.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--gecko-text-secondary)' }}>
                No calls in {MONTH_NAMES[month]} {year}{status ? ` with status ${statusOf(status).label}` : ''}.
              </td></tr>
            ) : calls.map(c => {
              const s = statusOf(c.status);
              const closesIn = c.status === 'OPEN' ? hoursUntil(c.lastYardCutoffAt) : null;
              return (
                <tr key={c.vesselCallId} style={{ opacity: c.status === 'CANCELLED' ? 0.6 : 1 }}>
                  <td style={{ fontFamily: 'var(--gecko-font-mono)', whiteSpace: 'nowrap' }}>{fmtDateTime(c.etd)}</td>
                  <td><Link href={`/masters/vessels/schedule/${c.vesselCallId}`} className="gecko-id-link">{c.callRef}</Link></td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{c.vesselName ?? c.vesselCode}</div>
                    {c.operatorVoyageOut && <div className="gecko-cell-meta">operator voyage {c.operatorVoyageOut}</div>}
                  </td>
                  <td className="gecko-text-mono">{c.terminalCode ?? '—'}</td>
                  <td>
                    <div className="gecko-row gecko-row-wrap" style={{ gap: 4 }}>
                      {c.lines.map(l => <span key={l} className="gecko-badge gecko-badge-xs gecko-badge-gray gecko-text-mono">{l}</span>)}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: closesIn !== null && closesIn < 48 ? 'var(--gecko-warning-700)' : undefined, fontWeight: closesIn !== null && closesIn < 48 ? 600 : undefined }}>
                    {fmtDateTime(c.lastYardCutoffAt)}
                  </td>
                  <td>
                    <span title={s.hint} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: s.bg, color: s.text }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />{s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
