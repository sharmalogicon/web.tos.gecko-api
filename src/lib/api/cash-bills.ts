/**
 * CUSTOMER CASH BILL — billing open cash lines on one receipt.
 *
 * Vector's `CustomerCashBill`: pick a customer, tick the cash charges standing
 * against them across any number of bookings, say how the money arrived, and
 * print the receipt. In Thailand that receipt IS the tax invoice, which is why
 * this and not `/api/revenue/invoices/send` is how a cash customer is billed —
 * that endpoint refuses CASH by design.
 *
 *   GET  /api/revenue/cash-bills/lines?branchId=&customerCode=[&orderNo=]
 *        the OPEN cash lines: quoted, priced, not yet on a receipt
 *   POST /api/revenue/cash-bills                       → 201 ReceiptResponse
 *   GET  /api/revenue/cash-bills/receipts/by-no/{no}   the receipt, by its number
 *
 * A saved bill is never edited. To change one, void it
 * (`POST /api/revenue/window/receipts/{id}/void`) and bill again — the voided
 * lines come back as open and appear here once more.
 *
 * There is no manual line entry on this screen, exactly as the desktop has it:
 * a charge that is on no statement is added on the booking statement first.
 */
import { apiGet, apiSend } from './client';
import type { Receipt } from './receipts';
import type { PaymentChannel } from './window';

export const CASH_BILLS_PATH = '/api/revenue/cash-bills';

/** Taking money is taking money, wherever the screen is. */
export const CASH_BILL_PERMISSION = 'revenue.cash.collect';

/**
 * One open cash line, as the API answers it.
 *
 * `amount` is before VAT and `total` is with it; `taxAmount` is the difference.
 * Those three are what the payment block adds up — never recomputed here, so a
 * rounding rule that lives in the API stays in the API.
 */
export interface CashBillLine {
  chargeId: string;
  bookingId: string;
  orderNo: string;
  customerCode: string | null;
  bookingContainerId: string | null;
  containerNo: string | null;
  /** Size and type as one code — 20GP, 40HC. */
  equipmentTypeCode: string | null;
  movementCode: string | null;
  chargeCode: string;
  chargeName: string | null;
  paymentTermCode: string;
  billTo: string;
  quantity: number;
  unitRate: number | null;
  amount: number;
  taxRate: number | null;
  taxAmount: number;
  total: number;
  currencyCode: string;
  /** WINDOW | GATE | STORAGE | MANUAL — where the line came from. */
  source: string | null;
}

export function cashBillLinesPath(branchId: string, customerCode: string, orderNo?: string): string {
  const p = new URLSearchParams();
  if (branchId) p.set('branchId', branchId);
  p.set('customerCode', customerCode);
  if (orderNo?.trim()) p.set('orderNo', orderNo.trim());
  return `${CASH_BILLS_PATH}/lines?${p.toString()}`;
}

export const getCashBillLines = (branchId: string, customerCode: string, orderNo?: string) =>
  apiGet<CashBillLine[]>(cashBillLinesPath(branchId, customerCode, orderNo));

/**
 * Who the receipt is made out to.
 *
 * It is SENT, not looked up: the party's master record supplies the default,
 * but a cash customer often wants the bill addressed to a branch or a different
 * legal name, and what the clerk typed is what gets printed.
 */
export interface CashBillPayer {
  name: string;
  taxId: string | null;
  /** Thai tax branch: '00000' is head office. */
  branchNo: string | null;
  address: string | null;
}

export interface CashBillPayment {
  channel: PaymentChannel;
  amount: number;
  /** What was handed over, when it was more than the bill; the API works out the change. */
  tenderedAmount: number | null;
  referenceNo: string | null;
  bankName: string | null;
}

export interface CreateCashBillRequest {
  branchId: string;
  customerCode: string;
  chargeIds: string[];
  payer: CashBillPayer;
  remarks: string | null;
  /** 0, 1 or 3 — a percentage of the amount BEFORE VAT. */
  withholdingTaxRate: number;
  payments: CashBillPayment[];
  /**
   * The total this screen showed the clerk. The API compares it with what the
   * lines come to now and answers 409 if they have moved, rather than quietly
   * billing a different number than the one somebody agreed to.
   */
  expectedTotal: number;
}

/** The Idempotency-Key is what makes a double-click safe — see newIdempotencyKey. */
export const createCashBill = (body: CreateCashBillRequest, idempotencyKey: string) =>
  apiSend<Receipt>('POST', CASH_BILLS_PATH, body, idempotencyKey);

export const receiptByNo = (receiptNo: string) =>
  apiGet<Receipt>(`${CASH_BILLS_PATH}/receipts/by-no/${encodeURIComponent(receiptNo)}`);

// ── what the bill comes to ──────────────────────────────────────────────────

export const WITHHOLDING_RATES = [0, 1, 3] as const;
export type WithholdingRate = (typeof WITHHOLDING_RATES)[number];

export interface CashBillTotals {
  /** Σ amount — the selling amount, before VAT. */
  selling: number;
  tax: number;
  total: number;
  withholding: number;
  /** What the customer actually hands over. */
  nett: number;
}

const to2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Adds the ticked lines up.
 *
 * Withholding tax is a percentage of the amount BEFORE VAT — it is the
 * customer's own tax, deducted from what they pay us and remitted by them — so
 * the nett is the VAT-inclusive total less that deduction.
 */
export function cashBillTotals(lines: CashBillLine[], rate: WithholdingRate): CashBillTotals {
  const selling = to2(lines.reduce((n, l) => n + l.amount, 0));
  const tax = to2(lines.reduce((n, l) => n + l.taxAmount, 0));
  const total = to2(lines.reduce((n, l) => n + l.total, 0));
  const withholding = to2((selling * rate) / 100);
  return { selling, tax, total, withholding, nett: to2(total - withholding) };
}

/** Cash is counted to the satang; a cent of float is not a shortfall. */
export const PAYMENT_TOLERANCE = 0.01;

export const paymentsBalance = (payments: CashBillPayment[], nett: number) =>
  to2(payments.reduce((n, p) => n + (p.amount || 0), 0) - nett);

/** A transfer, cheque or card without its reference is not traceable to the bank. */
export const needsReference = (channel: PaymentChannel) => channel !== 'CASH';

/**
 * The address a receipt is printed with, from a party contact or the party's
 * own address fields. Blank parts are dropped so a missing city leaves no gap.
 */
export const addressText = (parts: (string | null | undefined)[]) =>
  parts.map(p => (p ?? '').trim()).filter(Boolean).join('\n');
