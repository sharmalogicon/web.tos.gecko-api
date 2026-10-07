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

import { apiSend } from './client';

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

  /**
   * Set once the API carries them (docs/STATEMENT_CHARGE_EDIT_FOR_API.md).
   * Optional because the running API does not return them yet: the screen shows
   * an overridden rate as overridden when it can, and simply shows the rate
   * when it cannot.
   */
  rowVersion?: string;
  /** Vector's price model: original rate, a discount, and the selling rate it computes. */
  originalRate?: number | null;
  discountType?: 'NONE' | 'AMT' | 'PCT';
  discountRate?: number | null;
  isRateOverridden?: boolean;
  overrideReason?: string | null;
  overriddenBy?: string | null;
  overriddenAt?: string | null;
  /** A locked line survives Regenerate. */
  isLocked?: boolean;
  waivedBy?: string | null;
  waiveReasonCode?: string | null;
  /** Master-data context Vector shows on the grid. */
  chargeType?: string | null;
  billingUnitCode?: string | null;
  equipmentSize?: string | null;
  equipmentTypeCode?: string | null;
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

/**
 * Money owed or paid: always two decimals (฿160.50), never ฿160.5. The tariff
 * pages' `money` trims zeros on purpose — it prints rates like ฿84.11 per day.
 */
export const amount = (value: number | null | undefined, currency = 'THB') =>
  value === null || value === undefined
    ? '—'
    : `${currency === 'THB' ? '฿' : `${currency} `}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const payerLabel = (code: string | null, name: string | null) =>
  name ?? code ?? 'Walk-in (cash)';

// ── one booking's statement (billing/statement) ─────────────────────────────

export const statementPath = (orderNo: string) => `${CHARGES_PATH}/statement?orderNo=${encodeURIComponent(orderNo)}`;

/** With VAT, by where the money is. Paid includes earned. */
export interface StatementTotals {
  paid: number;
  waived: number;
  unbilled: number;
  invoiced: number;
  cancelled: number;
  /**
   * What the booking is EXPECTED to cost, from the quotation or the standard
   * tariff — before anything has been collected. `noPrice` is the count of
   * charges no tariff prices, which is not the same as free: the gate will
   * refuse those boxes.
   */
  expectedCash?: number;
  expectedCredit?: number;
  noPrice?: number;
}

/** How a statement line is shown. QUOTED is an expectation, not money taken. */
export const STATEMENT_STATUS: Record<string, { label: string; tone: string }> = {
  QUOTED:   { label: 'Expected', tone: 'info' },
  PAID:     { label: 'Paid',     tone: 'success' },
  EARNED:   { label: 'Paid',     tone: 'success' },
  UNBILLED: { label: 'To bill',  tone: 'warning' },
  INVOICED: { label: 'Invoiced', tone: 'primary' },
  WAIVED:   { label: 'Waived',   tone: 'neutral' },
  CANCELLED:{ label: 'Cancelled',tone: 'neutral' },
};

/**
 * A quoted line that nothing prices.
 *
 * Amount 0 with no schedule behind it is NOT a free move — it is a charge no
 * tariff covers. Shown red, because a clerk reading 0 would take no money and
 * send the truck to a gate that will not open.
 */
export const isUnpriced = (l: StatementLine): boolean =>
  l.charge.status === 'QUOTED' && (l.charge.amount ?? 0) === 0 && !l.charge.scheduleNo;

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

// ── the statement as one flat table (billing/statement) ─────────────────────

/**
 * Vector's Cost Sheet is ONE grid: every charge on the booking, with the
 * container as a column. Ours was grouped by box and then by movement, which
 * reads well on a two-box booking and becomes unusable on a twenty-box one —
 * the clerk hunting for LOLO has to open every section to find it, and cannot
 * sort by rate at all. So the statement flattens, and the grouping becomes
 * what it always really was: a filter.
 */
export interface StatementRow {
  charge: Charge;
  receiptNo: string | null;
  /** Where the line sits: null bookingContainerId means Revenue has no box for it. */
  bookingContainerId: string | null;
  containerNo: string | null;
  equipmentTypeCode: string | null;
}

export const flattenStatement = (s: BookingStatement): StatementRow[] =>
  s.boxes.flatMap(b => b.lines.map(l => ({
    charge: l.charge,
    receiptNo: l.receiptNo,
    bookingContainerId: b.bookingContainerId,
    containerNo: b.containerNo,
    equipmentTypeCode: b.equipmentTypeCode,
  })));

/**
 * Paid or not, in the words the counter uses. The seven charge statuses are an
 * accounting distinction; a clerk asking "has this been paid?" wants three
 * answers, and WAIVED is its own because it is a decision somebody made.
 */
export type SettledGroup = 'UNPAID' | 'PAID' | 'WAIVED' | 'CANCELLED';

export const settledGroup = (c: Charge): SettledGroup =>
  c.status === 'PAID' || c.status === 'EARNED' || c.status === 'INVOICED' ? 'PAID'
    : c.status === 'WAIVED' ? 'WAIVED'
      : c.status === 'CANCELLED' ? 'CANCELLED'
        : 'UNPAID';

export const SETTLED_LABEL: Record<SettledGroup, string> = {
  UNPAID: 'Unpaid', PAID: 'Paid', WAIVED: 'Waived', CANCELLED: 'Cancelled',
};

/**
 * Only a QUOTED line may be repriced or waived: money that has been taken and
 * the charge behind it must never be allowed to disagree. A paid line is
 * corrected by voiding its receipt, an invoiced one by a credit note.
 */
export const isEditableCharge = (c: Charge) => c.status === 'QUOTED';

/** Why this line cannot be touched, in the clerk's words. */
export const whyNotEditable = (c: Charge): string =>
  c.status === 'PAID' || c.status === 'EARNED'
    ? 'Already paid — void the receipt to change it.'
    : c.status === 'INVOICED' ? 'On an invoice — this needs a credit note.'
      : c.status === 'UNBILLED' ? 'Waiting to be invoiced — not changed from here.'
        : c.status === 'WAIVED' ? 'Already waived.'
          : c.status === 'CANCELLED' ? 'Cancelled with its EIR.'
            : 'Cannot be changed.';

// ── writes (docs/STATEMENT_CHARGE_EDIT_FOR_API.md) ──────────────────────────

/**
 * Override the rate on one quoted line, and waive one quoted line.
 *
 * `POST …/charges/{id}/override` DOES NOT EXIST YET — it is specified in
 * docs/STATEMENT_CHARGE_EDIT_FOR_API.md and the screen reports a 404 in those
 * words rather than as a bare failure. Waiving by charge id does not exist
 * either; `POST /api/revenue/window/waive` does, but it is keyed by
 * (bookingContainerId, chargeCode, billTo), which is AMBIGUOUS whenever the
 * same charge code appears on two movements of one box — as A-004 does on
 * KORAKIT's own BK-KTC-2610-00038. So the screen tries the precise path first
 * and falls back to the window's only when the key can only mean this line.
 */
export interface WindowWaiveRequest {
  bookingContainerId: string;
  chargeCode: string;
  billTo: string;
  paidUntil: string | null;
  reason: string;
}

export const waiveAtWindow = (body: WindowWaiveRequest) =>
  apiSend<unknown>('POST', '/api/revenue/window/waive', body);
