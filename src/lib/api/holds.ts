/**
 * The holds board (gecko_tos `yard.container_hold`, TIER3 §7): the rows as the API
 * returns them from GET /api/tos/holds/board and /summary. Releases go through the
 * existing POST /api/tos/holds/{id}/release with the row's rowVersion.
 */

export interface Hold {
  containerHoldId: string; containerNo: string | null; bookingId: string | null; orderNo: string | null;
  branchId: string | null; branchCode: string | null;
  holdCode: string; description: string | null; holdType: string | null; blockingScope: string | null;
  releaseAuthority: string | null; priority: number | null; displayColorHex: string | null;
  appliedAt: string; appliedBy: string | null; applyReason: string; externalRef: string | null; source: string;
  releasedAt: string | null; releasedBy: string | null; releaseReason: string | null; releaseRef: string | null;
  releaseSource: string | null; isActive: boolean; rowVersion: string;
}

export interface HoldBoardRow {
  hold: Hold;
  /** The booking's depot, or the yard the box stands in; null = a box in no yard. */
  depotBranchId: string | null; depotCode: string | null;
  heldOn: "CONTAINER" | "BOOKING"; boxesOnBooking: number | null;
  /** Whole days held so far — or held for, once released. */
  ageDays: number;
  canRelease: boolean; releaseRefRequired: boolean; releasePermission: string | null;
}

export interface HoldCount { key: string; count: number }

export interface HoldCodeCount {
  holdCode: string; description: string | null; holdType: string | null; blockingScope: string | null;
  releaseAuthority: string | null; displayColorHex: string | null; typeIsActive: boolean; count: number;
}

export interface HoldSummary {
  asOf: string; active: number;
  byHold: HoldCodeCount[]; byHoldType: HoldCount[]; byBlockingScope: HoldCount[]; bySource: HoldCount[];
  byDepot: { branchId: string | null; branchCode: string | null; count: number }[];
  ageing: HoldCount[];
  releasedPerDay: { day: string; count: number }[];
}

export const AUTHORITY_LABEL: Record<string, string> = {
  CUSTOMS: "Customs", LINE: "Shipping line", DEPOT_FINANCE: "Depot finance",
  DEPOT_OPERATIONS: "Depot operations", MNR: "M&R", SUPERVISOR: "Supervisor",
};

export const HOLD_SOURCES = ["MANUAL", "EDI", "AUTO", "MIGRATED"] as const;

export const AGE_LABEL: Record<string, string> = {
  UNDER_1_DAY: "Under 1 day",
  "1_TO_3_DAYS": "1–3 days",
  "3_TO_7_DAYS": "3–7 days",
  "7_TO_30_DAYS": "7–30 days",
  "30_DAYS_PLUS": "30 days +",
};

export const AGE_TONE: Record<string, string> = {
  UNDER_1_DAY: "var(--gecko-success-600)",
  "1_TO_3_DAYS": "var(--gecko-success-600)",
  "3_TO_7_DAYS": "var(--gecko-warning-600)",
  "7_TO_30_DAYS": "var(--gecko-error-400)",
  "30_DAYS_PLUS": "var(--gecko-error-600)",
};

/** What a hold's blocking scope stops, in the gate's words. */
export const SCOPE_LABEL: Record<string, string> = {
  ALL: "Every move",
  GATE_OUT: "Gate-out",
  GATE_IN: "Gate-in",
  LOAD: "Loading",
  RELEASE: "Release",
  UNKNOWN: "Unknown",
};

export function scopeLabel(scope: string | null | undefined): string {
  if (!scope) return "—";
  return SCOPE_LABEL[scope] ?? scope.replace(/_/g, " ").toLowerCase();
}

export function ageLabel(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}
