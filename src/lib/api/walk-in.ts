/**
 * WALK-IN TRUCKS — a customer arrives with no paperwork.
 *
 *   GET /api/tos/gate/walk-in-order-types   the tenant's four, one per answer pair
 *   GET /api/tos/gate/walk-in-boxes         yard boxes such a truck may pick up
 *   POST /api/tos/gate/trips                a row may be `walkIn` instead of `bookingContainerId`
 *
 * The clerk answers two questions and never picks an order type:
 *
 *      Drop off / Pick up   ->  direction IN / OUT
 *      Empty / Full         ->  fullEmpty
 *
 * Those two answers name exactly one active order type, because master data refuses a
 * second walk-in order type for the same pair. The gate then raises ONE booking
 * per truck, order type, customer and line — so two boxes of one customer on one
 * truck share a booking, and two customers' boxes do not.
 *
 * THIS REPLACES BLIND GATE IN on the screen. An empty box with no paperwork is
 * now "Drop off + Empty" with a customer named. `blind` still works in the API
 * for one release, but nothing here sends it any more.
 */
import { useApi } from './use-api';
import type { Paged } from './use-api';

export const WALK_IN_ORDER_TYPES_PATH = '/api/tos/gate/walk-in-order-types';

/** One of the tenant's walk-in order types, as the gate reads it. */
export interface WalkInOrderType {
  orderTypeCode: string;
  description: string | null;
  descriptionLocal: string | null;
  /** IN = drop off, OUT = pick up. */
  direction: 'IN' | 'OUT';
  fullEmpty: 'FULL' | 'EMPTY';
  movementCode: string;
  /** null = no cap on walk-in boxes of this order type per truck. */
  maxBoxesPerTruck: number | null;
  /** null = the charge rows decide. */
  paymentRule: string | null;
  releaseGradeCodes: string[];
}

/** A yard box a walk-in truck may take away. */
export interface WalkInBox {
  containerNo: string;
  equipmentTypeCode: string | null;
  lineCode: string;
  fullEmpty: 'FULL' | 'EMPTY';
  gradeCode: string | null;
  conditionCode: string | null;
  positionText: string | null;
  gateInAt: string;
  daysInYard: number | null;
  /** A hold stands on it. It can still be picked; the barrier decides. */
  isHeld: boolean;
}

/**
 * The tenant's walk-in order types.
 *
 * Read once when the gate screen opens, not per row: there are at most four and
 * the clerk's toggles are answered from the list in memory.
 */
export const useWalkInOrderTypes = (enabled: boolean) =>
  useApi<WalkInOrderType[]>(enabled ? WALK_IN_ORDER_TYPES_PATH : null);

/** IN for a drop-off, OUT for a pick-up — the same mapping the Save uses. */
export const walkInDirection = (trip: 'DROP_OFF_CONT' | 'PICK_UP_CONT'): 'IN' | 'OUT' =>
  trip === 'DROP_OFF_CONT' ? 'IN' : 'OUT';

/** The order type the clerk's two answers name, or null when the tenant has none. */
export function walkInOrderTypeFor(
  types: WalkInOrderType[] | null,
  trip: 'DROP_OFF_CONT' | 'PICK_UP_CONT',
  fullEmpty: 'FULL' | 'EMPTY' | null,
): WalkInOrderType | null {
  if (!types || !fullEmpty) return null;
  const direction = walkInDirection(trip);
  return types.find(t => t.direction === direction && t.fullEmpty === fullEmpty) ?? null;
}

/** Shown on a toggle the tenant has not set up, rather than letting the Save refuse it. */
export const NO_WALK_IN_ORDER_TYPE =
  'No walk-in order type for this. Set one up in Master data → Order types → Rules.';

export function walkInBoxesPath(params: {
  branchId: string;
  fullEmpty: 'FULL' | 'EMPTY';
  search?: string;
  draftId?: string | null;
  exclude?: string[];
  page?: number;
  pageSize?: number;
}): string {
  const q = new URLSearchParams();
  q.set('branchId', params.branchId);
  q.set('fullEmpty', params.fullEmpty);
  if (params.search?.trim()) q.set('search', params.search.trim());
  if (params.draftId) q.set('draftId', params.draftId);
  q.set('page', String(params.page ?? 1));
  q.set('pageSize', String(params.pageSize ?? 50));
  // Repeated, not comma-joined: the endpoint binds string[] from repeats.
  for (const box of params.exclude ?? []) if (box) q.append('excludeContainerNos', box);
  return `/api/tos/gate/walk-in-boxes?${q.toString()}`;
}

export type WalkInBoxPage = Paged<WalkInBox>;

/**
 * The refusals a walk-in row can earn, worded for a gate clerk.
 *
 * Every one of these comes back as a 409 BEFORE any money is taken
 * (`charged: false`), so the truck is still at the barrier and the clerk can
 * fix the row and Save again.
 */
export const WALK_IN_REFUSALS: Record<string, string> = {
  ON_AN_ORDER: 'This box is already on an open order. It moves on that order, not as a walk-in — pick the booking instead.',
  LOAD_MISMATCH: 'The box is not the load you chose. Switch Empty / Full to match what is actually on the truck.',
  GRADE_NOT_ALLOWED: 'This order type does not release that grade of box.',
  SURVEY_REQUIRED: 'Survey this box — list the damages, or tick Surveyed for none found — and Save again.',
  SEAL_NOT_AS_BOOKED: 'The seal keyed is not the one the booking declared.',
  SEAL_MISMATCH: 'The seal keyed is not the one the booking declared.',
  OWNER_MISMATCH: 'This box belongs to another line than the order type allows. Use the order type for its own line, '
    + 'or have the rule changed in Master data \u2192 Order types \u2192 Rules.',
  NO_BOOKED_SEAL: 'The booking declared no seal, so there is nothing to match this one against.',
};

/**
 * The payment rule, said in the clerk's terms.
 *
 * CREDIT_FOR_CREDIT_CUSTOMERS is the one that matters at the barrier: the
 * window preview comes back with a total of 0 and the charges sitting in
 * `billedLater`, and the truck is gated with nothing collected. A screen that
 * only read `due` would show "nothing to pay" and look broken.
 */
export const PAYMENT_RULE_NOTE: Record<string, string> = {
  CASH_ONLY: 'Cash at the window — everyone pays before the barrier lifts.',
  CREDIT_FOR_CREDIT_CUSTOMERS: 'A credit customer is billed to its account; anyone else pays at the window.',
  CREDIT_WITHIN_LIMIT: 'A credit customer is billed to its account up to its credit limit, then pays cash.',
};
