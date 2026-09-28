/**
 * The TOS gate, as the screens see it (gecko_tos PLAN §5.2–§5.5).
 *
 * Two calls carry the barrier: PREFLIGHT says whether the box may move and why,
 * and the gate transaction records it moving — one POST, one SQL transaction,
 * everything from the EIR to the outbox message the customer gets on LINE.
 */

export type GateDirection = "IN" | "OUT";
export type GateDecision = "ALLOWED" | "NEEDS_OVERRIDE" | "BLOCKED";
export type GateSeverity = "INFO" | "OVERRIDE" | "BLOCK";

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
}

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

export const SEVERITY_TONE: Record<GateSeverity, string> = { INFO: "info", OVERRIDE: "warning", BLOCK: "error" };

/** A container number as the yard writes it: ABCU 123456 7. */
export function formatContainerNo(containerNo: string): string {
  return containerNo.length === 11
    ? `${containerNo.slice(0, 4)} ${containerNo.slice(4, 10)} ${containerNo.slice(10)}`
    : containerNo;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const at = new Date(value);
  return at.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Dwell in the yard, the way a storage clerk says it. */
export function dwellLabel(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}
