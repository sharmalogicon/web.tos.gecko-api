/**
 * BOOKING ENTRY — container rows that survive a dropped line.
 * GATE_API_FOR_UI.md §16.
 *
 * The rule that shapes all of this: **every row stands alone**. A bad row comes
 * back REJECTED with its own field errors while the good rows are saved, and
 * resending a row that was already saved is free — it comes back REPLAYED with
 * the same line, never a second one.
 *
 * That is what makes auto-save honest. The grid can fire a batch on a timer
 * without the clerk ever pressing anything, and a timeout, a closed tab or a
 * depot wifi drop costs nothing: the unsent rows are simply sent again.
 *
 * The identity that makes it work is `clientLineId`, a UUID the BROWSER mints
 * when the row is created. It is not the server's id and it never changes. Two
 * sends of the same clientLineId are the same row; a new row needs a new id, and
 * reusing one with a different container number is rejected on purpose.
 */
import { apiSend } from './client';

/** A row as the grid holds it, before the server has seen it. */
export interface ContainerRowInput {
  clientLineId: string;
  containerNo: string;
  lineNo: number;
  declaredSealNo?: string | null;
  customerSealNo?: string | null;
  declaredVgmKg?: number | null;
  declaredVolumeCbm?: number | null;
  requiredDate?: string | null;
  cargoCategoryCode?: string | null;
  imdgClass?: string | null;
  unNumber?: string | null;
  reeferSetTempC?: number | null;
  reeferVentPct?: number | null;
  reeferHumidityPct?: number | null;
  stowageCode?: string | null;
  stowageNo?: string | null;
  isPreCool?: boolean | null;
  remarks?: string | null;
  handoverMode?: string | null;
}

/** A line as the server holds it, once saved. */
export interface SavedLine extends Omit<ContainerRowInput, 'clientLineId'> {
  bookingContainerId: string;
  clientLineId: string | null;
  equipmentRequirementId: string;
  rowVersion: string;
  inRegistry?: boolean;
  isCheckDigitValid?: boolean;
  stepsDone?: number;
}

export type BatchOutcome = 'CREATED' | 'REPLAYED' | 'REJECTED';

export interface BatchItem {
  index: number;
  clientLineId: string;
  containerNo: string;
  outcome: BatchOutcome;
  line: SavedLine | null;
  errors: Record<string, string[]> | null;
}

/** How full each requirement line is — shown live as rows are saved. */
export interface LineTally {
  lineNo: number;
  equipmentTypeCode: string;
  qty: number;
  assigned: number;
}

export interface BatchResult {
  bookingId: string;
  orderNo: string;
  created: number;
  replayed: number;
  rejected: number;
  lines: LineTally[];
  items: BatchItem[];
}

/**
 * The server's cap. Sending more in one call is a 400, so the queue splits
 * rather than discovering it at the depot counter.
 */
export const BATCH_MAX = 200;

/** Send rows in at most BATCH_MAX chunks; the caller gets every item back. */
export async function postContainerBatch(
  bookingId: string,
  rows: readonly ContainerRowInput[],
): Promise<BatchResult[]> {
  const out: BatchResult[] = [];
  for (let at = 0; at < rows.length; at += BATCH_MAX) {
    out.push(await apiSend<BatchResult>(
      'POST',
      `/api/tos/bookings/${bookingId}/containers/batch`,
      { containers: rows.slice(at, at + BATCH_MAX) },
    ));
  }
  return out;
}

/**
 * Replace ONE saved line (§16d).
 *
 * It replaces the details as a whole: a field left out is CLEARED, not kept.
 * So the caller sends back everything it read and changes only what the user
 * changed — which is why this takes the whole row, not a patch.
 *
 * A stale rowVersion is 409: someone else edited the line, re-read and re-apply.
 */
export function putContainerLine(
  bookingId: string,
  bookingContainerId: string,
  rowVersion: string,
  row: Omit<ContainerRowInput, 'clientLineId' | 'containerNo' | 'lineNo'>,
): Promise<SavedLine> {
  return apiSend<SavedLine>(
    'PUT',
    `/api/tos/bookings/${bookingId}/containers/${bookingContainerId}`,
    { rowVersion, ...row },
  );
}

export function unassignContainer(bookingId: string, bookingContainerId: string): Promise<void> {
  return apiSend<void>('DELETE', `/api/tos/bookings/${bookingId}/containers/${bookingContainerId}`);
}

/**
 * Fields the API freezes once the box has passed the gate (§16d). Changing one
 * is a 400 on that field, so the grid renders them read-only instead of letting
 * a clerk type into a cell that cannot be saved.
 */
export const FROZEN_AFTER_GATE: readonly string[] = [
  'declaredSealNo', 'customerSealNo', 'cargoCategoryCode',
  'imdgClass', 'unNumber', 'requiredDate', 'handoverMode',
];

/** A box has been through the gate once any step is done. */
export const hasPassedGate = (line: { stepsDone?: number } | null | undefined): boolean =>
  (line?.stepsDone ?? 0) > 0;

/**
 * A browser-made identity for a row.
 *
 * crypto.randomUUID needs a secure context; the depot runs over https and dev
 * over a local certificate, so it is there. The fallback exists so a row never
 * fails to get an id — an id-less row is a 400 for the whole call.
 */
export function newClientLineId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
