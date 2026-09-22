/**
 * Shapes returned by Gecko.Revenue (/api/revenue), written from its own
 * contracts — ScheduleResponse, RateSetResponse, FreeTimeSetResponse,
 * PriceRequest/PriceResult.
 *
 * VOCABULARY, so the screens stop inventing their own:
 *   status     DRAFT | PENDING | APPROVED | REJECTED | WITHDRAWN
 *              — where the version is in the maker-checker workflow.
 *   lifecycle  ACTIVE | SCHEDULED | EXPIRED | SUPERSEDED
 *              — where it is in TIME, derived, never stored.
 * The old mock had one "status" column mixing the two, which cannot show a
 * tariff that is approved but does not start until November.
 */

export type ScheduleStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type ScheduleLifecycle = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'SUPERSEDED' | 'DRAFT' | 'PENDING' | 'REJECTED' | 'WITHDRAWN';
export type ScheduleType = 'PUBLIC' | 'CONTRACT' | 'SPOT';

export interface Schedule {
  scheduleId: string;
  scheduleNo: string;
  versionNo: number;
  lineageId: string;
  name: string;
  moduleCode: string;
  scheduleType: ScheduleType;
  scopeRank: number;
  branchId: string | null;
  agentPartyCode: string | null;
  forwarderPartyCode: string | null;
  customerPartyCode: string | null;
  bookingRef: string | null;
  currencyCode: string;
  pricesIncludeTax: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** effectiveTo, or the day before the next version starts. */
  effectiveUntil: string | null;
  status: ScheduleStatus;
  lifecycle: ScheduleLifecycle;
  isEditable: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  waiveDamagedEmptyStorage: boolean;
  remarks: string | null;
  rateCount: number;
  rowVersion: string;
}

export interface RateTier {
  fromQty: number;
  toQty: number | null;
  rate: number;
}

export interface RateCondition {
  sequenceNo: number;
  axis: string;
  op: string;
  values: string[];
  number: number | null;
  flag: boolean | null;
  modifierOp: string;
  modifierValue: number;
  label: string | null;
}

export interface Rate {
  tosRateId: string;
  chargeCode: string;
  billTo: string;
  paymentTermCode: string;
  creditTermDays: number | null;
  orderTypeCode: string | null;
  movementCode: string | null;
  equipmentTypeCode: string | null;
  equipmentSize: string | null;
  cargoCategoryCode: string | null;
  truckCategoryCode: string | null;
  billingUnitCode: string;
  pricingMethod: string;
  tierBasis: string | null;
  rate: number | null;
  specificity: number;
  source: string;
  tiers: RateTier[];
  conditions: RateCondition[];
}

export interface RateSet {
  scheduleId: string;
  status: ScheduleStatus;
  rowVersion: string;
  rates: Rate[];
}

export interface FreeTimeRule {
  freeTimeKind: string;
  fullEmpty: string | null;
  direction: string | null;
  cargoGroup: string | null;
  equipmentSize: string | null;
  freeUnits: number;
  unit: string;
}

export interface FreeTimeSet {
  scheduleId: string;
  status: ScheduleStatus;
  rowVersion: string;
  rules: FreeTimeRule[];
}

export interface PricedTier {
  fromQty: number;
  toQty: number | null;
  quantity: number;
  baseRate: number;
  rate: number;
  amount: number;
}

export interface AppliedCondition {
  sequenceNo: number;
  label: string;
  before: number;
  after: number;
}

export interface PriceRequest {
  moduleCode: string;
  eventTime: string;
  chargeCode: string;
  billTo: string;
  paymentTermCode: string;
  branchId?: string | null;
  agentPartyCode?: string | null;
  forwarderPartyCode?: string | null;
  customerPartyCode?: string | null;
  bookingRef?: string | null;
  orderTypeCode?: string | null;
  movementCode?: string | null;
  equipmentTypeCode?: string | null;
  equipmentSize?: string | null;
  cargoCategoryCode?: string | null;
  truckCategoryCode?: string | null;
  isDangerousGoods?: boolean;
  grossWeightKg?: number | null;
  quantity?: number;
  freeTimeKind?: string | null;
  fullEmpty?: string | null;
  direction?: string | null;
}

export interface PriceResult {
  outcome: 'PRICED' | 'UNPRICED';
  chargeCode: string;
  billTo: string;
  paymentTermCode: string;
  pricedForDate: string;
  scheduleId: string | null;
  scheduleNo: string | null;
  versionNo: number | null;
  scheduleType: string | null;
  scopeRank: number | null;
  tosRateId: string | null;
  specificity: number | null;
  pricingMethod: string | null;
  billingUnitCode: string | null;
  currencyCode: string | null;
  pricesIncludeTax: boolean | null;
  baseRate: number | null;
  unitRate: number | null;
  quantity: number;
  freeUnits: number | null;
  freeTimeFromScheduleNo: string | null;
  chargeableQuantity: number | null;
  tiers: PricedTier[];
  conditions: AppliedCondition[];
  amount: number | null;
  /** Every candidate tariff the resolver tried, in order, and why it lost. */
  precedenceTrail: string[];
  resolvedAt: string;
}

// ── display helpers ────────────────────────────────────────────────────────

/** Time-based units price a DURATION, so they read as a tier table, not a unit price. */
const TIME_UNITS = new Set(['PER_DAY', 'PER_HOUR']);
export const isTimeCharge = (rate: Rate) => TIME_UNITS.has(rate.billingUnitCode) || rate.tierBasis !== null;

export const money = (value: number | null | undefined, currency = 'THB') =>
  value === null || value === undefined
    ? '—'
    : `${currency === 'THB' ? '฿' : `${currency} `}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const tierLabel = (tier: { fromQty: number; toQty: number | null }) =>
  tier.toQty === null ? `${tier.fromQty}+` : tier.fromQty === tier.toQty ? `${tier.fromQty}` : `${tier.fromQty}–${tier.toQty}`;

/** "any" is what a NULL axis means to the resolver; say so rather than showing a blank cell. */
export const axis = (value: string | null) => value ?? 'any';

export function conditionText(c: RateCondition): string {
  const target =
    c.op === 'IS' ? `${c.axis} is ${c.flag ? 'yes' : 'no'}`
    : c.op === 'IN' ? `${c.axis} in ${c.values.join(', ')}`
    : c.op === 'EQ' ? `${c.axis} = ${c.values.join(', ')}`
    : `${c.axis} ${c.op.toLowerCase()} ${c.number}`;
  const effect =
    c.modifierOp === 'ADD' ? `+${c.modifierValue}`
    : c.modifierOp === 'MULTIPLY' ? `×${c.modifierValue}`
    : `= ${c.modifierValue}`;
  return `${c.label ? `${c.label}: ` : ''}${target} → ${effect}`;
}

/** What the party columns show: PUBLIC applies to everyone, SPOT to one booking. */
export function partySummary(s: Schedule): string {
  if (s.scheduleType === 'PUBLIC') return 'All customers';
  const parties = [s.agentPartyCode, s.forwarderPartyCode, s.customerPartyCode].filter(Boolean).join(' × ');
  return s.bookingRef ? [parties, `booking ${s.bookingRef}`].filter(Boolean).join(' · ') : parties || '—';
}

export const SCOPE_RANK_LABEL: Record<number, string> = {
  1: 'Spot — this booking',
  2: 'Agent + forwarder + customer',
  3: 'Agent + customer',
  4: 'Forwarder + customer',
  5: 'Customer',
  6: 'Agent + forwarder',
  7: 'Agent',
  8: 'Forwarder',
  9: 'Public, this branch',
  10: 'Public, all branches',
};

export const STATUS_TONE: Record<string, string> = {
  DRAFT: 'neutral', PENDING: 'warning', APPROVED: 'success', REJECTED: 'error', WITHDRAWN: 'neutral',
  ACTIVE: 'success', SCHEDULED: 'info', EXPIRED: 'error', SUPERSEDED: 'neutral',
};

export const TYPE_TONE: Record<ScheduleType, { tone: string; icon: string; label: string }> = {
  PUBLIC: { tone: 'info', icon: 'globe', label: 'Public' },
  CONTRACT: { tone: 'primary', icon: 'fileText', label: 'Contract' },
  SPOT: { tone: 'warning', icon: 'clock', label: 'Spot' },
};

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatMoment(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
