/**
 * THE CONTAINER INQUIRY — every box that has been through this depot, one row
 * each (Gecko.Tos ContainerInquiryEndpoints, 2026-10-08).
 *
 *   GET /api/tos/containers                 the register, paged
 *   GET /api/tos/containers/{containerNo}   one box for the pop-up
 *
 * ONE ROW PER BOX, not per stay: the row is the box's LATEST stay, whether it
 * is in the yard now or long gone. That is the difference between this and Yard
 * Stock, which only knows about boxes currently inside.
 *
 * The booking a row names is the one the box is on now, else the one it left
 * on, else the one it came in on — the server decides, and the screen never
 * second-guesses it.
 *
 * Read-only, and scoped like the gate: `tos.gate.view` per depot. Asking for a
 * depot the caller does not cover answers 403, a bad filter value 400.
 */
import { apiGet } from './client';
import type { ActiveHold } from './gate-eir';
import type { ContainerStory } from './container-story';

export const CONTAINERS_PATH = '/api/tos/containers';

export const INQUIRY_PERMISSION = 'tos.gate.view';

/** IN_YARD while the box is inside; OUT_OF_YARD once it has gated out. */
export type InquiryStatus = 'IN_YARD' | 'OUT_OF_YARD';

/**
 * How the register is ordered. LAST_ACTIVITY is the server's default and the
 * one a clerk wants: whatever moved most recently, first.
 */
export type InquirySort = 'LAST_ACTIVITY' | 'GATE_IN' | 'OLDEST_IN' | 'CONTAINER_NO';

export const SORTS: { value: InquirySort; label: string }[] = [
  { value: 'LAST_ACTIVITY', label: 'Last activity' },
  { value: 'GATE_IN', label: 'Newest gate-in' },
  { value: 'OLDEST_IN', label: 'Oldest gate-in' },
  { value: 'CONTAINER_NO', label: 'Container number' },
];

/**
 * One box's latest stay.
 *
 * `daysInYard` runs to today while the box is in and stops at the gate-out once
 * it has left — the API does that arithmetic, in the depot's calendar days, so
 * this screen never computes a dwell of its own.
 */
export interface InquiryRow {
  containerNo: string;
  status: InquiryStatus;
  containerVisitId: string;
  branchId: string;
  branchCode: string | null;
  equipmentTypeCode: string | null;
  sizeCode: string | null;
  heightClass: string | null;
  isReefer: boolean;
  fullEmpty: string;
  lineCode: string;
  lineName: string | null;
  agentCode: string | null;
  agentName: string | null;
  customerCode: string | null;
  customerName: string | null;
  conditionCode: string | null;
  gradeCode: string | null;
  yardId: string | null;
  positionText: string | null;
  gateInTransactionId: string;
  gateInAt: string;
  gateInEirNo: string;
  gateInMovementCode: string;
  gateOutTransactionId: string | null;
  gateOutAt: string | null;
  gateOutEirNo: string | null;
  gateOutMovementCode: string | null;
  daysInYard: number;
  isHeld: boolean;
  bookingId: string | null;
  orderNo: string | null;
  carrierRef: string | null;
  subBlNo: string | null;
  lastEventAt: string;
}

/** What master data says the box IS, as opposed to what it did. Null when unregistered. */
export interface InquiryRegistry {
  containerId: string;
  equipmentTypeCode: string | null;
  status: string;
  isCheckDigitValid: boolean;
  fixedPortCodes: string[];
}

/**
 * One box in full.
 *
 * `latest` is NULL for a box that is on a booking and has never been through
 * the gate — booked, never gated in. The pop-up says exactly that rather than
 * drawing an empty stay.
 */
export interface InquiryDetail {
  containerNo: string;
  latest: InquiryRow | null;
  registry: InquiryRegistry | null;
  holds: ActiveHold[];
  story: ContainerStory;
}

/** Every filter the register offers. Blank values are left off the query. */
export interface InquiryQuery {
  search: string;
  branchId: string;
  status: string;
  fullEmpty: string;
  sizeCode: string;
  equipmentTypeCode: string;
  /** 'true' narrows to reefers; '' leaves both. */
  reefer: string;
  lineCode: string;
  agentCode: string;
  customerCode: string;
  /** Matches an order no, a carrier ref or a B/L — part of any of them. */
  booking: string;
  conditionCode: string;
  gradeCode: string;
  heldOnly: string;
  /** ISO with an offset; the API compares `gateInAt >= from` and `< to`. */
  gateInFrom: string;
  gateInTo: string;
  sort: string;
}

export const blankInquiryQuery = (): InquiryQuery => ({
  search: '', branchId: '', status: '', fullEmpty: '', sizeCode: '', equipmentTypeCode: '',
  reefer: '', lineCode: '', agentCode: '', customerCode: '', booking: '',
  conditionCode: '', gradeCode: '', heldOnly: '', gateInFrom: '', gateInTo: '', sort: 'LAST_ACTIVITY',
});

/**
 * The query string, with empties dropped.
 *
 * `search` and the rest go as the API names them — `Page`/`PageSize` capitalised
 * like the other TOS lists, the filters lower-cased as the handler declares them.
 */
export function inquiryPath(q: InquiryQuery, page: number, pageSize: number): string {
  const p = new URLSearchParams({ Page: String(page), PageSize: String(pageSize) });
  const put = (key: string, value: string) => { if (value.trim()) p.set(key, value.trim()); };
  put('Search', q.search);
  put('branchId', q.branchId);
  put('status', q.status);
  put('fullEmpty', q.fullEmpty);
  put('sizeCode', q.sizeCode);
  put('equipmentTypeCode', q.equipmentTypeCode);
  put('reefer', q.reefer);
  put('lineCode', q.lineCode);
  put('agentCode', q.agentCode);
  put('customerCode', q.customerCode);
  put('booking', q.booking);
  put('conditionCode', q.conditionCode);
  put('gradeCode', q.gradeCode);
  put('heldOnly', q.heldOnly);
  put('gateInFrom', q.gateInFrom);
  put('gateInTo', q.gateInTo);
  put('sort', q.sort);
  return `${CONTAINERS_PATH}?${p.toString()}`;
}

export const containerInquiryPath = (containerNo: string) =>
  `${CONTAINERS_PATH}/${encodeURIComponent(containerNo)}`;

export const getContainerInquiry = (containerNo: string) =>
  apiGet<InquiryDetail>(containerInquiryPath(containerNo));

/**
 * A date the clerk picked, as the API wants it.
 *
 * `gateInTo` is EXCLUSIVE (`gateInAt < to`), so "to 08-10" has to mean the end
 * of the 8th, not its first instant — otherwise a box gated in that morning
 * falls outside a range that names its own day.
 */
export const dayStart = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toISOString() : '');
export const dayEnd = (iso: string) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

export const STATUS_LABEL: Record<string, string> = {
  IN_YARD: 'In yard',
  OUT_OF_YARD: 'Out of yard',
};
