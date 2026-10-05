"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { RefreshButton } from '@/components/ui/RefreshButton';
import { useFacility } from '@/lib/api/facility';
import {
  deltaPct, longDate, orDash, shortMonth, timeOfDay,
  useOverviewDashboard,
  type AverageTrend, type ClosingVoyage, type CountTrend, type DaySummary,
  type LineMovement, type MonthlyMoves, type RecentMove,
} from '@/lib/api/dashboard';
import { ApiError } from '@/lib/api/problem';

/**
 * OPERATIONS OVERVIEW — live against /api/tos/dashboard/overview.
 *
 * Everything here is counted by the server for one depot on one day. The page
 * holds no numbers of its own.
 *
 * A quiet depot is the normal case right now: KORAKIT's migration loaded the
 * boxes standing in the yard, not the gate moves that put them there, so every
 * count reads zero until the depot starts recording. Each panel says so in its
 * own words rather than drawing an empty chart.
 */

// ── small shared pieces ─────────────────────────────────────────────────────

function Panel({ title, subtitle, actions, loading, error, empty, children }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  loading?: boolean;
  error?: ApiError | null;
  /** Shown instead of the body when the answer was "nothing yet". */
  empty?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="gecko-card gecko-card-padded">
      <div className="gecko-row gecko-row-start gecko-row-between gecko-dash-panel-head">
        <div>
          <div className="gecko-card-title">{title}</div>
          {subtitle && <div className="gecko-card-subtitle">{subtitle}</div>}
        </div>
        {actions}
      </div>
      <PanelBody loading={loading} error={error} empty={empty}>{children}</PanelBody>
    </div>
  );
}

function PanelBody({ loading, error, empty, children }: {
  loading?: boolean; error?: ApiError | null; empty?: string | null; children: React.ReactNode;
}) {
  if (loading) return <div className="gecko-dash-placeholder">Loading…</div>;
  if (error) return <PanelError error={error} />;
  if (empty) return <div className="gecko-dash-placeholder">{empty}</div>;
  return <>{children}</>;
}

function PanelError({ error }: { error: ApiError }) {
  return (
    <div className="gecko-dash-placeholder gecko-dash-placeholder-error">
      <Icon name="alertCircle" size={14} />
      <span>{error.title}</span>
      {error.explanation && <span className="gecko-dash-placeholder-detail">{error.explanation}</span>}
    </div>
  );
}

function Sparkline({ data, color }: { data: (number | null)[]; color: string }) {
  const points = data.filter((v): v is number => v !== null);
  if (points.length < 2) return null;
  const width = 96, height = 36;
  const max = Math.max(...points), min = Math.min(...points);
  const range = max - min || 1;
  // A null day (no trucks to average) breaks the line rather than pretending zero.
  const segments: string[] = [];
  let current: string[] = [];
  data.forEach((v, i) => {
    if (v === null) { if (current.length > 1) segments.push('M ' + current.join(' L ')); current = []; return; }
    current.push(`${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`);
  });
  if (current.length > 1) segments.push('M ' + current.join(' L '));
  if (!segments.length) return null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="gecko-sparkline">
      {segments.map((d, i) => (
        <path key={i} d={d} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

function KPICard({ label, sublabel, value, trend, spark, icon, accent, lowerIsBetter }: {
  label: string; sublabel: string; value: string;
  trend: { today: number | null; previousDay: number | null };
  spark: (number | null)[]; icon: string; accent: 'primary' | 'success' | 'accent' | 'info';
  /** Turnaround is the one metric where a fall is the good news. */
  lowerIsBetter?: boolean;
}) {
  const change = deltaPct(trend.today, trend.previousDay);
  const good = change === null ? false : lowerIsBetter ? change <= 0 : change >= 0;
  return (
    <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-lg">
      <div className="gecko-row gecko-row-start gecko-row-between">
        <div>
          <div className="gecko-dash-kpi-label">{label}</div>
          <div className="gecko-cell-sub gecko-dash-kpi-sublabel">{sublabel}</div>
        </div>
        <div className={`gecko-mini-icon gecko-mini-icon-${accent}`}>
          <Icon name={icon} size={16} />
        </div>
      </div>
      <div className="gecko-row gecko-row-end gecko-row-between gecko-stack-md">
        <div>
          <div className="gecko-stat-num gecko-dash-kpi-value">{value}</div>
          {change !== null && (
            <div className={`gecko-dash-kpi-delta ${good ? 'gecko-dash-kpi-delta-up' : 'gecko-dash-kpi-delta-down'}`}>
              <Icon name={change >= 0 ? 'arrowUp' : 'arrowDown'} size={11} stroke={2.5} />
              {change >= 0 ? '+' : ''}{change}%
              <span className="gecko-dash-kpi-delta-note">vs yesterday</span>
            </div>
          )}
        </div>
        <Sparkline data={spark} color={`var(--gecko-${accent}-600)`} />
      </div>
    </div>
  );
}

// ── panels ──────────────────────────────────────────────────────────────────

function MonthlyMovesChart({ months }: { months: MonthlyMoves[] }) {
  const max = Math.max(...months.map(m => m.moves), 1);
  const lastIndex = months.length - 1;
  return (
    <div className="gecko-dash-bars">
      {months.map((m, i) => (
        <div key={m.month} className="gecko-dash-bar-col" title={`${m.month}: ${m.moves.toLocaleString('en-US')} moves`}>
          <div className="gecko-dash-bar-track">
            <div
              className={`gecko-dash-bar ${i === lastIndex ? 'gecko-dash-bar-current' : ''}`}
              style={{ height: `${(m.moves / max) * 100}%` }}
            >
              {i === lastIndex && m.moves > 0 && <span className="gecko-dash-bar-value">{m.moves.toLocaleString('en-US')}</span>}
            </div>
          </div>
          <div className="gecko-cell-meta gecko-dash-bar-label">{shortMonth(m.month)}</div>
        </div>
      ))}
    </div>
  );
}

function TodaySummary({ summary }: { summary: DaySummary }) {
  const rows = [
    { label: 'Empty In', value: summary.emptyIn, tone: 'info' },
    { label: 'Empty Out', value: summary.emptyOut, tone: 'primary' },
    { label: 'Laden In', value: summary.ladenIn, tone: 'success' },
    { label: 'Laden Out', value: summary.ladenOut, tone: 'accent' },
  ];
  const peak = Math.max(...rows.map(r => r.value), 1);
  const utilisation = summary.teuCapacity
    ? Math.round((summary.teuMoved / summary.teuCapacity) * 100)
    : null;
  return (
    <>
      {rows.map(row => (
        <div key={row.label} className="gecko-dash-summary-row">
          <div className="gecko-row gecko-row-between gecko-row-baseline gecko-dash-summary-head">
            <span className="gecko-dash-summary-label">{row.label}</span>
            <span className="gecko-dash-summary-value">{row.value.toLocaleString('en-US')}</span>
          </div>
          <div className="gecko-progress gecko-progress-sm">
            <div className={`gecko-progress-bar gecko-progress-${row.tone}`} style={{ width: `${(row.value / peak) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="gecko-row gecko-row-between gecko-dash-summary-total">
        <span className="gecko-dash-summary-label">TEU moved</span>
        <span className="gecko-dash-summary-total-value">
          {summary.teuMoved.toLocaleString('en-US')}
          {summary.teuCapacity !== null && <span className="gecko-dash-summary-capacity"> / {summary.teuCapacity.toLocaleString('en-US')} capacity</span>}
          {utilisation !== null && <span className="gecko-dash-summary-capacity"> · {utilisation}%</span>}
        </span>
      </div>
    </>
  );
}

function LineBreakdown({ lines }: { lines: LineMovement[] }) {
  const max = Math.max(...lines.map(l => l.moves), 1);
  return (
    <>
      {lines.map(line => (
        <div key={line.lineCode} className="gecko-dash-line-row">
          <div className="gecko-dash-line-code">{line.lineCode.slice(0, 4)}</div>
          <div>
            <div className="gecko-dash-line-name">{line.lineName ?? line.lineCode}</div>
            <div className="gecko-progress gecko-progress-sm">
              <div className="gecko-progress-bar gecko-progress-primary" style={{ width: `${(line.moves / max) * 100}%` }} />
            </div>
          </div>
          <div className="gecko-dash-line-count">
            {line.moves.toLocaleString('en-US')}
            <div className="gecko-dash-line-unit">MOVES</div>
          </div>
        </div>
      ))}
    </>
  );
}

function urgency(hours: number): 'high' | 'med' | 'low' {
  if (hours <= 16) return 'high';
  if (hours <= 30) return 'med';
  return 'low';
}

function ClosingVoyages({ voyages }: { voyages: ClosingVoyage[] }) {
  return (
    <>
      {voyages.map(v => {
        const tone = urgency(v.hoursToCutoff);
        const hours = Math.max(0, Math.floor(v.hoursToCutoff));
        const minutes = Math.max(0, Math.round((v.hoursToCutoff - hours) * 60));
        return (
          <div key={v.vesselCallId} className="gecko-dash-voyage">
            <div className="gecko-row gecko-row-between gecko-dash-voyage-head">
              <div className="gecko-row">
                <Icon name="ship" size={14} className="gecko-text-secondary-icon" />
                <div>
                  <div className="gecko-dash-voyage-no">{v.voyageNo}</div>
                  <div className="gecko-cell-meta">{v.vesselName ?? '—'}</div>
                </div>
              </div>
              <div className={`gecko-row gecko-dash-voyage-eta gecko-dash-voyage-eta-${tone}`}>
                <Icon name="clock" size={12} />
                <span>{hours}h {String(minutes).padStart(2, '0')}m</span>
              </div>
            </div>
            <div className="gecko-grid-2 gecko-dash-voyage-bars">
              {[{ label: 'FULL', pct: v.fullPct, tone: 'primary' }, { label: 'EMPTY', pct: v.emptyPct, tone: 'accent' }].map(bar => (
                <div key={bar.label}>
                  <div className="gecko-row gecko-row-between gecko-dash-voyage-bar-head">
                    <span className="gecko-text-secondary">{bar.label}</span><span>{bar.pct}%</span>
                  </div>
                  <div className="gecko-progress gecko-progress-sm">
                    <div className={`gecko-progress-bar gecko-progress-${bar.tone}`} style={{ width: `${bar.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Direction, not movement code: tenants name their own moves (KORAKIT writes
 * FULL_IN where SCT writes GIE), so the arrow follows IN/OUT and the code is
 * shown verbatim beside it.
 */
function MoveDirection({ move }: { move: RecentMove }) {
  const inbound = move.direction === 'IN';
  return (
    <span className={`gecko-dash-move ${inbound ? 'gecko-dash-move-in' : 'gecko-dash-move-out'}`}>
      <Icon name={inbound ? 'arrowDown' : 'arrowUp'} size={12} stroke={2} />
      {move.direction}
      <span className="gecko-dash-move-code">{move.movementCode}</span>
    </span>
  );
}

function MoveStatus({ status }: { status: RecentMove['status'] }) {
  return status === 'VOIDED'
    ? <span className="gecko-badge gecko-badge-gray gecko-badge-xs">Voided</span>
    : <span className="gecko-badge gecko-badge-success gecko-badge-xs">Complete</span>;
}

// ── page ────────────────────────────────────────────────────────────────────

export default function DashboardOverviewPage() {
  const { branch, loading: facilityLoading } = useFacility();
  const { data, error, loading, reload } = useOverviewDashboard(branch?.branchId ?? null);

  const busy = loading || facilityLoading;
  const noDepot = !facilityLoading && !branch;
  const kpis = data?.kpis;

  const kpiCards: { label: string; sublabel: string; trend: CountTrend | AverageTrend; icon: string; accent: 'primary' | 'success' | 'accent' | 'info'; lowerIsBetter?: boolean }[] = [
    { label: 'Gate Transactions', sublabel: 'TODAY', trend: kpis?.gateTransactions ?? { today: 0, previousDay: 0, last8Days: [] }, icon: 'invoice', accent: 'primary' },
    { label: 'Truck Turnaround', sublabel: 'AVG MIN', trend: kpis?.truckTurnaroundMinutes ?? { today: null, previousDay: null, last8Days: [] }, icon: 'truck', accent: 'success', lowerIsBetter: true },
    { label: 'EIR-Out', sublabel: 'DELIVERIES', trend: kpis?.eirOut ?? { today: 0, previousDay: 0, last8Days: [] }, icon: 'arrowUp', accent: 'accent' },
    { label: 'EIR-In', sublabel: 'RECEIPTS', trend: kpis?.eirIn ?? { today: 0, previousDay: 0, last8Days: [] }, icon: 'arrowDown', accent: 'info' },
  ];

  return (
    <div className="gecko-stack gecko-dash-page">
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <h1 className="gecko-page-title-lg">Operations Overview</h1>
          <p className="gecko-page-subtitle">
            {data ? longDate(data.date) : '—'}
            {branch && <> · {branch.displayName}</>}
          </p>
        </div>
        <div className="gecko-page-header-actions">
          <RefreshButton resource="Dashboard" iconSize={14} onRefresh={reload} />
        </div>
      </div>

      {noDepot && (
        <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
          No depot is assigned to this account, so there is nothing to report on.
        </div>
      )}

      {error && !busy && (
        <div className="gecko-card gecko-card-padded"><PanelError error={error} /></div>
      )}

      {!noDepot && !error && (
        <>
          <div className="gecko-grid-4 gecko-dash-grid">
            {kpiCards.map(card => (
              <KPICard
                key={card.label}
                label={card.label}
                sublabel={card.sublabel}
                value={busy ? '—' : orDash(card.trend.today)}
                trend={card.trend}
                spark={card.trend.last8Days}
                icon={card.icon}
                accent={card.accent}
                lowerIsBetter={card.lowerIsBetter}
              />
            ))}
          </div>

          <div className="gecko-dash-row-2-1">
            <Panel
              title="Monthly Moves"
              subtitle="Last 12 months · gate in and out · this depot"
              loading={busy}
              empty={data && data.monthlyMoves.every(m => m.moves === 0) ? 'No gate moves recorded in the last 12 months.' : null}
            >
              {data && <MonthlyMovesChart months={data.monthlyMoves} />}
            </Panel>

            <Panel
              title="Today's Summary"
              subtitle="Whole depot day"
              loading={busy}
            >
              {data && <TodaySummary summary={data.todaySummary} />}
            </Panel>
          </div>

          <div className="gecko-grid-2 gecko-dash-grid">
            <Panel
              title="Movement by Shipping Line"
              subtitle="Last 7 days · top 5"
              loading={busy}
              empty={data && data.movementByLine.length === 0 ? 'No gate moves in the last 7 days.' : null}
            >
              {data && <LineBreakdown lines={data.movementByLine} />}
            </Panel>

            <Panel
              title="Closing Voyages"
              subtitle="Cutoff in the next 48 hours"
              loading={busy}
              empty={data && data.closingVoyages.length === 0 ? 'No vessel cutoffs in the next 48 hours.' : null}
            >
              {data && <ClosingVoyages voyages={data.closingVoyages} />}
            </Panel>
          </div>

          <div className="gecko-card gecko-card-flush">
            <div className="gecko-row gecko-row-between gecko-dash-table-head">
              <div>
                <div className="gecko-card-title">Recent Gate Transactions</div>
                <div className="gecko-card-subtitle">Last 10 gate moves at this depot</div>
              </div>
            </div>
            {busy
              ? <div className="gecko-dash-placeholder">Loading…</div>
              : data && data.recentTransactions.length === 0
                ? <div className="gecko-dash-placeholder">No gate activity recorded yet.</div>
                : (
                  <div className="gecko-table-wrapper gecko-dash-table-wrapper">
                    <table className="gecko-table gecko-dash-table">
                      <thead>
                        <tr>
                          <th>Unit</th><th>ISO</th><th>Move</th><th>Line</th><th>Truck</th><th>Time</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.recentTransactions.map(move => (
                          <tr key={move.gateTransactionId} className={move.status === 'VOIDED' ? 'gecko-dash-row-voided' : ''}>
                            <td className="gecko-mono gecko-dash-cell-unit">{move.containerNo}</td>
                            <td>{move.isoCode ? <span className="gecko-badge gecko-badge-gray gecko-badge-xs">{move.isoCode}</span> : <span className="gecko-cell-meta">—</span>}</td>
                            <td><MoveDirection move={move} /></td>
                            <td className="gecko-dash-cell-line">{move.lineCode ?? '—'}</td>
                            <td className="gecko-cell-meta gecko-mono">{move.truckPlate ?? '—'}</td>
                            <td className="gecko-mono gecko-dash-cell-time">{timeOfDay(move.at)}</td>
                            <td><MoveStatus status={move.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
          </div>
        </>
      )}
    </div>
  );
}
