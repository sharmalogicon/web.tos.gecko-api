/**
 * One box's story, as the unit inquiry reads it.
 *
 *   GET /api/tos/containers/{no}/story      stays (yard.container_visit) with their events, and bookings
 *   GET /api/master/containers/{no}         the registry: type, ISO, owner, lessor, weights
 *   GET /api/tos/gate/transactions?containerNo=   its EIRs
 *   GET /api/tos/containers/{no}/holds      what holds it now (its own and its booking's)
 *   GET /api/tos/holds?containerNo=&status=RELEASED   holds released
 *   GET /api/tos/reefer/sessions?search=&status=ALL   its plug sessions
 *
 * Each read is scoped by the API: a gate clerk sees only the stays and EIRs at
 * their own depot. No price is read here — charges are per booking at the cash window.
 */

export const STORY_PERMISSIONS = {
  gateView: 'tos.gate.view',
  bookingView: 'tos.booking.view',
  holdView: 'tos.hold.view',
  reeferView: 'tos.reefer.view',
  registryView: 'mdm.equipment.view',
  yardView: 'mdm.org.view',
} as const;

export const storyPath = (no: string) => `/api/tos/containers/${encodeURIComponent(no)}/story`;
export const registryPath = (no: string) => `/api/master/containers/${encodeURIComponent(no)}`;

export interface StoryEvent {
  visitEventId: number;
  eventType: string;
  fromValue: string | null;
  toValue: string | null;
  eventAt: string;
  eventBy: string | null;
  referenceId: string | null;
  remarks: string | null;
}

export interface StoryVisit {
  containerVisitId: string;
  branchId: string;
  branchCode: string | null;
  equipmentTypeCode: string | null;
  lineCode: string;
  fullEmpty: string;
  conditionCode: string | null;
  /** The EMR desk's note on this stay (API 2026-10-12); shown at gate-out as INFO. */
  emrRemarks?: string | null;
  gradeCode: string | null;
  yardId: string | null;
  positionText: string | null;
  gateInTransactionId: string;
  gateInEirNo: string | null;
  gateInMovementCode: string | null;
  gateInAt: string | null;
  gateOutTransactionId: string | null;
  gateOutEirNo: string | null;
  gateOutAt: string | null;
  daysInYard: number;
  isInYard: boolean;
  isHeld: boolean;
  currentBookingContainerId: string | null;
  lastEventAt: string;
  events: StoryEvent[];
}

export interface StoryBooking {
  bookingContainerId: string;
  bookingId: string;
  orderNo: string;
  branchId: string;
  branchCode: string | null;
  orderTypeCode: string;
  bookingStatus: string;
  lineCode: string;
  customerCode: string | null;
  assignedAt: string;
  endedAt: string | null;
  endReason: string | null;
  isOpen: boolean;
}

export interface ContainerStory {
  containerNo: string;
  isInYard: boolean;
  current: StoryVisit | null;
  visits: StoryVisit[];
  bookings: StoryBooking[];
}

/** The registry row (Gecko.MasterData ContainerResponse). */
export interface RegistryContainer {
  containerId: string;
  containerNo: string;
  prefix: string;
  typeCode: string | null;
  isoCode: string | null;
  ownerCode: string | null;
  lessorCode: string | null;
  ownershipType: string;
  material: string | null;
  manufactureDate: string | null;
  manufacturer: string | null;
  cscPlateRef: string | null;
  acepRef: string | null;
  nextExaminationDate: string | null;
  tareWeightKg: number | null;
  maxGrossKg: number | null;
  reeferUnitMake: string | null;
  reeferUnitModel: string | null;
  status: string;
  statusChangedAt: string | null;
  isCheckDigitValid: boolean;
}

/** What the clerk typed, as the API reads it: spaces and dashes out, upper case. */
export function normaliseContainerNo(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * ANY box number the depot may meet: 4 to 11 letters or digits.
 *
 * This mirrors `ContainerNumber.AnyFormed` in Gecko.SharedKernel, which is what
 * the API actually tests before it answers 400 — NOT the ISO shape. The owner
 * settled it on 2026-10-08: "some containers don't follow ISO container specs",
 * naming real KORAKIT boxes — ANVY6399011, PLD9256601, RBI051, 4043535.
 *
 * It was the ISO regex here until 2026-10-12, which meant this screen refused
 * to look up boxes that are standing in the yard right now: a clerk keying
 * CONT2990876 was told it "is not a container number" and no request was ever
 * sent. Do not tighten it again.
 */
export function isWellFormedContainerNo(no: string): boolean {
  return /^[A-Z0-9]{4,11}$/.test(no);
}

const EVENT_LABEL: Record<string, string> = {
  GATE_IN: 'Gate-in',
  GATE_OUT: 'Gate-out',
  PLUG_IN: 'Plugged in',
  PLUG_OUT: 'Unplugged',
  CORRECTION: 'Correction',
  HOLD_APPLIED: 'Hold applied',
  SURVEY: 'Surveyed',
  // Written by the Container Master's yard panel (API 2026-10-12). Named here
  // because the fallback turns EMR_REMARKS into "Emr remarks".
  CONDITION_CHANGE: 'Condition changed',
  GRADE_CHANGE: 'Grade changed',
  EMR_REMARKS: 'EMR remarks',
  RENUMBERED: 'Number corrected',
};

export function eventLabel(type: string): string {
  return EVENT_LABEL[type] ?? type.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}
