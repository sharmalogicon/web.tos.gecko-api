/**
 * MANY CUSTOMERS' SPECIAL PRICES, FROM ONE WORKBOOK (owner 2026-11-12).
 *
 *   GET  /api/revenue/tariffs/multi-customer/template      one Cust_<code> sheet per customer
 *   POST /api/revenue/tariffs/multi-customer/imports       upload → preview, nothing applied
 *   GET  /api/revenue/tariffs/multi-customer/imports/{id}  read that preview again
 *   POST …/imports/{id}/confirm                            all of it, or none of it
 *   POST …/imports/{id}/cancel
 *
 * This is NOT the per-tariff Excel round-trip in revenue.ts. That one edits the
 * rates of ONE draft schedule the caller already opened. This one writes a
 * SPECIAL-<code> contract for each sheet, APPROVED and live from the chosen
 * date, with no separate approval step — which is why confirming needs
 * `revenue.tariff.approve` on top of `revenue.import.manage`, and why the
 * screen must not offer the button to anyone else.
 *
 * Only the charges that differ from the standard tariff are kept; everything
 * priced the same as standard is dropped on purpose, so the customer keeps
 * following the standard tariff for it.
 *
 * The API is built and runs locally but is NOT on Azure yet, and Azure needs
 * database script gecko_revenue 56 first. Until both land, every call here
 * answers 404 in production.
 */
import { apiDownload, apiGet, apiSend, apiUpload, saveBlob } from './client';

/** What a sheet does to that customer's contract when the batch is confirmed. */
export type MultiAction = 'NEW_CONTRACT' | 'REPLACE' | 'NO_CHANGE' | 'KEPT_ALL_STANDARD';

export type MultiSeverity = 'INFO' | 'WARNING' | 'ERROR';

export interface MultiIssue {
  column: string | null;
  severity: MultiSeverity | string;
  /** e.g. OTHER_CONTRACT, BAD_TIERS — stable, unlike the message. */
  code: string;
  message: string;
}

export interface MultiRow {
  sheet: string;
  rowNo: number;
  action: string | null;
  status: string;
  issues: MultiIssue[];
}

/**
 * A special price a REPLACE takes away.
 *
 * `matchKey` is the resolver's key, pipe-joined — `GATEFEE|CUSTOMER|CASH|*|…`.
 * The charge code is the first field; the rest is axis detail a pricing clerk
 * reads but a depot clerk does not.
 */
export interface MultiDropped {
  matchKey: string;
  price: string;
}

/** The charge code out of a match key: everything before the first pipe. */
export const chargeCodeOf = (matchKey: string): string =>
  matchKey.split('|')[0] || matchKey;

export interface MultiSheetDetail {
  sheet: string;
  customerCode: string;
  customerName: string | null;
  action: MultiAction | string;
  status: string;
  existingScheduleNo: string | null;
  existingVersion: number | null;
  /** Filled only after the batch is APPLIED — the tariff this sheet became. */
  resultScheduleId: string | null;
  chargesKept: number;
  rowsKept: number;
  rowsSameAsStandard: number;
  rowsDropped: number;
  issues: MultiIssue[];
  /** Only the rows that carry a warning or an error; a clean sheet lists none. */
  rows: MultiRow[];
  /** The customer's current special prices this REPLACE removes. Empty otherwise. */
  dropped: MultiDropped[];
}

export interface MultiPreview {
  batchId: string;
  status: string;
  fileName: string;
  branchId: string;
  effectiveFrom: string;
  sheets: number;
  sheetsError: number;
  customersNew: number;
  customersReplaced: number;
  customersKeptAllStandard: number;
  customersUnchanged: number;
  rowsKept: number;
  rowsSameAsStandard: number;
  rowsDropped: number;
  rowsError: number;
  failureMessage: string | null;
  sheetsDetail: MultiSheetDetail[];
}

const BASE = '/api/revenue/tariffs/multi-customer';

/** The API refuses more than this, and the picker should refuse first. */
export const MAX_CUSTOMERS = 200;
/** The API refuses a bigger file; checking here saves the upload. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/**
 * Confirm is offered only on a preview that is still VALIDATED and wholly
 * clean. A single error anywhere stops the batch: it is all-or-nothing, so a
 * half-good file must be fixed and sent again rather than partly applied.
 */
export const isConfirmable = (p: MultiPreview | null): boolean =>
  !!p && p.status === 'VALIDATED' && p.sheetsError === 0 && p.rowsError === 0;

/** How many customers this batch actually changes — what the confirm asks about. */
export const customersAffected = (p: MultiPreview): number =>
  p.customersNew + p.customersReplaced;

/**
 * The workbook, pre-filled with what each customer pays today.
 *
 * `customerCodes` empty is legal and documented: it returns one example sheet
 * of standard prices with no customer chosen, which is how a clerk starts when
 * they do not yet know who they are pricing.
 */
export async function downloadMultiTemplate(
  branchId: string, customerCodes: string[], effectiveOn?: string,
): Promise<void> {
  const p = new URLSearchParams({ branchId });
  if (customerCodes.length > 0) p.set('customerCodes', customerCodes.join(','));
  if (effectiveOn) p.set('effectiveOn', effectiveOn);
  const { blob, filename } = await apiDownload(`${BASE}/template?${p.toString()}`);
  saveBlob(blob, filename ?? `Multi_customer_tariff_${branchId}.xlsx`);
}

/** Upload the edited workbook: validated and previewed, nothing applied. */
export function uploadMultiWorkbook(
  file: File, branchId: string, effectiveFrom: string,
): Promise<MultiPreview> {
  const form = new FormData();
  form.append('file', file);
  form.append('branchId', branchId);
  form.append('effectiveFrom', effectiveFrom);
  return apiUpload<MultiPreview>(`${BASE}/imports`, form);
}

export const getMultiImport = (batchId: string) =>
  apiGet<MultiPreview>(`${BASE}/imports/${batchId}`);

export const confirmMultiImport = (batchId: string) =>
  apiSend<MultiPreview>('POST', `${BASE}/imports/${batchId}/confirm`);

export const cancelMultiImport = (batchId: string) =>
  apiSend<MultiPreview>('POST', `${BASE}/imports/${batchId}/cancel`);
