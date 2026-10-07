/**
 * Everything the Booking Statement WRITES — Vector's Cost Sheet, bound.
 *
 * NONE OF THESE ENDPOINTS EXIST YET except the window waive. They are specified
 * in docs/STATEMENT_CHARGE_EDIT_FOR_API.md and called here exactly as specified,
 * so the day the API lands nothing in the UI changes. Until then every caller
 * reports a 404 in words that name what is missing, rather than as a bare
 * failure the clerk cannot act on.
 *
 * The shapes follow Vector, because the depot's clerks already know them:
 *  - a price is ORIGINAL RATE + a DISCOUNT, not a retyped number. "5% off" is
 *    then a fact the system holds, not a sentence somebody wrote in a reason
 *    box and nobody can total.
 *  - a line can be LOCKED, which is what makes Regenerate safe: re-price
 *    everything from the tariff EXCEPT what a supervisor has pinned.
 */
import { apiSend } from './client';
import type { Charge } from './charges';

export const CHARGES_PATH = '/api/revenue/charges';

// ── pricing one line: Vector's original rate + discount ──────────────────────

export type DiscountType = 'NONE' | 'AMT' | 'PCT';

export const DISCOUNT_LABEL: Record<DiscountType, string> = {
  NONE: 'No discount',
  AMT: 'Amount off',
  PCT: 'Percent off',
};

/**
 * The selling rate Vector would compute. Kept here, not in a component, because
 * the dialog, the grid and the bulk editor must all agree to the satang.
 */
export function sellingRate(originalRate: number, type: DiscountType, discount: number): number {
  if (!Number.isFinite(originalRate) || originalRate < 0) return 0;
  if (type === 'AMT') return Math.max(0, round2(originalRate - (discount || 0)));
  if (type === 'PCT') return Math.max(0, round2(originalRate * (1 - (discount || 0) / 100)));
  return round2(originalRate);
}

/** Money is held to two places everywhere; a third one only ever shows up as a rounding dispute. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PriceEdit {
  rowVersion?: string;
  originalRate: number;
  discountType: DiscountType;
  discountRate: number;
  reason: string;
}

/** Reprice ONE quoted line. 404 until the API ships it. */
export const repriceCharge = (chargeId: string, body: PriceEdit) =>
  apiSend<Charge>('POST', `${CHARGES_PATH}/${chargeId}/price`, body);

/** Put a line back on the tariff's own rate, keeping the audit entry. */
export const clearPriceEdit = (chargeId: string, rowVersion?: string) =>
  apiSend<Charge>('DELETE', `${CHARGES_PATH}/${chargeId}/price${qs({ rowVersion })}`);

// ── waiving ──────────────────────────────────────────────────────────────────

/**
 * Vector asks WHY in a closed list, not free text, because "goodwill" and
 * "rate error" are different conversations at month end and nobody can total a
 * sentence. The free note stays, underneath.
 */
export const WAIVE_REASONS = [
  'GOODWILL', 'RATE_ERROR', 'DISPUTE_RESOLUTION', 'MANAGEMENT_APPROVAL', 'SYSTEM_ERROR',
] as const;
export type WaiveReasonCode = (typeof WAIVE_REASONS)[number];

export const WAIVE_REASON_LABEL: Record<WaiveReasonCode, string> = {
  GOODWILL: 'Goodwill',
  RATE_ERROR: 'Rate error',
  DISPUTE_RESOLUTION: 'Dispute resolution',
  MANAGEMENT_APPROVAL: 'Management approval',
  SYSTEM_ERROR: 'System error',
};

/**
 * `reasonCode` is the answer; `reason` is the note beside it. The API takes both
 * and defaults the note to the code, so an empty note is allowed — which is why
 * the dialogs require the CODE and not the prose.
 */
export interface WaiveBody { rowVersion?: string; reasonCode: WaiveReasonCode; reason: string }

/** Waive ONE line by its id — precise, unlike the window's (box, code, bill-to) key. */
export const waiveCharge = (chargeId: string, body: WaiveBody) =>
  apiSend<Charge>('POST', `${CHARGES_PATH}/${chargeId}/waive`, body);

/** Waive the ticked lines in one call, so a part-done bulk waive cannot happen. */
export const waiveCharges = (chargeIds: string[], body: Omit<WaiveBody, 'rowVersion'>) =>
  apiSend<{ waived: number }>('POST', `${CHARGES_PATH}/waive`, { chargeIds, ...body });

export const unwaiveCharge = (chargeId: string, rowVersion?: string) =>
  apiSend<Charge>('DELETE', `${CHARGES_PATH}/${chargeId}/waive${qs({ rowVersion })}`);

// ── adding charges by hand ───────────────────────────────────────────────────

export interface ManualCharge {
  orderNo: string;
  /** Empty applies it to the booking rather than to one box. */
  bookingContainerIds: string[];
  chargeCode: string;
  movementCode: string | null;
  billTo: string;
  paymentTermCode: string;
  quantity: number;
  originalRate: number;
  discountType: DiscountType;
  discountRate: number;
  remarks: string;
}

/** Vector's "+ Manual Charge". Answers the charges it created, one per box. */
export const addManualCharge = (body: ManualCharge) =>
  apiSend<Charge[]>('POST', `${CHARGES_PATH}/manual`, body);

/**
 * Vector's "Add Charges To All Items" / "Update Charges To All Items".
 *
 * `mode: 'ADD'` puts the charge on every box that does not already carry it;
 * `'UPDATE'` reprices the ones that do and adds nothing. One call, because
 * twenty boxes done one at a time is nineteen chances to stop half way.
 */
export interface BulkCharge extends ManualCharge { mode: 'ADD' | 'UPDATE' }

export const applyChargeToAll = (body: BulkCharge) =>
  apiSend<{ added: number; updated: number; skipped: number }>('POST', `${CHARGES_PATH}/bulk`, body);

// ── locking and regenerating ─────────────────────────────────────────────────

/** A locked line survives Regenerate. Without this, Regenerate undoes every correction. */
export const setChargeLock = (chargeId: string, isLocked: boolean, rowVersion?: string) =>
  apiSend<Charge>('POST', `${CHARGES_PATH}/${chargeId}/lock`, { isLocked, rowVersion });

export interface RegenerateRequest {
  orderNo: string;
  /** Lines already paid, invoiced or waived are never touched, whatever this says. */
  keepLocked: boolean;
  keepManual: boolean;
  reason: string;
}

export interface RegenerateResult {
  repriced: number;
  added: number;
  removed: number;
  keptLocked: number;
  /** Lines the tariff still cannot price — the clerk must see these. */
  noRate: number;
}

/** Vector's "Regenerate Cost Sheet": re-price the booking from today's tariff. */
export const regenerateStatement = (body: RegenerateRequest) =>
  apiSend<RegenerateResult>('POST', `${CHARGES_PATH}/regenerate`, body);

// Sending to an invoice lives in lib/api/invoices.ts — it is CREDIT only and
// answers an invoice, so it belongs with the invoice register rather than here.

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}
