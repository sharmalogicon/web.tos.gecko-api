/**
 * The TOS gate, as the screens see it (gecko_tos PLAN §5.2–§5.5).
 *
 * Two calls carry the barrier: PREFLIGHT says whether the box may move and why,
 * and the gate transaction records it moving — one POST, one SQL transaction,
 * everything from the EIR to the outbox message the customer gets on LINE.
 */

export type GateDirection = "IN" | "OUT";
export type GateDecision = "ALLOWED" | "NEEDS_OVERRIDE" | "BLOCKED";
export type GateSeverity = "INFO" | "WARN" | "OVERRIDE" | "BLOCK";

/**
 * The leg of the truck's trip, as Vector's clerks name it. REQUIRED on every
 * gate transaction, and the server checks it agrees with `direction`: a
 * drop-off is an IN, a pick-up is an OUT (400 on `tripType` otherwise).
 *
 * It is not a synonym for direction — it decides which fields the server then
 * insists on (see TRIP_TYPE_RULES).
 */
export type TripType = "DROP_OFF_CONT" | "PICK_UP_CONT";

export const TRIP_TYPES: { value: TripType; label: string; direction: GateDirection; hint: string }[] = [
  { value: "DROP_OFF_CONT", label: "Drop-off", direction: "IN", hint: "the truck leaves a box here" },
  { value: "PICK_UP_CONT", label: "Pick-up", direction: "OUT", hint: "the truck takes a box away" },
];

export const directionOfTrip = (trip: TripType): GateDirection =>
  trip === "DROP_OFF_CONT" ? "IN" : "OUT";

/**
 * What the server will demand, so the clerk is told before the POST rather than
 * by a 400 afterwards. The server remains the authority — this only mirrors it.
 *
 * FULL/EMPTY is the booking step's load state (preflight `nextStep.fullEmpty`),
 * never what the clerk picked.
 */
export function requiredGateFields(
  trip: TripType,
  fullEmpty: "FULL" | "EMPTY" | null,
  isExportBooking: boolean,
): string[] {
  if (trip === "PICK_UP_CONT") return [];
  const required = ["tareWeightKg", "maxGrossWeightKg"];
  if (fullEmpty === "FULL") {
    required.push("cargoWeightKg", "seals");
    if (isExportBooking) required.push("customsPermitNo");
  }
  return required;
}

/** Seal types the gate accepts. AGENT/CUSTOMER are Vector's "Agent Seal" / "Cust. Seal". */
export const SEAL_TYPES = ["LINE", "SHIPPER", "CUSTOMS", "TERMINAL", "AGENT", "CUSTOMER"] as const;

export interface GateFinding { code: string; message: string; severity: GateSeverity }

export interface GateBooking {
  bookingId: string; orderNo: string; branchId: string; orderTypeCode: string; directionCode: string;
  lineCode: string; customerCode: string | null; vesselCallId: string | null; callRef: string | null;
  validTo: string | null; bookingContainerId: string; declaredSealNo: string | null;
  declaredVgmKg: number | null; equipmentTypeCode: string | null;
}

export interface GateStep {
  movementPlanId: string; sequenceNo: number; movementCode: string; direction: GateDirection;
  fullEmpty: "FULL" | "EMPTY"; isRequired: boolean; checkSealNo: boolean; checkGrossWeight: boolean;
  requireVesselVoyage: boolean; allowDamagedRelease: boolean; requiresSurvey: boolean;
  stepsSkipped: string[];
}

export interface GateHold {
  containerHoldId: string; holdCode: string; description: string | null; blockingScope: string | null;
  releaseAuthority: string | null; heldVia: "CONTAINER" | "BOOKING"; blocksThisMove: boolean;
}

export interface GateYard {
  containerVisitId: string; branchId: string; fullEmpty: string; positionText: string | null; lastEventAt: string;
}

export interface GateCutoff { kind: string; at: string; isLate: boolean; coveredByExceptionId: string | null }
export interface GateCoupon { gateAuthorizationId: string; couponRef: string; paymentChannel: string; validUntil: string }

export interface GatePreflight {
  containerNo: string; direction: GateDirection; at: string; decision: GateDecision;
  findings: GateFinding[]; booking: GateBooking | null; nextStep: GateStep | null;
  holds: GateHold[]; inYard: GateYard | null; cutoff: GateCutoff | null; coupon: GateCoupon | null;
  isCheckDigitValid: boolean; isInRegistry: boolean;
}

export interface GateSeal { sealNo: string; sealType: string; isIntact: boolean; matchesDeclared: boolean | null }

export interface GateTransaction {
  gateTransactionId: string; eirNo: string; branchId: string; direction: GateDirection; positionNo: number;
  movementCode: string; fullEmpty: string; containerNo: string; isCheckDigitValid: boolean;
  equipmentTypeCode: string | null; bookingId: string; orderNo: string; lineCode: string;
  truckVisitId: string; visitNo: string; truckPlate: string;
  grossWeightKg: number | null; vgmKg: number | null; vgmMethod: string | null; weightSource: string | null;
  conditionCode: string | null; gradeCode: string | null; sealMismatch: boolean; seals: GateSeal[];
  cutoffKindApplied: string | null; cutoffAtApplied: string | null; isLate: boolean;
  cutoffExceptionId: string | null; lateOverrideReason: string | null; checkDigitOverrideReason: string | null;
  gateAuthorizationId: string | null;
  // Vector parity (2026-10-01). `gradeCode` above doubles as the container
  // class — there is deliberately no separate containerClassCode field.
  /**
   * Everything non-blocking the barrier said as the move was recorded — the
   * truck not matching the one paid for, gate hours, a warning-only missing
   * coupon. It is NOT stored: a later GET of this EIR returns null.
   */
  findings: GateFinding[] | null;
  tripType: TripType; truckCategoryCode: string | null; materialCode: string | null;
  maxGrossWeightKg: number | null; cargoWeightKg: number | null;
  ventSetting: string | null; humidityPct: number | null;
  gensetNo: string | null; clipOnNo: string | null;
  customsPermitNo: string | null; paperlessCode: string | null; nextLocationCode: string | null;
  transactionAt: string; recordedAt: string; status: "COMPLETED" | "VOIDED";
  containerVisitId: string | null; bookingContainerCompleted: boolean; rowVersion: string;
}

export interface GateTransactionSummary {
  gateTransactionId: string; eirNo: string; direction: GateDirection; movementCode: string; fullEmpty: string;
  containerNo: string; orderNo: string; lineCode: string; truckPlate: string;
  transactionAt: string; isLate: boolean; status: string;
}

export interface YardContainer {
  containerVisitId: string; branchId: string; containerNo: string; equipmentTypeCode: string | null;
  lineCode: string; fullEmpty: string; conditionCode: string | null; gradeCode: string | null;
  positionText: string | null; gateInAt: string; gateInEirNo: string; gateInMovementCode: string;
  daysInYard: number; isHeld: boolean; currentBookingContainerId: string | null; lastEventAt: string;
}

export interface TruckVisit {
  truckVisitId: string; visitNo: string; branchId: string; truckPlate: string; trailerPlate: string | null;
  haulierCode: string | null; driverName: string | null; laneCode: string | null;
  arrivedAt: string; gateInAt: string | null; gateOutAt: string | null; dwellMinutes: number | null;
  status: "ARRIVED" | "ON_SITE" | "DEPARTED"; source: string; transactions: GateTransactionSummary[];
  truckCategoryCode?: string | null;
  /**
   * What the truck did on this visit, DERIVED by the server from the moves that
   * stand — a voided EIR never happened, so re-read the visit after voiding one.
   * Never sent and never stored: `tripType` is the move's, this is the visit's.
   * Do not recompute it here by counting transactions.
   */
  pickupDropoffMode?: PickupDropoffMode | null;
}

/** The `PICKUP_DROPOFF_MODE` code list; labels come from it, not from here. */
export type PickupDropoffMode = "PICKUP" | "DROPOFF" | "PICKUP_DROPOFF" | "NONE";

// ─── display helpers ─────────────────────────────────────────────────────────

export const TOS_PERMISSIONS = {
  gateView: "tos.gate.view",
  gateCreate: "tos.gate.create",
  gateOverride: "tos.gate.override",
  cutoffOverride: "tos.cutoff.override",
  holdView: "tos.hold.view",
} as const;

export const DECISION_TONE: Record<GateDecision, { tone: string; label: string; hint: string }> = {
  ALLOWED:        { tone: "success", label: "Allowed",        hint: "Lift the boom and record the move." },
  NEEDS_OVERRIDE: { tone: "warning", label: "Needs override", hint: "A supervisor may allow this, with a reason that goes on the EIR." },
  BLOCKED:        { tone: "error",   label: "Refused",        hint: "There is no override at the barrier. Fix the cause first." },
};

export const SEVERITY_TONE: Record<GateSeverity, string> = { INFO: "info", WARN: "warning", OVERRIDE: "warning", BLOCK: "error" };

/** A container number as the yard writes it: ABCU 123456 7. */
export function formatContainerNo(containerNo: string): string {
  return containerNo.length === 11
    ? `${containerNo.slice(0, 4)} ${containerNo.slice(4, 10)} ${containerNo.slice(10)}`
    : containerNo;
}

export { formatDate, formatDateTime } from "../format";

export { formatTime } from "../format";

/** Dwell in the yard, the way a storage clerk says it. */
export function dwellLabel(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

// ── the gate transaction request ────────────────────────────────────────────

export interface GateTruckRequest {
  plate: string;
  trailerPlate?: string | null;
  haulierCode?: string | null;
  driverName?: string | null;
  driverLicence?: string | null;
  laneCode?: string | null;
  /** Only stored when this POST opens a NEW visit; ignored alongside truckVisitId. */
  truckCategoryCode?: string | null;
}

export interface GateSealRequest { sealNo: string; sealType: string; isIntact: boolean }

/**
 * Everything the gate POST accepts. Built in one place so the desk and the
 * EIR-In screen cannot drift apart — they post the same contract.
 */
export interface GateTransactionRequest {
  branchId: string;
  containerNo: string;
  direction: GateDirection;
  tripType: TripType;
  truckVisitId?: string | null;
  truck?: GateTruckRequest | null;
  transactionAt?: string | null;
  grossWeightKg?: number | null;
  tareWeightKg?: number | null;
  vgmKg?: number | null;
  vgmMethod?: string | null;
  weightSource?: string | null;
  /** The container class. There is no separate containerClassCode. */
  gradeCode?: string | null;
  conditionCode?: string | null;
  temperatureC?: number | null;
  isoCode?: string | null;
  seals?: GateSealRequest[];
  yardId?: string | null;
  yardSlotId?: string | null;
  positionText?: string | null;
  checkDigitOverrideReason?: string | null;
  lateOverrideReason?: string | null;
  remarks?: string | null;
  materialCode?: string | null;
  maxGrossWeightKg?: number | null;
  cargoWeightKg?: number | null;
  ventSetting?: string | null;
  humidityPct?: number | null;
  gensetNo?: string | null;
  clipOnNo?: string | null;
  customsPermitNo?: string | null;
  paperlessCode?: string | null;
  nextLocationCode?: string | null;
}

/** "" → null, so an untouched optional field is absent rather than empty. */
export const textOrNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** "" → null, otherwise a number. Keeps 0 as 0 — a zero cargo weight is a value. */
export const numberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Preflight for a truck the clerk has already keyed. Passing the truck lets the
 * barrier compare it with the one the coupon was priced for — it never blocks,
 * it just says so (TRUCK_CATEGORY_NOT_AS_PAID, HAULIER_NOT_AS_PAID). Send
 * `truckVisitId` instead when a second box joins an open visit.
 */
export function preflightPath(params: {
  branchId: string;
  containerNo: string;
  direction: GateDirection;
  truckVisitId?: string | null;
  truckCategoryCode?: string | null;
  haulierCode?: string | null;
}): string {
  const query = new URLSearchParams({
    branchId: params.branchId,
    containerNo: params.containerNo,
    direction: params.direction,
  });
  if (params.truckVisitId) query.set("truckVisitId", params.truckVisitId);
  else {
    if (params.truckCategoryCode) query.set("truckCategoryCode", params.truckCategoryCode);
    if (params.haulierCode) query.set("haulierCode", params.haulierCode);
  }
  return `/api/tos/gate/preflight?${query}`;
}

// ── how a booked box is collected or delivered ──────────────────────────────

/**
 * Vector's "P/U Mode" / "D/O Mode", per booked container. Who collects or
 * delivers it.
 *
 * NOT the visit's `pickupDropoffMode` (that is derived, per truck) and NOT the
 * order-type step's `pudoMode`. Three different things with similar names; this
 * one is the booking's.
 *
 * The ten values are fixed in the API — there is no code list behind them, so
 * unlike BOOKING_TYPE or PICKUP_DROPOFF_MODE a tenant cannot add an eleventh.
 */
export type HandoverMode =
  | "DO_OWN" | "DO_OTHER" | "DO_ONLY" | "DO_CUS"
  | "PU_OWN" | "PU_OTHER" | "PU_ONLY" | "PU_PORT"
  | "REPO_OWN" | "REPO_OTHER";

export interface HandoverModeOption { value: HandoverMode; label: string }

/** Labels as Vector prints them, so a clerk reads what they already know. */
const HANDOVER_MODES: Record<"IMPORT" | "EXPORT" | "OTHER", HandoverModeOption[]> = {
  IMPORT: [
    { value: "DO_OWN", label: "D/O OWN" },
    { value: "DO_OTHER", label: "D/O OTHER" },
    { value: "DO_ONLY", label: "D/O ONLY" },
    { value: "DO_CUS", label: "D/O CUS" },
  ],
  EXPORT: [
    { value: "PU_OWN", label: "P/U OWN" },
    { value: "PU_OTHER", label: "P/U OTHER" },
    { value: "PU_ONLY", label: "P/U ONLY" },
    { value: "PU_PORT", label: "P/U PORT" },
  ],
  OTHER: [
    { value: "REPO_OWN", label: "OWN" },
    { value: "REPO_OTHER", label: "OTHER" },
  ],
};

/**
 * The modes a booking may use. Sending one from another direction's list is a
 * 400 on `containers[i].handoverMode`, so the picker only ever offers these.
 */
export function handoverModesFor(directionCode: string | null | undefined): HandoverModeOption[] {
  if (directionCode === "IMPORT") return HANDOVER_MODES.IMPORT;
  if (directionCode === "EXPORT") return HANDOVER_MODES.EXPORT;
  return HANDOVER_MODES.OTHER;
}

/** What the column is called: Vector says "D/O Mode" inbound, "P/U Mode" outbound. */
export function handoverModeLabel(directionCode: string | null | undefined): string {
  if (directionCode === "IMPORT") return "D/O Mode";
  if (directionCode === "EXPORT") return "P/U Mode";
  return "Handover";
}

/** The `…_OWN` of the booking's list — the default Vector offers. */
export const defaultHandoverMode = (directionCode: string | null | undefined): HandoverMode =>
  handoverModesFor(directionCode)[0].value;

/** The printed label for a stored value, whichever list it came from. */
export function handoverModeText(mode: string | null | undefined): string {
  if (!mode) return "—";
  for (const list of Object.values(HANDOVER_MODES)) {
    const found = list.find(o => o.value === mode);
    if (found) return found.label;
  }
  return mode;
}
