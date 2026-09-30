"use client";

/**
 * The two dashboards that read from Gecko.Tos
 * (/api/tos/dashboard/overview and /api/tos/dashboard/gate-traffic).
 *
 * Each page is ONE request: the server does the aggregating, so the browser is
 * not pulling thousands of gate rows to count them.
 *
 * ZERO IS A REAL ANSWER. A depot that has not recorded a gate move today
 * returns zeros, nulls and empty lists, and that is correct — KORAKIT's
 * migration loaded the boxes currently in the yard, not their gate history, so
 * every figure here stays at zero until the pilot records live moves. The
 * screens have to make that read as "nothing yet", not as "broken".
 *
 * `null` and `0` are different answers and must not be collapsed:
 *   0    — we counted, and there were none
 *   null — there was nothing to average (no trucks, no moves, no capacity)
 */
import { useApi } from './use-api';
import { useSession } from '../auth/session';

/** A count today, yesterday, and the eight days ending today (oldest first). */
export interface CountTrend {
  today: number;
  previousDay: number;
  last8Days: number[];
}

/** Same shape, but a day with nothing to average is null rather than 0. */
export interface AverageTrend {
  today: number | null;
  previousDay: number | null;
  last8Days: (number | null)[];
}

export interface OverviewKpis {
  gateTransactions: CountTrend;
  truckTurnaroundMinutes: AverageTrend;
  eirOut: CountTrend;
  eirIn: CountTrend;
}

export interface MonthlyMoves {
  /** "yyyy-MM". */
  month: string;
  moves: number;
}

export interface DaySummary {
  emptyIn: number;
  emptyOut: number;
  ladenIn: number;
  ladenOut: number;
  teuMoved: number;
  /** Null when no yard at this depot records a capacity. */
  teuCapacity: number | null;
}

export interface LineMovement {
  lineCode: string;
  lineName: string | null;
  moves: number;
}

export interface ClosingVoyage {
  vesselCallId: string;
  voyageNo: string;
  vesselName: string | null;
  cutoffAt: string;
  hoursToCutoff: number;
  fullPct: number;
  emptyPct: number;
}

export type GateMoveStatus = 'COMPLETED' | 'VOIDED';
export type GateMoveDirection = 'IN' | 'OUT';

export interface RecentMove {
  gateTransactionId: string;
  containerNo: string;
  isoCode?: string | null;
  movementCode: string;
  direction: GateMoveDirection;
  lineCode?: string | null;
  truckPlate: string | null;
  at: string;
  status: GateMoveStatus;
}

export interface OverviewDashboard {
  date: string;
  branchId: string;
  kpis: OverviewKpis;
  monthlyMoves: MonthlyMoves[];
  todaySummary: DaySummary;
  movementByLine: LineMovement[];
  closingVoyages: ClosingVoyage[];
  recentTransactions: RecentMove[];
}

export interface GateTrafficKpis {
  trucksIn: { today: number; previousDay: number };
  avgTurnMinutes: { today: number | null; previousDay: number | null };
  throughputPerHour: number;
  /** "08:00", or null on a day with no moves. */
  peakHour: string | null;
}

export interface HourBucket {
  hour: number;
  moves: number;
}

export interface GateTrafficDashboard {
  date: string;
  branchId: string;
  kpis: GateTrafficKpis;
  hourly: HourBucket[];
  recentActivity: RecentMove[];
}

function path(endpoint: string, branchId: string, date?: string): string {
  const query = new URLSearchParams({ branchId });
  if (date) query.set('date', date);
  return `/api/tos/dashboard/${endpoint}?${query}`;
}

export function useOverviewDashboard(branchId: string | null, date?: string) {
  const { status } = useSession();
  const enabled = status === 'authenticated' && !!branchId;
  const { data, error, loading, reload } = useApi<OverviewDashboard>(
    enabled ? path('overview', branchId!, date) : null,
  );
  // useApi leaves `loading` true for a null path, which would pin the page on
  // its skeleton for a user with no depot.
  return { data, error, loading: enabled && loading, reload };
}

export function useGateTrafficDashboard(branchId: string | null, date?: string) {
  const { status } = useSession();
  const enabled = status === 'authenticated' && !!branchId;
  const { data, error, loading, reload } = useApi<GateTrafficDashboard>(
    enabled ? path('gate-traffic', branchId!, date) : null,
  );
  return { data, error, loading: enabled && loading, reload };
}

// ── presentation helpers ────────────────────────────────────────────────────

/**
 * Day-on-day change, as a whole percentage. Null when there is nothing to
 * compare against: yesterday at zero makes the change infinite, not 100%.
 */
export function deltaPct(today: number | null, previous: number | null): number | null {
  if (today === null || previous === null || previous === 0) return null;
  return Math.round(((today - previous) / previous) * 100);
}

/** A count, or "—" when the answer is "nothing to measure". */
export function orDash(value: number | null | undefined, suffix = ''): string {
  return value === null || value === undefined ? '—' : `${value.toLocaleString('en-US')}${suffix}`;
}

/** "14:32" in the depot's own offset — the API sends it with one, so keep it. */
export function timeOfDay(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? '—'
    : at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** "Mon, 29 Sep 2026" from a yyyy-MM-dd the server chose. */
export function longDate(date: string): string {
  const at = new Date(`${date}T00:00:00`);
  return Number.isNaN(at.getTime())
    ? date
    : at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

/** "2026-09" → "Sep". */
export function shortMonth(month: string): string {
  const at = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(at.getTime()) ? month : at.toLocaleDateString('en-GB', { month: 'short' });
}
