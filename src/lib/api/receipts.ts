/**
 * One cash receipt — Vector's **Customer Cash Bill**.
 *
 * In Thailand the receipt IS the tax invoice, which is why the depot calls this
 * screen a bill and why there is no separate cash-invoice document to raise:
 * `POST /api/revenue/invoices/send` refuses CASH for exactly that reason.
 *
 *   GET  /api/revenue/window/receipts/{id}            the bill
 *   GET  /api/revenue/window/receipts/{id}/receipt.pdf  what the customer is handed
 *   POST /api/revenue/window/receipts/{id}/void       with a reason
 */
import { apiDownload, apiGet, apiSend, saveBlob } from './client';

export interface ReceiptLine {
  lineNo: number;
  chargeCode: string;
  description: string | null;
  containerNo: string | null;
  movementCode: string | null;
  billingUnitCode: string | null;
  quantity: number;
  unitRate: number;
  amount: number;
  taxRate: number | null;
  taxAmount: number;
  serviceFrom: string | null;
  serviceTo: string | null;
}

/** How the money arrived. One receipt can be settled in several ways. */
export interface ReceiptPayment {
  channel: string;
  amount: number;
  tendered: number | null;
  change: number | null;
  referenceNo: string | null;
  bankName: string | null;
}

export interface ReceiptCoupon {
  couponRef: string;
  containerNo: string | null;
  movementCode: string | null;
  validUntil: string | null;
}

export interface Receipt {
  receiptId: string;
  receiptNo: string;
  receiptAt: string;
  status: string;
  branchId: string;
  branchCode: string | null;
  orderNo: string | null;
  shiftId: string | null;
  cashierUserId: string | null;
  /** Who it is made out to — the desktop's General Information block. */
  payerName: string | null;
  payerTaxId: string | null;
  payerBranchNo: string | null;
  payerAddress: string | null;
  seller: unknown;
  lines: ReceiptLine[];
  payments: ReceiptPayment[];
  coupons: ReceiptCoupon[];
  currencyCode: string;
  subtotal: number;
  tax: number;
  total: number;
  withholdingTaxRate: number | null;
  withholdingTaxAmount: number;
  nettAmount: number;
  change: number;
  voidedAt: string | null;
  voidReason: string | null;
  replacesReceiptNo: string | null;
  replacedByReceiptNo: string | null;
  /** GATE | WINDOW | CASH_BILL … — where it was issued. Only a GATE one may be split. */
  issuedFrom: string | null;
  /** On a receipt that CAME OUT of a split: the original it was carved from. */
  splitFromReceiptNo: string | null;
  /** On the original, once split: the receipts that replaced it. */
  splitIntoReceiptNos: string[] | null;
  payerPartyCode: string | null;
  remarks: string | null;
}

export const RECEIPTS_PATH = '/api/revenue/window/receipts';

export const receiptPath = (id: string) => `${RECEIPTS_PATH}/${encodeURIComponent(id)}`;
export const receiptPdfPath = (id: string) => `${receiptPath(id)}/receipt.pdf`;
export const couponPdfPath = (id: string) => `${receiptPath(id)}/coupon.pdf`;

/**
 * HAND THE RECEIPT PDF TO THE BROWSER — the only correct way to do it.
 *
 * `receipt.pdf` is an ordinary authorised endpoint
 * (`RequireBranchPermission(CashCollect)`), and the access token lives in a
 * JavaScript variable, never a cookie (ADR-006). So a plain `<a href>` or
 * `window.open` on that path sends NO Authorization header and the API answers
 * 401 — correctly. The bytes have to be fetched with the token and then saved.
 */
export async function downloadReceiptPdf(receiptId: string, receiptNo?: string): Promise<void> {
  const { blob, filename } = await apiDownload(receiptPdfPath(receiptId));
  saveBlob(blob, filename ?? `${receiptNo ?? receiptId}.pdf`);
}

export const voidReceipt = (id: string, reason: string) =>
  apiSend<Receipt>('POST', `${receiptPath(id)}/void`, { reason });

/** CASH, TRANSFER, CHEQUE… shown as the depot says them. */
export const CHANNEL_LABEL: Record<string, string> = {
  CASH: 'Cash',
  TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  CARD: 'Card',
};
export const channelLabel = (c: string) => CHANNEL_LABEL[c] ?? c;

// ── splitting a gate receipt ────────────────────────────────────────────────

/**
 * ONE TRUCK, SEVERAL PAYERS.
 *
 * A gate clerk takes the whole truck on one receipt because that is how the
 * barrier works — one visit, one payment — and only afterwards does the driver
 * say that two of the boxes are the haulier's and the rest the customer's. The
 * desktop answers that by carving the receipt up.
 *
 * It is NOT a refund and not a correction: the money does not move. Every line
 * of the original goes to exactly one part, each part gets its own payer and
 * its own payments, and the parts together must match the original channel for
 * channel. The original is then VOIDED with `splitIntoReceiptNos` pointing at
 * its replacements, so the audit trail survives.
 *
 * Only a GATE receipt, only ISSUED, only on the day it was issued — the API
 * answers 409 to anything else, and `canDivide` mirrors that. A CHANGE OF
 * PAYER is looser — any issued receipt, any day — so `canChangePayer` decides
 * whether the button appears at all.
 */
export interface SplitPart {
  /** Which of the original's lines this part takes. Every line goes to exactly one part. */
  lineNos: number[];
  /** The master-data party this part is made out to. */
  payerPartyCode: string;
  /** What gets PRINTED — defaulted from the party, editable, sent as typed. */
  payer: { name: string; taxId: string | null; branchNo: string | null; address: string | null };
  /** The API works the amount out; Vector offers it only over ฿1,000. */
  withholdingTax: boolean;
  payments: {
    channel: string;
    amount: number;
    tenderedAmount: number | null;
    referenceNo: string | null;
    bankName: string | null;
  }[];
}

export interface SplitReceiptRequest {
  parts: SplitPart[];
  remarks: string | null;
}

export const splitReceiptPath = (id: string) => `${receiptPath(id)}/split`;

/** 200 answers the NEW receipts, one per part, each already carrying its number. */
export const splitReceipt = (id: string, body: SplitReceiptRequest) =>
  apiSend<Receipt[]>('POST', splitReceiptPath(id), body);

export const getReceipt = (id: string) => apiGet<Receipt>(receiptPath(id));

/** Vector offers withholding only over ฿1,000 (§8) — the same rule as the window. */
export const WITHHOLDING_FLOOR = 1000;

/**
 * TWO DIFFERENT QUESTIONS, since the API split them (Gecko.Revenue d5e7665,
 * 2026-10-09).
 *
 * CHANGE OF PAYER is one part holding every line. It works on ANY issued
 * receipt — gate, window or cash bill — on ANY day, and the receipt is updated
 * IN PLACE: same id, same number, same lines, same payments, same coupons.
 * Only who it is made out to changes. Nothing is voided.
 *
 * DIVIDING is two or more parts, and that is still a gate receipt on the day it
 * was issued. The first part keeps the original number; the rest get new ones.
 *
 * Both are structural rather than `Pick<Receipt, …>`: the cash window carries
 * its own Receipt shape (window.ts) and the same questions are asked of both.
 */
type ReceiptFacts = { issuedFrom?: string | null; status: string; receiptAt: string } | null | undefined;

/** Any issued receipt can be made out to somebody else. */
export const canChangePayer = (r: ReceiptFacts): boolean => r?.status === 'ISSUED';

/**
 * Can its lines be shared out between payers?
 *
 * "Today" is the depot's day as the browser reads it. A clerk at 23:59 could in
 * principle disagree with the server by a minute; the server decides, and its
 * 409 is shown as it words it.
 */
export function canDivide(r: ReceiptFacts): boolean {
  if (!r || r.issuedFrom !== 'GATE' || r.status !== 'ISSUED') return false;
  const issued = new Date(r.receiptAt);
  if (Number.isNaN(issued.getTime())) return false;
  const now = new Date();
  return issued.getFullYear() === now.getFullYear()
    && issued.getMonth() === now.getMonth()
    && issued.getDate() === now.getDate();
}
