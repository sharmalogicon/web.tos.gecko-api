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

/** 3 letters, U/J/Z, 7 digits — the same test the API applies before it answers 400. */
export function isWellFormedContainerNo(no: string): boolean {
  return /^[A-Z]{3}[UJZ][0-9]{7}$/.test(no);
}

const EVENT_LABEL: Record<string, string> = {
  GATE_IN: 'Gate-in',
  GATE_OUT: 'Gate-out',
  PLUG_IN: 'Plugged in',
  PLUG_OUT: 'Unplugged',
  CORRECTION: 'Correction',
  HOLD_APPLIED: 'Hold applied',
  SURVEY: 'Surveyed',
};

export function eventLabel(type: string): string {
  return EVENT_LABEL[type] ?? type.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}
