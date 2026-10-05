/**
 * One gate-out: a truck leaving with one box.
 *
 * Gate Out is deliberately NOT the multi-box screen Gate In is. The desktop
 * keeps it to one container per save — no summary grid, no VAS list, no damage
 * panel — because a truck leaves with what it came to collect, and the common
 * case is one box on one trip.
 *
 * Release Laden To Port was dropped on 2026-10-05 (owner): KORAKIT does not
 * release laden boxes to a port from this screen, and contract §10 says
 * laden-to-port is the ordinary `FULL_OUT` step anyway — nothing about it
 * needed a mode of its own.
 */
import type { GateFinding, GatePreflight, GateTransaction, GateTransactionRequest } from '@/lib/api/tos';
import { numberOrNull, textOrNull } from '@/lib/api/tos';
import type { ApiError } from '@/lib/api/problem';

/**
 * The truck, which belongs to the VISIT and not to any one box on it.
 *
 * A truck already inside has all of this read off its visit — retyping a plate
 * at the exit is how one arrival becomes two trucks. A truck that arrives empty
 * to collect has no visit yet, so it is keyed, and the first box recorded opens
 * one.
 */
export interface GateOutTruck {
  truckVisitId: string;
  visitNo: string;
  truckPlate: string;
  trailerPlate: string;
  haulierCode: string;
  driverName: string;
  driverLicenceNo: string;
  truckCategoryCode: string;
}

export const blankGateOutTruck = (): GateOutTruck => ({
  truckVisitId: '', visitNo: '', truckPlate: '', trailerPlate: '',
  haulierCode: '', driverName: '', driverLicenceNo: '', truckCategoryCode: '',
});

/** One box leaving on this truck. */
export interface GateOutDraft {
  /** Local only; the server's id arrives on `recorded`. */
  key: string;

  /** The box going out, picked from what is waiting to leave. */
  bookingContainerId: string;
  bookingId: string;
  orderNo: string;
  carrierRef: string;
  orderTypeCode: string;
  bookingTypeCode: string;
  customerCode: string;
  agentCode: string;
  equipmentTypeCode: string;
  containerNo: string;
  movementCode: string;
  fullEmpty: 'FULL' | 'EMPTY' | null;

  vesselName: string;
  voyageNo: string;

  conditionCode: string;
  gradeCode: string;
  materialCode: string;
  heightCode: string;
  isoCode: string;

  tareWeightKg: string;
  maxGrossWeightKg: string;
  cargoWeightKg: string;
  vgmKg: string;

  /** Vector labels these Seal #1 and Seal #2 on the way out, not Agent/Cust. */
  sealNo1: string;
  sealNo2: string;

  temperatureC: string;
  ventSetting: string;
  humidityPct: string;
  gensetMode: 'NO' | 'YES';
  gensetNo: string;
  clipOnNo: string;

  customsPermitNo: string;
  paperlessCode: string;
  nextLocationCode: string;
  remarks: string;

  checkDigitOverrideReason: string;

  known: GatePreflight | null;
  findings: GateFinding[];

  saving: boolean;
  recorded: GateTransaction | null;
  error: ApiError | null;
}

let seq = 0;
export const blankGateOut = (): GateOutDraft => ({
  key: `o${++seq}-${Date.now().toString(36)}`,
  bookingContainerId: '', bookingId: '', orderNo: '', carrierRef: '',
  orderTypeCode: '', bookingTypeCode: '', customerCode: '', agentCode: '',
  equipmentTypeCode: '', containerNo: '', movementCode: '', fullEmpty: null,
  vesselName: '', voyageNo: '',
  conditionCode: '', gradeCode: '', materialCode: '', heightCode: '', isoCode: '',
  tareWeightKg: '', maxGrossWeightKg: '', cargoWeightKg: '', vgmKg: '',
  sealNo1: '', sealNo2: '',
  temperatureC: '', ventSetting: '', humidityPct: '', gensetMode: 'NO', gensetNo: '',
  clipOnNo: '', customsPermitNo: '', paperlessCode: '', nextLocationCode: '', remarks: '',
  checkDigitOverrideReason: '',
  known: null, findings: [],
  saving: false, recorded: null, error: null,
});

/**
 * A pick-up requires nothing beyond the box — that is the server's matrix, and
 * it is why most of this form is read-only. What the clerk still owes is the
 * box itself, and the truck when it is not one already standing in the yard.
 */
export function gateOutIssues(d: GateOutDraft): string[] {
  const issues: string[] = [];
  if (!d.bookingContainerId) issues.push('The box to release');
  if (!d.containerNo.trim()) issues.push('Container no.');
  if (d.gensetMode === 'YES' && !d.gensetNo.trim()) issues.push('Genset no.');
  return issues;
}

/** The truck is checked once for the whole visit, not once per box. */
export function truckIssues(t: GateOutTruck, keyedTruck: boolean): string[] {
  const issues: string[] = [];
  if (keyedTruck) {
    if (!t.truckPlate.trim()) issues.push('Registration no.');
    if (!t.haulierCode) issues.push('Haulier');
  } else if (!t.truckVisitId) {
    issues.push('Truck in the yard');
  }
  return issues;
}

/** Gross is tare + cargo, as Vector computes it — never typed. */
export function grossOf(d: GateOutDraft): number | null {
  const tare = Number(d.tareWeightKg);
  if (d.tareWeightKg.trim() === '' || !Number.isFinite(tare)) return null;
  if (d.cargoWeightKg.trim() === '') return tare;
  const cargo = Number(d.cargoWeightKg);
  return Number.isFinite(cargo) ? tare + cargo : null;
}

/** Over the plate limit warns and carries on; it never refuses the move. */
export function overMaxWeight(d: GateOutDraft): boolean {
  const gross = grossOf(d);
  const max = Number(d.maxGrossWeightKg);
  if (gross == null || d.maxGrossWeightKg.trim() === '' || !Number.isFinite(max) || max <= 0) return false;
  return gross > max;
}

/**
 * Vector's `SwitchStatus` for the way out: seals are always live because the
 * terminal seals the box before it leaves, and the reefer settings only matter
 * on a full box.
 */
export const reeferEditable = (d: GateOutDraft) => d.fullEmpty === 'FULL';

export const locationLabel = (d: GateOutDraft) =>
  d.orderTypeCode.includes('IN') ? 'Prev loc.' : 'Next loc.';

/** The POST body. One box, always OUT, always a pick-up. */
export function gateOutToRequest(
  d: GateOutDraft, t: GateOutTruck, branchId: string, visitId: string | null,
): GateTransactionRequest {
  return {
    branchId,
    containerNo: d.containerNo.trim().toUpperCase(),
    direction: 'OUT',
    tripType: 'PICK_UP_CONT',
    // The first box recorded opens the visit and names the truck; every box
    // after it joins by id. Sending `truck` twice opens a second visit for one
    // arrival, which is how a yard's move count quietly goes wrong.
    ...(visitId
      ? { truckVisitId: visitId }
      : {
        truck: {
          plate: t.truckPlate.trim().toUpperCase(),
          trailerPlate: textOrNull(t.trailerPlate),
          driverName: textOrNull(t.driverName),
          driverLicence: textOrNull(t.driverLicenceNo),
          haulierCode: textOrNull(t.haulierCode),
          truckCategoryCode: textOrNull(t.truckCategoryCode),
        },
      }),
    grossWeightKg: grossOf(d),
    tareWeightKg: numberOrNull(d.tareWeightKg),
    maxGrossWeightKg: numberOrNull(d.maxGrossWeightKg),
    cargoWeightKg: numberOrNull(d.cargoWeightKg),
    vgmKg: numberOrNull(d.vgmKg),
    weightSource: null,
    conditionCode: textOrNull(d.conditionCode),
    gradeCode: textOrNull(d.gradeCode),
    materialCode: textOrNull(d.materialCode),
    isoCode: textOrNull(d.isoCode),
    temperatureC: numberOrNull(d.temperatureC),
    ventSetting: textOrNull(d.ventSetting),
    humidityPct: numberOrNull(d.humidityPct),
    gensetNo: d.gensetMode === 'YES' ? textOrNull(d.gensetNo) : null,
    clipOnNo: textOrNull(d.clipOnNo),
    customsPermitNo: textOrNull(d.customsPermitNo),
    paperlessCode: textOrNull(d.paperlessCode),
    nextLocationCode: textOrNull(d.nextLocationCode),
    seals: [
      { sealNo: d.sealNo1, sealType: 'TERMINAL' },
      { sealNo: d.sealNo2, sealType: 'LINE' },
    ]
      .filter(s => s.sealNo.trim())
      .map(s => ({ sealNo: s.sealNo.trim().toUpperCase(), sealType: s.sealType, isIntact: true })),
    remarks: textOrNull(d.remarks),
    checkDigitOverrideReason: textOrNull(d.checkDigitOverrideReason),
  };
}

export type { GateTransaction };
