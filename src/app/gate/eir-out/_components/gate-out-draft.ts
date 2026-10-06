/**
 * GATE OUT — releasing what Gate In planned.
 *
 * A pick-up happens twice (§25). Gate In ANNOUNCES it: the money is taken, no
 * EIR is written, and the box is held for that truck for 24 hours. Gate Out
 * RELEASES it against the truck's own visit.
 *
 * So this screen does not choose what leaves. It shows the truck in front of
 * the clerk and the pick-ups that truck came for, and the clerk confirms the
 * box actually loaded. For an empty pick-up the yard chooses the box, so the
 * number is keyed here for the first time — the booking follows it (§24
 * write-back) and the server checks it at the barrier.
 *
 * No money is taken here, and `POST /gate/transactions` is never called: the
 * release is one `POST /gate/trips` carrying `truckVisitId`, so one arrival
 * stays one visit.
 */
import type { GateFinding, GatePreflight } from '@/lib/api/tos';
import { textOrNull } from '@/lib/api/tos';
import type { TripRow, VisitPickup } from '@/lib/api/gate-trips';
import type { ApiError } from '@/lib/api/problem';

/** The truck, read off its visit. Nothing here is typed by the clerk. */
export interface GateOutTruck {
  truckVisitId: string;
  visitNo: string;
  truckPlate: string;
  trailerPlate: string;
  haulierCode: string;
  driverName: string;
  truckCategoryCode: string;
}

export const blankGateOutTruck = (): GateOutTruck => ({
  truckVisitId: '', visitNo: '', truckPlate: '', trailerPlate: '',
  haulierCode: '', driverName: '', truckCategoryCode: '',
});

/** One planned pick-up, as the clerk works it. */
export interface ReleaseRow {
  key: string;
  pickup: VisitPickup;

  /**
   * The box actually loaded.
   *
   * Pre-filled from the plan when Gate In named one. Where the yard chooses it
   * is blank and keyed here — and it may legitimately differ from what was
   * planned, because the yard gives whichever box of that type is to hand.
   */
  containerNo: string;

  sealNo1: string;
  sealNo2: string;
  conditionCode: string;
  gradeCode: string;
  remarks: string;

  /** What preflight said about letting this box out. */
  known: GatePreflight | null;
  looking: boolean;
  findings: GateFinding[];
  error: ApiError | null;

  /** Set once the Save has released it. */
  releasedEirNo: string | null;
  releasedPdfUrl: string | null;
}

let seq = 0;
export const rowFor = (pickup: VisitPickup): ReleaseRow => ({
  key: `r${++seq}-${pickup.visitPickupId.slice(0, 8)}`,
  pickup,
  containerNo: pickup.containerNo ?? '',
  sealNo1: '', sealNo2: '',
  conditionCode: '', gradeCode: '', remarks: '',
  known: null, looking: false, findings: [], error: null,
  releasedEirNo: null, releasedPdfUrl: null,
});

/** The yard picks the box, so Gate In never named one. */
export const yardChooses = (r: ReleaseRow) => !r.pickup.containerNo;

/**
 * What stops this row being released.
 *
 * Only the shape is checked here — whether the box may actually leave is the
 * server's to say, and it says so in `findings`. A BLOCK finding holds the
 * Save, because releasing a box the barrier refused is the one mistake this
 * screen cannot undo.
 */
export function releaseIssues(r: ReleaseRow): string[] {
  const issues: string[] = [];
  if (!r.containerNo.trim()) issues.push('Container no.');
  if (isBlocked(r)) issues.push('A refusal to clear');
  return issues;
}

export const isBlocked = (r: ReleaseRow) => r.findings.some(f => f.severity === 'BLOCK');

/** One release, as the Save wants it. No truck block: the visit names it. */
export function releaseToTripRow(r: ReleaseRow, branchId: string): TripRow {
  return {
    bookingContainerId: r.pickup.bookingContainerId,
    move: {
      branchId,
      containerNo: r.containerNo.trim().toUpperCase(),
      direction: 'OUT',
      tripType: 'PICK_UP_CONT',
      conditionCode: textOrNull(r.conditionCode),
      gradeCode: textOrNull(r.gradeCode),
      remarks: textOrNull(r.remarks),
      seals: [
        { sealNo: r.sealNo1, sealType: 'TERMINAL' },
        { sealNo: r.sealNo2, sealType: 'LINE' },
      ]
        .filter(s => s.sealNo.trim())
        .map(s => ({ sealNo: s.sealNo.trim().toUpperCase(), sealType: s.sealType, isIntact: true })),
    },
  };
}
