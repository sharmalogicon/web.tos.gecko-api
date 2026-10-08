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
import { apiSend } from './client';

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
}

export const RECEIPTS_PATH = '/api/revenue/window/receipts';

export const receiptPath = (id: string) => `${RECEIPTS_PATH}/${encodeURIComponent(id)}`;
export const receiptPdfPath = (id: string) => `${receiptPath(id)}/receipt.pdf`;
export const couponPdfPath = (id: string) => `${receiptPath(id)}/coupon.pdf`;

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
