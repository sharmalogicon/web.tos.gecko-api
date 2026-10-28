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
import { openPdf } from './open-pdf';
import { ApiError } from './problem';

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
 * EVERY PART OF A SPLIT RECEIPT, PRINTED — not just the first.
 *
 * A split makes several tax invoices out of one, and the driver leaves with
 * ALL of them: each part carries its own number, its own boxes and its own
 * total. Three screens had their own one-document version of this and each
 * printed part 1 only (owner 2026-10-28), so there is one of these now and
 * they all call it.
 *
 * AWAITED IN TURN, FIRST PART FIRST. Firing them together makes the browser
 * treat every tab after the first as a pop-up, and the order they come out of
 * the printer is the order the clerk staples them in.
 *
 * A FAILURE ON ONE DOES NOT COST THE OTHERS. A 404 means that part has no such
 * document — a credit part has no coupon — and the rest are still owed to the
 * driver, so it is recorded and the run goes on. A 403 is the exception: the
 * permission is not per receipt, so the second would refuse exactly as the
 * first did and stopping saves three identical failures.
 *
 * If the browser blocks a tab, `openPdf` saves the file instead. Nothing here
 * second-guesses that: the clerk has the document either way, and the caller
 * says so by offering a per-part reprint link.
 */
export interface PrintedParts {
  /** Receipt numbers whose document opened or saved. */
  printed: string[];
  /** Receipt numbers the API has no such document for (404). */
  missing: string[];
  /** Set when the run stopped early — a refusal that would repeat. */
  refused: string | null;
}

export async function printReceiptParts(
  parts: { receiptId: string; receiptNo: string }[],
  kind: 'receipt' | 'coupon',
): Promise<PrintedParts> {
  const out: PrintedParts = { printed: [], missing: [], refused: null };
  const pathOf = kind === 'coupon' ? couponPdfPath : receiptPdfPath;
  const suffix = kind === 'coupon' ? '-coupon.pdf' : '.pdf';
  for (const part of parts) {
    try {
      await openPdf(pathOf(part.receiptId), `${part.receiptNo}${suffix}`);
      out.printed.push(part.receiptNo);
    } catch (e: unknown) {
      const err = e instanceof ApiError ? e : null;
      if (err?.status === 404) { out.missing.push(part.receiptNo); continue; }
      out.refused = err?.status === 403
        ? 'That document needs a permission you do not have at this depot.'
        : err?.title ?? 'Could not reach the Gecko API.';
      break;
    }
  }
  return out;
}

/** What to tell the clerk after {@link printReceiptParts}, or null if nothing needs saying. */
export function printedPartsToast(r: PrintedParts, kind: 'receipt' | 'coupon'):
  { variant: 'success' | 'warning' | 'danger'; title: string; message: string } | null {
  const noun = kind === 'coupon' ? 'coupon' : 'receipt';
  const list = (xs: string[]) => xs.join(', ');
  if (r.refused) return { variant: 'danger', title: `${noun === 'coupon' ? 'Coupons' : 'Receipts'} not printed`, message: r.refused };
  if (r.printed.length === 0 && r.missing.length > 0)
    return { variant: 'danger', title: `No ${noun} printed`, message: `There is no ${noun} on ${list(r.missing)}.` };
  if (r.missing.length > 0)
    return { variant: 'warning', title: `Some ${noun}s printed`, message: `Printed ${list(r.printed)}; no ${noun} on ${list(r.missing)}.` };
  // One document opening IS its own feedback. Several is worth saying, because
  // a blocked tab becomes a saved file the clerk has to go and find.
  if (r.printed.length > 1)
    return { variant: 'success', title: `${r.printed.length} ${noun}s sent to print`, message: list(r.printed) };
  return null;
}
/**
 * The CASH INVOICE form — an overlay for the depot's pre-printed stationery, so
 * it prints values at fixed places and looks sparse on plain paper. Needs
 * `revenue.cash.collect`, like the coupon.
 */
export const cashInvoicePdfPath = (id: string) => `${receiptPath(id)}/cash-invoice.pdf`;

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
