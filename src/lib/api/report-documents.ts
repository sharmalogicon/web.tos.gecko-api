/**
 * THE REPORTS THE API RENDERS — PDF or Excel (Gecko.Tos, 2026-10-08).
 *
 *   GET /api/tos/reports/empty-in-yard.{pdf|xlsx}
 *   GET /api/tos/reports/full-in-yard.{pdf|xlsx}
 *   GET /api/tos/reports/gate-in-out.{pdf|xlsx}
 *
 * These are AUTHORISED endpoints, so the bytes are fetched with the bearer
 * token and handed to the browser — never opened as a navigation. A plain
 * `<a href>` on one of these answers 401, which is how the receipt PDFs broke
 * earlier today (see downloadReceiptPdf in receipts.ts).
 *
 * The three endpoints do not agree on their parameter names — `size` here,
 * `containerSize` there; `fromDate` here, `dateFrom` there — so each report
 * carries its own mapping in the catalogue rather than this file guessing.
 */
import { apiDownload, saveBlob } from './client';
import type { ReportDef } from '../reports-catalog';

export type ReportFormat = 'pdf' | 'xlsx';

/** What the drawer collected, in the shape this builder reads. */
export type ReportParamBag = Record<string, string | null | undefined>;

/**
 * Build the query for one report.
 *
 * Blank values are left out entirely: sending `agentCode=` would be a filter on
 * the empty string, not "any agent".
 */
export function reportQuery(report: ReportDef, branchId: string, values: ReportParamBag): string {
  const doc = report.document;
  if (!doc) return '';
  const p = new URLSearchParams();
  if (branchId) p.set('branchId', branchId);
  for (const [field, apiName] of Object.entries(doc.params)) {
    if (!apiName) continue;
    const v = values[field];
    if (v === null || v === undefined || String(v).trim() === '') continue;
    p.set(apiName, String(v).trim());
  }
  return p.toString();
}

/**
 * What a clerk should see the file called.
 *
 * The server names it in Content-Disposition and that wins; this is only the
 * fallback when it sends none.
 */
export const reportFileName = (report: ReportDef, format: ReportFormat, from: string, to: string) => {
  const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const range = from && to ? `-${from}-${to}` : from ? `-${from}` : '';
  return `${slug}${range}.${format}`;
};

/**
 * Fetch the report and hand it to the browser.
 *
 * A large depot's PDF takes several seconds, so the caller shows a spinner and
 * awaits this. Any failure throws an ApiError the caller renders — a 400 names
 * the field it refused, a 403 means a depot the user does not cover.
 */
export async function downloadReport(
  report: ReportDef, format: ReportFormat, branchId: string, values: ReportParamBag,
): Promise<void> {
  const doc = report.document;
  if (!doc) throw new Error(`${report.title} has no document endpoint.`);
  const query = reportQuery(report, branchId, values);
  const { blob, filename } = await apiDownload(`${doc.path}.${format}?${query}`);
  saveBlob(blob, filename ?? reportFileName(report, format, String(values.dateFrom ?? ''), String(values.dateTo ?? '')));
}

/**
 * The drawer fields a report cannot be run without, as field keys.
 *
 * Gate In/Out is the only one of the three that insists on a date range — the
 * two yard reports are a snapshot and take one only to narrow the gate-in day.
 */
export function missingRequired(report: ReportDef, values: ReportParamBag): string[] {
  const need = report.document?.required ?? [];
  return need.filter(k => !String(values[k] ?? '').trim());
}

/** The API caps Gate In/Out at 366 days; saying so beats a 400 after the wait. */
export const RANGE_LIMIT_DAYS = 366;

export function rangeTooLong(from: string, to: string): boolean {
  if (!from || !to) return false;
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  return days > RANGE_LIMIT_DAYS;
}
