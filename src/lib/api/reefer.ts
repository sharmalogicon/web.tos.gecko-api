/**
 * The reefer plug log (gecko_tos `yard.reefer_power_session`): when a reefer in the
 * yard was plugged in and out, as GET/POST/PUT/DELETE /api/tos/reefer return it.
 * TOS records the fact and the hours (per STARTED hour, computed, never stored);
 * Revenue prices the power from it — GET /api/revenue/reefer/power. The screen
 * never computes a price.
 *
 * Readings, alarms, PTI and pre-cool are not part of this log.
 */

import { apiGet, apiSend } from './client';
import type { Paged } from './use-api';

export const REEFER_PERMISSIONS = {
  view: 'tos.reefer.view',
  manage: 'tos.reefer.manage',
} as const;

export const REEFER_SESSIONS_PATH = '/api/tos/reefer/sessions';
export const REEFER_CANDIDATES_PATH = '/api/tos/reefer/candidates';
export const REEFER_POWER_PATH = '/api/revenue/reefer/power';
/** Revenue answers at most this many container visits per call. */
export const REEFER_POWER_MAX_IDS = 200;

export type ReeferStatus = 'OPEN' | 'CLOSED' | 'ALL';
export type ReeferCloseReason = 'MANUAL' | 'GATE_OUT';

export interface ReeferSession {
  id: string;
  containerVisitId: string;
  containerNo: string;
  branchId: string;
  branchCode: string | null;
  equipmentTypeCode: string | null;
  isoTypeCode: string | null;
  pluggedInAt: string;
  pluggedInBy: string | null;
  pluggedOutAt: string | null;
  pluggedOutBy: string | null;
  closeReason: ReeferCloseReason | null;
  closeGateTransactionId: string | null;
  plugPointCode: string | null;
  setPointC: number | null;
  remarks: string | null;
  /** Runs to now while the session is open. */
  minutesPlugged: number;
  /** Per started hour, for this session alone. */
  billableHours: number;
  isOpen: boolean;
  /** The write endpoints' own branch rule: false means a write would be refused. */
  canManage: boolean;
  rowVersion: string;
}

/** A reefer standing in the yard with nothing plugged in. */
export interface ReeferCandidate {
  containerVisitId: string;
  containerNo: string;
  branchId: string;
  branchCode: string | null;
  equipmentTypeCode: string | null;
  gateInAt: string | null;
  /** The booking line's set point, else what the gate read off the display. */
  suggestedSetPointC: number | null;
}

export type ReeferPowerOutcome = 'PRICED' | 'NO_SESSIONS' | 'CHARGE_CODE_NOT_SET' | 'RATE_NOT_SET' | 'PRICED_ZERO';

/**
 * Revenue's power charge for one container visit: all its sessions summed, then
 * rounded UP to the started hour once (61 min = 2 h).
 */
export interface ReeferPower {
  containerVisitId: string;
  containerNo: string;
  billableHours: number;
  minutesPlugged: number;
  outcome: ReeferPowerOutcome;
  chargeCode: string | null;
  amount: number | null;
  currency: string | null;
  message: string | null;
}

export interface PlugInRequest {
  containerNo: string;
  pluggedInAt?: string | null;
  plugPointCode?: string | null;
  setPointC?: number | null;
  remarks?: string | null;
}

export interface PlugOutRequest {
  pluggedOutAt?: string | null;
  /** When given, replaces the session's remarks; leave undefined to keep them. */
  remarks?: string;
  rowVersion: string;
}

export interface CorrectSessionRequest {
  pluggedInAt: string;
  /** Only for a closed session — a correction neither closes nor re-opens one. */
  pluggedOutAt?: string | null;
  plugPointCode?: string | null;
  setPointC?: number | null;
  remarks?: string | null;
  rowVersion: string;
}

export function sessionsPath(q: { status: ReeferStatus; branchId?: string; search?: string; from?: string; to?: string; page?: number; pageSize?: number }): string {
  const p = new URLSearchParams({ status: q.status });
  if (q.branchId) p.set('branchId', q.branchId);
  if (q.search) p.set('search', q.search);
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.page) p.set('page', String(q.page));
  if (q.pageSize) p.set('pageSize', String(q.pageSize));
  return `${REEFER_SESSIONS_PATH}?${p.toString()}`;
}

export function candidatesPath(branchId: string, search: string, pageSize = 50): string {
  const p = new URLSearchParams({ pageSize: String(pageSize) });
  if (branchId) p.set('branchId', branchId);
  if (search.trim()) p.set('search', search.trim());
  return `${REEFER_CANDIDATES_PATH}?${p.toString()}`;
}

/** The candidates endpoint pages its answer; accept a bare array too. */
export function candidateRows(data: Paged<ReeferCandidate> | ReeferCandidate[] | null): ReeferCandidate[] | null {
  if (data === null) return null;
  return Array.isArray(data) ? data : data.items;
}

/** Null when there is nothing to ask Revenue about (the page shows "—"). */
export function powerPath(containerVisitIds: string[]): string | null {
  const ids = [...new Set(containerVisitIds)].slice(0, REEFER_POWER_MAX_IDS);
  return ids.length ? `${REEFER_POWER_PATH}?containerVisitIds=${ids.map(encodeURIComponent).join(',')}` : null;
}

export const getSession = (id: string) => apiGet<ReeferSession>(`${REEFER_SESSIONS_PATH}/${id}`);
export const plugIn = (body: PlugInRequest) => apiSend<ReeferSession>('POST', REEFER_SESSIONS_PATH, body);
export const plugOut = (id: string, body: PlugOutRequest) =>
  apiSend<ReeferSession>('POST', `${REEFER_SESSIONS_PATH}/${id}/plug-out`, body);
export const correctSession = (id: string, body: CorrectSessionRequest) =>
  apiSend<ReeferSession>('PUT', `${REEFER_SESSIONS_PATH}/${id}`, body);
export const voidSession = (id: string, rowVersion: string) =>
  apiSend<void>('DELETE', `${REEFER_SESSIONS_PATH}/${id}?rowVersion=${encodeURIComponent(rowVersion)}`);

// ─── display helpers ─────────────────────────────────────────────────────────

export function closeReasonLabel(reason: ReeferCloseReason | null): string {
  if (reason === 'GATE_OUT') return 'Gate-out';
  if (reason === 'MANUAL') return 'Plugged out';
  return '—';
}

export function setPointLabel(c: number | null | undefined): string {
  if (c === null || c === undefined) return '—';
  return `${c > 0 ? '+' : ''}${Number(c).toFixed(1)} °C`;
}

/** 197 → "3 h 17 min". */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** What Revenue's answer shows: an amount only when priced; otherwise why not. */
export function powerLabel(p: ReeferPower): { text: string; priced: boolean } {
  if ((p.outcome === 'PRICED' || p.outcome === 'PRICED_ZERO') && p.amount !== null) {
    const amount = p.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return { text: `${amount} ${p.currency ?? ''}`.trim(), priced: true };
  }
  if (p.outcome === 'CHARGE_CODE_NOT_SET') return { text: 'Charge code not set', priced: false };
  if (p.outcome === 'NO_SESSIONS') return { text: 'No sessions', priced: false };
  return { text: 'Rate not set', priced: false };
}

/** An ISO instant as a `datetime-local` value, in the browser's time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` value as an ISO instant; null when blank ("now" on the server). */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** A `date` value's start (or end) of day in the browser's time, as an ISO instant. */
export function dayBound(value: string, end: boolean): string | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** A typed set point: blank → null, else the number (the API range-checks it). */
export function parseSetPoint(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
