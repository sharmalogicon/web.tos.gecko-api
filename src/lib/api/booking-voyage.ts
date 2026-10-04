/**
 * The booking's vessel, voyage and cut-offs.
 *
 * Vector shows this block greyed and it is right to: the vessel, the voyage, the
 * wharf and the ETD belong to the VESSEL CALL, not to the booking. The booking
 * points at a call and inherits them. Letting a clerk retype them per booking is
 * how two bookings on one sailing end up disagreeing about when it leaves.
 *
 * The cut-offs are the exception, in both senses. A clerk entering a booking may
 * genuinely need a later cut-off for THAT booking — and rather than editing the
 * sailing's dates underneath every other booking on it, that is recorded as a
 * per-booking exception carrying who allowed it, until when, and why.
 */
import { apiSend } from './client';

/** A cut-off as it applies to this booking's line, from the vessel call. */
export interface EffectiveCutoff {
  kind: string;
  at: string;
  source: string;
  appliesTo: string;
}

/**
 * The kinds, in the order Vector lays them out. CFS_DRY / CFS_REEFER are not in
 * the API yet (docs/BOOKING_VECTOR_PARITY_FOR_API.md §1); they are listed here
 * so the panel shows the row the clerk expects, empty, rather than silently
 * omitting a cut-off they work to every day.
 */
export const CUTOFF_KINDS: { kind: string; label: string; pending?: boolean }[] = [
  { kind: 'YARD_DRY', label: 'CY cut-off (dry)' },
  { kind: 'YARD_REEFER', label: 'CY cut-off (reefer)' },
  { kind: 'CFS_DRY', label: 'CFS cut-off (dry)', pending: true },
  { kind: 'CFS_REEFER', label: 'CFS cut-off (reefer)', pending: true },
  { kind: 'PORT_DRY', label: 'Port cut-off' },
  { kind: 'PORT_REEFER', label: 'Port cut-off (reefer)' },
  { kind: 'VGM', label: 'VGM' },
  { kind: 'SI', label: 'Shipping instruction' },
];

/**
 * A booking's own cut-off, later than the sailing's.
 *
 * The response shape is not documented yet, so the fields below are optional and
 * read defensively — the panel shows what it is given and nothing breaks on what
 * it is not. See §0 of the parity doc.
 */
export interface CutoffException {
  cutoffExceptionId?: string;
  bookingCutoffExceptionId?: string;
  cutoffKind: string;
  allowedUntil: string;
  reason: string;
  status?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  revokedAt?: string | null;
  createdAt?: string | null;
}

export const cutoffExceptionsPath = (bookingId: string) =>
  `/api/tos/bookings/${bookingId}/cutoff-exceptions`;

export const effectiveCutoffsPath = (vesselCallId: string, lineCode?: string | null) =>
  `/api/tos/vessel-calls/${vesselCallId}/effective-cutoffs${lineCode ? `?lineCode=${encodeURIComponent(lineCode)}` : ''}`;

/** Allow THIS booking past a cut-off, with a reason that stays on the record. */
export function addCutoffException(bookingId: string, input: {
  cutoffKind: string;
  allowedUntil: string;
  reason: string;
}): Promise<CutoffException> {
  return apiSend<CutoffException>('POST', cutoffExceptionsPath(bookingId), input);
}

/** Take it back. The path is assumed from PLAN.md and confirmed on first use. */
export function revokeCutoffException(bookingId: string, exceptionId: string, reason?: string): Promise<void> {
  return apiSend<void>('POST', `${cutoffExceptionsPath(bookingId)}/${exceptionId}/revoke`,
    reason ? { reason } : undefined);
}

export const exceptionId = (e: CutoffException): string =>
  e.cutoffExceptionId ?? e.bookingCutoffExceptionId ?? `${e.cutoffKind}-${e.allowedUntil}`;

/** Live ones only: a revoked exception is history, not a date anyone works to. */
export const isLive = (e: CutoffException): boolean =>
  !e.revokedAt && (e.status ?? 'APPROVED').toUpperCase() !== 'REVOKED';
