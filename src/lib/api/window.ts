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
  /** MOVEMENT, STORAGE … and now VAS — a service the clerk ticked. */
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
  /** CASH lines are paid here; CREDIT lines appear under `billedLater`. */
  paymentTermCode?: string | null;
  /** PER_TRIP is the gate charge — levied once per truck, not per box. */
  billingUnitCode?: string | null;
  /** True when the haulier's own term moved this line out of the cash total. */
  byHaulierTerm?: boolean;
}

/** Cash and credit totals are kept apart: `total` above is cash only. */
export interface BilledLaterTotals {
  subtotal: number;
  tax: number;
  total: number;
  currencyCode: string | null;
}

/**
 * Thai withholding tax, offered only when the server says it may be applied —
 * a cash total over ฿1,000, and the tenant switch on.
 *
 * It does NOT change the invoice: the tax invoice still totals `total`, and
 * the customer hands over `nett` instead. So `expectedTotal` stays the quote's
 * total while the payments must add up to `nett`.
 */
export interface WithholdingTax {
  rate: number;
  amount: number;
  nett: number;
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

/**
 * A charge the server considered and did not put on the cash total, with the
 * reason. Showing these is what stops a cashier arguing with the number:
 * PER_TRIP_ON_OTHER_BOX (the gate charge is on another box of this truck),
 * HAULIER_CREDIT (billed to the haulier instead), GATE_CHARGE_ONLY, UNPRICED.
 */
export interface TriedVariant {
  chargeCode: string;
  billTo: string;
  outcome: string;
  amount: number | null;
  paymentTermCode?: string | null;
  /** The server's own sentence for this outcome — prefer it to inventing one. */
  note?: string | null;
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
  /** Lines this box will be invoiced for later, not paid for here. */
  billedLater?: QuoteLine[] | null;
  /** The gate may offer VAS on this box — an empty drop-off or a pick-up. */
  vasOffered?: boolean;
  /**
   * Charges no tariff prices (§16g). Not "free": UNPRICED. The box gets no
   * coupon, the gate blocks it (NO_COUPON) and a receipt for it is a 409.
   * Amount is 0, which is exactly why it must never be shown as a zero line —
   * a clerk reading 0 would take the money and send the truck to a closed gate.
   */
  noPrice?: QuoteLine[] | null;
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
  /** CASH only. What is billed later is in `billedLater`, never added in. */
  total: number;
  currencyCode: string | null;
  /** The truck category actually priced on — the tenant default when none was sent. */
  truckCategoryCode?: string | null;
  /** The haulier actually priced on — the booking's when none was sent. */
  haulierCode?: string | null;
  billedLater?: BilledLaterTotals | null;
  /** Non-null when withholding tax may be applied to this quote. */
  withholdingTax?: WithholdingTax | null;
  /**
   * Set when another booking on the same truck already carries the PER_TRIP
   * gate charge — "ZZKU1234565 on BK-…". The charge is levied once per truck,
   * so this booking is quoted without it.
   */
  gateChargeCarriedBy?: string | null;
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
  /**
   * Send exactly what the quote used. These three are what the price was
   * worked out from, so a different value here is a different total — and a
   * 409 rather than a silent overcharge.
   */
  truckCategoryCode?: string | null;
  haulierCode?: string | null;
  vas?: string[];
  /** The truck's OTHER bookings — same list the quote used, or the total moves. */
  sameTruckAs?: string[];
  /** Apply withholding tax. Payments must then add up to the quote's `nett`. */
  withholdingTax?: boolean;
}

/** The quote and the receipt must agree, so both are built from one object. */
export interface QuoteTerms {
  truckCategoryCode: string;
  haulierCode: string;
  vas: string[];
  /** Other order numbers on this truck — the gate charge is levied once. */
  sameTruckAs: string[];
}

export const NO_TERMS: QuoteTerms = { truckCategoryCode: '', haulierCode: '', vas: [], sameTruckAs: [] };

/** `/api/revenue/window/bookings` for one truck: its category, haulier, VAS and other bookings. */
export function windowQuotePath(
  orderNo: string,
  terms: QuoteTerms,
  paidUntil?: string | null,
  bookingContainerIds?: string[],
): string {
  const query = new URLSearchParams({ orderNo });
  if (paidUntil) query.set('paidUntil', paidUntil);
  if (terms.truckCategoryCode) query.set('truckCategoryCode', terms.truckCategoryCode);
  if (terms.haulierCode) query.set('haulierCode', terms.haulierCode);
  for (const code of terms.vas) query.append('vas', code);
  for (const order of terms.sameTruckAs) query.append('sameTruckAs', order);
  for (const id of bookingContainerIds ?? []) query.append('bookingContainerIds', id);
  return `/api/revenue/window/bookings?${query}`;
}

// ── what one truck visit was charged (after the gate) ───────────────────────

export interface VisitMoney { amount: number; vat: number; total: number }

export interface VisitQuoteLine {
  chargeCode: string;
  description: string | null;
  sellRate: number | null;
  qty: number | null;
  vatRate: number | null;
  amount: number;
  taxAmount: number;
  /** Vector's convention: rate x qty PLUS tax. */
  sellingAmount: number;
  paymentTerm: string;
  paymentTo: string;
  payerCode: string | null;
  status: string;
  billingUnitCode: string | null;
  /** The once-per-truck PER_TRIP line. */
  isGateCharge: boolean;
  receiptNo: string | null;
}

export interface VisitQuoteBox {
  containerNo: string | null;
  orderNo: string | null;
  movementCode: string | null;
  eirNo: string | null;
  gateTransactionId: string | null;
  lines: VisitQuoteLine[];
}

/**
 * What a truck visit ended up costing, read after its boxes were gated —
 * cash taken at the window against credit going on an account.
 *
 * NOT a pre-payment quote: cash is paid before the barrier, when no visit
 * exists yet. That is the booking quote. 404 means nothing was charged on the
 * visit at all, which is a legitimate answer, not an error.
 */
export interface VisitQuote {
  truckVisitId: string;
  branchId: string;
  boxes: VisitQuoteBox[];
  paidNow: VisitMoney;
  billedLater: VisitMoney;
  currencyCode: string | null;
}

export const visitQuotePath = (truckVisitId: string) =>
  `/api/revenue/window/quote-visit?truckVisitId=${encodeURIComponent(truckVisitId)}`;

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
  /**
   * GATE | WINDOW | CASH_BILL … Only a GATE receipt of today may be split
   * between payers, and any issued receipt can change payer — see
   * `canDivide` / `canChangePayer` in receipts.ts.
   */
  issuedFrom?: string | null;
  splitFromReceiptNo?: string | null;
  splitIntoReceiptNos?: string[] | null;
  /**
   * Withholding tax, when the clerk applied it. `total` above is still the tax
   * invoice's total; `nettAmount` is what the customer actually handed over,
   * and what the drawer expects. Null/0 rate = none applied.
   */
  withholdingTaxRate?: number | null;
  withholdingTaxAmount?: number | null;
  nettAmount?: number | null;
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
/**
 * A box can be paid for only when every charge on it HAS a price.
 *
 * A box carrying a noPrice line is not cheap, it is unpriced: the server issues
 * no coupon, the gate blocks it with NO_COUPON, and a receipt for it is refused
 * with a 409 (§16g). Letting the clerk tick it would take the customer's money
 * and then send the truck to a gate that will not open.
 */
export const isPayable = (box: WindowBox) => box.due.length > 0 && !hasNoPrice(box);

/** True when some charge on this box has no rate in any tariff. */
export const hasNoPrice = (box: WindowBox) => (box.noPrice?.length ?? 0) > 0;

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

