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
  GateFinding, GatePreflight, GateTransactionRequest, TripType,
} from '@/lib/api/tos';
import type { TripDamage, TripRowResult, VasOption } from '@/lib/api/gate-trips';
import { directionOfTrip, numberOrNull, requiredGateFields, textOrNull } from '@/lib/api/tos';
import { formatDateTime } from '@/lib/format';
import type { TripRow } from '@/lib/api/gate-trips';
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
   * A WALK-IN row: the truck arrived with no paperwork.
   *
   * Replaces BLIND GATE IN on this screen (owner 2026-10-12). The clerk answers
   * Drop off / Pick up (`trip`) and Empty / Full (`fullEmpty`); those two name
   * the tenant's walk-in order type, and the Save raises one booking of it per
   * truck, customer and line. Nothing here sends `blind` any more.
   *
   * A row is EITHER walk-in or booked: picking a booking clears this, and
   * turning this on clears the booking.
   */
  isWalkIn: boolean;
  /**
   * R6: the clerk surveyed the box as it came in — damages listed, or none
   * found. Some order-type steps refuse the gate-in without it (SURVEY_REQUIRED).
   */
  surveyed: boolean;
  lineCode: string;
  customerCode: string;
  equipmentTypeCode: string;
  agentCode: string;

  /** Agreed on the second Save, after the clerk accepted a type change (§23.5). */
  acceptTypeChange: boolean;

  /** Set when the row was filled from a booking the clerk picked. */
  bookingContainerId: string;
  /**
   * The picked line's rowVersion, needed to NOMINATE it.
   *
   * A booking is often made before anyone knows which boxes will go on it, so
   * its rows carry no number. At the gate the clerk picks one of those pending
   * moves and keys the box that actually turned up — that is an edit of the
   * booking line, not a new assignment.
   */
  bookingContainerRowVersion: string;
  /** What the booking line already held, so a real change is recognisable. */
  bookedContainerNo: string;
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
  /** STANDARD / HIGH_CUBE / HALF, pre-filled from the equipment type (§23.4). */
  heightCode: string;
  /** Split from the equipment type: the truck's 45 ft limit counts in feet. */
  size: string;
  type: string;
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

  /** Drop-off rows with a damaged condition carry a survey (§23.3). */
  damages: TripDamage[];

  /** The VAS menu for this box's next movement, priced (§23.2a). */
  vasMenu: VasOption[];
  vasTicked: string[];

  /** What this row would cost, from the quote that Record ran. */
  due: QuoteLineLike[];
  /**
   * What goes on an account instead of the drawer — a haulier on CREDIT terms
   * moves its charges off the cash due. Priced and owed, just not owed here.
   */
  billedLater: QuoteLineLike[];
  /**
   * Charges no tariff prices. NOT free: the gate refuses a box it cannot
   * price, so these are the most important lines on the quote and used to be
   * thrown away — the panel read `due` alone and said "nothing priced yet".
   */
  noPrice: QuoteLineLike[];
  /**
   * Charges that are ALREADY DEALT WITH — paid in advance on an earlier
   * receipt, or waived at the window (API 2026-10-08).
   *
   * They are not owed and never enter a total, but a clerk taking money at the
   * barrier has to see them: a box whose lift was prepaid looks, without this,
   * exactly like a box that was never charged for it.
   */
  settled: SettledLike[];
  /**
   * What the quote decided about WHO PAYS, as opposed to what was paid already.
   *
   * CUSTOMER_ON_CREDIT  the charge goes on the customer's account, no cash here
   * CREDIT_LIMIT_REACHED  a credit customer at or over its limit pays cash now
   *
   * Both were being thrown away with the rest of `tried`, so a truck that owed
   * nothing and a truck whose customer had just blown its credit limit showed
   * the clerk exactly the same card.
   */
  moneyNotes: SettledLike[];
  /** The server's own sentence about this box, when it has one. */
  quoteNote: string | null;
  /**
   * Why the price could not be read. A failed quote used to be swallowed and
   * shown as 0.00, which is the same screen as "this costs nothing".
   */
  quoteError: string | null;
  quoteTotal: number;
  quoteTax: number;

  /**
   * Set by Record: the place the server HELD, which may not be the one picked.
   * `placeMessage` says so, and is shown blue — it is news, not a fault.
   */
  reserved: boolean;
  /**
   * The hold itself, so it can be GIVEN BACK and RENEWED.
   *
   * Thrown away until 2026-10-08, which meant a removed row left its box locked
   * for the rest of its 15 minutes and a long truck quietly lost its holds
   * halfway through keying.
   */
  boxReservationId: string | null;
  /** When the hold lapses unless renewed — shown on the row. */
  holdExpiresAt: string | null;
  placeMessage: string | null;

  saving: boolean;
  /** What the Save made of it: GATED with an EIR, or PLANNED with a coupon. */
  result: TripRowResult | null;
  error: ApiError | null;
  /** What the barrier said — from Record, or carried by a refusal. */
  findings: GateFinding[];
}

/**
 * A charge the quote TRIED and found already dealt with.
 *
 * `outcome` is SETTLED; the note says how — "Paid in advance on CAKTC261000004."
 * or "Waived at the window." — and a waiver carries no amount, because nothing
 * was taken.
 */
export interface SettledLike {
  chargeCode: string;
  chargeName?: string | null;
  billTo?: string | null;
  outcome: string;
  amount: number | null;
  note?: string | null;
  paymentTermCode?: string | null;
}

/** Only the parts of a quote line this screen shows. */
export interface QuoteLineLike {
  chargeCode: string;
  chargeName?: string | null;
  paymentTermCode?: string | null;
  /** The haulier's own term moved this line to credit (§2). */
  byHaulierTerm?: boolean | null;
  amount: number;
  taxAmount: number;
  total: number;
  currencyCode?: string | null;
}

/** The condition a box arrives in unless the clerk says otherwise. */
export const DEFAULT_CONDITION = 'AV';

let seq = 0;
export const newMoveKey = () => `m${++seq}-${Date.now().toString(36)}`;

export function blankMove(trip: TripType, defaults: {
  orderTypeCode?: string; lineCode?: string; isWalkIn?: boolean; fullEmpty?: 'FULL' | 'EMPTY';
} = {}): MoveDraft {
  return {
    key: newMoveKey(),
    trip,
    containerNo: '',
    known: null,
    looking: false,
    isWalkIn: defaults.isWalkIn ?? false,
    surveyed: false,
    lineCode: defaults.lineCode ?? '',
    customerCode: '',
    equipmentTypeCode: '',
    agentCode: '',
    acceptTypeChange: false,
    bookingContainerId: '',
    bookingContainerRowVersion: '',
    bookedContainerNo: '',
    bookingId: '',
    orderNo: '',
    carrierRef: '',
    orderTypeCode: defaults.orderTypeCode ?? '',
    bookingTypeCode: '',
    movementCode: '',
    // A walk-in row opens on the clerk's answer; a booked row reads it off the
    // booking once one is picked.
    fullEmpty: defaults.fullEmpty ?? null,
    // AV — a sound box is what rolls through the gate nearly every time, so the
    // clerk changes it only when something is wrong (owner, 2026-10-09).
    conditionCode: DEFAULT_CONDITION,
    gradeCode: '',
    materialCode: '',
    heightCode: '',
    size: '',
    type: '',
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
    damages: [],
    vasMenu: [],
    vasTicked: [],
    due: [],
    billedLater: [],
    noPrice: [],
    settled: [],
    moneyNotes: [],
    quoteNote: null,
    quoteError: null,
    quoteTotal: 0,
    quoteTax: 0,
    reserved: false,
    boxReservationId: null,
    holdExpiresAt: null,
    placeMessage: null,
    saving: false,
    result: null,
    error: null,
    findings: [],
  };
}

/**
 * Any box number the depot may meet: 4 to 11 letters or digits.
 *
 * The API's own test (`ContainerNumber.AnyFormed`), not the ISO shape. It was
 * the ISO shape here until 2026-10-12, which meant the gate would not even look
 * up a box like RBI051 or 4043535 \u2014 real KORAKIT numbers (owner 2026-10-08:
 * "some containers don't follow ISO container specs") \u2014 and refused to add
 * the trip. Whether a number is ISO is the check digit's business, and the
 * server raises that as a finding the clerk can override.
 */
export const CONTAINER_PATTERN = /^[A-Z0-9]{4,11}$/;
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
    // The order type's own rules for this step. Null until preflight answers,
    // and null means nothing is demanded — there is no rule to read yet.
    move.known?.nextStep ?? null,
  );
}

/**
 * The clerk picked a pending move and keyed a different box into it.
 *
 * That is a NOMINATION: the booking line is updated to the container that
 * actually turned up. It is not the same as gating a loose box, and doing it
 * the other way round is what made the gate ask the server about a container it
 * had never been told of.
 */
export const needsNomination = (m: MoveDraft): boolean =>
  m.bookingContainerId !== ''
  && normaliseBox(m.containerNo) !== ''
  && normaliseBox(m.containerNo) !== normaliseBox(m.bookedContainerNo);

/** Is this box on an order — one the clerk picked, or one preflight found? */
export const onBooking = (m: MoveDraft): boolean =>
  !!m.known?.booking || m.bookingContainerId !== '';

/**
 * A walk-in DROP-OFF may arrive with no number at all — unreadable, or a box
 * that never had one. The gate issues NOID+7 for it (API 2026-10-18).
 *
 * Only a drop-off: a pick-up names a box that is standing in the yard, so it
 * always has one, and a booked box takes its number from the booking.
 */
export const mayMintNumber = (m: MoveDraft) => m.isWalkIn && m.trip === 'DROP_OFF_CONT';

/** A row is ready when it has a plausible box and whatever the server demands. */
export function rowIssues(move: MoveDraft): string[] {
  const issues: string[] = [];
  if (!move.containerNo.trim()) {
    // Blank is allowed here, but then nothing can be read off a registry entry
    // that does not exist: the API requires the line and the type instead.
    if (!mayMintNumber(move)) {
      issues.push('Container number');
      return issues;
    }
  } else if (!boxLooksRight(move.containerNo)) {
    issues.push('Container number (4 to 11 letters or digits)');
  }

  /**
   * WHERE THE BOX WILL STAND used to be hard-coded here for every drop-off
   * (owner 2026-10-22). It is a tick on the order type now (owner 2026-10-27)
   * and arrives through `requiredFor` with the rest, so one list governs every
   * asterisk on the card. With no answer from the server the tick falls back to
   * that same hard-coded rule, so nothing changed for a depot that has not set
   * one.
   */
  for (const field of requiredFor(move)) {
    if (field === 'seals') {
      if (!move.seals.some(s => s.sealNo.trim())) issues.push('At least one seal');
      continue;
    }
    /**
     * There is no `grossWeightKg` on the draft to read — it is DERIVED
     * (`grossOf` = tare + cargo), so a generic lookup would find `undefined`
     * and quietly pass. The tare is the number the clerk actually keys, so the
     * issue says so rather than naming a box that cannot be typed into.
     */
    if (field === 'grossWeightKg') {
      if (grossOf(move) == null) issues.push('Gross weight (key the tare)');
      continue;
    }
    const value = move[field as keyof MoveDraft];
    if (typeof value === 'string' && !value.trim()) issues.push(FIELD_LABELS[field] ?? field);
  }

  /**
   * A WALK-IN row. No B/L is wanted — that is the whole point — but the
   * customer always is, because the booking the Save raises is that customer's
   * and the charges go to its account.
   *
   * A pick-up takes its line and type from the yard box, so neither is asked
   * for; a drop-off needs the line, and the type too when the registry has
   * never seen the box.
   */
  if (move.isWalkIn) {
    if (!move.fullEmpty) issues.push('Empty or full');
    if (!move.customerCode) issues.push('Customer');
    if (move.trip === 'DROP_OFF_CONT') {
      if (!move.lineCode) issues.push('Shipping line');
      // With no number there is no registry entry to fall back on, so the type
      // is required outright rather than only when the box is unknown.
      const noNumber = !move.containerNo.trim();
      if (!move.equipmentTypeCode && (noNumber || move.known?.isInRegistry === false)) {
        issues.push('Box type');
      }
    }
  } else if (!onBooking(move)) {
    // Not walk-in and not booked is no longer a thing this screen can send:
    // `blind` is gone, so the row has to become one or the other.
    issues.push('Booking (or make it a walk-in)');
  }

  if (needsDigitReason(move) && !move.checkDigitOverrideReason.trim()) issues.push('Check-digit override reason');
  if (needsLateReason(move) && !move.lateOverrideReason.trim()) issues.push('Late gate-in reason');
  return issues;
}

const FIELD_LABELS: Record<string, string> = {
  yardId: 'Yard',
  positionText: 'Position',
  tareWeightKg: 'Tare weight',
  maxGrossWeightKg: 'Max gross weight',
  cargoWeightKg: 'Cargo weight',
  grossWeightKg: 'Gross weight',
  customsPermitNo: 'Customs permit no.',
};

export const needsDigitReason = (m: MoveDraft) =>
  m.findings.some(f => f.code === 'CHECK_DIGIT' && f.severity === 'OVERRIDE');
export const needsLateReason = (m: MoveDraft) =>
  m.findings.some(f => f.code.startsWith('LATE') && f.severity === 'OVERRIDE');

/**
 * A booked pick-up cannot be invented: the box has to be on an order already.
 *
 * A WALK-IN pick-up is the exception, and the reason this check now asks. The
 * customer collecting an empty off the yard has no order by definition — the
 * Save raises one. Before walk-ins existed, "pick-up with no order" could only
 * be a mistake.
 */
export const pickupHasNoOrder = (m: MoveDraft) =>
  m.trip === 'PICK_UP_CONT' && !m.isWalkIn && !!m.known && !onBooking(m);

/** The truck, as the move that OPENS the visit reports it. */
export interface TruckDetails {
  plate: string;
  trailerPlate: string;
  haulierCode: string;
  driverName: string;
  driverLicenceNo: string;
  driverMobile: string;
  truckCategoryCode: string;
  /**
   * WHEN THE TRUCK WAS AT THE BARRIER, as a datetime-local value
   * (yyyy-MM-ddTHH:mm, in the clerk's own zone — never UTC).
   *
   * It belongs to the TRUCK, not to a row: one truck is at the gate once, and
   * every box it carries was there at the same moment. It defaults to now and
   * may be wound back as far as the depot needs — the only floor is each box's
   * own last movement, which `beforeLastMoveIssue` checks per row.
   */
  transactionAt: string;
}

/**
 * Why the gate clock is not acceptable, in the clerk’s words — or null.
 *
 * THERE IS NO BACK-DATE WINDOW. NOT 24 HOURS, NOT THE DEPOT’S, NOT ANY (owner
 * 2026-10-27, said twice). A clerk may reach back as far as the paper goes — a
 * week, a month, a year. Do not reintroduce a floor here, and do not put a
 * `min` on the picker: a greyed-out calendar is this rule broken.
 *
 * THE ONLY RULE IS THE BOX’S OWN LAST MOVEMENT, which is per container and not
 * per clock, so it cannot live in this function at all. It is
 * `beforeLastMoveIssue` below, answered from the preflight the moment a
 * container number is keyed.
 *
 * What is left here is only what is not a date at all — blank, unreadable —
 * and the future. FUTURE_GRACE_MINUTES mirrors the server’s
 * `GateRules.FutureGrace`, a constant and not a per-depot setting, so the
 * screen and the POST refuse the same instant. Nobody keys a truck that has
 * not yet arrived.
 */
const FUTURE_GRACE_MINUTES = 5;

export function backDateIssue(value: string, now: Date = new Date()): string | null {
  if (!value.trim()) return 'The gate date and time is blank.';
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return 'The gate date and time cannot be read.';
  if (at.getTime() > now.getTime() + FUTURE_GRACE_MINUTES * 60_000)
    return 'The gate date and time is in the future.';
  return null;
}


/**
 * A MOVE CANNOT PRECEDE THE BOX'S OWN LAST MOVE (owner 2026-10-27).
 *
 * Time runs one way for a container: it cannot be gated in on Monday if the
 * system already has it leaving on Wednesday. Dating a move behind its
 * predecessor reorders the box's history, and everything read off that
 * order — where it stands, how long it has been there, what storage is owed —
 * is then computed from a sequence that never happened.
 *
 * IT READS THE PREFLIGHT, which the gate already calls the moment a container
 * number is keyed — so this costs no extra round trip.
 *
 *   lastMovementAt      the box's whole history. LIVE on the API since
 *                       2026-10-27, and verified to carry a value for a box
 *                       that has LEFT the yard — the case below cannot see.
 *   inYard.lastEventAt  the fallback for an older API: only the visit the box
 *                       is on NOW, and null for a box not in the yard — which
 *                       is exactly the returning box whose history matters
 *
 * The server holds the full history and stays the authority either way.
 *
 * STRICTLY LATER, NOT "at or after". We asked for equal to be allowed; the API
 * shipped `at > previousMoveAt` (GateRules.BeforePreviousMove / InBeforeLastOut,
 * both BLOCK). Equal is therefore REFUSED, and this check follows the server
 * rather than the request — a screen that accepted the same instant would pass
 * a row the POST then rejects, which is the one failure that teaches a clerk to
 * stop believing the screen.
 *
 * THE MESSAGE NAMES THE EARLIEST MINUTE THE CLERK CAN KEY, which is never the
 * minute of the last movement. A stored instant has seconds; the picker has
 * none. A box that last moved at 14:00:13 refuses a keyed 14:00, and a refusal
 * reading "cannot be before 14:00" would be telling the clerk to key what it
 * has just rejected. The first whole minute strictly after the last movement is
 * the smallest value both this check and the server accept.
 */
export function beforeLastMoveIssue(move: MoveDraft, transactionAt: string): string | null {
  const last = move.known?.lastMovementAt ?? move.known?.inYard?.lastEventAt;
  if (!last || !transactionAt.trim()) return null;
  const at = new Date(transactionAt);
  const previous = new Date(last);
  if (Number.isNaN(at.getTime()) || Number.isNaN(previous.getTime())) return null;
  if (at.getTime() > previous.getTime()) return null;
  const box = move.containerNo.trim() || 'this box';
  // The first whole minute STRICTLY after the last movement; see the note above.
  const earliest = new Date((Math.floor(previous.getTime() / 60_000) + 1) * 60_000);
  return `${box} already has a movement at ${formatDateTime(last)}. `
    + `The gate date and time must be later than that — `
    + `the earliest you can key is ${formatDateTime(earliest.toISOString())}.`;
}

/**
 * The POST body for one row.
 *
 * `truckVisitId` and `truck` are exclusive: the first recorded move opens the
 * visit and names the truck, the rest join it by id. Sending both would leave
 * the server to guess which one the clerk meant.
 */
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

/** A damaged box carries a survey; Vector's condition for it is DMG. */
export const isDamaged = (move: MoveDraft): boolean =>
  move.trip === 'DROP_OFF_CONT' && move.conditionCode.trim().toUpperCase() === 'DMG';

/**
 * One row as the Save wants it.
 *
 * The truck is NOT on the row — it is on the Save, once, because a truck
 * arrives once. The place (`bookingContainerId`) is what ties the row to the
 * booking, and the server writes the container number onto that place itself:
 * the UI never PUTs the booking line (§24.3).
 */
export function moveToTripRow(move: MoveDraft, branchId: string, transactionAt: string | null): TripRow {
  const box = normaliseBox(move.containerNo);
  const row: TripRow = {
    move: {
      branchId,
      // An empty pick-up where the yard chooses the box is keyed at Gate Out,
      // so the number is genuinely blank here (§25.1). A walk-in drop-off may
      // also be blank on purpose: the gate mints NOID+7 for it.
      containerNo: box,
      direction: directionOfTrip(move.trip),
      tripType: move.trip,
      // The gate clock, the same instant on every row of this truck. Null means
      // "now", which is what the server assumed before this existed.
      transactionAt,
      // Gross is derived from tare + cargo, as Vector derives it. It is not a
      // weighbridge reading, so `weightSource` stays null.
      grossWeightKg: grossOf(move),
      tareWeightKg: numberOrNull(move.tareWeightKg),
      maxGrossWeightKg: numberOrNull(move.maxGrossWeightKg),
      cargoWeightKg: numberOrNull(move.cargoWeightKg),
      vgmKg: numberOrNull(move.vgmKg),
      weightSource: null,
      conditionCode: textOrNull(move.conditionCode),
      gradeCode: textOrNull(move.gradeCode),
      materialCode: textOrNull(move.materialCode),
      heightCode: textOrNull(move.heightCode),
      isoCode: textOrNull(move.isoCode),
      temperatureC: numberOrNull(move.temperatureC),
      ventSetting: textOrNull(move.ventSetting),
      humidityPct: numberOrNull(move.humidityPct),
      gensetNo: move.gensetMode === 'YES' ? textOrNull(move.gensetNo) : null,
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
    },
  };

  if (move.bookingContainerId) {
    row.bookingContainerId = move.bookingContainerId;
  } else {
    /**
     * A box with no booking is a WALK-IN, never a blind gate-in any more.
     *
     * A PICK-UP's line and type come from the yard box the clerk chose, so
     * sending this screen's copies could only disagree with the yard. A
     * drop-off sends what was keyed, and the API falls back to the registry's
     * owner when the line is left out.
     */
    const pickUp = move.trip === 'PICK_UP_CONT';
    row.walkIn = {
      fullEmpty: move.fullEmpty ?? 'EMPTY',
      customerCode: move.customerCode,
      lineCode: pickUp ? null : move.lineCode || null,
      equipmentTypeCode: pickUp ? null : move.equipmentTypeCode || null,
      remarks: move.remarks || null,
    };
  }

  // R6. Damages imply it server-side, but sending it keeps the row honest when
  // the clerk ticked "none found" and listed nothing.
  if (move.trip === 'DROP_OFF_CONT' && (move.surveyed || move.damages.length > 0)) row.surveyed = true;

  // Damages belong to a drop-off only; on a pick-up they are a 400.
  if (move.trip === 'DROP_OFF_CONT' && move.damages.length > 0) row.damages = move.damages;

  /**
   * What the clerk read off the box, so the server can say it differs (§23.5).
   *
   * Only for a BOOKED box: that comparison is against what the booking says,
   * and a walk-in has no booking to disagree with. The API ignores it on a
   * walk-in row; sending it anyway only invites a future version to not.
   */
  if (move.equipmentTypeCode && !move.isWalkIn) row.equipmentTypeCode = move.equipmentTypeCode;
  if (move.acceptTypeChange) row.acceptTypeChange = true;

  return row;
}

/** What the visit calls itself, by the same rule the server uses (§11). */
export function derivedMode(moves: MoveDraft[]): 'NONE' | 'DROPOFF' | 'PICKUP' | 'PICKUP_DROPOFF' {
  const done = moves.filter(m => m.result && m.result.status !== 'NOT_GATED');
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
