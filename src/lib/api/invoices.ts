/**
 * Invoices — Gecko.Revenue, live since 2026-10-07.
 *
 *   GET  /api/revenue/invoices                 the register (revenue.charge.view)
 *   GET  /api/revenue/invoices/{invoiceId}     one invoice and its lines
 *   POST /api/revenue/invoices/send            raise one from ticked charges
 *                                              (revenue.invoice.issue)
 *
 * CREDIT ONLY. A cash charge is collected at the window and its RECEIPT is the
 * tax invoice, so sending cash lines here answers 400. An invoice is issued at
 * once and is final: there is no draft, and appending to an existing invoiceNo
 * answers 409. One payer, one branch, one currency per invoice.
 *
 * Not built, so the screen does not offer them: a PDF, credit notes, and
 * recording a payment against an invoice. `/billing/credit-notes` stays blocked.
 */
import { apiSend } from './client';

export const INVOICES_PATH = '/api/revenue/invoices';

export type InvoiceTerm = 'CASH' | 'CREDIT';

export interface InvoiceSummary {
  invoiceId: string;
  invoiceNo: string;
  branchId: string;
  invoiceType: string;
  status: string;
  paymentTermCode: string;
  billTo: string;
  payerCode: string | null;
  payerName: string | null;
  currencyCode: string;
  amount: number;
  tax: number;
  total: number;
  /** A COUNT of lines on the register; the detail call carries the lines themselves. */
  lines: number;
  issuedAt: string;
  remarks: string | null;
}

/**
 * One line of an invoice.
 *
 * REPORTED TO THE API OWNER 2026-10-07: the published schema for this is the
 * SUBSCRIPTION billing line (`invoiceLineId, description, quantity, unitPrice,
 * lineTotal, entitlementId`) — `/api/revenue/invoices/{id}` and
 * `/api/subscription/invoices/{id}` both point at the same `InvoiceLineResponse`.
 * The agreed shape was the charge line below. Until that is settled the screen
 * accepts EITHER, so it draws something sensible whichever actually arrives,
 * and says so where a field is genuinely absent.
 */
export interface InvoiceLine {
  // the agreed charge-line shape
  lineNo?: number;
  chargeId?: string;
  orderNo?: string | null;
  containerNo?: string | null;
  movementCode?: string | null;
  chargeCode?: string;
  chargeName?: string | null;
  unitRate?: number;
  amount?: number;
  taxCode?: string | null;
  taxRate?: number | null;
  taxAmount?: number;
  total?: number;
  // what the published schema says
  invoiceLineId?: string;
  description?: string;
  unitPrice?: number;
  lineTotal?: number;
  entitlementId?: string | null;
  // common to both
  quantity: number;
}

export interface InvoiceDetail { invoice: InvoiceSummary; lines: InvoiceLine[] }

/** One line, read whichever way the API answers. */
export const lineView = (l: InvoiceLine, i: number) => ({
  key: l.chargeId ?? l.invoiceLineId ?? String(i),
  no: l.lineNo ?? i + 1,
  code: l.chargeCode ?? null,
  text: l.chargeName ?? l.description ?? '—',
  containerNo: l.containerNo ?? null,
  movementCode: l.movementCode ?? null,
  orderNo: l.orderNo ?? null,
  quantity: l.quantity,
  unitRate: l.unitRate ?? l.unitPrice ?? 0,
  amount: l.amount ?? l.lineTotal ?? 0,
  taxAmount: l.taxAmount ?? null,
  total: l.total ?? l.lineTotal ?? 0,
});

export interface InvoiceQuery {
  search: string;
  payerCode: string;
  orderNo: string;
}

export const invoicesPath = (q: Partial<InvoiceQuery>, branchId: string, page = 1, pageSize = 50) => {
  const p = new URLSearchParams({ Page: String(page), PageSize: String(pageSize) });
  if (branchId) p.set('branchId', branchId);
  if (q.search?.trim()) p.set('Search', q.search.trim());
  if (q.payerCode?.trim()) p.set('payerCode', q.payerCode.trim());
  if (q.orderNo?.trim()) p.set('orderNo', q.orderNo.trim());
  return `${INVOICES_PATH}?${p.toString()}`;
};

export const invoicePath = (invoiceId: string) => `${INVOICES_PATH}/${encodeURIComponent(invoiceId)}`;

export interface SendInvoiceRequest {
  chargeIds: string[];
  /**
   * CASH or CREDIT. Only CREDIT is accepted today — CASH answers 400, because
   * cash is collected at the window and its receipt IS the tax invoice. The
   * screen offers both (the owner's call, 2026-10-07: a Thai clerk calls that
   * receipt an invoice) and shows the server's refusal when it comes.
   */
  paymentTermCode: InvoiceTerm;
  /** A number appends to that invoice; null raises a new one. An existing number answers 409 today. */
  invoiceNo: string | null;
  remarks: string;
}

export interface SendInvoiceResult {
  invoiceId: string;
  invoiceNo: string;
  lines: number;
  amount: number;
  tax: number;
  total: number;
  currencyCode: string;
}

export const sendToInvoice = (body: SendInvoiceRequest) =>
  apiSend<SendInvoiceResult>('POST', `${INVOICES_PATH}/send`, body);

export const INVOICE_PERMISSIONS = { issue: 'revenue.invoice.issue', view: 'revenue.charge.view' } as const;

/**
 * Issued is the only status the API makes today, but it answers a string, so
 * the register must not assume. An unknown status is shown as itself.
 */
export const INVOICE_STATUS: Record<string, { label: string; badge: string }> = {
  ISSUED: { label: 'Issued', badge: 'gecko-badge-info' },
  PAID: { label: 'Paid', badge: 'gecko-badge-success' },
  VOIDED: { label: 'Voided', badge: 'gecko-badge-gray' },
  CANCELLED: { label: 'Cancelled', badge: 'gecko-badge-gray' },
};
