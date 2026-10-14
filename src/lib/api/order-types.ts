/**
 * Order types — Gecko.MasterData /api/master/order-types.
 *
 * An order type is what the depot is asked to do ('CUSOMER MTY', 'EXP CY/CY').
 * It expands into gate STEPS (a movement each, walked 1..n, with five gate rules
 * per step) and the CHARGES it raises (optionally pinned to one step).
 *
 * Who may do what (gecko_identity 14_mdm_permissions.sql), tenant-wide only:
 *   read               mdm.commercial.view
 *   create/edit/delete mdm.commercial.manage   (TENANT_OWNER, ACCOUNTS)
 *
 * Codes are human phrases with spaces and '/' — always build URLs with
 * orderTypePath(). Steps and charges are replaced as whole sets, each an edit of
 * the order type: send its rowVersion, get the order type back at the new one.
 */
import { apiSend } from './client';
import { useApi } from './use-api';

/**
 * THE RULES PANEL (gecko_master 34, WALK_IN_ORDERS_PLAN §2).
 *
 * Order-type-wide rules, as opposed to the five per-STEP gate flags in
 * `OrderTypeStep`. Vector drew a box called "Rules" too, but that box edited
 * the SELECTED MOVEMENT's flags — the same four that are already columns in
 * our steps grid. These five are new and belong to the order type itself.
 *
 * Every field off / null is what the gate did before they existed, so an order
 * type that has never been touched behaves exactly as it always has.
 */
export interface OrderTypeRules {
  /** R1: a truck may arrive with no paperwork; the gate raises one booking of this order type. */
  isWalkIn: boolean;
  /** R2: null = the charge rows decide. */
  paymentRule: string | null;
  /** R3: grades a pick-up may take; empty = any. */
  releaseGradeCodes: string[];
  /** R4: a box whose owner is not the booking's line. null = the tenant setting decides. */
  ownerMatch: string | null;
  /** R5: walk-in boxes of this order type on one truck; null = no cap. */
  maxBoxesPerTruck: number | null;
}

/** R2's four answers. `''` is "as the charges say" — the API's null. */
export const PAYMENT_RULES: { value: string; label: string; hint: string }[] = [
  { value: '', label: 'As the charges say', hint: 'Each charge row’s own payment term decides.' },
  { value: 'CASH_ONLY', label: 'Cash at the window', hint: 'Everyone pays before the barrier lifts, credit customers included.' },
  {
    value: 'CREDIT_FOR_CREDIT_CUSTOMERS', label: 'Credit customers on account, others cash',
    hint: 'A credit customer’s truck is gated with nothing collected; anyone else pays at the window.',
  },
  {
    value: 'CREDIT_WITHIN_LIMIT', label: 'Credit customers on account up to their limit, then cash',
    hint: 'As above, except a customer at or over its credit limit pays cash this time.',
  },
];

/** R4's three answers. `''` is the tenant setting. */
export const OWNER_MATCHES: { value: string; label: string; hint: string }[] = [
  { value: '', label: 'As the tenant setting says', hint: 'Whatever the depot’s own setting decides.' },
  { value: 'REFUSE', label: 'Refuse it', hint: 'The barrier will not take a box owned by another line.' },
  { value: 'ALLOW', label: 'Allow it, warn only', hint: 'The gate notes it and lets the box through.' },
];

export const NO_RULES: OrderTypeRules = {
  isWalkIn: false, paymentRule: null, releaseGradeCodes: [], ownerMatch: null, maxBoxesPerTruck: null,
};

export interface OrderType {
  orderTypeId: string;
  orderTypeCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  directionCode: string;
  serviceTypeId: string | null;
  serviceCode: string | null;
  cargoClassCode: string;
  bookingTypeCode: string | null;
  /**
   * Do this order type's moves hang off a vessel call?
   *
   * The booking screen reads it to decide whether to DEMAND a vessel call and,
   * on an export, the ports. Depot work — storage, repair, a swap — has no
   * sailing, and asking for one is asking a clerk to invent it.
   */
  requiresVesselSchedule: boolean;
  isActive: boolean;
  rowVersion: string;
  /** Always present on a read; the API projects every field, defaults and all. */
  rules?: OrderTypeRules;
}

export interface OrderTypeStep {
  orderTypeMovementId: string;
  movementId: string;
  movementCode: string;
  movementDescription: string;
  sequenceNo: number;
  isRequired: boolean;
  isBillable: boolean;
  checkSealNo: boolean;
  checkGrossWeight: boolean;
  requireVesselVoyage: boolean;
  allowDamagedRelease: boolean;
  skipEdi: boolean;
  pudoMode: string | null;
  /** R6: the gate-in on this step needs a damage survey on the same truck visit. */
  requireSurvey: boolean;
  /** R12: the seal keyed at the gate must be the booking's declared seal. Needs checkSealNo. */
  sealMustMatch: boolean;
}

export interface OrderTypeCharge {
  orderTypeChargeId: string;
  chargeCodeId: string;
  chargeCode: string;
  chargeDescription: string;
  movementId: string | null;
  movementCode: string | null;
  paymentTo: string;
  paymentTermCode: string | null;
  isDefault: boolean;
  isOptional: boolean;
  isCargoCharge: boolean;
  isValueAddedService: boolean;
  raiseAtGateIn: boolean;
  defaultQty: number | null;
}

export interface OrderTypeDetail {
  orderType: OrderType;
  movements: OrderTypeStep[];
  charges: OrderTypeCharge[];
}

export interface SaveOrderType {
  orderTypeCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  /** Left out on purpose: the API derives it from the booking type. */
  directionCode?: string;
  cargoClassCode: string;
  serviceCode: string | null;
  bookingTypeCode: string | null;
  requiresVesselSchedule: boolean;
  isActive: boolean;
  rowVersion?: string;
  /**
   * The whole Rules panel, or LEFT OUT to keep the rules as they are.
   *
   * That distinction is the point: the header form saves without the panel
   * loaded and must not wipe five rules it never showed. Only the Rules card
   * sends this, and when it does it replaces every field.
   */
  rules?: OrderTypeRules;
}

export interface SaveOrderTypeStep {
  movementCode: string;
  sequenceNo: number;
  isRequired: boolean;
  isBillable: boolean;
  checkSealNo: boolean;
  checkGrossWeight: boolean;
  requireVesselVoyage: boolean;
  allowDamagedRelease: boolean;
  skipEdi: boolean;
  pudoMode: string | null;
  requireSurvey: boolean;
  sealMustMatch: boolean;
}

export interface SaveOrderTypeCharge {
  chargeCode: string;
  paymentTo: string;
  movementCode: string | null;
  paymentTermCode: string | null;
  isDefault: boolean;
  isOptional: boolean;
  isCargoCharge: boolean;
  isValueAddedService: boolean;
  raiseAtGateIn: boolean;
  defaultQty: number | null;
}

export interface CodeName { code: string; name: string; nameLocal: string | null }

export interface OrderTypeVocabulary {
  directions: CodeName[];
  cargoClasses: CodeName[];
  bookingTypes: CodeName[];
  serviceTypes: CodeName[];
  pudoModes: CodeName[];
  movements: { code: string; name: string; direction: string; fullEmpty: string }[];
  chargeCodes: { code: string; name: string; moduleCode: string }[];
}

export const orderTypePath = (code: string) => `/api/master/order-types/${encodeURIComponent(code)}`;

export const useOrderTypeVocabulary = () => useApi<OrderTypeVocabulary>('/api/master/vocabulary/order-types');

export const createOrderType = (body: SaveOrderType) =>
  apiSend<OrderTypeDetail>('POST', '/api/master/order-types', body);

export const updateOrderType = (code: string, body: SaveOrderType) =>
  apiSend<OrderType>('PUT', orderTypePath(code), body);

export const replaceSteps = (code: string, movements: SaveOrderTypeStep[], rowVersion: string) =>
  apiSend<OrderTypeDetail>('PUT', `${orderTypePath(code)}/movements`, { movements, rowVersion });

export const replaceCharges = (code: string, charges: SaveOrderTypeCharge[], rowVersion: string) =>
  apiSend<OrderTypeDetail>('PUT', `${orderTypePath(code)}/charges`, { charges, rowVersion });

export const deleteOrderType = (code: string, rowVersion: string) =>
  apiSend<void>('DELETE', `${orderTypePath(code)}?rowVersion=${encodeURIComponent(rowVersion)}`);

/**
 * Save the Rules panel on its own.
 *
 * It is a PUT of the order type, like every other header save, but it carries
 * `rules` and the header's own fields unchanged. The alternative — a Save on
 * the header that also sends rules — would mean the header form had to hold
 * five values it does not show, and the first clerk to press Save from a stale
 * tab would quietly turn walk-in off.
 */
export const saveRules = (code: string, header: SaveOrderType, rules: OrderTypeRules) =>
  updateOrderType(code, { ...header, rules });

/** What the clerk can be told before the API says it. */
export function ruleErrors(rules: OrderTypeRules, stepCount: number, walkInStepOk: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (rules.isWalkIn && stepCount !== 1)
    e['rules.isWalkIn'] = stepCount === 0
      ? 'A walk-in order type has exactly one step. Add the truck\u2019s drop-off or pick-up first.'
      : `This order type has ${stepCount} steps. A walk-in order type has exactly one \u2014 the truck\u2019s drop-off or pick-up.`;
  else if (rules.isWalkIn && !walkInStepOk)
    e['rules.isWalkIn'] = 'That step is not a gate drop-off or pick-up of a full or empty box, so a walk-in truck could not be matched to it.';
  if (rules.maxBoxesPerTruck !== null && (rules.maxBoxesPerTruck < 1 || rules.maxBoxesPerTruck > 99))
    e['rules.maxBoxesPerTruck'] = 'Between 1 and 99, or leave it empty for no cap.';
  return e;
}
