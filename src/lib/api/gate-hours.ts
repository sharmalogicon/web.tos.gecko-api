/**
 * Gate hours — Gecko.MasterData /api/master/gate-hours.
 *
 *   windows     GET/POST /windows?branchId=        PUT/DELETE /windows/{id}
 *   exceptions  GET/POST /exceptions?branchId=&year=  PUT/DELETE /exceptions/{id}
 *   status      GET /status?branchId=[&at=]        open now / next opening
 *
 * Reads need mdm.org.view, writes mdm.org.manage AT the depot. Every row has
 * its own rowVersion; a stale one is a 409. A depot with no windows is
 * NOT_CONFIGURED and the barrier does not check hours there.
 */
import { apiSend } from './client';
import { withVersion } from './lookups';

const BASE = '/api/master/gate-hours';

export interface GateHoursWindow {
  gateHoursWindowId?: string;
  branchId: string;
  /** 1 = Monday … 7 = Sunday. */
  isoWeekday: number;
  /** "HH:mm" */
  opensAt: string;
  /** "HH:mm"; at or before opensAt = runs past midnight. */
  closesAt: string;
  isOvernight?: boolean;
  minutes?: number;
  rowVersion?: string;
}

export interface GateHoursException {
  gateHoursExceptionId?: string;
  branchId: string;
  /** yyyy-MM-dd */
  exceptionDate: string;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  reason: string;
  rowVersion?: string;
}

export type GateHoursState = 'OPEN' | 'OUTSIDE_HOURS' | 'HOLIDAY' | 'CLOSED_DATE' | 'NOT_CONFIGURED';

export interface GateHoursStatus {
  branchId: string;
  isConfigured: boolean;
  isOpen: boolean;
  state: GateHoursState;
  note: string | null;
  /** DateTimeOffsets in the depot's own offset (+07:00) — print as given. */
  localAt: string;
  openUntil: string | null;
  nextOpensAt: string | null;
}

export const windowsPath = (branchId: string) => `${BASE}/windows?branchId=${encodeURIComponent(branchId)}`;
export const exceptionsPath = (branchId: string, year: number) =>
  `${BASE}/exceptions?branchId=${encodeURIComponent(branchId)}&year=${year}`;
export const statusPath = (branchId: string) => `${BASE}/status?branchId=${encodeURIComponent(branchId)}`;

export function saveWindow(w: GateHoursWindow) {
  const body = { branchId: w.branchId, isoWeekday: Number(w.isoWeekday), opensAt: w.opensAt, closesAt: w.closesAt };
  return w.gateHoursWindowId
    ? apiSend<GateHoursWindow>('PUT', `${BASE}/windows/${w.gateHoursWindowId}`, { ...body, rowVersion: w.rowVersion })
    : apiSend<GateHoursWindow>('POST', `${BASE}/windows`, body);
}

export const deleteWindow = (w: GateHoursWindow) =>
  apiSend<void>('DELETE', withVersion(`${BASE}/windows/${w.gateHoursWindowId}`, w.rowVersion ?? ''));

export function saveException(x: GateHoursException) {
  const body = {
    branchId: x.branchId, exceptionDate: x.exceptionDate, isClosed: x.isClosed,
    opensAt: x.isClosed ? null : x.opensAt, closesAt: x.isClosed ? null : x.closesAt, reason: x.reason.trim(),
  };
  return x.gateHoursExceptionId
    ? apiSend<GateHoursException>('PUT', `${BASE}/exceptions/${x.gateHoursExceptionId}`, { ...body, rowVersion: x.rowVersion })
    : apiSend<GateHoursException>('POST', `${BASE}/exceptions`, body);
}

export const deleteException = (x: GateHoursException) =>
  apiSend<void>('DELETE', withVersion(`${BASE}/exceptions/${x.gateHoursExceptionId}`, x.rowVersion ?? ''));

export const WEEKDAYS = [
  { value: '1', label: 'Monday' }, { value: '2', label: 'Tuesday' }, { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' }, { value: '5', label: 'Friday' }, { value: '6', label: 'Saturday' },
  { value: '7', label: 'Sunday' },
];

export const weekdayName = (isoWeekday: number | string) => WEEKDAYS[Number(isoWeekday) - 1]?.label ?? String(isoWeekday);

/** "8h" / "7h 30m". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * The depot's wall time from an offset ISO string ("2026-09-30T22:00:00+07:00"),
 * read off the string — never converted to the browser's zone.
 */
export function wallTime(iso: string): { date: string; time: string } {
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** "Wed 30 Sep 2026" from yyyy-MM-dd (a calendar date, no zone). */
export function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
