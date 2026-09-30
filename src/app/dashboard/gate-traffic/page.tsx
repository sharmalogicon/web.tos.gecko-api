"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { RefreshButton } from '@/components/ui/RefreshButton';
import { useFacility } from '@/lib/api/facility';
import {
  deltaPct, longDate, orDash, timeOfDay,
  useGateTrafficDashboard,
  type HourBucket, type RecentMove,
} from '@/lib/api/dashboard';
import { ApiError } from '@/lib/api/problem';

/**
 * GATE & TRAFFIC — live against /api/tos/dashboard/gate-traffic.
 *
 * WHAT THIS PAGE NO LONGER SHOWS, and why. It used to carry four panels with
 * no data model behind them anywhere in the platform:
 *
 *   - Appointment compliance (KPI and per-hour bars) — there is no appointment
 *     table in gecko_tos; /gate/appointments is still a mock screen.
 *   - "Lanes Active 4 / 6" and the live lane table — the gate has no concept of
 *     a lane: gate.gate_transaction records the move, not the booth it passed.
 *   - "Gate Queue — Next 10 Trucks" with driver and haulier names — nothing
 *     records a truck before it reaches the gate.
 *   - Turn-time distribution buckets — the API averages turnaround; it does not
 *     return the per-visit spread, and inventing buckets from an average is a
 *     lie with a chart around it.
 *
 * Each was invented fixture data. If any of them should exist, it is a piece of
 * platform work, not a UI change.
 */

function KpiCard({ label, value, sub, tone }: {
  label: string; value: string; sub?: React.ReactNode; tone: 'primary' | 'success' | 'info';
}) {
  return (
    <div className={`gecko-card gecko-card-padded gecko-stack gecko-gate-kpi gecko-gate-kpi-${tone}`}>
      <div className="gecko-stat-label">{label}</div>
      <div className="gecko-stat-num gecko-gate-kpi-value">{value}</div>
      {sub && <div className="gecko-gate-kpi-sub">{sub}</div>}
    </div>
  );
}

function Widget({ title, wide, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`gecko-card gecko-card-flush gecko-gate-widget ${wide ? 'gecko-gate-widget-wide' : ''}`}>
      <div className="gecko-gate-widget-head">{title}</div>
      <div className="gecko-gate-widget-body">{children}</div>
    </div>
  );
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

function HourlyChart({ hourly, peakHour }: { hourly: HourBucket[]; peakHour: string | null }) {
  const max = Math.max(...hourly.map(h => h.moves), 1);
  const peak = peakHour ? Number(peakHour.slice(0, 2)) : null;
  return (
    <div className="gecko-gate-hours">
      {hourly.map(bucket => (
        <div key={bucket.hour} className="gecko-gate-hour" title={`${String(bucket.hour).padStart(2, '0')}:00 — ${bucket.moves} moves`}>
          <div className="gecko-gate-hour-track">
            {bucket.moves > 0
              ? <div
                  className={`gecko-gate-hour-bar ${bucket.hour === peak ? 'gecko-gate-hour-bar-peak' : ''}`}
                  style={{ height: `${(bucket.moves / max) * 100}%` }}
                />
              : <div className="gecko-gate-hour-zero" />}
          </div>
          {bucket.hour % 3 === 0 && <div className="gecko-gate-hour-label">{String(bucket.hour).padStart(2, '0')}</div>}
        </div>
      ))}
    </div>
  );
}

function ActivityTable({ moves }: { moves: RecentMove[] }) {
  return (
    <div className="gecko-table-wrapper gecko-dash-table-wrapper">
      <table className="gecko-table gecko-dash-table">
        <thead>
          <tr><th>Unit</th><th>Move</th><th>Truck</th><th>Time</th><th>Status</th></tr>
        </thead>
        <tbody>
          {moves.map(move => (
            <tr key={move.gateTransactionId} className={move.status === 'VOIDED' ? 'gecko-dash-row-voided' : ''}>
              <td className="gecko-mono gecko-dash-cell-unit">{move.containerNo}</td>
              <td>
                <span className={`gecko-dash-move ${move.direction === 'IN' ? 'gecko-dash-move-in' : 'gecko-dash-move-out'}`}>
                  <Icon name={move.direction === 'IN' ? 'arrowDown' : 'arrowUp'} size={12} stroke={2} />
                  {move.direction}
                  <span className="gecko-dash-move-code">{move.movementCode}</span>
                </span>
              </td>
              <td className="gecko-cell-meta gecko-mono">{move.truckPlate ?? '—'}</td>
              <td className="gecko-mono gecko-dash-cell-time">{timeOfDay(move.at)}</td>
              <td>
                {move.status === 'VOIDED'
                  ? <span className="gecko-badge gecko-badge-gray gecko-badge-xs">Voided</span>
                  : <span className="gecko-badge gecko-badge-success gecko-badge-xs">Complete</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GateTrafficDashboardPage() {
  const { branch, loading: facilityLoading } = useFacility();
  const { data, error, loading, reload } = useGateTrafficDashboard(branch?.branchId ?? null);

  const busy = loading || facilityLoading;
  const noDepot = !facilityLoading && !branch;
  const k = data?.kpis;
  const trucksChange = deltaPct(k?.trucksIn.today ?? null, k?.trucksIn.previousDay ?? null);
  const turnChange = deltaPct(k?.avgTurnMinutes.today ?? null, k?.avgTurnMinutes.previousDay ?? null);
  const quiet = data && data.hourly.every(h => h.moves === 0);

  return (
    <div className="gecko-stack gecko-dash-page">
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <h1 className="gecko-page-title-lg">Gate &amp; Traffic</h1>
          <p className="gecko-page-subtitle">
            {data ? longDate(data.date) : '—'}
            {branch && <> · {branch.displayName}</>}
          </p>
        </div>
        <div className="gecko-page-header-actions">
          <RefreshButton resource="Gate traffic" iconSize={14} onRefresh={reload} />
        </div>
      </div>

      {noDepot && (
        <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
          No depot is assigned to this account, so there is nothing to report on.
        </div>
      )}

      {error && !busy && <div className="gecko-card gecko-card-padded"><PanelError error={error} /></div>}

      {!noDepot && !error && (
        <>
          <div className="gecko-grid-3 gecko-dash-grid">
            <KpiCard
              label="Trucks In Today"
              value={busy ? '—' : orDash(k?.trucksIn.today ?? null)}
              tone="primary"
              sub={trucksChange !== null
                ? <span className={trucksChange >= 0 ? 'gecko-dash-kpi-delta-up' : 'gecko-dash-kpi-delta-down'}>
                    {trucksChange >= 0 ? '↑' : '↓'} {Math.abs(trucksChange)}% vs yesterday
                  </span>
                : 'No comparison for yesterday'}
            />
            <KpiCard
              label="Avg Turn Time"
              value={busy ? '—' : k?.avgTurnMinutes.today === null || k?.avgTurnMinutes.today === undefined ? '—' : `${k.avgTurnMinutes.today} min`}
              tone="success"
              sub={turnChange !== null
                ? <span className={turnChange <= 0 ? 'gecko-dash-kpi-delta-up' : 'gecko-dash-kpi-delta-down'}>
                    {turnChange <= 0 ? '↓' : '↑'} {Math.abs(turnChange)}% vs yesterday
                  </span>
                : 'No trucks completed today'}
            />
            <KpiCard
              label="Gate Throughput"
              value={busy ? '—' : `${(k?.throughputPerHour ?? 0).toLocaleString('en-US')} / hr`}
              tone="info"
              sub={k?.peakHour ? `Peak hour: ${k.peakHour}` : 'No peak hour yet'}
            />
          </div>

          <div className="gecko-gate-grid">
            <Widget title="Hourly Gate Throughput" wide>
              {busy
                ? <div className="gecko-dash-placeholder">Loading…</div>
                : quiet
                  ? <div className="gecko-dash-placeholder">No gate activity recorded yet today.</div>
                  : data && <HourlyChart hourly={data.hourly} peakHour={data.kpis.peakHour} />}
            </Widget>

            <Widget title="Recent Gate Activity" wide>
              {busy
                ? <div className="gecko-dash-placeholder">Loading…</div>
                : data && data.recentActivity.length === 0
                  ? <div className="gecko-dash-placeholder">No gate activity recorded yet.</div>
                  : data && <ActivityTable moves={data.recentActivity} />}
            </Widget>
          </div>
        </>
      )}
    </div>
  );
}
