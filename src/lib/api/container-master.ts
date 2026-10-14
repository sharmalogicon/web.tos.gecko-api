/**
 * CONTAINER MASTER — the write side of the box.
 *
 * Reading a box is `container-story.ts` (its stays, its events, its registry
 * row). This file is what a clerk CHANGES about it:
 *
 *   PUT /api/master/containers/{containerNo}   the registry row + its fixed ports
 *
 * One PUT, one rowVersion. The registry's fixed-port list is a field of that
 * same row, not a sub-resource — so "Save" on the Container Master page sends
 * the identity and the ports together, and a stale rowVersion refuses both
 * rather than letting half the screen land.
 *
 * Everything the PUT carries is REPLACED by what is sent. There is no PATCH:
 * omitting `tareWeightKg` clears it. `fromRegistry()` therefore seeds the form
 * from the row that was read, and `requestFrom()` sends every field back.
 *
 * The three things that were waiting on the API all landed on 2026-10-12
 * (UI_PROMPT_CONTAINER_MASTER.md), and live below: a standing box's condition,
 * its EMR remarks, and correcting its number. Note where each one lives — the
 * renumber is a TOS endpoint, not a master-data one, because the box's stays,
 * EIRs and receipts have to move with the number and master data cannot call
 * TOS (the dependency runs the other way).
 */
import { apiSend } from './client';
import { useApi } from './use-api';
import type { RegistryContainer } from './container-story';

// ─── permissions ──────────────────────────────────────────────────────────────

export const MASTER_PERMISSIONS = {
  /** Read the registry row. */
  view: 'mdm.equipment.view',
  /** Change it, and renumber the box. Tenant-wide — a branch grant is not enough. */
  manage: 'mdm.equipment.manage',
  /** Place a hold on the box. */
  holdApply: 'tos.hold.apply',
  /**
   * Change a standing box's condition or EMR remarks.
   *
   * New on 2026-10-12 and NOT a gate permission: TENANT_OWNER, OPS_MANAGER and
   * YARD_PLANNER hold it, gate clerks get 403. It is checked at the VISIT's
   * branch, so a planner who covers one depot cannot mark a box at another.
   */
  yardManage: 'tos.yard.manage',
} as const;

// ─── the registry row, as the PUT needs it ────────────────────────────────────

/**
 * The API returns these two on every container read, but `RegistryContainer`
 * predates the Container Master page and does not declare them. Declared here
 * rather than edited into that interface so the read-only screens that use it
 * are untouched.
 */
export type RegistryRow = RegistryContainer & {
  rowVersion: string;
  /** Port codes the box is designated to; empty = it may go to any port. */
  fixedPortCodes: string[];
  /**
   * The PUT takes ids where the GET also hands back codes. Both come down on
   * the same read, so a clerk who never touches a picker still round-trips the
   * right id and nothing has to be resolved by code.
   */
  equipmentTypeId: string | null;
  ownerPartyId: string | null;
  lessorPartyId: string | null;
  /** Free text about the box itself. Part of the full-replace PUT — see requestFrom. */
  remarks: string | null;
  /** Present on the wire, not yet declared upstream; both are ISO timestamps. */
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  /** Resolved display names, so the footer can read "Created by Natthaphon". */
  createdByName?: string | null;
  updatedByName?: string | null;
};

/** Vector's "Hire Mode". The API's four, in the order a clerk meets them. */
export const OWNERSHIP_TYPES = [
  { value: 'LINE_OWNED', label: 'Line owned' },
  { value: 'LEASED', label: 'Leased' },
  { value: 'SHIPPER_OWNED', label: 'Shipper owned (SOC)' },
  { value: 'DEPOT_OWNED', label: 'Depot owned' },
] as const;

/** Vector's "Material". Blank is allowed — many older boxes have none recorded. */
export const MATERIALS = [
  { value: '', label: '—' },
  { value: 'STEEL', label: 'Steel' },
  { value: 'CORTEN_STEEL', label: 'Corten steel' },
  { value: 'ALUMINIUM', label: 'Aluminium' },
  { value: 'STAINLESS_STEEL', label: 'Stainless steel' },
  { value: 'FRP', label: 'FRP' },
  { value: 'OTHER', label: 'Other' },
] as const;

/**
 * The LIFECYCLE of the box — not where it is standing and not what condition it
 * is in. A box can be IN_SERVICE and damaged, or SCRAPPED and still in the yard
 * waiting for the breaker.
 */
export const REGISTRY_STATUSES = [
  { value: 'IN_SERVICE', label: 'In service' },
  { value: 'OFF_HIRED', label: 'Off hired' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'TOTAL_LOSS', label: 'Total loss' },
  { value: 'SCRAPPED', label: 'Scrapped' },
] as const;

// ─── the form ─────────────────────────────────────────────────────────────────

/**
 * Every editable field as a string, because that is what an `<input>` holds.
 * Numbers and dates are parsed on the way out, so a half-typed "45" never
 * becomes NaN in state.
 */
export interface MasterForm {
  equipmentTypeId: string;
  isoCode: string;
  /** The pickers read and write codes; the ids beside them are what the PUT carries. */
  ownerCode: string;
  ownerPartyId: string;
  lessorCode: string;
  lessorPartyId: string;
  ownershipType: string;
  status: string;
  material: string;
  manufactureDate: string;
  manufacturer: string;
  cscPlateRef: string;
  acepRef: string;
  nextExaminationDate: string;
  tareWeightKg: string;
  maxGrossKg: string;
  reeferUnitMake: string;
  reeferUnitModel: string;
  remarks: string;
  fixedPortCodes: string[];
}

const text = (v: string | null | undefined) => v ?? '';
const num = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

/** Seed the form from the row that was read. */
export function fromRegistry(row: RegistryRow): MasterForm {
  return {
    equipmentTypeId: text(row.equipmentTypeId),
    isoCode: text(row.isoCode),
    ownerCode: text(row.ownerCode),
    ownerPartyId: text(row.ownerPartyId),
    lessorCode: text(row.lessorCode),
    lessorPartyId: text(row.lessorPartyId),
    ownershipType: row.ownershipType,
    status: row.status,
    material: text(row.material),
    manufactureDate: text(row.manufactureDate),
    manufacturer: text(row.manufacturer),
    cscPlateRef: text(row.cscPlateRef),
    acepRef: text(row.acepRef),
    nextExaminationDate: text(row.nextExaminationDate),
    tareWeightKg: num(row.tareWeightKg),
    maxGrossKg: num(row.maxGrossKg),
    reeferUnitMake: text(row.reeferUnitMake),
    reeferUnitModel: text(row.reeferUnitModel),
    remarks: text(row.remarks),
    fixedPortCodes: [...(row.fixedPortCodes ?? [])],
  };
}

/** What the clerk can see is different, so Save can be disabled until it is. */
export function isDirty(a: MasterForm, b: MasterForm): boolean {
  const keys = Object.keys(a) as (keyof MasterForm)[];
  return keys.some(k => k === 'fixedPortCodes'
    ? a.fixedPortCodes.join(',') !== b.fixedPortCodes.join(',')
    : a[k] !== b[k]);
}

/** Blank is "not recorded", which the API spells `null`, not `""`. */
const orNull = (v: string) => (v.trim() === '' ? null : v.trim());
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

export interface UpdateContainerRequest {
  rowVersion: string;
  ownershipType: string;
  status: string;
  equipmentTypeId: string | null;
  isoCode: string | null;
  ownerPartyId: string | null;
  lessorPartyId: string | null;
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
  /**
   * Sent on EVERY save, never omitted.
   *
   * Like every field of this PUT, what is sent is what is stored: leaving it
   * out clears the box's remarks. The form therefore always carries the
   * current text, even when the clerk never opened that field.
   */
  remarks: string | null;
  fixedPortCodes: string[];
}

/** The PUT body. Every field goes back, because the PUT replaces the row. */
export function requestFrom(form: MasterForm, rowVersion: string): UpdateContainerRequest {
  return {
    rowVersion,
    ownershipType: form.ownershipType,
    status: form.status,
    equipmentTypeId: orNull(form.equipmentTypeId),
    isoCode: orNull(form.isoCode)?.toUpperCase() ?? null,
    ownerPartyId: orNull(form.ownerPartyId),
    // ck_container__lessor: only a LEASED box has one, and a LEASED box must.
    lessorPartyId: form.ownershipType === 'LEASED' ? orNull(form.lessorPartyId) : null,
    material: orNull(form.material),
    manufactureDate: orNull(form.manufactureDate),
    manufacturer: orNull(form.manufacturer),
    cscPlateRef: orNull(form.cscPlateRef),
    acepRef: orNull(form.acepRef),
    nextExaminationDate: orNull(form.nextExaminationDate),
    tareWeightKg: numOrNull(form.tareWeightKg),
    maxGrossKg: numOrNull(form.maxGrossKg),
    reeferUnitMake: orNull(form.reeferUnitMake),
    reeferUnitModel: orNull(form.reeferUnitModel),
    remarks: orNull(form.remarks),
    fixedPortCodes: form.fixedPortCodes,
  };
}

/**
 * What the screen can tell the clerk before the API does.
 *
 * Only the rules whose message would otherwise arrive as a field error after a
 * round trip AND whose wording the clerk can act on. Everything else — unknown
 * port, ISO code not mapped to the type, bad check digit — is left to the
 * server, because the server's sentence is better than any guess here.
 */
export function localErrors(form: MasterForm): Partial<Record<keyof MasterForm, string>> {
  const errors: Partial<Record<keyof MasterForm, string>> = {};

  if (form.ownershipType === 'LEASED' && !form.lessorCode.trim())
    errors.lessorCode = 'A leased container must name its lessor — nobody could off-hire or invoice it otherwise.';

  if (form.isoCode.trim() && !/^[A-Za-z0-9]{4}$/.test(form.isoCode.trim()))
    errors.isoCode = 'An ISO 6346 size-type code is exactly four letters or digits, e.g. 45G1.';

  const tare = Number(form.tareWeightKg);
  if (form.tareWeightKg.trim() && (!Number.isFinite(tare) || tare < 1 || tare > 50_000))
    errors.tareWeightKg = 'Between 1 and 50,000 kg.';

  const gross = Number(form.maxGrossKg);
  if (form.maxGrossKg.trim() && (!Number.isFinite(gross) || gross < 1 || gross > 100_000))
    errors.maxGrossKg = 'Between 1 and 100,000 kg.';

  if (form.tareWeightKg.trim() && form.maxGrossKg.trim() && Number.isFinite(tare) && Number.isFinite(gross) && tare >= gross)
    errors.maxGrossKg = 'Max gross has to be heavier than the tare — the difference is the payload.';

  if (form.remarks.length > 1000) errors.remarks = 'Up to 1,000 characters.';

  return errors;
}

/**
 * The Container Master SCREEN for a box.
 *
 * It kept the /units/unit-inquiry route when it grew from the read-only unit
 * inquiry (owner 2026-10-12), because the EIR screens, the yard stock list and
 * /gate/container-status all link into it. Everything that wants to open a box
 * goes through here, so the day the route does move, it moves once.
 */
export const masterPath = (no: string) => `/units/unit-inquiry?no=${encodeURIComponent(no)}`;

export const registryWritePath = (no: string) => `/api/master/containers/${encodeURIComponent(no)}`;

export const saveRegistry = (no: string, body: UpdateContainerRequest) =>
  apiSend<RegistryRow>('PUT', registryWritePath(no), body);

// ─── a standing box: condition, grade and EMR remarks ───────────────────────

/**
 * What both visit writes answer with. `holdsApplied` matters: marking a box
 * damaged puts the depot's damage hold on automatically (owner 2026-10-12), so
 * the screen has to say so and re-read the holds.
 */
export interface VisitStateResponse {
  containerVisitId: string;
  containerNo: string;
  branchId: string;
  conditionCode: string | null;
  gradeCode: string | null;
  emrRemarks: string | null;
  lastEventAt: string;
  holdsApplied: string[];
}

/**
 * Change a standing box's condition and/or grade, with a reason.
 *
 * A field left out stays as it is, so this is the one write on the page that is
 * NOT a full replace. 409 once the box has gated out on that stay: a departed
 * box's condition is history, not something to edit.
 */
export const setVisitCondition = (
  visitId: string, body: { conditionCode?: string; gradeCode?: string; reason: string },
) => apiSend<VisitStateResponse>('POST', `/api/tos/visits/${visitId}/condition`, body);

/** Null or '' clears it. Max 500. 409 once the box has gated out. */
export const setEmrRemarks = (visitId: string, remarks: string | null) =>
  apiSend<VisitStateResponse>('PUT', `/api/tos/visits/${visitId}/emr-remarks`, { remarks });

/**
 * The conditions that carry the damage hold.
 *
 * Derived from the condition master rather than hard-coded: a code is
 * "damaged" when it is unserviceable AND flags damage, which is what the API
 * tests. Used only to WARN before the save — the server decides.
 */
export const putsOnDamageHold = (
  code: string, conditions: { conditionCode: string; isServiceable: boolean; codecoDamageFlag: boolean }[],
): boolean => {
  const found = conditions.find(c => c.conditionCode === code);
  return !!found && !found.isServiceable && found.codecoDamageFlag;
};

// ─── correcting the number ───────────────────────────────────────────────────

/** What moved with the number. Shown back to the clerk, because it is a lot. */
export interface RenumberResult {
  oldContainerNo: string;
  newContainerNo: string;
  rowVersion: string;
  moved: {
    containerVisits: number; bookingContainers: number; holds: number; gateTransactions: number;
    surveys: number; coupons: number; pickups: number; reservations: number; reeferSessions: number;
  };
}

/**
 * Correct a mis-keyed container number, moving the box's whole history with it.
 *
 * A TOS endpoint, NOT a master-data one, even though it needs
 * `mdm.equipment.manage`: the stays, EIRs, surveys, coupons and the registry
 * row all have to move together, and master data cannot call TOS. TOS moves its
 * own rows, calls the registry last, and rolls everything back if the registry
 * refuses. Revenue follows through the outbox a second or two later.
 *
 * After a 200 the OLD number 404s, so the caller navigates to the new one.
 */
export const renumberContainer = (
  containerNo: string, body: { newContainerNo: string; reason: string; rowVersion: string },
) => apiSend<RenumberResult>('POST', `/api/tos/containers/${encodeURIComponent(containerNo)}/renumber`, body);

// ─── the registry's own history ──────────────────────────────────────────────

export interface RegistryChange { field: string; from: string | null; to: string | null }

export interface RegistryHistoryEntry {
  at: string;
  kind: 'CREATED' | 'UPDATED' | 'RENUMBERED' | string;
  by: string | null;
  byName: string | null;
  reason: string | null;
  changes: RegistryChange[];
}

/**
 * Every change to the registry row, newest first.
 *
 * Built from the row's own versions, so it reaches back to the day the registry
 * was loaded. A save that changed nothing writes no entry. `field` names match
 * the response's property names, which is why the labels below are keyed on
 * those rather than on anything of our own.
 */
export const historyPath = (no: string) => `/api/master/containers/${encodeURIComponent(no)}/history`;

export const useRegistryHistory = (no: string | null) =>
  useApi<RegistryHistoryEntry[]>(no ? historyPath(no) : null);

/** The API's field names, as a clerk would say them. */
export const FIELD_LABELS: Record<string, string> = {
  containerNo: 'Container no',
  typeCode: 'Size \u00b7 type',
  isoCode: 'ISO code',
  ownerCode: 'Owner',
  lessorCode: 'Lessor',
  ownershipType: 'Hire mode',
  material: 'Material',
  manufactureDate: 'Manufactured',
  manufacturer: 'Manufacturer',
  cscPlateRef: 'CSC plate ref',
  acepRef: 'ACEP ref',
  nextExaminationDate: 'Next examination',
  tareWeightKg: 'Tare weight',
  maxGrossKg: 'Max gross',
  reeferUnitMake: 'Reefer unit make',
  reeferUnitModel: 'Reefer unit model',
  fixedPortCodes: 'Fixed ports',
  remarks: 'Remarks',
  status: 'Registry status',
};

export const fieldLabel = (field: string) =>
  FIELD_LABELS[field] ?? field.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
