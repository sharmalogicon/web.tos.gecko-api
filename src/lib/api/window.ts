/**
 * THE CASH WINDOW — types for /api/revenue/window (Gecko.Revenue WindowContracts.cs).
 *
 * The counter where a driver pays for a box's next movement: lift + storage up
 * to a chosen "paid until" day + VAT, one receipt (the Thai tax invoice), and a
 * coupon per box that the gate spends. Names mirror the C# records exactly;
 * DateOnly arrives as "yyyy-MM-dd", DateTimeOffset as ISO text, decimals as numbers.
 */

import { apiSend } from './client';

export const WINDOW_PERMISSIONS = {
  collect: 'revenue.cash.collect',
  waive: 'revenue.charge.waive',
  /** Undo a wrong receipt before the box has moved (owner / ops manager / accounts). */
  voidReceipt: 'revenue.receipt.void',
} as const;

/** The only channels the API accepts (WindowEndpoints.Channels). */
export const PAYMENT_CHANNELS = ['CASH', 'TRANSFER', 'CHEQUE', 'CARD'] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

export const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  CASH: 'Cash',
  TRANSFER: 'Transfer',
  CHEQUE: 'Cheque',
  CARD: 'Card',
};

// ── the quote ───────────────────────────────────────────────────────────────

export interface QuoteLine {
  kind: string;
  chargeCode: string;
  chargeName: string;
  billTo: string;
  payerPartyCode: string | null;
  quantity: number;
  unitRate: number | null;
  amount: number;
  taxCode: string | null;
  taxRate: number;
  taxAmount: number;
  total: number;
  serviceFrom: string | null;
  serviceTo: string | null;
  scheduleNo: string | null;
}

export interface SettledCharge {
  chargeId: string;
  chargeCode: string;
  status: string;
  total: number;
  couponRef: string | null;
  serviceTo: string | null;
  waiveReason: string | null;
}

export interface TriedVariant {
  chargeCode: string;
  billTo: string;
  outcome: string;
  amount: number | null;
}

export interface WindowBox {
  bookingContainerId: string;
  containerNo: string | null;
  equipmentTypeCode: string | null;
  nextMovementCode: string | null;
  direction: string | null;
  isBillable: boolean;
  inAt: string | null;
  stayDays: number | null;
  due: QuoteLine[];
  settled: SettledCharge[];
  tried: TriedVariant[];
  total: number;
  /** Why nothing is due, when nothing is. */
  note: string | null;
}

export interface WindowBooking {
  bookingId: string;
  branchId: string;
  orderNo: string;
  status: string;
  orderTypeCode: string;
  customerCode: string | null;
  agentCode: string | null;
  lineCode: string | null;
  paidUntil: string | null;
  /** The depot's calendar day (branch time zone) — the earliest "paid until" the window accepts. */
  today: string;
  boxes: WindowBox[];
  subtotal: number;
  tax: number;
  total: number;
  currencyCode: string | null;
  /** This booking's voided receipts that nothing replaces yet — a new payment may name one. */
  voidedReceipts?: VoidedReceipt[] | null;
}

export interface VoidedReceipt {
  receiptId: string;
  receiptNo: string;
  voidedAt: string | null;
  voidReason: string | null;
  total: number;
}

// ── the drawer ──────────────────────────────────────────────────────────────

export interface OpenShiftRequest {
  branchId: string;
  openingFloat: number;
  currencyCode?: string | null;
}

export interface ShiftCountRequest {
  channel: string;
  countedAmount: number;
}

export interface CloseShiftRequest {
  counts: ShiftCountRequest[];
  note: string | null;
}

export interface ChannelAmount {
  channel: string;
  amount: number;
}

export interface ShiftCount {
  channel: string;
  expected: number;
  counted: number;
  variance: number;
}

export interface Shift {
  shiftId: string;
  branchId: string;
  cashierUserId: string;
  currencyCode: string;
  openedAt: string;
  openingFloat: number;
  status: string;
  closedAt: string | null;
  receipts: number;
  /** Per channel; CASH includes the opening float. */
  expected: ChannelAmount[];
  counts: ShiftCount[];
}

/** One line of GET /window/shifts/{id}/receipts — newest first. */
export interface ShiftReceipt {
  receiptId: string;
  receiptNo: string;
  receiptAt: string;
  orderNo: string | null;
  payerName: string;
  total: number;
  currencyCode: string;
  /** ISSUED | VOIDED */
  status: string;
}

// ── the receipt ─────────────────────────────────────────────────────────────

export interface PayerRequest {
  name: string | null;
  taxId: string | null;
  branchNo: string | null;
  address: string | null;
}

export interface PaymentRequest {
  channel: string;
  amount: number;
  tenderedAmount: number | null;
  referenceNo: string | null;
  bankName: string | null;
}

export interface CreateReceiptRequest {
  bookingId: string;
  bookingContainerIds: string[];
  paidUntil: string | null;
  payer: PayerRequest | null;
  payments: PaymentRequest[];
  /** MUST be the total the cashier was shown — the API refuses (409) if the price moved. */
  expectedTotal: number;
  /** Paying again after a void: the voided receipt of this booking this one replaces. */
  replacesReceiptId?: string | null;
}

export interface ReceiptLine {
  lineNo: number;
  chargeCode: string;
  description: string;
  containerNo: string | null;
  movementCode: string | null;
  quantity: number;
  unitRate: number | null;
  amount: number;
  taxRate: number;
  taxAmount: number;
  billingUnitCode: string | null;
  serviceFrom: string | null;
  serviceTo: string | null;
}

export interface ReceiptPayment {
  channel: string;
  amount: number;
  tendered: number | null;
  change: number | null;
  referenceNo: string | null;
  bankName: string | null;
}

/**
 * The seller block of the tax invoice, exactly as master data holds it. A null
 * field is one MDM does not have yet — print "(not set)", never make one up.
 */
export interface Seller {
  companyCode: string;
  nameEn: string;
  nameLocal: string | null;
  taxId: string | null;
  /** "00000" = head office. */
  taxBranchNo: string | null;
  isHeadOffice: boolean | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface Coupon {
  couponRef: string;
  containerNo: string | null;
  movementCode: string;
  validUntil: string | null;
}

export interface Receipt {
  receiptId: string;
  receiptNo: string;
  receiptAt: string;
  status: string;
  orderNo: string;
  payerName: string;
  payerTaxId: string | null;
  subtotal: number;
  tax: number;
  total: number;
  change: number;
  currencyCode: string;
  lines: ReceiptLine[];
  payments: ReceiptPayment[];
  coupons: Coupon[];
  branchId: string;
  branchCode: string | null;
  payerBranchNo: string | null;
  payerAddress: string | null;
  shiftId: string;
  cashierUserId: string;
  /** Null when the depot has no invoicing company in master data. */
  seller: Seller | null;
  voidedAt: string | null;
  voidReason: string | null;
  /** The voided receipt this one replaces, and the receipt that replaced this one (when voided). */
  replacesReceiptNo?: string | null;
  replacedByReceiptNo?: string | null;
}

// ── waiving ─────────────────────────────────────────────────────────────────

export interface WaiveRequest {
  bookingContainerId: string;
  chargeCode: string;
  billTo: string;
  paidUntil: string | null;
  reason: string;
}

export interface WaiveResponse {
  chargeId: string;
  chargeCode: string;
  total: number;
  coupon: Coupon | null;
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Rounds to satang — the API compares decimals exactly, so float dust must not reach it. */
export const toSatang = (n: number) => Math.round(n * 100) / 100;

export function formatBaht(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `฿${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "สำนักงานใหญ่ / Head office (00000)" or "สาขาที่ 00001 / Branch 00001"; null when not recorded. */
export function taxBranchLabel(branchNo: string | null, isHeadOffice?: boolean | null): string | null {
  if (!branchNo) return null;
  const head = isHeadOffice ?? /^0+$/.test(branchNo);
  return head ? `สำนักงานใหญ่ / Head office (${branchNo})` : `สาขาที่ ${branchNo} / Branch ${branchNo}`;
}

export const receiptPdfPath = (receiptId: string) => `/api/revenue/window/receipts/${receiptId}/receipt.pdf`;

/** Void a wrong receipt; the answer is the receipt as it now reads (VOIDED, reason, same number). */
export const voidReceipt = (receiptId: string, reason: string) =>
  apiSend<Receipt>('POST', `/api/revenue/window/receipts/${receiptId}/void`, { reason });

/** A booking's box can be taken to the counter when the quote has lines on it. */
export const isPayable = (box: WindowBox) => box.due.length > 0;

/** The party a receipt can be made out to — only the name is used; the shape is loose on purpose. */
export interface PartyLookup {
  partyCode?: string;
  code?: string;
  name?: string | null;
  displayName?: string | null;
  legalName?: string | null;
  taxId?: string | null;
}

export const partyName = (p: PartyLookup | null | undefined) =>
  p?.displayName || p?.name || p?.legalName || null;
