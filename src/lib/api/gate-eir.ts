/**
 * The EIR registers and the EIR detail (gecko_tos `gate.gate_transaction`).
 *
 * The gate DESK is the only screen that creates an EIR; these read what it
 * wrote: the register, the one EIR with its seals, the survey of that move and
 * its damages, the photos, the truck visit and the holds on the box now.
 */
import type { GateTransaction } from "./tos";

/** The one EIR, with the fields the register's detail shows (all appended by the API). */
export interface EirDetail extends GateTransaction {
  tareWeightKg: number | null; tempObservedC: number | null; isoCode: string | null;
  positionText: string | null; surveyId: string | null; remarks: string | null;
  voidedAt: string | null; voidedBy: string | null; voidReason: string | null;
  replacesGateTransactionId: string | null;
}

export interface SurveyDamage {
  surveyDamageId: string; lineNo: number; locationCode: string | null; componentCode: string | null;
  damageCode: string; damageDescription: string | null; makesUnserviceable: boolean;
  lengthCm: number | null; widthCm: number | null; quantity: number; isPreExisting: boolean; remarks: string | null;
}

export interface Survey {
  surveyId: string; containerVisitId: string; gateTransactionId: string | null; containerNo: string; branchId: string;
  surveyType: string; surveyedAt: string; surveyedBy: string | null; surveyorName: string | null;
  conditionCode: string | null; gradeCode: string | null; isServiceable: boolean; remarks: string | null;
  damages: SurveyDamage[]; holdsApplied: string[]; rowVersion: string;
}

export interface GateAttachment {
  attachmentId: string; ownerType: string; ownerId: string; contentType: string; sizeBytes: number | null;
  sha256: string | null; caption: string | null; takenAt: string | null; createdAt: string;
}

export interface ActiveHold {
  containerHoldId: string; holdCode: string; description: string | null; holdType: string | null;
  blockingScope: string | null; releaseAuthority: string | null; priority: number | null; displayColorHex: string | null;
  appliedAt: string; applyReason: string; source: string; heldVia: "CONTAINER" | "BOOKING";
  bookingId: string | null; orderNo: string | null;
}

export interface ContainerHolds { containerNo: string; isHeld: boolean; holds: ActiveHold[] }

export const GATE_API = "/api/tos/gate";

export const eirPath = (direction: string, id: string) =>
  `/gate/${direction === "OUT" ? "eir-out" : "eir-in"}/${id}`;

export const attachmentsPath = (ownerType: "GATE_TRANSACTION" | "SURVEY", ownerId: string) =>
  `${GATE_API}/attachments?ownerType=${ownerType}&ownerId=${ownerId}`;

/** A day as the API filters it: from local midnight, to (exclusive) the next midnight. */
export function dayRange(fromDay: string, toDay: string): { from?: string; to?: string } {
  const at = (d: string, plusDays = 0) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day + plusDays).toISOString();
  };
  return { from: fromDay ? at(fromDay) : undefined, to: toDay ? at(toDay, 1) : undefined };
}

export function formatKg(kg: number | null | undefined): string {
  return kg == null ? "—" : `${kg.toLocaleString("en-GB", { maximumFractionDigits: 0 })} kg`;
}

export function formatBytes(n: number | null): string {
  if (n == null) return "";
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
