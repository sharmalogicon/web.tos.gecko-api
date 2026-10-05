/**
 * One truck visit, and the boxes that go on or off it.
 *
 * THE MODEL, which is the API's and not an invention of this screen:
 *
 *   - `tripType` belongs to the MOVE. Two values, required on every POST.
 *     DROP_OFF_CONT is a gate IN, PICK_UP_CONT is a gate OUT.
 *   - The MODE belongs to the VISIT and is DERIVED by the server from the moves
 *     that stand — never sent, never stored (contract §11). So this screen does
 *     not ask "is this a receival or a delivery": it asks per box, and the visit
 *     calls itself DROPOFF / PICKUP / PICKUP_DROPOFF on its own.
 *   - The FIRST move recorded opens the visit: it carries `truck`. Every move
 *     after it carries `truckVisitId` instead. Sending `truck` twice would open
 *     a second visit for the same truck, which is how one arrival becomes two.
 *
 * Each row is recorded on its own POST, because that is what the API offers —
 * there is no batch. A row that is refused leaves the others alone, which is
 * the behaviour a gate clerk needs when one box of three has a hold on it.
 */
import type {
  GateFinding, GatePreflight, GateTransaction, GateTransactionRequest, TripType,
} from '@/lib/api/tos';
import { directionOfTrip, numberOrNull, requiredGateFields, textOrNull } from '@/lib/api/tos';
import type { ApiError } from '@/lib/api/problem';

export interface SealRow { sealNo: string; sealType: string; isIntact: boolean }
export const EMPTY_SEAL: SealRow = { sealNo: '', sealType: 'LINE', isIntact: true };

/** A box on this visit: what the clerk has keyed, and what became of it. */
export interface MoveDraft {
  /** Local only. The server's id is on `recorded`. */
  key: string;
  trip: TripType;
  containerNo: string;

  /** What preflight said about the box. Null until it has been looked up. */
  known: GatePreflight | null;
  looking: boolean;

  /**
   * The BLIND GATE IN, raised with the move when the box is on no booking.
   *
   * `POST /api/tos/gate/blind-orders` is the gate's own door — it makes the
   * BLIND GATE IN order the booking page refuses to make by hand, and it does
   * NOT want a B/L, which is exactly the desktop's rule: choosing BLIND GATE IN
   * is what stops the Booking/B-L No being mandatory (GateIn.cs line 198).
   * The order type is not sent: it is BLIND GATE IN by definition.
   */
  lineCode: string;
  customerCode: string;
  equipmentTypeCode: string;
  agentCode: string;

  /** Set when the row was filled from a booking the clerk picked. */
  bookingContainerId: string;
  bookingId: string;
  orderNo: string;
  carrierRef: string;
  orderTypeCode: string;
  bookingTypeCode: string;
  movementCode: string;
  fullEmpty: 'FULL' | 'EMPTY' | null;

  /** Vector's "Status" — the box's condition on the EIR (AV, DM …). */
  conditionCode: string;
  /** Vector's "Container Class". The gate has no separate class field. */
  gradeCode: string;
  materialCode: string;
  /** No API field carries it yet; shown so the shape is right. */
  heightCode: string;
  isoCode: string;

  /** Read off the booking, never typed — they belong to the vessel call. */
  vesselName: string;
  voyageNo: string;

  /** Vector shows a NO/YES beside the genset number. */
  gensetMode: 'NO' | 'YES';

  tareWeightKg: string;
  maxGrossWeightKg: string;
  cargoWeightKg: string;
  vgmKg: string;

  seals: SealRow[];

  temperatureC: string;
  ventSetting: string;
  humidityPct: string;
  gensetNo: string;
  clipOnNo: string;

  customsPermitNo: string;
  paperlessCode: string;
  nextLocationCode: string;

  yardId: string;
  positionText: string;
  remarks: string;

  /** Revealed only when the server asks for them. */
  checkDigitOverrideReason: string;
  lateOverrideReason: string;

  saving: boolean;
  recorded: GateTransaction | null;
  error: ApiError | null;
  /** What the barrier said — on the 201, or carried by a 409. Never stored. */
  findings: GateFinding[];
}

let seq = 0;
export const newMoveKey = () => `m${++seq}-${Date.now().toString(36)}`;

export function blankMove(trip: TripType, defaults: {
  orderTypeCode?: string; lineCode?: string;
} = {}): MoveDraft {
  return {
    key: newMoveKey(),
    trip,
    containerNo: '',
    known: null,
    looking: false,
    lineCode: defaults.lineCode ?? '',
    customerCode: '',
    equipmentTypeCode: '',
    agentCode: '',
    bookingContainerId: '',
    bookingId: '',
    orderNo: '',
    carrierRef: '',
    orderTypeCode: defaults.orderTypeCode ?? '',
    bookingTypeCode: '',
    movementCode: '',
    fullEmpty: null,
    conditionCode: '',
    gradeCode: '',
    materialCode: '',
    heightCode: '',
    isoCode: '',
    vesselName: '',
    voyageNo: '',
    gensetMode: 'NO',
    tareWeightKg: '',
    maxGrossWeightKg: '',
    cargoWeightKg: '',
    vgmKg: '',
    // Vector gives the clerk exactly two slots — Agent Seal and Cust. Seal —
    // which is why the API grew the AGENT and CUSTOMER seal types. Both are
    // always present; `moveToRequest` drops whichever is left blank.
    seals: [
      { sealNo: '', sealType: 'AGENT', isIntact: true },
      { sealNo: '', sealType: 'CUSTOMER', isIntact: true },
    ],
    temperatureC: '',
    ventSetting: '',
    humidityPct: '',
    gensetNo: '',
    clipOnNo: '',
    customsPermitNo: '',
    paperlessCode: '',
    nextLocationCode: '',
    yardId: '',
    positionText: '',
    remarks: '',
    checkDigitOverrideReason: '',
    lateOverrideReason: '',
    saving: false,
    recorded: null,
    error: null,
    findings: [],
  };
}

/** ISO 6346: four letters, then seven digits. */
export const CONTAINER_PATTERN = /^[A-Z]{4}\d{7}$/;
export const normaliseBox = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const boxLooksRight = (value: string) => CONTAINER_PATTERN.test(normaliseBox(value));

/**
 * The fields the server will insist on for THIS row, so the clerk is told
 * before the POST rather than by a 400 after it. FULL/EMPTY comes from the
 * booking step the preflight returned, never from anything the clerk picked.
 */
export function requiredFor(move: MoveDraft): string[] {
  return requiredGateFields(
    move.trip,
    // Preflight is the authority once it has answered; before that the box the
    // clerk picked already said whether the move is full or empty.
    move.known?.nextStep?.fullEmpty ?? move.fullEmpty,
    (move.known?.booking?.directionCode ?? move.bookingTypeCode) === 'EXPORT',
  );
}

/** Is this box on an order — one the clerk picked, or one preflight found? */
export const onBooking = (m: MoveDraft): boolean =>
  !!m.known?.booking || m.bookingContainerId !== '';

/** A row is ready when it has a plausible box and whatever the server demands. */
export function rowIssues(move: MoveDraft): string[] {
  const issues: string[] = [];
  if (!move.containerNo.trim()) {
    issues.push('Container number');
    return issues;
  }
  if (!boxLooksRight(move.containerNo)) issues.push('Container number is not four letters and seven digits');

  for (const field of requiredFor(move)) {
    if (field === 'seals') {
      if (!move.seals.some(s => s.sealNo.trim())) issues.push('At least one seal');
      continue;
    }
    const value = move[field as keyof MoveDraft];
    if (typeof value === 'string' && !value.trim()) issues.push(FIELD_LABELS[field] ?? field);
  }

  // On no booking, the gate raises a BLIND GATE IN for it. No B/L is wanted —
  // that is the point of a blind gate-in — but the line and the customer are,
  // and the type of box when the registry has never seen it.
  if (!onBooking(move) && move.trip === 'DROP_OFF_CONT') {
    if (!move.lineCode) issues.push('Shipping line');
    if (!move.customerCode) issues.push('Customer');
    if (!move.equipmentTypeCode && move.known?.isInRegistry === false) issues.push('Equipment type');
  }

  if (needsDigitReason(move) && !move.checkDigitOverrideReason.trim()) issues.push('Check-digit override reason');
  if (needsLateReason(move) && !move.lateOverrideReason.trim()) issues.push('Late gate-in reason');
  return issues;
}

const FIELD_LABELS: Record<string, string> = {
  tareWeightKg: 'Tare weight',
  maxGrossWeightKg: 'Max gross weight',
  cargoWeightKg: 'Cargo weight',
  customsPermitNo: 'Customs permit no.',
};

export const needsDigitReason = (m: MoveDraft) =>
  m.findings.some(f => f.code === 'CHECK_DIGIT' && f.severity === 'OVERRIDE');
export const needsLateReason = (m: MoveDraft) =>
  m.findings.some(f => f.code.startsWith('LATE') && f.severity === 'OVERRIDE');

/** A pick-up cannot be invented: the box has to be on an order already. */
export const pickupHasNoOrder = (m: MoveDraft) =>
  m.trip === 'PICK_UP_CONT' && !!m.known && !onBooking(m);

/** The truck, as the move that OPENS the visit reports it. */
export interface TruckDetails {
  plate: string;
  trailerPlate: string;
  haulierCode: string;
  driverName: string;
  driverLicenceNo: string;
  driverMobile: string;
  truckCategoryCode: string;
}

/**
 * The POST body for one row.
 *
 * `truckVisitId` and `truck` are exclusive: the first recorded move opens the
 * visit and names the truck, the rest join it by id. Sending both would leave
 * the server to guess which one the clerk meant.
 */
export function moveToRequest(
  move: MoveDraft,
  branchId: string,
  truck: TruckDetails,
  truckVisitId: string | null,
): GateTransactionRequest {
  const box = normaliseBox(move.containerNo);
  return {
    branchId,
    containerNo: box,
    direction: directionOfTrip(move.trip),
    tripType: move.trip,
    ...(truckVisitId
      ? { truckVisitId }
      : {
        truck: {
          plate: truck.plate.trim().toUpperCase(),
          trailerPlate: textOrNull(truck.trailerPlate),
          driverName: textOrNull(truck.driverName),
          driverLicence: textOrNull(truck.driverLicenceNo),
          haulierCode: textOrNull(truck.haulierCode),
          truckCategoryCode: textOrNull(truck.truckCategoryCode),
        },
      }),
    // Gross is derived from tare + cargo, as Vector derives it. It is NOT a
    // weighbridge reading, so `weightSource` stays null rather than claiming
    // the box was weighed when nobody weighed it.
    grossWeightKg: grossOf(move),
    tareWeightKg: numberOrNull(move.tareWeightKg),
    maxGrossWeightKg: numberOrNull(move.maxGrossWeightKg),
    cargoWeightKg: numberOrNull(move.cargoWeightKg),
    vgmKg: numberOrNull(move.vgmKg),
    weightSource: null,
    conditionCode: textOrNull(move.conditionCode),
    gradeCode: textOrNull(move.gradeCode),
    materialCode: textOrNull(move.materialCode),
    isoCode: textOrNull(move.isoCode),
    temperatureC: numberOrNull(move.temperatureC),
    ventSetting: textOrNull(move.ventSetting),
    humidityPct: numberOrNull(move.humidityPct),
    gensetNo: textOrNull(move.gensetNo),
    clipOnNo: textOrNull(move.clipOnNo),
    customsPermitNo: textOrNull(move.customsPermitNo),
    paperlessCode: textOrNull(move.paperlessCode),
    nextLocationCode: textOrNull(move.nextLocationCode),
    yardId: move.yardId || null,
    positionText: textOrNull(move.positionText),
    seals: move.seals
      .filter(s => s.sealNo.trim())
      .map(s => ({ sealNo: s.sealNo.trim().toUpperCase(), sealType: s.sealType, isIntact: s.isIntact })),
    remarks: textOrNull(move.remarks),
    checkDigitOverrideReason: textOrNull(move.checkDigitOverrideReason),
    lateOverrideReason: textOrNull(move.lateOverrideReason),
  };
}

/**
 * Gross is COMPUTED, never typed: `gross = tare + cargo`
 * (`CalculateGrossWeight`, GateIn.cs line 3284). Letting a clerk type a third
 * number that disagrees with the other two is how a weighbridge ticket and an
 * EIR end up telling different stories.
 */
export function grossOf(move: MoveDraft): number | null {
  const tare = Number(move.tareWeightKg);
  const cargo = Number(move.cargoWeightKg);
  if (move.tareWeightKg.trim() === '' || !Number.isFinite(tare)) return null;
  if (move.cargoWeightKg.trim() === '') return tare;
  if (!Number.isFinite(cargo)) return null;
  return tare + cargo;
}

/**
 * Over the plate limit. Vector WARNS and carries on ("Over Max Weight",
 * `ValidateWeight` line 1100) — it does not refuse, because a real overweight
 * box is still standing at the gate and still has to be written down.
 */
export function overMaxWeight(move: MoveDraft): boolean {
  const gross = grossOf(move);
  const max = Number(move.maxGrossWeightKg);
  if (gross == null || move.maxGrossWeightKg.trim() === '' || !Number.isFinite(max) || max <= 0) return false;
  return gross > max;
}

/**
 * What the clerk may touch, by trip and load — Vector's `SwitchStatus`
 * (GateIn.cs line 2138). A pick-up seals the box on the way out; a full
 * drop-off declares its cargo, reefer settings and permit; an empty drop-off
 * does neither but still carries seals.
 */
export function editable(move: MoveDraft, field: 'reefer' | 'seals' | 'cargo' | 'permit' | 'clipOn'): boolean {
  const load = move.known?.nextStep?.fullEmpty ?? move.fullEmpty;
  const fullDrop = move.trip === 'DROP_OFF_CONT' && load === 'FULL';
  switch (field) {
    case 'seals': return true;
    case 'reefer':
    case 'cargo':
    case 'permit':
    case 'clipOn': return fullDrop;
  }
}

/** Vector flips this label on an inbound order type. */
export const locationLabel = (move: MoveDraft): string =>
  (move.known?.booking?.orderTypeCode ?? move.orderTypeCode).includes('IN') ? 'Prev loc.' : 'Next loc.';

/** What the visit calls itself, by the same rule the server uses (§11). */
export function derivedMode(moves: MoveDraft[]): 'NONE' | 'DROPOFF' | 'PICKUP' | 'PICKUP_DROPOFF' {
  const done = moves.filter(m => m.recorded);
  const anyIn = done.some(m => m.trip === 'DROP_OFF_CONT');
  const anyOut = done.some(m => m.trip === 'PICK_UP_CONT');
  if (anyIn && anyOut) return 'PICKUP_DROPOFF';
  if (anyIn) return 'DROPOFF';
  if (anyOut) return 'PICKUP';
  return 'NONE';
}

export const MODE_LABELS: Record<string, string> = {
  NONE: 'Nothing recorded yet',
  DROPOFF: 'Drop-off',
  PICKUP: 'Pick-up',
  PICKUP_DROPOFF: 'Drop-off and pick-up',
};
