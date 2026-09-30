/**
 * The stock on hand, counted — Gecko.Tos GET /api/tos/yard/stock.
 *
 * The same boxes as the stock list (/api/tos/yard/containers, yard.vw_container_in_yard),
 * tallied by yard, area, type, line, customer, condition and grade, and as pools of
 * type × line × grade × condition. tos.gate.view per depot; a clerk counts only their depot.
 *
 * KORAKIT locates boxes at yard level: the "area" is the position text the gate
 * wrote (Vector's area code), not a bay/row/tier slot.
 */

export interface YardStockTally {
  boxes: number;
  /** From MDM's equipment type; a box whose type MDM does not know adds no TEU. */
  teu: number;
  full: number;
  empty: number;
  reefer: number;
  held: number;
  days0To7: number;
  days8To14: number;
  days15To30: number;
  daysOver30: number;
  maxDays: number;
}

/** `code` is null for boxes with nothing on that axis (no area, no grade…). `name` is MDM's, for parties. */
export interface YardStockGroup {
  code: string | null;
  name: string | null;
  tally: YardStockTally;
}

export interface YardStockYard {
  /** null = boxes not placed in any yard. */
  yardId: string | null;
  tally: YardStockTally;
  areas: YardStockGroup[];
}

export interface YardStockPool {
  equipmentTypeCode: string | null;
  sizeCode: string | null;
  lineCode: string;
  lineName: string | null;
  gradeCode: string | null;
  conditionCode: string | null;
  tally: YardStockTally;
}

export interface YardStock {
  asAt: string;
  branchId: string | null;
  yardId: string | null;
  fullEmpty: 'FULL' | 'EMPTY' | null;
  total: YardStockTally;
  yards: YardStockYard[];
  types: YardStockGroup[];
  lines: YardStockGroup[];
  customers: YardStockGroup[];
  conditions: YardStockGroup[];
  grades: YardStockGroup[];
  pools: YardStockPool[];
}

export type StockLoad = '' | 'FULL' | 'EMPTY';

export const YARD_STOCK_PERMISSIONS = {
  view: 'tos.gate.view',
  yards: 'mdm.org.view',
} as const;

export function yardStockPath(q: { branchId?: string; yardId?: string; fullEmpty?: StockLoad }): string {
  const parts: string[] = [];
  if (q.branchId) parts.push(`branchId=${encodeURIComponent(q.branchId)}`);
  if (q.yardId) parts.push(`yardId=${encodeURIComponent(q.yardId)}`);
  if (q.fullEmpty) parts.push(`fullEmpty=${q.fullEmpty}`);
  return '/api/tos/yard/stock' + (parts.length ? `?${parts.join('&')}` : '');
}

export function teuLabel(teu: number): string {
  return Number.isInteger(teu) ? teu.toLocaleString() : teu.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Share of a yard's declared capacity; null when the yard has none. */
export function occupancy(teu: number, capacityTeu: number | null | undefined): number | null {
  return capacityTeu && capacityTeu > 0 ? teu / capacityTeu : null;
}
