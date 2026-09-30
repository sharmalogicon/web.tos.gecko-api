/**
 * Priced charge lines — Gecko.Revenue billing.charge.
 *
 *   GET /api/revenue/charges            the register (billing/service-orders): ?status=A,B &source= &payerCode=
 *                                       &chargeCode= &containerNo= &orderNo= &from= &to= &search= &branchId=
 *   GET /api/revenue/charges/unbilled   credit lines not yet invoiced (UNBILLED), totalled per payer
 *
 * revenue.charge.view per branch. A cash depot's lines are PAID / EARNED / WAIVED;
 * UNBILLED lines come from credit accrual at the gate, which is not running yet.
 */

export type ChargeStatus = 'QUOTED' | 'PAID' | 'EARNED' | 'UNBILLED' | 'INVOICED' | 'WAIVED' | 'CANCELLED';
export type ChargeSource = 'WINDOW' | 'GATE' | 'STORAGE' | 'MANUAL';

export interface Charge {
  chargeId: string;
  branchId: string;
  source: ChargeSource;
  status: ChargeStatus;
  bookingId: string | null;
  orderNo: string | null;
  containerNo: string | null;
  movementCode: string | null;
  gateTransactionId: string | null;
  eirNo: string | null;
  billingPeriod: string | null;
  serviceFrom: string | null;
  serviceTo: string | null;
  chargeCode: string;
  chargeName: string | null;
  billTo: string;
  paymentTermCode: string;
  payerCode: string | null;
  payerName: string | null;
  quantity: number;
  unitRate: number | null;
  amount: number;
  taxAmount: number;
  total: number;
  currencyCode: string;
  pricedForDate: string | null;
  scheduleNo: string | null;
  scheduleVersionNo: number | null;
  receiptId: string | null;
  couponRef: string | null;
  invoiceId: string | null;
  earnedAt: string | null;
  waivedAt: string | null;
  waiveReason: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  creditNoteRequired: boolean;
  createdAt: string;
}

export interface UnbilledPayer {
  payerCode: string | null;
  payerName: string | null;
  billTo: string;
  currencyCode: string;
  lines: number;
  boxes: number;
  amount: number;
  tax: number;
  total: number;
  oldest: string;
  newest: string;
}

export interface Unbilled {
  asAt: string;
  branchId: string | null;
  lines: number;
  amount: number;
  tax: number;
  total: number;
  payers: UnbilledPayer[];
}

export const CHARGE_PERMISSIONS = { view: 'revenue.charge.view' } as const;

export const CHARGES_PATH = '/api/revenue/charges';

export const unbilledPath = (branchId?: string) =>
  `/api/revenue/charges/unbilled${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`;

export const CHARGE_STATUS: Record<ChargeStatus, { label: string; badge: string; hint: string }> = {
  QUOTED:    { label: 'Quoted',    badge: 'gecko-badge-gray',    hint: 'Priced, not yet paid' },
  PAID:      { label: 'Paid',      badge: 'gecko-badge-info',    hint: 'Paid at the window; the box has not moved yet' },
  EARNED:    { label: 'Earned',    badge: 'gecko-badge-success', hint: 'Paid, and the gate move it paid for has happened' },
  UNBILLED:  { label: 'Unbilled',  badge: 'gecko-badge-warning', hint: 'Credit line waiting for an invoice' },
  INVOICED:  { label: 'Invoiced',  badge: 'gecko-badge-primary', hint: 'On an invoice' },
  WAIVED:    { label: 'Waived',    badge: 'gecko-badge-gray',    hint: 'Forgiven at the window, with a reason' },
  CANCELLED: { label: 'Cancelled', badge: 'gecko-badge-gray',    hint: 'The EIR it came from was voided' },
};

export const CHARGE_SOURCE: Record<ChargeSource, string> = {
  WINDOW: 'Cash window',
  GATE: 'Gate event',
  STORAGE: 'Storage',
  MANUAL: 'Manual',
};

export const payerLabel = (code: string | null, name: string | null) =>
  name ?? code ?? 'Walk-in (cash)';

// ── one booking's statement (billing/statement) ─────────────────────────────

export const statementPath = (orderNo: string) => `${CHARGES_PATH}/statement?orderNo=${encodeURIComponent(orderNo)}`;

/** With VAT, by where the money is. Paid includes earned. */
export interface StatementTotals { paid: number; waived: number; unbilled: number; invoiced: number; cancelled: number }

export interface StatementLine { charge: Charge; receiptNo: string | null }

export interface StatementBox {
  /** null = lines whose box Revenue does not know on this booking. */
  bookingContainerId: string | null;
  containerNo: string | null;
  equipmentTypeCode: string | null;
  isCurrent: boolean;
  endReason: string | null;
  lines: StatementLine[];
  totals: StatementTotals;
}

export interface StatementReceipt {
  receiptId: string;
  receiptNo: string;
  receiptAt: string;
  status: 'ISSUED' | 'VOIDED';
  payerName: string;
  currencyCode: string;
  subtotal: number;
  tax: number;
  total: number;
  voidedAt: string | null;
  voidReason: string | null;
  replacesReceiptNo: string | null;
  replacedByReceiptNo: string | null;
}

export interface BookingStatement {
  bookingId: string;
  orderNo: string;
  branchId: string;
  bookingStatus: string;
  orderTypeCode: string;
  customerCode: string | null;
  customerName: string | null;
  boxes: StatementBox[];
  receipts: StatementReceipt[];
  totals: StatementTotals;
}
