/**
 * One truck, one Save — the gate's write model (GATE_API_FOR_UI.md §23–§25).
 *
 * The shape both gate screens share, and the reason they can share it: a box
 * coming in and a box going out differ only in the direction of the move.
 *
 * THREE THINGS WORTH KNOWING BEFORE CHANGING ANY OF THIS:
 *
 * 1. A BOOKING ROW IS A PLACE, NOT A BOX. A booking is usually made before
 *    anyone knows which containers will go on it, so its rows carry no number.
 *    Keying a box at the gate fills a place. Two clerks can pick the same place;
 *    Gecko never lets the second overwrite the first — it moves them to the next
 *    free place like it and says so (§24.2).
 *
 * 2. RECORD DOES NOT COMMIT. It reserves the place and prices the row. Nothing
 *    is written and no money is taken until the one Save. That is why a truck
 *    with three boxes cannot end up half gated.
 *
 * 3. A PICK-UP HAPPENS TWICE (§25). Gate In ANNOUNCES it — money is taken, no
 *    EIR, the row comes back PLANNED and the box is held for that truck for 24
 *    hours. Gate Out RELEASES it against the truck's own visit. Gate Out can
 *    only release what Gate In planned.
 *
 * `POST /api/tos/gate/transactions` is not called from the gate screens at all
 * any more. It remains for corrections and for other callers.
 */
import { apiSend } from './client';
import type { GateFinding, GateTransactionRequest } from './tos';

/* ── reserving a place ──────────────────────────────────────────────────── */

export interface ReserveRequest {
  branchId: string;
  draftId: string;
  bookingContainerId: string;
  /** Sent as soon as the clerk keys it: the box is checked against §24.1 at once. */
  containerNo?: string | null;
}

export interface Reservation {
  boxReservationId: string;
  branchId: string;
  draftId: string;
  /** The place actually HELD. Use THIS from now on — it may not be the one asked for. */
  bookingContainerId: string | null;
  containerNo: string | null;
  reservedBy: string;
  reservedByName: string | null;
  reservedAt: string;
  expiresAt: string;
  /** Set when the place asked for was taken and the server moved to another. */
  switchedFromBookingContainerId: string | null;
  /** Why it moved, in the server's words. Shown blue — it is news, not a fault. */
  message: string | null;
  findings: GateFinding[] | null;
}

export const reserveBox = (body: ReserveRequest) =>
  apiSend<Reservation>('POST', '/api/tos/gate/reservations', body);

/* ── the Save ───────────────────────────────────────────────────────────── */

export interface TripBlind {
  containerNo: string;
  lineCode: string;
  customerCode?: string | null;
  equipmentTypeCode?: string | null;
  carrierRef?: string | null;
  agentCode?: string | null;
  remarks?: string | null;
}

export interface TripDamage {
  damageCode: string;
  locationCode?: string | null;
  componentCode?: string | null;
  quantity?: number | null;
  remarks?: string | null;
}

export interface TripRow {
  /** The place this row fills. Absent on a blind box, which has no booking. */
  bookingContainerId?: string | null;
  blind?: TripBlind | null;
  move: GateTransactionRequest;
  /** Drop-off rows only; a damage on a pick-up is a 400. */
  damages?: TripDamage[] | null;
  /** What the clerk read off the box, when it differs from what was booked. */
  equipmentTypeCode?: string | null;
  /** Sent on the SECOND Save, after the clerk agreed to the type change. */
  acceptTypeChange?: boolean | null;
}

export interface TripTruck {
  plate: string;
  trailerPlate?: string | null;
  haulierCode?: string | null;
  driverName?: string | null;
  driverLicence?: string | null;
  laneCode?: string | null;
  arrivedAt?: string | null;
  truckCategoryCode?: string | null;
}

export interface TripPayment {
  /** Null name: the receipt is made out to the first row's customer (§23.1). */
  payer: { name: string | null; taxId: string | null; branchNo: string | null; address: string | null };
  payments: {
    channel: string; amount: number;
    tenderedAmount?: number | null; referenceNo?: string | null; bankName?: string | null;
  }[];
  /** The quote's cash total. A different one is a 409 "the price changed". */
  expectedTotal: number;
  withholdingTax?: boolean;
}

export interface TripSaveRequest {
  branchId: string;
  draftId: string;
  /** Gate In: the truck that arrived. Gate Out sends `truckVisitId` instead. */
  truck?: TripTruck | null;
  /** Gate Out: the visit being released against, so one arrival stays one visit. */
  truckVisitId?: string | null;
  rows: TripRow[];
  vas?: string[] | null;
  /** Gate In only — a pick-up is paid for when it is announced, not released. */
  payment?: TripPayment | null;
}

/** What became of one row. */
export type TripRowStatus = 'GATED' | 'PLANNED' | 'NOT_GATED' | string;

export interface TripRowResult {
  index: number;
  containerNo: string;
  /** The place used — not necessarily the one sent, if it was switched. */
  bookingContainerId: string;
  orderNo: string;
  status: TripRowStatus;
  eirNo: string | null;
  gateTransactionId: string | null;
  eirPdfUrl: string | null;
  couponRef: string | null;
  reason: string | null;
  findings: GateFinding[] | null;
  surveyId: string | null;
  holdsApplied: string[] | null;
  /** A pick-up announced at Gate In, released later at Gate Out. */
  visitPickupId: string | null;
}

export interface TripReceipt {
  receiptId: string; receiptNo: string;
  subtotal: number; tax: number; total: number;
  withholdingTax: number; nett: number;
  currencyCode: string;
  pdfUrl: string;
  couponPdfUrl: string | null;
}

export interface TripSaveResult {
  tripSaveId: string;
  truckVisitId: string | null;
  visitNo: string | null;
  receipt: TripReceipt | null;
  rows: TripRowResult[];
  truckInPdfUrl: string | null;
  /** Set when nothing is left to collect: the truck is out. */
  truckLeftAt: string | null;
}

/**
 * The Save. The Idempotency-Key is the caller's to mint and to KEEP: the same
 * key resent after a timeout returns the same EIRs rather than gating a truck
 * twice. A new key is minted only for a genuinely new attempt — which is why
 * agreeing to a type change takes a fresh one.
 */
export const saveTrip = (body: TripSaveRequest, idempotencyKey: string) =>
  apiSend<TripSaveResult>('POST', '/api/tos/gate/trips', body, idempotencyKey);

/* ── what the Save can refuse with ──────────────────────────────────────── */

export interface TripRefusalRow {
  index: number;
  containerNo: string | null;
  orderNo?: string | null;
  findings?: GateFinding[] | null;
  bookedType?: string | null;
  keyedType?: string | null;
  canChange?: boolean | null;
  message?: string | null;
}

/**
 * A 409 from the Save, unpacked. `charged: false` on every one of them —
 * nothing was taken and nothing was created, so a retry is safe.
 */
export interface TripRefusal {
  code?: string | null;
  title?: string | null;
  charged?: boolean | null;
  rows?: TripRefusalRow[] | null;
}

/** Findings for one row of a refusal, by its index. */
export function refusalFindingsFor(refusal: TripRefusal | null, index: number): GateFinding[] {
  return refusal?.rows?.find(r => r.index === index)?.findings ?? [];
}

/* ── the lists the gate clerk may read ──────────────────────────────────── */

export interface GateVas {
  chargeCode: string;
  description: string;
  descriptionLocal: string | null;
  billTo: string;
  paymentTermCode: string | null;
  offeredOn: string;
  offeredOnMovements: string[];
}

/**
 * A VAS with its price, from the quote that priced the row (§23.2a).
 *
 * `outcome: UNPRICED` means no tariff prices it. Ticking one blocks the
 * receipt, so it is shown greyed with "no price" rather than hidden — a clerk
 * looking for washing needs to know it exists and why it cannot be sold.
 */
export interface VasOption {
  chargeCode: string;
  chargeName: string | null;
  billTo: string;
  paymentTermCode: string | null;
  ticked: boolean;
  outcome: string;
  unitRate: number | null;
  amount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currencyCode: string;
  scheduleNo: string | null;
}

export const isVasSellable = (v: VasOption) => v.outcome !== 'UNPRICED';

export interface GateDamageCode {
  damageCode: string;
  description: string;
  severity: number;
  /** Puts the depot's damage hold on the box. */
  makesUnserviceable: boolean;
}

export interface GateDamageLists {
  damageCodes: GateDamageCode[];
  locations: string[];
  components: string[];
}

export const GATE_VAS_PATH = (orderTypeCode: string) =>
  `/api/tos/gate/vas?orderTypeCode=${encodeURIComponent(orderTypeCode)}`;
export const GATE_DAMAGE_CODES_PATH = '/api/tos/gate/damage-codes';

/* ── a pick-up announced at Gate In ─────────────────────────────────────── */

export interface VisitPickup {
  visitPickupId: string;
  bookingContainerId: string;
  orderNo: string;
  /** Null when the yard chooses the box — it is keyed at Gate Out. */
  containerNo: string | null;
  equipmentTypeCode: string | null;
  status: string;
  plannedAt: string;
  gateTransactionId: string | null;
  cancelReason: string | null;
}

export const isPlanned = (p: VisitPickup) => p.status === 'PLANNED';

/** A supervisor lets a truck leave without the box it came for (§25.4). */
export const cancelPickup = (visitId: string, visitPickupId: string, reason: string) =>
  apiSend<void>('POST', `/api/tos/gate/visits/${visitId}/pickups/${visitPickupId}/cancel`, { reason });

export const departVisit = (visitId: string) =>
  apiSend<void>('POST', `/api/tos/gate/visits/${visitId}/depart`, {});

/* ── the truck's load limit ─────────────────────────────────────────────── */

/**
 * At most 45 ft each way: 1×40 or 2×20 (Vector GateIn.cs:1366, §23.1).
 *
 * Checked here as well as at the server — a clerk should learn that the third
 * box will not fit while they are keying it, not after pressing Save on a truck
 * that is already at the barrier.
 */
export function overTruckLimit(sizes: string[]): boolean {
  const feet = sizes.reduce((n, s) => n + (s.startsWith('4') ? 40 : s.startsWith('2') ? 20 : 0), 0);
  return feet > 45;
}

export const TRUCK_LIMIT_NOTE = 'A truck carries 1 × 40 ft or 2 × 20 ft each way.';
