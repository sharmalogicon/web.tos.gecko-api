/**
 * The two live reports.
 *
 *   GET /api/tos/reports/gate-moves?branchId=&from=&to=          moves by day, movement, customer, line, type
 *   GET /api/revenue/reports/receipts?branchId=&from=&to=        cash receipts by day, shift, cashier, customer, channel
 *   GET /api/revenue/reports/receipts/list?…&status=&search=     the receipts, paged
 *
 * from / to are DEPOT days (yyyy-MM-dd), both inclusive, at most 366 of them.
 * Gate moves need tos.gate.view at the depot; receipts need revenue.charge.view.
 */

export const REPORT_PERMISSIONS = {
  gateMoves: 'tos.gate.view',
  receipts: 'revenue.charge.view',
} as const;

export const GATE_MOVES_PATH = '/api/tos/reports/gate-moves';
export const RECEIPTS_PATH = '/api/revenue/reports/receipts';
export const RECEIPTS_LIST_PATH = '/api/revenue/reports/receipts/list';

export const reportPath = (base: string, branchId: string, from: string, to: string) =>
  `${base}?branchId=${encodeURIComponent(branchId)}&from=${from}&to=${to}`;

// ── gate moves ──────────────────────────────────────────────────────────────

export interface GateMovesTally {
  moves: number; in: number; out: number;
  fullIn: number; emptyIn: number; fullOut: number; emptyOut: number;
  teu: number;
}

export interface GateMovesGroup { code: string | null; name: string | null; tally: GateMovesTally }

export interface GateMovesReport {
  branchId: string;
  branchCode: string;
  from: string;
  to: string;
  total: GateMovesTally;
  voided: number;
  /** EIRs a Vector migration wrote in the range — in the gate register, not counted as moves. */
  migrated: number;
  days: { day: string; tally: GateMovesTally }[];
  movements: { movementCode: string; direction: string; fullEmpty: string; moves: number; teu: number }[];
  customers: GateMovesGroup[];
  lines: GateMovesGroup[];
  types: GateMovesGroup[];
}

// ── receipts ────────────────────────────────────────────────────────────────

export interface ReceiptTally { receipts: number; subtotal: number; tax: number; total: number }

export interface ReceiptsReport {
  branchId: string;
  branchCode: string;
  from: string;
  to: string;
  currencies: string[];
  total: ReceiptTally;
  voided: ReceiptTally;
  days: { day: string; tally: ReceiptTally }[];
  shifts: {
    shiftId: string; cashierUserId: string | null; cashierName: string | null;
    openedAt: string | null; closedAt: string | null; status: string | null; tally: ReceiptTally;
  }[];
  cashiers: { cashierUserId: string; cashierName: string | null; tally: ReceiptTally }[];
  customers: { payerCode: string | null; payerName: string; tally: ReceiptTally }[];
  channels: { channel: string; payments: number; amount: number }[];
}

export interface ReceiptRow {
  receiptId: string;
  receiptNo: string;
  receiptAt: string;
  shiftId: string;
  cashierUserId: string;
  cashierName: string | null;
  orderNo: string | null;
  payerCode: string | null;
  payerName: string;
  payerTaxId: string | null;
  payerBranchNo: string | null;
  currencyCode: string;
  subtotal: number;
  tax: number;
  total: number;
  status: 'ISSUED' | 'VOIDED';
  voidedAt: string | null;
  voidReason: string | null;
  channels: string[];
}

// ── dates ───────────────────────────────────────────────────────────────────

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Quick ranges, in the browser's calendar (the depot's, in practice). */
export function presetRange(preset: 'today' | 'yesterday' | 'thisMonth' | 'lastMonth'): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'today': return { from: iso(now), to: iso(now) };
    case 'yesterday': { const d = new Date(y, m, now.getDate() - 1); return { from: iso(d), to: iso(d) }; }
    case 'thisMonth': return { from: iso(new Date(y, m, 1)), to: iso(now) };
    case 'lastMonth': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  }
}

/** The start of a day and the last instant of another, for the gate register's from / to. */
export function dayRangeInstants(from: string, to: string): { from: string; to: string } {
  return {
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59.999`).toISOString(),
  };
}

export function toCsv(head: string[], rows: (string | number | null | undefined)[][]): Blob {
  const cell = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return new Blob([[head.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))].join('\r\n')], { type: 'text/csv;charset=utf-8' });
}
