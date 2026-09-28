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

import { apiDownload, apiGet, apiSend, apiUpload, saveBlob } from './client';

export type ScheduleStatus ='DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
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

// ── writing a tariff ───────────────────────────────────────────────────────
// Mirrors SaveScheduleRequest / RateItem / FreeTimeItem in
// Gecko.Revenue/Endpoints/Tariffs (ScheduleEndpoints.cs, RateContracts.cs).

export interface SaveScheduleRequest {
  scheduleNo: string;
  name: string;
  moduleCode: string;
  scheduleType: ScheduleType;
  effectiveFrom: string;
  effectiveTo?: string | null;
  branchId?: string | null;
  agentPartyCode?: string | null;
  forwarderPartyCode?: string | null;
  customerPartyCode?: string | null;
  bookingRef?: string | null;
  currencyCode?: string;
  pricesIncludeTax?: boolean;
  waiveDamagedEmptyStorage?: boolean;
  remarks?: string | null;
  rowVersion?: string | null;
}

export type PricingMethod = 'FLAT' | 'TIERED_INCREMENTAL' | 'TIERED_BAND' | 'TIERED_BLOCK';
export type TierBasis = 'DAY' | 'HOUR' | 'TEU' | 'FLEET_TEU';

export interface ConditionItem {
  axis: string;
  op: string;
  modifierOp: string;
  modifierValue: number;
  values?: string[] | null;
  number?: number | null;
  flag?: boolean | null;
  label?: string | null;
}

export interface RateItem {
  chargeCode: string;
  billTo: string;
  paymentTermCode: string;
  creditTermDays?: number | null;
  orderTypeCode?: string | null;
  movementCode?: string | null;
  equipmentTypeCode?: string | null;
  equipmentSize?: string | null;
  cargoCategoryCode?: string | null;
  truckCategoryCode?: string | null;
  billingUnitCode?: string | null;
  pricingMethod: PricingMethod;
  tierBasis?: TierBasis | null;
  rate?: number | null;
  tiers?: RateTier[] | null;
  conditions?: ConditionItem[] | null;
}

export type FreeTimeKind = 'STORAGE' | 'CHASSIS' | 'TRUCK_WAITING';

export interface FreeTimeItem {
  freeTimeKind: FreeTimeKind;
  freeUnits: number;
  fullEmpty?: 'FULL' | 'EMPTY' | null;
  direction?: 'IMPORT' | 'EXPORT' | 'LOCAL' | null;
  cargoGroup?: 'NORMAL' | 'REEFER' | 'DG' | null;
  equipmentSize?: string | null;
}

export const PRICING_METHODS: PricingMethod[] = ['FLAT', 'TIERED_INCREMENTAL', 'TIERED_BAND', 'TIERED_BLOCK'];
export const TIER_BASES: TierBasis[] = ['DAY', 'HOUR', 'TEU', 'FLEET_TEU'];

/** Tariff condition vocabulary (Gecko.Revenue/Domain/TariffVocabulary.cs). */
export const LIST_AXES = ['EQUIPMENT_SIZE', 'EQUIPMENT_TYPE', 'CARGO_CATEGORY', 'TRUCK_CATEGORY'];
export const FLAG_AXES = ['IS_REEFER', 'IS_DG', 'IS_OOG'];
export const NUMERIC_AXES = ['WEIGHT_KG'];
export const MODIFIER_OPS = ['ADD', 'MULTIPLY', 'REPLACE'];

/**
 * The closed vocabularies a rate row is written in — GET /api/revenue/lookups
 * (Gecko.Revenue/Endpoints/Tariffs/LookupEndpoints.cs), read from the same
 * lookup.* replicas RateSetValidator checks against. Sorted for display.
 */
export interface BillToRoleLookup { code: string; name: string; nameLocal: string | null; sortOrder: number }
export interface PaymentTermLookup {
  code: string; name: string; nameLocal: string | null; sortOrder: number;
  /** Paid before the box moves (CASH, PREPAID). */
  settlesBeforeRelease: boolean;
  requiresCreditAccount: boolean;
}
export interface BillingUnitLookup {
  code: string; name: string; nameLocal: string | null; sortOrder: number;
  /** What the quantity counts; a DAY/HOUR tier basis needs a unit whose source matches. */
  quantitySource: string;
  isTimeBased: boolean;
}
export interface CurrencyLookup { code: string; name: string; symbol: string | null; minorUnits: number | null }
export interface RevenueLookups {
  billToRoles: BillToRoleLookup[];
  paymentTerms: PaymentTermLookup[];
  billingUnits: BillingUnitLookup[];
  currencies: CurrencyLookup[];
}

export const REVENUE_LOOKUPS_PATH = '/api/revenue/lookups';
export const getRevenueLookups = () => apiGet<RevenueLookups>(REVENUE_LOOKUPS_PATH);

/** Tiers as one line, the same text the Excel template uses: `1-7:160; 8-14:275; 15+:390`. */
export function formatTiers(tiers: RateTier[]): string {
  const n = (v: number) => String(Number(v.toFixed(4)));
  return [...tiers].sort((a, b) => a.fromQty - b.fromQty)
    .map(t => `${t.toQty === null ? `${n(t.fromQty)}+` : `${n(t.fromQty)}-${n(t.toQty)}`}:${n(t.rate)}`)
    .join('; ');
}

/** Parses tier text; the server re-checks gaps and overlaps (TierPricing.Defects). */
export function parseTiers(text: string): { tiers: RateTier[]; error: string | null } {
  const tiers: RateTier[] = [];
  for (const raw of text.split(';').map(s => s.trim()).filter(Boolean)) {
    const colon = raw.lastIndexOf(':');
    if (colon <= 0) return { tiers: [], error: `'${raw}' should look like 1-7:160 (range, colon, rate).` };
    const range = raw.slice(0, colon).replace(/\s/g, '');
    const rate = Number(raw.slice(colon + 1).trim().replace(/,/g, ''));
    if (!Number.isFinite(rate)) return { tiers: [], error: `'${raw}': the rate after ':' is not a number.` };
    if (range.endsWith('+')) {
      const from = Number(range.slice(0, -1));
      if (range.length < 2 || !Number.isFinite(from)) return { tiers: [], error: `'${raw}': '${range}' is not a range.` };
      tiers.push({ fromQty: from, toQty: null, rate });
    } else {
      const [a, b] = range.split('-');
      const from = Number(a);
      const to = b === undefined ? from : Number(b);
      if (a === '' || !Number.isFinite(from) || !Number.isFinite(to)) return { tiers: [], error: `'${raw}': '${range}' is not a range.` };
      tiers.push({ fromQty: from, toQty: to, rate });
    }
  }
  return { tiers, error: null };
}

// ── Excel round-trip (Gecko.Revenue/Endpoints/Imports/ImportEndpoints.cs) ──

export interface ImportIssue {
  column: string | null;
  severity: string;
  code: string;
  message: string;
}

export interface ImportRowView {
  sheet: string;
  rowNo: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UNCHANGED' | null;
  status: string;
  rateKey: string | null;
  issues: ImportIssue[];
}

export interface ImportPreview {
  importBatchId: string;
  scheduleId: string;
  /** VALIDATED | APPLIED | CANCELLED */
  status: string;
  fileName: string;
  scheduleChangedSinceExport: boolean;
  rowsTotal: number;
  rowsOk: number;
  rowsWarning: number;
  rowsError: number;
  rowsInsert: number;
  rowsUpdate: number;
  rowsDelete: number;
  rowsUnchanged: number;
  failureMessage: string | null;
  rows: ImportRowView[];
}

/** GET the tariff's workbook and hand it to the browser as a download. */
export async function downloadTariffTemplate(scheduleId: string, fallbackName: string): Promise<void> {
  const { blob, filename } = await apiDownload(`/api/revenue/tariffs/${scheduleId}/template`);
  saveBlob(blob, filename ?? fallbackName);
}

/** Upload an edited workbook: parsed, validated and previewed — nothing is applied yet. */
export function uploadTariffWorkbook(scheduleId: string, file: File): Promise<ImportPreview> {
  const form = new FormData();
  form.append('file', file, file.name);
  return apiUpload<ImportPreview>(`/api/revenue/tariffs/${scheduleId}/imports`, form);
}

export const confirmImport = (batchId: string) => apiSend<ImportPreview>('POST', `/api/revenue/imports/${batchId}/confirm`);
export const cancelImport = (batchId: string) => apiSend<ImportPreview>('POST', `/api/revenue/imports/${batchId}/cancel`);

/**
 * Server validation keys are `rates[3].rate`, `rates[3].conditions[0]`,
 * `rates[3]` (and PascalCase `Rates[3].Rate` from attribute validation).
 * Groups them per row index, field name lower-cased; '' is the whole row.
 */
export function rowErrors(fieldErrors: Record<string, string[]>, collection: string): Map<number, Record<string, string[]>> {
  const out = new Map<number, Record<string, string[]>>();
  const pattern = new RegExp(`^${collection}\\[(\\d+)\\](?:\\.(.+))?$`, 'i');
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const m = pattern.exec(key);
    if (!m) continue;
    const index = Number(m[1]);
    const field = (m[2] ?? '').split(/[.[]/)[0].toLowerCase();
    const row = out.get(index) ?? {};
    row[field] = [...(row[field] ?? []), ...messages];
    out.set(index, row);
  }
  return out;
}
