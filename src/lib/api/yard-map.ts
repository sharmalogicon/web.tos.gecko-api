"use client";
/**
 * THE YARD MAP — the depot's switch, the layout, and what stands in it now.
 *
 * Three APIs, one module, because one screen uses two of them at a time:
 *
 *   1. THE SWITCH. `GET /api/tos/gate/settings?branchId=` answers
 *      `yardMapEnabled` and `yardLocationMode` beside the gate's own settings.
 *      It is read with `tos.gate.view`, which is why it is this endpoint and
 *      NOT /api/master/settings: that one needs `mdm.config.view`, which a gate
 *      clerk does not hold, and the clerk's screens have to know whether this
 *      depot has a map. Two tenants share this build — GECKO draws its yard,
 *      KORAKIT locates boxes by area code — so the depot decides, not the code.
 *
 *   2. THE LAYOUT (master data). Blocks, where they sit on the map, and the
 *      slots generated from their rows × bays × tiers. Reading needs
 *      `mdm.org.view`; every write needs `mdm.org.manage` AT THE YARD'S DEPOT,
 *      so the editor asks `canAt('mdm.org.manage', branchId)` before offering
 *      one. Each write carries the block's `rowVersion`: a stale one answers
 *      409 rather than overwriting what somebody else saved.
 *
 *   3. WHAT IS IN IT (TOS). `GET /api/tos/yard/map?yardId=` counts the boxes
 *      standing in each block — boxes, TEU, full / empty, reefers, holds,
 *      damaged, dwell — plus `unplaced`, the boxes in the yard that stand in no
 *      slot. Those are NOT guessed into a block: a depot that records an area
 *      code has every box unplaced, and inventing a position for them would be
 *      a map that lies. Reading needs `tos.gate.view`, which is why Yard at a
 *      Glance reads this one endpoint and never the master-data blocks.
 *
 *   4. ONE BLOCK, SLOT BY SLOT (TOS, Phase 2). `/yard/blocks/{id}/stacks` for
 *      the gate's slot picker and the stack view, `/yard/locate` for where a
 *      box is, and `POST /yard/moves` to move one inside the depot. The first
 *      two read with `tos.gate.view`; moving needs `tos.yard.manage`.
 *
 *   5. WHICH SLOT IS BEST (TOS, Phase 3). `/yard/suggestions` scores the legal
 *      slots for a box and says why. The yard's STACKING RULES are enforced by
 *      the API on every pick, and a refusal is overridable with a reason by
 *      someone holding `tos.gate.override` — see GATE_OVERRIDE below.
 */
import { apiGet, apiSend } from './client';
import { useApi } from './use-api';
import { useFacility } from './facility';

// ── 1. the switch ──────────────────────────────────────────────────────────

export type YardLocationMode = 'AREA' | 'SLOT';

/**
 * HOW A BOX'S EXPECTED DEPARTURE IS KNOWN, best first (Phase 5).
 *
 *   PLANNER           somebody set it by hand — it beats everything else.
 *   TRUCK_PLANNED     a truck at the depot is planned to collect it.
 *   VESSEL_ETD        an export's vessel is due to sail then.
 *   BOOKING_VALID_TO  the end of the booking's last valid day.
 *   GIVEN             the caller stated it (a suggestion asked with a date).
 *   UNKNOWN           nothing says.
 */
export type DepartureSource = 'PLANNER' | 'TRUCK_PLANNED' | 'VESSEL_ETD' | 'BOOKING_VALID_TO' | 'GIVEN' | 'UNKNOWN';

/** `GET /api/tos/gate/settings` — the depot's settings the gate screens follow. */
export interface GateSettings {
  branchId: string;
  futureGraceMinutes: number;
  yardMapEnabled: boolean;
  yardLocationMode: YardLocationMode;
}

export const gateSettingsPath = (branchId: string) =>
  `/api/tos/gate/settings?branchId=${encodeURIComponent(branchId)}`;

export interface YardSettings {
  /** Does THIS depot show the yard map? False while it is still being read. */
  mapEnabled: boolean;
  /** AREA = an area code typed at the gate; SLOT = block / row / bay / tier. */
  locationMode: YardLocationMode;
  loading: boolean;
  /**
   * WHY IT IS FALSE, when the reason is not the setting.
   *
   * The settings come off a gate endpoint, so reading them needs
   * `tos.gate.view`. Somebody who does not hold it — an accounts-only
   * account — gets a 403, and "the map is off" would be the wrong thing to
   * tell them. The screens say what actually happened instead.
   */
  denied: boolean;
}

/**
 * The yard-map switch for the depot in the header.
 *
 * It answers `false` while the read is in flight and `false` when the read
 * fails, which is the safe way round: a menu entry that appears and vanishes is
 * worse than one that appears a moment late, and a screen shown on a guess
 * could be a screen of another depot's blocks. Switching depot re-reads it,
 * because the setting is the depot's.
 */
export function useYardSettings(): YardSettings {
  const { branch } = useFacility();
  const { data, error, loading } = useApi<GateSettings>(branch?.branchId ? gateSettingsPath(branch.branchId) : null);
  return {
    mapEnabled: data?.yardMapEnabled ?? false,
    locationMode: data?.yardLocationMode ?? 'AREA',
    loading: !!branch?.branchId && loading,
    denied: error?.status === 403,
  };
}

// ── 2. the layout ──────────────────────────────────────────────────────────

/**
 * org.yard_block.block_type — what the block is for. Null = untyped.
 *
 * FULL (gecko_master 42) is full boxes of ANY direction: a domestic customer's
 * full box is neither an import nor an export, and before this there was no
 * block type that would take it without lying about where it came from.
 */
export type BlockType =
  | 'IMPORT' | 'EXPORT' | 'FULL' | 'EMPTY' | 'REEFER' | 'DAMAGE' | 'HAZ' | 'OOG' | 'TRANSHIPMENT';

export const BLOCK_TYPES: readonly BlockType[] = [
  'IMPORT', 'EXPORT', 'FULL', 'EMPTY', 'REEFER', 'DAMAGE', 'HAZ', 'OOG', 'TRANSHIPMENT',
];

/** The API holds ONE size per block (`allocatedSizeFt`), not a set of ISO types. */
export const BLOCK_SIZES = [20, 40, 45] as const;

/** `GET /api/master/yards/{yardId}/blocks` — one block of a yard. */
export interface YardBlock {
  yardBlockId: string;
  yardId: string;
  blockCode: string;
  blockType: BlockType | null;
  maxRows: number | null;
  maxBays: number | null;
  maxTiers: number | null;
  /** The party the block is kept for — any line, agent or customer. */
  allocatedToPartyCode: string | null;
  /** 20 | 40 | 45, or null for any size. */
  allocatedSizeFt: number | null;
  isReeferBlock: boolean;
  isDgBlock: boolean;
  isOogBlock: boolean;
  /** Where it sits on the map, in grid pixels. Null = never placed. */
  layoutX: number | null;
  layoutY: number | null;
  layoutWidth: number | null;
  layoutHeight: number | null;
  layoutRotationDeg: number | null;
  /** #RRGGBB, overriding the colour its type would give it. */
  displayColorHex: string | null;
  isActive: boolean;
  /** Rows made, and slots made — generated, not typed. */
  rowCount: number;
  slotCount: number;
  /** Base64 ROWVERSION; send it back on every write. A stale one answers 409. */
  rowVersion: string;
}

/** Body of POST /yards/{yardId}/blocks and PUT /yard-blocks/{id}. */
export interface SaveYardBlock {
  blockCode: string;
  blockType: BlockType | null;
  maxRows: number | null;
  maxBays: number | null;
  maxTiers: number | null;
  allocatedToPartyCode: string | null;
  allocatedSizeFt: number | null;
  isReeferBlock: boolean;
  isDgBlock: boolean;
  isOogBlock: boolean;
  layoutX: number | null;
  layoutY: number | null;
  layoutWidth: number | null;
  layoutHeight: number | null;
  layoutRotationDeg: number | null;
  displayColorHex: string | null;
  isActive: boolean;
  /** Required on PUT, left out on POST. */
  rowVersion?: string;
}

/** One block's place on the map, as the layout save sends it. */
export interface YardBlockPlacement {
  yardBlockId: string;
  layoutX: number | null;
  layoutY: number | null;
  layoutWidth: number | null;
  layoutHeight: number | null;
  layoutRotationDeg: number | null;
  rowVersion: string;
}

/** What generating a block's slots did. */
export interface YardSlotGeneration {
  rowsCreated: number;
  slotsCreated: number;
  slotCount: number;
  /**
   * Slots the block already had that its rows × bays × tiers no longer cover.
   * They are KEPT — a box may be standing in one — and the clerk is told.
   */
  slotsOutsideLayout: number;
  block: YardBlock;
}

export const yardBlocksPath = (yardId: string) => `/api/master/yards/${yardId}/blocks`;

export const createYardBlock = (yardId: string, body: SaveYardBlock) =>
  apiSend<YardBlock>('POST', yardBlocksPath(yardId), body);

export const updateYardBlock = (blockId: string, body: SaveYardBlock) =>
  apiSend<YardBlock>('PUT', `/api/master/yard-blocks/${blockId}`, body);

export const deleteYardBlock = (blockId: string, rowVersion: string) =>
  apiSend<void>('DELETE', `/api/master/yard-blocks/${blockId}?rowVersion=${encodeURIComponent(rowVersion)}`);

/**
 * Save where the blocks sit. ALL OF THEM OR NONE, and the answer is the yard's
 * whole block list with fresh rowVersions — which the caller must keep, or its
 * next save is the stale one.
 */
export const saveYardLayout = (yardId: string, blocks: YardBlockPlacement[]) =>
  apiSend<YardBlock[]>('PUT', `/api/master/yards/${yardId}/layout`, { blocks });

/**
 * Make the block's rows (A, B, C… up to maxRows) and then every row × bay ×
 * tier slot. Safe to repeat: it adds only what is missing.
 */
export const generateYardSlots = (blockId: string) =>
  apiSend<YardSlotGeneration>('POST', `/api/master/yard-blocks/${blockId}/slots/generate`);

/** Everything a block write sends, taken from the block as it stands. */
export function blockBody(block: YardBlock, patch: Partial<SaveYardBlock> = {}): SaveYardBlock {
  return {
    blockCode: block.blockCode,
    blockType: block.blockType,
    maxRows: block.maxRows,
    maxBays: block.maxBays,
    maxTiers: block.maxTiers,
    allocatedToPartyCode: block.allocatedToPartyCode,
    allocatedSizeFt: block.allocatedSizeFt,
    isReeferBlock: block.isReeferBlock,
    isDgBlock: block.isDgBlock,
    isOogBlock: block.isOogBlock,
    layoutX: block.layoutX,
    layoutY: block.layoutY,
    layoutWidth: block.layoutWidth,
    layoutHeight: block.layoutHeight,
    layoutRotationDeg: block.layoutRotationDeg,
    displayColorHex: block.displayColorHex,
    isActive: block.isActive,
    rowVersion: block.rowVersion,
    ...patch,
  };
}

// ── 3. what is in it ───────────────────────────────────────────────────────

/**
 * Counts over a set of boxes. `damaged` = a condition MDM marks not
 * serviceable; dwell is in whole days.
 */
export interface YardMapTally {
  boxes: number;
  teu: number;
  full: number;
  empty: number;
  reefer: number;
  held: number;
  damaged: number;
  averageDays: number;
  maxDays: number;
}

/** One block as laid out, and what stands in it now. */
export interface YardMapBlock {
  yardBlockId: string;
  blockCode: string;
  blockType: BlockType | null;
  maxRows: number | null;
  maxBays: number | null;
  maxTiers: number | null;
  allocatedToPartyCode: string | null;
  allocatedSizeFt: number | null;
  isReeferBlock: boolean;
  isDgBlock: boolean;
  isOogBlock: boolean;
  layoutX: number | null;
  layoutY: number | null;
  layoutWidth: number | null;
  layoutHeight: number | null;
  layoutRotationDeg: number | null;
  displayColorHex: string | null;
  slotCount: number;
  blockedSlotCount: number;
  reeferPlugCount: number;
  /** TEU ÷ usable slots × 100. NULL = no usable slot — generate them first. */
  occupancyPct: number | null;
  tally: YardMapTally;
}

export interface YardMap {
  asAt: string;
  yardId: string;
  yardCode: string;
  yardName: string;
  branchId: string;
  mapEnabled: boolean;
  locationMode: YardLocationMode;
  capacityTeu: number | null;
  slotCount: number;
  usableSlotCount: number;
  total: YardMapTally;
  /** Boxes in this yard standing in no slot of the layout — located by area. */
  unplaced: YardMapTally;
  /** ACTIVE blocks only. */
  blocks: YardMapBlock[];
}

export const yardMapPath = (yardId: string) => `/api/tos/yard/map?yardId=${encodeURIComponent(yardId)}`;

/**
 * HAS THIS YARD GOT SLOTS TO PICK FROM?
 *
 * The depot's `yard.location_mode` says the tenant works in slots; it does not
 * say that THIS yard has been laid out yet. GECKO is a SLOT depot whose YARD 1
 * had two blocks with no slots generated and whose YARD 2 had no blocks at
 * all — so the gate showed "No blocks in this yard", a disabled select, and no
 * way to say where the box was going at all.
 *
 * `known` is false while the map is being read or could not be read: nothing
 * is decided on a guess, and the screens fall back to free key-in, which is
 * the answer that always works.
 */
export function useYardHasSlots(yardId: string | null): { hasSlots: boolean; known: boolean } {
  const { data, loading, error } = useApi<YardMap>(yardId ? yardMapPath(yardId) : null);
  const answered = !!yardId && !loading && !error && data?.yardId === yardId;
  return {
    hasSlots: answered && (data?.blocks ?? []).some(b => b.slotCount > 0),
    known: answered,
  };
}

/** The live map of one yard. Pass null to ask nothing. */
export function useYardMap(yardId: string | null) {
  return useApi<YardMap>(yardId ? yardMapPath(yardId) : null);
}

// ── 4. one block, stack by stack ───────────────────────────────────────────
//
// `GET /api/tos/yard/blocks/{blockId}/stacks` is what makes a slot pickable.
// A yard map coloured by occupancy says WHERE the room is; this says WHICH slot
// a box may go in, and that is not a thing a clerk can work out by eye: a slot
// is takeable only when it is in use, not blocked, empty, and standing on the
// ground or on another box. The server answers `canTake` per slot so the gate
// and the yard desk never have to reason about it.

export interface YardStackBox {
  containerNo: string;
  equipmentTypeCode: string | null;
  lineCode: string;
  fullEmpty: 'FULL' | 'EMPTY';
  daysInYard: number;
  isHeld: boolean;
}

export interface YardStackSlot {
  yardSlotId: string;
  tierNumber: number;
  /** "A-B-03-2" — block, row, bay, tier. It becomes the box's position text. */
  label: string;
  hasReeferPlug: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  isActive: boolean;
  /** A box can go here NOW: in use, not blocked, empty, and standing on something. */
  canTake: boolean;
  box: YardStackBox | null;
}

/** One stack — a row and a bay — tier 1 first. `height` = boxes standing in it. */
export interface YardStack {
  bayNumber: number;
  height: number;
  slots: YardStackSlot[];
}

export interface YardStackRow {
  rowLabel: string;
  bays: YardStack[];
}

export interface YardBlockStacks {
  yardBlockId: string;
  blockCode: string;
  blockType: BlockType | null;
  yardId: string;
  yardCode: string;
  isActive: boolean;
  maxRows: number | null;
  maxBays: number | null;
  maxTiers: number | null;
  slotCount: number;
  occupied: number;
  /** Slots that could take a box right now. */
  canTake: number;
  rows: YardStackRow[];
}

export const yardStacksPath = (blockId: string) => `/api/tos/yard/blocks/${blockId}/stacks`;

/** One block, stack by stack. Pass null to ask nothing. */
export function useYardStacks(blockId: string | null) {
  return useApi<YardBlockStacks>(blockId ? yardStacksPath(blockId) : null);
}

/**
 * THE SLOT A BOX GOES IN WHEN THE CLERK PICKS THIS STACK: the lowest one free.
 *
 * Nobody picks a tier. A box goes on the ground, or on the box already there —
 * which is the lowest `canTake` slot of the stack, and the only one the API
 * would accept anyway (a higher tier with nothing under it is refused as
 * floating). So the stack is what the clerk clicks and the tier follows.
 */
export const lowestFreeSlot = (stack: YardStack): YardStackSlot | null =>
  stack.slots.find(s => s.canTake) ?? null;

/**
 * Why nothing can go in this stack, in the clerk's words — or null when
 * something can. Used as the tooltip on a disabled stack, because a cell that
 * cannot be clicked and does not say why is a screen that looks broken.
 */
export function stackRefusal(stack: YardStack, maxTiers: number | null): string | null {
  if (lowestFreeSlot(stack)) return null;
  if (stack.slots.length === 0) return 'No slots here yet.';
  if (stack.slots.every(s => !s.isActive)) return 'Not in use.';
  const blocked = stack.slots.find(s => s.isBlocked);
  if (stack.slots.filter(s => s.isActive).every(s => s.isBlocked)) {
    return blocked?.blockReason ? `Blocked: ${blocked.blockReason}` : 'Blocked.';
  }
  if (stack.height >= stack.slots.filter(s => s.isActive && !s.isBlocked).length) {
    return `Full — ${stack.height} of ${maxTiers ?? stack.slots.length} tiers.`;
  }
  // Every other case the server knows about: a blocked slot above the boxes, a
  // gap it will not let a box float over.
  return blocked?.blockReason ? `Blocked above: ${blocked.blockReason}` : 'Nothing can go here now.';
}

// ── 5. where a box is ──────────────────────────────────────────────────────

/** `GET /api/tos/yard/locate?containerNo=`. Block, row, bay and tier are null for a box located by area. */
export interface YardLocation {
  containerVisitId: string;
  containerNo: string;
  branchId: string;
  yardId: string | null;
  yardCode: string | null;
  yardSlotId: string | null;
  yardBlockId: string | null;
  blockCode: string | null;
  rowLabel: string | null;
  bayNumber: number | null;
  tierNumber: number | null;
  positionText: string | null;
  equipmentTypeCode: string | null;
  fullEmpty: string;
  gateInAt: string;
  daysInYard: number;
  isHeld: boolean;
  /**
   * THE DIG: the boxes standing on top of this one, lowest first.
   *
   * Empty for a box on top of its stack or located by area. While it is not
   * empty the box cannot be moved at all — the API refuses with a 409 naming
   * them — so the screens say so before the clerk tries.
   */
  boxesOnTop: string[];
  /**
   * WHEN THE BOX IS EXPECTED TO LEAVE (Phase 5), and how that is known.
   *
   * Null when nothing says: no planner has set one, no truck is planned for
   * it, it is not on an export vessel and its booking has no valid-to. The
   * yard uses it to decide what not to bury, which is why it is worth setting.
   */
  expectedDepartureAt: string | null;
  departureSource: DepartureSource;
  departureNote: string | null;
}

export const yardLocatePath = (containerNo: string) =>
  `/api/tos/yard/locate?containerNo=${encodeURIComponent(containerNo)}`;

/**
 * Where a box stands now — normally one stay, and 404 when it is not in a yard
 * the caller covers. The 404 is an ANSWER, not a failure: "not in the yard".
 */
export const locateContainer = (containerNo: string) =>
  apiGet<YardLocation[]>(yardLocatePath(containerNo));

/** The same read, declaratively, for a screen that is already showing a box. */
export function useYardLocation(containerNo: string | null) {
  return useApi<YardLocation[]>(containerNo ? yardLocatePath(containerNo) : null);
}

/** A slot label pulled apart: "A-B-03-2" is block A, row B, bay 03, tier 2. */
export interface SlotWords { block: string; row: string; bay: string; tier: string }

/**
 * A POSITION TEXT READ AS A SLOT, or null when it is not one.
 *
 * Every list prints a slot as BLOCK-ROW-BAY-TIER, and the last three parts are
 * always row, bay, tier — a block code may itself contain a dash, so it is
 * whatever comes before them rather than simply the first part. A depot that
 * types its own areas (KORAKIT's ก) has nothing of the sort, which is exactly
 * what the null answer is for: show what was keyed, untouched.
 */
export function readSlotLabel(text: string | null | undefined): SlotWords | null {
  const parts = (text ?? '').trim().toUpperCase().split(/[-/\s]+/).filter(Boolean);
  if (parts.length < 4) return null;
  return {
    block: parts.slice(0, parts.length - 3).join('-'),
    row: parts[parts.length - 3],
    bay: parts[parts.length - 2],
    tier: parts[parts.length - 1],
  };
}

/**
 * WHERE THE BOX STANDS, in the words a driver is told it in.
 *
 * "A-B-03-2" reads back as "Block A · Bay 03 · Row B · Tier 2" — bay before
 * row, which is the order the printed Truck-In form uses and the order the
 * yard walks it. Anything that is not a slot label is returned as it was
 * keyed, and nothing at all is null.
 */
export function placeInWords(text: string | null | undefined): string | null {
  const said = (text ?? '').trim();
  if (!said) return null;
  const slot = readSlotLabel(said);
  return slot ? `Block ${slot.block} · Bay ${slot.bay} · Row ${slot.row} · Tier ${slot.tier}` : said;
}

// ── 6. moving a box inside the depot ───────────────────────────────────────

/**
 * Move a box that is already in the yard. Needs `tos.yard.manage` AT the depot
 * (`canAt('tos.yard.manage', branchId)`), which is why a clerk without it is
 * shown no Move at all rather than a button that answers 403.
 *
 * Send a SLOT (`toYardSlotId`), or an AREA (`toPositionText`, with `toYardId`
 * when the yard changes too). The stay keeps its one row — this is not a
 * gate-out and a gate-in — and the move is journalled as SHIFT, from → to,
 * with the reason in its remarks, so the unit inquiry shows the trail.
 */
export interface YardMoveRequest {
  branchId: string;
  containerNo: string;
  toYardSlotId?: string | null;
  toYardId?: string | null;
  toPositionText?: string | null;
  reason?: string | null;
  /** ISO instant. Left out, the server uses now. */
  movedAt?: string | null;
  /**
   * WHY A SLOT THAT BREAKS THE YARD'S STACKING RULES IS BEING USED (Phase 3).
   * Needs `tos.gate.override` at the depot; from anyone else it is a 400 on
   * `overrideReason`. It is added to the SHIFT history after the move's reason.
   */
  overrideReason?: string | null;
}

export const YARD_MOVES_PATH = '/api/tos/yard/moves';

/**
 * 200 with where the box now stands.
 *
 * The refusals a screen must word for the clerk:
 *   400 `toYardSlotId`  say where / already there / floating / blocked / wrong yard
 *   400 `movedAt`       in the future, or before the box's own last move
 *   409                 another box stands on top of this one, or the slot was just taken
 */
export const moveYardBox = (body: YardMoveRequest) =>
  apiSend<YardLocation>('POST', YARD_MOVES_PATH, body);

/** Who may move a box. The screens ask `canAt(YARD_MANAGE, branchId)`. */
export const YARD_MANAGE = 'tos.yard.manage';

// ── 7. where should this box go? ───────────────────────────────────────────
//
// `GET /api/tos/yard/suggestions` (Phase 3) scores every stack's lowest free
// tier and answers the best, each with the reasons for its score: the block is
// reserved for this line, the stack already holds the same line and size, an
// empty goes high and a full box low, a reefer plug is left for a box that
// needs one. ONLY LEGAL SLOTS ARE SUGGESTED — free, standing on something, and
// breaking none of the yard's stacking rules.
//
// It is a suggestion, never a decision. The clerk may click any stack in the
// grid, and the API checks that pick on its own merits. A suggestion the screen
// enforced would be a rule nobody agreed to.

export interface YardSuggestion {
  yardSlotId: string;
  /** "A-B-03-2" — the slot's label, which becomes the box's position text. */
  label: string;
  yardBlockId: string;
  blockCode: string;
  rowLabel: string;
  bayNumber: number;
  tierNumber: number;
  /** Higher is better. Comparable only within one answer. */
  score: number;
  /** Why it scored what it did, in the clerk's words. Best reason first. */
  reasons: string[];
}

export interface YardSuggestions {
  yardId: string;
  yardCode: string;
  equipmentTypeCode: string | null;
  lineCode: string | null;
  fullEmpty: string | null;
  /** What the yard took the box's departure to be, and where that came from. */
  expectedDepartureAt?: string | null;
  departureSource?: DepartureSource;
  /** How many stacks were looked at — the yard's size, for context. */
  stacksLooked: number;
  /** Legal slots found. ZERO means nothing in this yard can take the box. */
  candidates: number;
  suggestions: YardSuggestion[];
}

/**
 * What the yard needs to know about the box to suggest a slot for it.
 *
 * TWO WAYS TO ASK. A box ALREADY IN THE YARD (a move) is named by
 * `containerNo` and the API reads its own facts — type, line, customer, DG,
 * out-of-gauge, condition — and leaves its current slot out. A box AT THE GATE
 * has no stay yet, so the screen says what it knows: type, line and full/empty
 * are required, the rest sharpen the answer.
 */
export interface YardSuggestionQuery {
  yardId: string;
  /** A box standing in the yard; the API reads the rest from its stay. */
  containerNo?: string | null;
  equipmentTypeCode?: string | null;
  lineCode?: string | null;
  fullEmpty?: 'FULL' | 'EMPTY' | null;
  customerCode?: string | null;
  isDangerous?: boolean;
  isOutOfGauge?: boolean;
  conditionCode?: string | null;
  limit?: number;
  /**
   * WHEN THIS BOX LEAVES, so the yard does not bury it (Phase 5).
   *
   * A box at the gate has no stay to read it from, so the screen says it: the
   * BOOKING PLACE (`bookingContainerId`) lets the API work it out from the
   * vessel's ETD or the booking's valid-to, and `expectedDepartureAt` states
   * it outright when something already knows. Either one makes the answer
   * weigh departure; without them the scores are the Phase 3 ones.
   */
  bookingContainerId?: string | null;
  expectedDepartureAt?: string | null;
}

/**
 * The query's URL, or NULL when there is not enough to ask with.
 *
 * Null rather than a request the API would answer 400 to: "Which type of box?"
 * is a fair answer to a bad question and a useless thing to show a clerk who
 * has not keyed the box yet.
 */
export function yardSuggestionsPath(q: YardSuggestionQuery | null): string | null {
  if (!q?.yardId) return null;
  const p = new URLSearchParams({ yardId: q.yardId });
  const box = q.containerNo?.trim();
  if (box) {
    p.set('containerNo', box);
  } else {
    const type = q.equipmentTypeCode?.trim();
    const line = q.lineCode?.trim();
    if (!type || !line || !q.fullEmpty) return null;
    p.set('equipmentTypeCode', type);
    p.set('lineCode', line);
    p.set('fullEmpty', q.fullEmpty);
    if (q.customerCode?.trim()) p.set('customerCode', q.customerCode.trim());
    if (q.isDangerous) p.set('isDangerous', 'true');
    if (q.isOutOfGauge) p.set('isOutOfGauge', 'true');
    if (q.conditionCode?.trim()) p.set('conditionCode', q.conditionCode.trim());
    if (q.bookingContainerId?.trim()) p.set('bookingContainerId', q.bookingContainerId.trim());
    if (q.expectedDepartureAt) p.set('expectedDepartureAt', q.expectedDepartureAt);
  }
  if (q.limit) p.set('limit', String(q.limit));
  return `/api/tos/yard/suggestions?${p.toString()}`;
}

/** The best slots for a box, or nothing when the question cannot be asked yet. */
export function useYardSuggestions(query: YardSuggestionQuery | null) {
  return useApi<YardSuggestions>(yardSuggestionsPath(query));
}

// ── 8. the stacking rules, and who may override them ──────────────────────

/**
 * THE RULES THE YARD APPLIES TO A SLOT (Phase 3), and what each refuses:
 *
 *   SIZE_BLOCK   a box of another length in a block allocated to 20 / 40 / 45'
 *   SIZE_STACK   a box on a box of another length — a stack is one length
 *   OOG_ON_TOP   anything on top of an out-of-gauge box
 *   RESERVED     another party's box in a block kept for a line or customer
 *   BLOCK_TYPE   EMPTY block ← a full box; FULL / IMPORT / EXPORT /
 *                TRANSHIPMENT ← an empty; REEFER ← not a reefer;
 *                DAMAGE ← a serviceable box
 *   REEFER_PLUG  a full reefer in a slot with no plug
 *   DG_BLOCK     dangerous goods outside a DG or HAZ block
 *   OOG_BLOCK    an out-of-gauge box outside an OOG block or row
 *
 * EVERY ONE OF THEM IS OVERRIDABLE by someone holding `tos.gate.override`, with
 * a written reason that is kept on the box's history. The PHYSICAL checks are
 * not: a slot that is taken, blocked, not in use, floating or in another yard
 * is refused to everybody, because no reason makes a box stand in mid-air.
 *
 * The API sends the broken rules as one sentence — the screens show the
 * server's own words rather than translating a code into a guess.
 */
export const GATE_OVERRIDE = 'tos.gate.override';

/** The finding code a refused rule arrives under in the big Save's 409. */
export const YARD_RULE_FINDING = 'YARD_RULE';

/** The WARN finding a gate-out preflight adds for a box with others on top. */
export const BOXES_ON_TOP_FINDING = 'BOXES_ON_TOP';

/**
 * Does this refusal invite an override?
 *
 * The server says so itself — "A supervisor may override this with a reason" —
 * and saying it only when the server does keeps a physical refusal (a taken or
 * floating slot) from offering a reason box that cannot help.
 */
export const canOverrideRefusal = (message: string | null | undefined): boolean =>
  !!message && /may override/i.test(message);

// ── 9. the whole yard at once (Phase 5, for the 3D view) ──────────────────

/** One block of the whole-yard answer: where it sits on the map, and its stacks. */
export interface YardBlockPlan {
  layoutX: number | null;
  layoutY: number | null;
  layoutWidth: number | null;
  layoutHeight: number | null;
  layoutRotationDeg: number | null;
  displayColorHex: string | null;
  block: YardBlockStacks;
}

export interface WholeYard {
  yardId: string;
  yardCode: string;
  yardName: string;
  blocks: YardBlockPlan[];
}

export const wholeYardPath = (yardId: string) => `/api/tos/yard/stacks?yardId=${encodeURIComponent(yardId)}`;

/**
 * EVERY BLOCK AND EVERY SLOT OF ONE YARD, in one answer.
 *
 * The 3D view needs the lot before it can draw anything, and asking per block
 * would be forty requests and a yard that assembles itself in front of the
 * user. Nothing else should read this: a screen that needs one block reads
 * `/stacks/{blockId}` (useYardStacks), which is a fraction of the payload.
 */
export function useWholeYard(yardId: string | null) {
  return useApi<WholeYard>(yardId ? wholeYardPath(yardId) : null);
}
