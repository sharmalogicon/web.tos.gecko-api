import { formatDate } from './format';
/**
 * Tariff types — shared schema between editor (/tariff/plans/new) and
 * view-only detail (/tariff/plans/[id]).
 *
 * AI-future room is baked in:
 *  - RateRow.source / sourceRef / confidence let AI-suggested rows coexist with human rows
 *  - SurchargeCondition is a structured DSL (not free text) so AI can read/write it
 *  - ResolutionResult.reason + precedenceTrail are machine-readable training labels
 */

export type ScheduleType = 'PUBLIC' | 'CONTRACT' | 'SPOT';
export type ScheduleStatus = 'Draft' | 'Pending' | 'Active' | 'Expired';
export type PaymentTerm = 'CASH' | 'CREDIT';
export type BilledTo = 'CUSTOMER' | 'AGENT' | 'FWD' | 'LINE' | 'CARRIER' | 'HAULIER';
export type Axis = 'SIZE' | 'TYPE' | 'TRUCK_CAT' | 'CARGO_CAT';

// ── Conditional surcharges (DSL) ────────────────────────────────────────────
//
// A rate row can carry zero-or-more conditions that modify the base amount
// when an evaluation context matches. Example: "+฿200 if Reefer", "×1.5 if Size in [40, 45]".
// The DSL is intentionally structured so AI agents can both READ existing rules
// (for explainability) and WRITE new ones (for rate suggestion).

export type ConditionAxis =
  | 'SIZE'        // input.size
  | 'TYPE'        // input.type
  | 'TRUCK_CAT'   // input.truckCat
  | 'CARGO_CAT'   // input.cargoCat
  | 'REEFER'      // derived: type === 'RF'
  | 'DG'          // derived: cargoCat === 'HAZ'
  | 'OOG'         // derived: cargoCat === 'OOG'
  | 'WEIGHT_KG';  // input.weightKg (numeric)

export type ConditionOp = 'eq' | 'in' | 'is' | 'gt' | 'lt' | 'gte' | 'lte';
export type ModifierOp = 'add' | 'multiply' | 'replace';

export interface SurchargeCondition {
  id: string;
  when: {
    axis: ConditionAxis;
    op: ConditionOp;
    values: (string | number | boolean)[];
  };
  then: {
    op: ModifierOp;
    value: number;           // for 'add'/'replace' = THB amount; for 'multiply' = factor (e.g. 1.5)
  };
  label?: string;            // optional human-readable name (e.g., "Reefer surcharge")
}

// ── Rate row ────────────────────────────────────────────────────────────────

export type RateRowSource =
  | 'human'         // entered by hand in the UI
  | 'imported'      // came from CSV/Excel
  | 'inherited'     // pulled from a parent tariff
  | 'ai-suggested'  // proposed by AI; needs explicit accept
  | 'ai-extracted'; // pulled from a PDF/email by AI

export interface RateRow {
  id: string;
  size?: string;
  type?: string;
  truckCat?: string;
  cargoCat?: string;
  paymentTerm: PaymentTerm;
  billedTo: BilledTo;
  amount: number;                       // base rate
  conditions?: SurchargeCondition[];    // optional modifiers
  // Provenance
  source: RateRowSource;
  sourceRef?: string;
  confidence?: number;
  acceptedAt?: string;
}

export interface PricedCharge {
  id: string;
  code: string;
  desc: string;
  source: 'MOVEMENT' | 'VAS';
  orderTypeId: string;
  movementSeq: number;
  axes: Set<Axis>;
  rows: RateRow[];
}

// ── Non-movement pricing ────────────────────────────────────────────────────

export interface TEUBand {
  id: string;
  from: number;
  to: number;
  ratePerDay: number;
}

// User-defined day slab. Customer/depot decides the day boundaries, not us —
// "1-5, 6-10, 11+" is just a common default. Slabs are ordered low→high; the
// LAST slab is treated as open-ended past its toDay (rate continues forever).
export interface DaySlab {
  id: string;
  fromDay: number;
  toDay: number;
  ratePerDay: number;
}

export interface StorageConfig {
  freeDays: number;
  mode: 'PER_DAY_SLAB' | 'FLEET_TEU_SLAB';
  perDaySlabs: DaySlab[];
  fleetTeuBands: TEUBand[];
}

export interface FreeTimeMatrix {
  fullExport: { normal: number; reefer: number; dg: number };
  fullImport: { normal: number; reefer: number; dg: number };
  emptyExport: { normal: number; reefer: number };
  emptyImport: { normal: number; reefer: number };
  waiveMtyDm: boolean;
}

// ── Resolution engine ───────────────────────────────────────────────────────

export type ResolutionReason =
  | 'EXACT_MATCH'
  | 'AXIS_FALLBACK'
  | 'NO_AXES_FLAT'
  | 'FALLBACK_PUBLIC'
  | 'UNPRICED';

export interface ResolutionInput {
  orderTypeId: string;
  movementSeq: number;
  size?: string;
  type?: string;
  truckCat?: string;
  cargoCat?: string;
  paymentTerm: PaymentTerm;
  billedTo: BilledTo;
  weightKg?: number;
}

export interface AppliedCondition {
  conditionId: string;
  label: string;       // e.g., "+฿200 if Reefer"
  before: number;      // amount before this modifier
  after: number;       // amount after
}

export interface ResolutionResult {
  chargeCode: string;
  chargeDesc: string;
  source: 'MOVEMENT' | 'VAS';
  matched: boolean;
  winningTariffId: string;
  winningRowId?: string;
  baseRate?: number;
  rate?: number;                 // final rate after conditions applied
  appliedConditions?: AppliedCondition[];
  paymentTerm?: PaymentTerm;
  billedTo?: BilledTo;
  precedenceTrail: string[];
  reason: ResolutionReason;
}

// ── Schedule envelope (used by the view page) ───────────────────────────────

export interface ActivityEntry {
  id: string;
  who: string;
  what: string;
  when: string;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'info' | 'neutral';
}

export interface WorkflowProgressStep {
  stepId: string;
  stepName: string;
  approverLabel: string;
  status: 'approved' | 'auto-approved' | 'pending' | 'upcoming';
  at?: string;
  by?: string;
  thresholdNote?: string;
}

export interface Schedule {
  id: string;
  name: string;
  type: ScheduleType;
  status: ScheduleStatus;
  liner?: { code: string; name: string };
  forwarder?: { code: string; name: string };
  shipper?: { code: string; name: string };
  effective: string;
  expiry: string;
  salesPerson: string;
  approver: string;
  workflowId: string;
  workflowProgress: WorkflowProgressStep[];
  orderTypesInScope: string[];
  prices: PricedCharge[];
  ladenStorage: StorageConfig;
  emptyStorage: StorageConfig;
  ptiRates: Record<string, number>;
  precoolRates: Record<string, number>;
  freeTime: FreeTimeMatrix;
  activity: ActivityEntry[];
}

// ── Constants ───────────────────────────────────────────────────────────────

export const SIZES = ['20', '40', '45'];
export const TYPES = ['DC', 'HC', 'RF', 'OT', 'FR', 'TK'];
export const TRUCK_CATS = ['TRAILER', 'SIDE-LOADER', 'FLATBED', 'TIPPER'];
export const CARGO_CATS = ['GENERAL', 'HAZ', 'TEMP', 'OOG'];

export const PUBLIC_TARIFF_ID = 'TP-2026-PUB';

export const TYPE_TONE: Record<ScheduleType, { tone: string; icon: string; label: string }> = {
  PUBLIC:   { tone: 'info',    icon: 'globe',    label: 'Public' },
  CONTRACT: { tone: 'primary', icon: 'fileText', label: 'Contract' },
  SPOT:     { tone: 'warning', icon: 'clock',    label: 'Spot' },
};

export const STATUS_TONE: Record<ScheduleStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  Draft: 'neutral',
  Pending: 'warning',
  Active: 'success',
  Expired: 'danger',
};

export const REASON_TONE: Record<ResolutionReason, string> = {
  EXACT_MATCH:     'success',
  AXIS_FALLBACK:   'warning',
  NO_AXES_FLAT:    'primary',
  FALLBACK_PUBLIC: 'info',
  UNPRICED:        'danger',
};

export const REASON_LABEL: Record<ResolutionReason, string> = {
  EXACT_MATCH:     'Exact match',
  AXIS_FALLBACK:   'Partial axis match',
  NO_AXES_FLAT:    'Flat charge',
  FALLBACK_PUBLIC: 'Falls back to Public',
  UNPRICED:        'Unpriced',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

export const fmtTHB = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDateLong = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return formatDate(d.toISOString());
};

export function daysBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (isNaN(d1) || isNaN(d2)) return 0;
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

let _seed = 1;
export const rid = () => `r_${_seed++}_${Math.random().toString(36).slice(2, 7)}`;

// ── Resolution engine ───────────────────────────────────────────────────────

function evaluateCondition(c: SurchargeCondition, input: ResolutionInput): boolean {
  const { axis, op, values } = c.when;
  let actual: string | number | boolean | undefined;
  switch (axis) {
    case 'SIZE':       actual = input.size; break;
    case 'TYPE':       actual = input.type; break;
    case 'TRUCK_CAT':  actual = input.truckCat; break;
    case 'CARGO_CAT':  actual = input.cargoCat; break;
    case 'REEFER':     actual = input.type === 'RF'; break;
    case 'DG':         actual = input.cargoCat === 'HAZ'; break;
    case 'OOG':        actual = input.cargoCat === 'OOG'; break;
    case 'WEIGHT_KG':  actual = input.weightKg ?? 0; break;
  }
  if (actual === undefined) return false;
  switch (op) {
    case 'eq':  return actual === values[0];
    case 'in':  return (values as (string | number)[]).includes(actual as string | number);
    case 'is':  return Boolean(actual) === Boolean(values[0]);
    case 'gt':  return Number(actual) > Number(values[0]);
    case 'lt':  return Number(actual) < Number(values[0]);
    case 'gte': return Number(actual) >= Number(values[0]);
    case 'lte': return Number(actual) <= Number(values[0]);
  }
}

function applyModifier(base: number, mod: SurchargeCondition['then']): number {
  switch (mod.op) {
    case 'add':      return base + mod.value;
    case 'multiply': return base * mod.value;
    case 'replace':  return mod.value;
  }
}

export function describeCondition(c: SurchargeCondition): string {
  if (c.label) return c.label;
  const v = Array.isArray(c.when.values) ? c.when.values.join('/') : String(c.when.values);
  const axis = c.when.axis.replace(/_/g, '-').toLowerCase();
  const cond =
    c.when.op === 'is' ? `${axis}` :
    c.when.op === 'in' ? `${axis} in [${v}]` :
    c.when.op === 'eq' ? `${axis} = ${v}` :
    `${axis} ${c.when.op} ${v}`;
  const mod =
    c.then.op === 'add'      ? `+ ฿${c.then.value}` :
    c.then.op === 'multiply' ? `× ${c.then.value}` :
                                `→ ฿${c.then.value}`;
  return `${mod} if ${cond}`;
}

export function resolveCharge(
  charge: PricedCharge,
  input: ResolutionInput,
  thisScheduleId: string,
): ResolutionResult {
  const candidates = charge.rows.filter(
    r => r.paymentTerm === input.paymentTerm && r.billedTo === input.billedTo
  );

  const fallback = (): ResolutionResult => ({
    chargeCode: charge.code, chargeDesc: charge.desc, source: charge.source,
    matched: false,
    winningTariffId: PUBLIC_TARIFF_ID,
    precedenceTrail: [thisScheduleId, PUBLIC_TARIFF_ID],
    reason: 'FALLBACK_PUBLIC',
  });

  if (candidates.length === 0) return fallback();

  const buildResult = (row: RateRow, reason: ResolutionReason): ResolutionResult => {
    let rate = row.amount;
    const applied: AppliedCondition[] = [];
    for (const c of row.conditions ?? []) {
      if (evaluateCondition(c, input)) {
        const before = rate;
        rate = applyModifier(rate, c.then);
        applied.push({
          conditionId: c.id,
          label: describeCondition(c),
          before, after: rate,
        });
      }
    }
    return {
      chargeCode: charge.code, chargeDesc: charge.desc, source: charge.source,
      matched: true,
      winningTariffId: thisScheduleId, winningRowId: row.id,
      baseRate: row.amount, rate,
      appliedConditions: applied,
      paymentTerm: row.paymentTerm, billedTo: row.billedTo,
      precedenceTrail: [thisScheduleId],
      reason,
    };
  };

  if (charge.axes.size === 0) {
    return buildResult(candidates[0], 'NO_AXES_FLAT');
  }

  type Scored = { row: RateRow; matchCount: number; reject: boolean };
  const scored: Scored[] = candidates.map(r => {
    let matchCount = 0;
    let reject = false;
    if (charge.axes.has('SIZE')) {
      if (r.size === input.size) matchCount++;
      else if (r.size && r.size !== input.size) reject = true;
    }
    if (charge.axes.has('TYPE')) {
      if (r.type === input.type) matchCount++;
      else if (r.type && r.type !== input.type) reject = true;
    }
    if (charge.axes.has('TRUCK_CAT')) {
      if (r.truckCat === input.truckCat) matchCount++;
      else if (r.truckCat && r.truckCat !== input.truckCat) reject = true;
    }
    if (charge.axes.has('CARGO_CAT')) {
      if (r.cargoCat === input.cargoCat) matchCount++;
      else if (r.cargoCat && r.cargoCat !== input.cargoCat) reject = true;
    }
    return { row: r, matchCount, reject };
  }).filter(s => !s.reject);

  if (scored.length === 0) return fallback();

  scored.sort((a, b) => b.matchCount - a.matchCount);
  const best = scored[0];
  const isExact = best.matchCount === charge.axes.size;

  return buildResult(best.row, isExact ? 'EXACT_MATCH' : 'AXIS_FALLBACK');
}
