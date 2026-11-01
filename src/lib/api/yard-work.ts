"use client";
/**
 * THE WORK OF THE YARD — the forklift's list, the stock check, and the figures.
 *
 * Phase 4 of the yard map (owner 2026-10-30). The map says where boxes are;
 * this is what gets done to them, and how well:
 *
 *   /yard/jobs    PUT_AWAY (made by the gate the moment a box comes in to a
 *                 slot), RELOCATE (a planner's order, or a "dig" clearing the
 *                 way for a pull) and PULL (bring a box out for the truck).
 *                 OPEN → STARTED → DONE, or CANCELLED. Finishing SCANS the
 *                 box: the wrong box is refused, which is the whole point of
 *                 asking a driver to scan rather than tick.
 *
 *   /yard/checks   walk a yard or one block, scan what stands where, and see
 *                 how far the records are from the yard. Closing can apply
 *                 what was found as real yard moves.
 *
 *   /yard/kpis     per block and per period: occupancy, dwell, gate-ins, moves,
 *                 jobs done and how long they took, digs, rule overrides.
 *
 * WHO MAY DO WHAT. Reading all three needs `tos.gate.view`. Taking, finishing,
 * ordering and cancelling jobs, and starting, scanning and closing checks, need
 * `tos.yard.manage` AT THE DEPOT — so the screens ask
 * `canAt(YARD_MANAGE, branchId)` and simply do not show a button a driver's
 * account cannot use. Overriding a stacking rule still needs
 * `tos.gate.override` (Phase 3).
 */
import { apiSend } from './client';
import { useApi } from './use-api';
import type { DepartureSource } from './yard-map';

// ── the work list ──────────────────────────────────────────────────────────

export type YardJobType = 'PUT_AWAY' | 'RELOCATE' | 'PULL';
export type YardJobStatus = 'OPEN' | 'STARTED' | 'DONE' | 'CANCELLED';

export interface YardJob {
  yardJobId: string;
  branchId: string;
  jobType: YardJobType;
  status: YardJobStatus;
  /** 1 goes first. A dig is ordered one rank sooner than the pull it clears. */
  priority: number;
  containerNo: string;
  containerVisitId: string;
  /** Where it stood when the job was ordered. "GATE" for a put-away. */
  fromPositionText: string | null;
  /** Where it stands NOW — which is not the same thing once it has been moved. */
  currentPosition: string | null;
  toYardId: string | null;
  toYardSlotId: string | null;
  /** Null on a PULL, and on a relocate the driver decides. */
  toPositionText: string | null;
  /** Set on a dig: the PULL it clears the way for. */
  forYardJobId: string | null;
  gateTransactionId: string | null;
  reason: string | null;
  assignedTo: string | null;
  /** The driver's name, resolved by the API — never a user id on screen. */
  assignedToName: string | null;
  startedAt: string | null;
  doneAt: string | null;
  donePositionText: string | null;
  cancelledReason: string | null;
  createdAt: string;
  /** Live jobs only: what must be dug out before this box can be lifted. */
  boxesOnTop: string[];
  rowVersion: string;
}

export const YARD_JOBS_PATH = '/api/tos/yard/jobs';

export interface YardJobQuery {
  branchId: string;
  /** Comma-separated. Omitted, the API answers the live ones (OPEN,STARTED). */
  status?: string;
  jobType?: YardJobType;
  /** Only the jobs this user has taken. */
  mine?: boolean;
  limit?: number;
}

export function yardJobsPath(q: YardJobQuery | null): string | null {
  if (!q?.branchId) return null;
  const p = new URLSearchParams({ branchId: q.branchId });
  if (q.status) p.set('status', q.status);
  if (q.jobType) p.set('jobType', q.jobType);
  if (q.mine) p.set('mine', 'true');
  if (q.limit) p.set('limit', String(q.limit));
  return `${YARD_JOBS_PATH}?${p.toString()}`;
}

export function useYardJobs(query: YardJobQuery | null) {
  return useApi<YardJob[]>(yardJobsPath(query));
}

/** Order a RELOCATE or a PULL. A PULL also orders a dig per box on top of it. */
export interface YardJobOrder {
  branchId: string;
  jobType: 'RELOCATE' | 'PULL';
  containerNo: string;
  toYardId?: string | null;
  toYardSlotId?: string | null;
  toPositionText?: string | null;
  /** 1 to 9; 5 unless the planner says otherwise. */
  priority?: number;
  reason?: string | null;
}

/**
 * 201 with every job made: the PULL first, then its digs — which is why this
 * answers a LIST and not one job. A pull of a buried box is three or four
 * decisions, and the planner has to see all of them.
 */
export const orderYardJob = (body: YardJobOrder) => apiSend<YardJob[]>('POST', YARD_JOBS_PATH, body);

/**
 * A driver takes it. 409 when somebody else has it, or it is finished.
 *
 * `equipmentCode` (Phase 5) names the machine, and the API checks it can do
 * this job at all — full or empty, the box's length, the tier — answering 400
 * on `equipmentCode` with the reason. Left out, nothing is checked and nothing
 * is recorded against a machine.
 */
export const startYardJob = (jobId: string, equipmentCode?: string | null) =>
  apiSend<YardJob>('POST', equipmentCode
    ? `${YARD_JOBS_PATH}/${jobId}/start?equipmentCode=${encodeURIComponent(equipmentCode)}`
    : `${YARD_JOBS_PATH}/${jobId}/start`);

/**
 * The driver finished.
 *
 * `containerNo` is the box SCANNED, and the wrong one is a 400 on that field.
 * Leave the place out to confirm the job's own destination; send a slot or an
 * area when the box went somewhere else — that is a yard move, with the rules,
 * the override and a 409 when the slot was taken meanwhile. A dig, or a
 * relocate with no destination, MUST say where it went.
 */
export interface YardJobDone {
  containerNo: string;
  toYardId?: string | null;
  toYardSlotId?: string | null;
  toPositionText?: string | null;
  /** Needs `tos.gate.override`; otherwise a 400 on this field. */
  overrideReason?: string | null;
  /** The machine that did it (Phase 5); checked as on `start`. */
  equipmentCode?: string | null;
}

export const finishYardJob = (jobId: string, body: YardJobDone) =>
  apiSend<YardJob>('POST', `${YARD_JOBS_PATH}/${jobId}/done`, body);

/** Cancel a job. A PULL takes its digs with it. */
export const cancelYardJob = (jobId: string, reason: string) =>
  apiSend<YardJob>('POST', `${YARD_JOBS_PATH}/${jobId}/cancel`, { reason });

/** What a job is called on screen. A dig is a relocate with a purpose. */
export function jobTypeLabel(job: Pick<YardJob, 'jobType' | 'forYardJobId'>): string {
  if (job.jobType === 'PUT_AWAY') return 'Put away';
  if (job.jobType === 'PULL') return 'Pull';
  return job.forYardJobId ? 'Dig' : 'Relocate';
}

/** Where the job says the box goes, or that nobody has said. */
export const jobTarget = (job: YardJob): string =>
  job.toPositionText ?? (job.jobType === 'PULL' ? 'out to the truck' : "driver's choice");

// ── the stock check ────────────────────────────────────────────────────────

export type YardCheckStatus = 'OPEN' | 'CLOSED';
/**
 * MATCH    the records say it stands exactly there.
 * MOVED    it is in the yard, but the records put it somewhere else.
 * UNKNOWN  the records say it is not in this depot at all.
 * MISSING  expected in the yard or block, and not scanned.
 */
export type YardCheckLineStatus = 'MATCH' | 'MOVED' | 'UNKNOWN' | 'MISSING';

export interface YardCheckLine {
  containerNo: string;
  status: YardCheckLineStatus;
  containerVisitId: string | null;
  /** Where the records put it. */
  recordedPosition: string | null;
  /** Where it was actually seen. */
  seenPosition: string | null;
  seenYardSlotId: string | null;
  seenTier: number | null;
  scannedAt: string | null;
}

/** A MOVED line the close tried to apply, and why it could not. */
export interface YardCheckMove {
  containerNo: string;
  from: string | null;
  to: string | null;
  applied: boolean;
  problem: string | null;
}

export interface YardCheck {
  yardCheckId: string;
  branchId: string;
  yardId: string;
  yardCode: string | null;
  yardBlockId: string | null;
  blockCode: string | null;
  status: YardCheckStatus;
  startedAt: string;
  closedAt: string | null;
  remarks: string | null;
  /** Boxes the records put in the checked yard or block. */
  expected: number;
  scanned: number;
  match: number;
  moved: number;
  missing: number;
  unknown: number;
  /** MATCH ÷ expected × 100. Null when nothing was expected. */
  accuracyPct: number | null;
  lines: YardCheckLine[];
  movesApplied: YardCheckMove[];
}

/** The list row: the counts of one check without its lines. */
export interface YardCheckSummary {
  yardCheckId: string;
  yardId: string;
  yardBlockId: string | null;
  status: YardCheckStatus;
  startedAt: string;
  closedAt: string | null;
  remarks: string | null;
  scanned: number;
}

export const YARD_CHECKS_PATH = '/api/tos/yard/checks';

export const yardChecksPath = (branchId: string | null) =>
  branchId ? `${YARD_CHECKS_PATH}?branchId=${encodeURIComponent(branchId)}` : null;

export function useYardChecks(branchId: string | null) {
  return useApi<YardCheckSummary[]>(yardChecksPath(branchId));
}

/**
 * One check. An OPEN one is worked out live — against the yard as it is right
 * now — and a CLOSED one answers what it found when it was closed.
 */
export function useYardCheck(checkId: string | null) {
  return useApi<YardCheck>(checkId ? `${YARD_CHECKS_PATH}/${checkId}` : null);
}

export const startYardCheck = (body: { yardId: string; yardBlockId?: string | null; remarks?: string | null }) =>
  apiSend<YardCheck>('POST', YARD_CHECKS_PATH, body);

/**
 * A box seen, and where. Scanning it again REPLACES where it was seen, so a
 * checker who mis-keyed a stack simply scans it again in the right one.
 * The slot has to be in the yard being checked (400 `yardSlotId`), and a
 * closed check refuses everything (409).
 */
export const scanYardCheck = (checkId: string, body: { containerNo: string; yardSlotId?: string | null; positionText?: string | null }) =>
  apiSend<YardCheckLine>('POST', `${YARD_CHECKS_PATH}/${checkId}/scans`, body);

/**
 * Close it. `applyMoves` puts the records right for every MOVED box, as real
 * yard moves (journalled SHIFT, "Yard check"), each checked like any other
 * move — so some may be refused, and `movesApplied` says which and why.
 *
 * MISSING and UNKNOWN are never "fixed": a box nobody can find is not a data
 * entry problem, and guessing would hide it.
 */
export const closeYardCheck = (checkId: string, applyMoves: boolean) =>
  apiSend<YardCheck>('POST', `${YARD_CHECKS_PATH}/${checkId}/close?applyMoves=${applyMoves}`);

/** The colour a line reads in: green right, amber moved, red not ours / not found. */
export const checkLineTone = (status: YardCheckLineStatus): 'success' | 'warning' | 'danger' | 'neutral' => {
  switch (status) {
    case 'MATCH': return 'success';
    case 'MOVED': return 'warning';
    case 'UNKNOWN': return 'danger';
    case 'MISSING': return 'neutral';
  }
};

// ── the figures ────────────────────────────────────────────────────────────

export interface YardKpiJob {
  jobType: string;
  done: number;
  /** From ordered to done. */
  averageMinutes: number;
}

export interface YardKpiBlock {
  yardBlockId: string;
  blockCode: string;
  blockType: string | null;
  boxes: number;
  usableSlots: number;
  occupancyPct: number | null;
  averageDays: number;
  gateIns: number;
  /** Yard moves that ENDED in this block, and that started in it. */
  shiftsIn: number;
  shiftsOut: number;
  putAways: number;
}

export interface YardKpis {
  yardId: string;
  yardCode: string;
  from: string;
  to: string;
  /** Every box in the yard now, and those of them standing in a slot. */
  boxesInYard: number;
  boxesInBlocks: number;
  usableSlots: number;
  occupancyPct: number | null;
  gateIns: number;
  shifts: number;
  movesPerHour: number;
  /** Relocations done to clear a pull. */
  digs: number;
  ruleOverrides: number;
  jobs: YardKpiJob[];
  blocks: YardKpiBlock[];
  /** Per machine (Phase 5); the API sends it, empty when no job named one. */
  machines?: YardKpiMachine[];
}

export function yardKpisPath(yardId: string | null, from?: string | null, to?: string | null): string | null {
  if (!yardId) return null;
  const p = new URLSearchParams({ yardId });
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  return `/api/tos/yard/kpis?${p.toString()}`;
}

/** The yard's figures. No period asked for = the last seven days. */
export function useYardKpis(yardId: string | null, from?: string | null, to?: string | null) {
  return useApi<YardKpis>(yardKpisPath(yardId, from, to));
}

/**
 * THE RESHUFFLE RATE: digs ÷ pulls done.
 *
 * How often collecting a box meant moving another one first — the number that
 * says whether the yard is being stacked well. Null when nothing was pulled in
 * the period, because 0/0 is not 0%.
 */
export function reshuffleRate(kpis: Pick<YardKpis, 'digs' | 'jobs'>): number | null {
  const pulls = kpis.jobs.find(j => j.jobType === 'PULL')?.done ?? 0;
  return pulls === 0 ? null : Math.round((kpis.digs / pulls) * 1000) / 10;
}

// ── the machines (Phase 5) ─────────────────────────────────────────────────

/**
 * WHAT CAN LIFT WHAT. A machine is not interchangeable with the next one: an
 * empty handler cannot pick up a laden box, a small forklift cannot reach the
 * fourth tier, and a 20-foot machine cannot take a 40-foot box. The API checks
 * the machine against the job and refuses with a 400 on `equipmentCode` that
 * names the reason, so the driver is told why rather than left to wonder which
 * button was wrong.
 *
 * There is NO DELETE: a machine that has done work is in the history of every
 * job it did. Out of use is `isActive: false`.
 */
export type MachineKind = 'FORKLIFT' | 'REACH_STACKER' | 'EMPTY_HANDLER' | 'TOP_LOADER' | 'RTG' | 'STRADDLE_CARRIER' | 'TERMINAL_TRUCK';

export const MACHINE_KINDS: { value: MachineKind; label: string }[] = [
  { value: 'FORKLIFT', label: 'Forklift' },
  { value: 'REACH_STACKER', label: 'Reach stacker' },
  { value: 'EMPTY_HANDLER', label: 'Empty handler' },
  { value: 'TOP_LOADER', label: 'Top loader' },
  { value: 'RTG', label: 'RTG' },
  { value: 'STRADDLE_CARRIER', label: 'Straddle carrier' },
  { value: 'TERMINAL_TRUCK', label: 'Terminal truck' },
];

export interface HandlingEquipment {
  handlingEquipmentId: string;
  branchId: string;
  equipmentCode: string;
  name: string | null;
  kind: MachineKind;
  handlesFull: boolean;
  handlesEmpty: boolean;
  /** The longest box it takes, in feet. Null = any length. */
  maxSizeFt: number | null;
  /** The highest tier it reaches. Null = any tier. */
  maxTier: number | null;
  isActive: boolean;
  /** Jobs it finished in the last 24 hours. */
  doneLast24h: number;
  rowVersion: string;
}

export const YARD_EQUIPMENT_PATH = '/api/tos/yard/equipment';

export const yardEquipmentPath = (branchId: string | null) =>
  branchId ? `${YARD_EQUIPMENT_PATH}?branchId=${encodeURIComponent(branchId)}` : null;

export function useYardEquipment(branchId: string | null) {
  return useApi<HandlingEquipment[]>(yardEquipmentPath(branchId));
}

export interface SaveMachine {
  branchId: string;
  equipmentCode: string;
  kind: MachineKind;
  name?: string | null;
  handlesFull: boolean;
  handlesEmpty: boolean;
  maxSizeFt?: number | null;
  maxTier?: number | null;
  isActive: boolean;
  /** Required on an edit; a stale one answers 409. */
  rowVersion?: string | null;
}

export const saveMachine = (machine: SaveMachine, handlingEquipmentId?: string | null) =>
  handlingEquipmentId
    ? apiSend<HandlingEquipment>('PUT', `${YARD_EQUIPMENT_PATH}/${handlingEquipmentId}`, machine)
    : apiSend<HandlingEquipment>('POST', YARD_EQUIPMENT_PATH, machine);

/**
 * THE MACHINE THIS DEVICE DRIVES, remembered for the next job.
 *
 * A convenience and nothing more: the handheld in a cab belongs to that cab all
 * shift, and asking which machine on every job is a tap nobody needs. It lives
 * in this browser only, is never sent anywhere by itself, and the sheet still
 * shows which machine is about to be sent.
 */
export const MACHINE_PREFERENCE_KEY = 'gecko.yard.machine';

/** Per machine over a KPI period (Phase 5). */
export interface YardKpiMachine {
  equipmentCode: string;
  kind: string;
  done: number;
  /** From taken to done. */
  averageMinutes: number;
  /** Jobs divided by the hours between its first take and its last finish. */
  jobsPerHour: number | null;
}

// ── expected departure (Phase 5) ───────────────────────────────────────────

/**
 * WHEN A BOX IS EXPECTED TO LEAVE.
 *
 * The yard's one piece of foresight, and everything downstream uses it:
 * pre-staging lists what is due out, and the suggestions refuse to bury a box
 * that leaves sooner than the one going on top of it.
 *
 * Setting it by hand makes the source PLANNER, which outranks everything the
 * API can work out for itself. Sending null clears it, and the date is derived
 * again from the truck, the vessel or the booking.
 */
export interface SetDeparture {
  branchId: string;
  containerNo: string;
  /** ISO instant, or null to clear it and go back to the derived date. */
  expectedDepartureAt: string | null;
  note?: string | null;
}

export interface ExpectedDeparture {
  containerNo: string;
  expectedDepartureAt: string | null;
  source: DepartureSource;
  note: string | null;
}

export const setExpectedDeparture = (body: SetDeparture) =>
  apiSend<ExpectedDeparture>('PUT', '/api/tos/yard/expected-departure', body);

/** What a source is called on screen. */
export function departureSourceLabel(source: DepartureSource | string | null | undefined): string {
  switch (source) {
    case 'PLANNER': return 'set by a planner';
    case 'TRUCK_PLANNED': return 'a truck is planned';
    case 'VESSEL_ETD': return 'the vessel ETD';
    case 'BOOKING_VALID_TO': return 'the booking last day';
    case 'GIVEN': return 'as given';
    default: return 'nothing says';
  }
}

// ── pre-staging (Phase 5) ──────────────────────────────────────────────────

/** One box due out, and what stands in its way. */
export interface PrestageItem {
  containerNo: string;
  containerVisitId: string;
  fullEmpty: string;
  positionText: string | null;
  expectedDepartureAt: string;
  departureSource: DepartureSource;
  /** Negative when it is already overdue. */
  hoursToGo: number;
  boxesOnTop: string[];
  /** The job types already waiting for it: PULL, RELOCATE, PUT_AWAY. */
  liveJobs: string[];
}

export interface Prestage {
  branchId: string;
  asAt: string;
  hours: number;
  items: PrestageItem[];
  /** Boxes standing on the boxes due out: the work that stowing has created. */
  digsNeeded: number;
  /** The jobs a POST made; empty on a read. */
  jobsOrdered: string[];
}

export const prestagePath = (branchId: string | null, hours: number) =>
  branchId ? `/api/tos/yard/prestage?branchId=${encodeURIComponent(branchId)}&hours=${hours}` : null;

export function usePrestage(branchId: string | null, hours: number) {
  return useApi<Prestage>(prestagePath(branchId, hours));
}

/**
 * ORDER THE LOT: a PULL for every box due out that has none, and a dig for
 * every box standing on one. Priority by how soon it leaves — within 2 hours
 * is 2, within 6 is 3, else 4, and a dig is a rank sooner than its pull.
 */
export const orderPrestage = (branchId: string, hours: number) =>
  apiSend<Prestage>('POST', `/api/tos/yard/prestage?branchId=${encodeURIComponent(branchId)}&hours=${hours}`);

/** "in 3 h", "in 40 min", "2 h overdue" — how a planner reads a departure. */
export function dueLabel(at: string, now: Date = new Date()): string {
  const ms = new Date(at).getTime() - now.getTime();
  const min = Math.round(ms / 60_000);
  if (min < -60) return `${Math.round(-min / 60)} h overdue`;
  if (min < 0) return `${-min} min overdue`;
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `in ${h} h` : `in ${Math.round(h / 24)} days`;
}
