/**
 * The small masters the Lookups screen edits (decision B) — Gecko.MasterData.
 *
 *   grades, conditions      /api/master/container-grades|container-conditions   mdm.equipment.view / manage
 *   movements, service types, tax codes
 *                           /api/master/movements|service-types|tax-codes       mdm.commercial.view / manage
 *   code lists, mappings    /api/master/code-lists, /api/master/code-mappings   mdm.config.view / manage
 *
 * Every row carries a Base64 rowVersion: send it back on PUT and DELETE. A
 * stale one answers 409. Codes may hold '/', so URLs are built with codePath().
 */
import { apiSend } from './client';
import { useApi } from './use-api';

export const codePath = (base: string, code: string) => `${base}/${encodeURIComponent(code)}`;
export const withVersion = (url: string, rowVersion: string) =>
  `${url}${url.includes('?') ? '&' : '?'}rowVersion=${encodeURIComponent(rowVersion)}`;

export interface ContainerGrade {
  containerGradeId?: string;
  gradeCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  isFoodGrade: boolean;
  isReleasable: boolean;
  /** 1–99, lower = better. */
  rankOrder: number;
  isActive: boolean;
  rowVersion?: string;
}

export interface ContainerCondition {
  containerConditionId?: string;
  conditionCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  /** 1–9, higher = worse. */
  severity: number;
  isServiceable: boolean;
  requiresRepair: boolean;
  /** Sets the CODECO DAM segment. */
  codecoDamageFlag: boolean;
  isActive: boolean;
  rowVersion?: string;
}

export interface Movement {
  movementId?: string;
  movementCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  fullEmpty: 'FULL' | 'EMPTY' | 'ANY';
  direction: 'IN' | 'OUT' | 'INTERNAL' | 'TRANSFER';
  appliesToModule: 'TOS' | 'CFS' | 'TRUCKING' | 'BOTH';
  codecoStatusCode: string | null;
  changesYardPosition: boolean;
  changesStatus: boolean;
  requiresSurvey: boolean;
  isActive: boolean;
  rowVersion?: string;
}

export interface ServiceType {
  serviceTypeId?: string;
  serviceCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  originForm: string;
  destinationForm: string;
  displayOrder: number;
  isActive: boolean;
  rowVersion?: string;
}

export interface TaxCode {
  taxCodeId?: string;
  taxCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  countryCode: string;
  taxType: string;
  ratePct: number;
  /** yyyy-mm-dd */
  effectiveFrom: string;
  effectiveTo: string | null;
  isDefaultForType: boolean;
  outputTaxGl: string | null;
  inputTaxGl: string | null;
  isActive: boolean;
  rowVersion?: string;
}

export interface CodeListCategory {
  categoryCode: string;
  descriptionEn: string;
  owningModule: string;
  /** false = closed: the platform branches on its values, a tenant cannot add one. */
  allowsTenantValues: boolean;
  valueCount: number;
}

export interface CodeListValue {
  categoryCode: string;
  code: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  isoCode: string | null;
  sortOrder: number;
  isActive: boolean;
  /** true = the tenant added it; false = a global value (possibly overridden). */
  isTenantDefined: boolean;
  /** The tenant's own row — null when the value is the global one untouched. */
  rowVersion: string | null;
}

export interface CodeMapping {
  codeMappingId?: string;
  mappingType: string;
  codeListCategory: string | null;
  partyId: string | null;
  partyCode: string | null;
  channel: string;
  direction: string;
  externalCode: string;
  internalCode: string;
  description: string | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  rowVersion?: string;
}

export const GRADES_PATH = '/api/master/container-grades';
export const CONDITIONS_PATH = '/api/master/container-conditions';
export const MOVEMENTS_PATH = '/api/master/movements';
export const SERVICE_TYPES_PATH = '/api/master/service-types';
export const TAX_CODES_PATH = '/api/master/tax-codes';
export const CODE_LISTS_PATH = '/api/master/code-lists';
export const CODE_MAPPINGS_PATH = '/api/master/code-mappings';

/** POST for a new row, PUT (with its rowVersion) for an existing one. */
export function saveByCode<T extends { rowVersion?: string }>(base: string, code: string, row: T, isNew: boolean) {
  return isNew ? apiSend<T>('POST', base, row) : apiSend<T>('PUT', codePath(base, code), row);
}

export const deleteByCode = (base: string, code: string, rowVersion: string) =>
  apiSend<void>('DELETE', withVersion(codePath(base, code), rowVersion));

export const saveCodeValue = (value: CodeListValue) =>
  apiSend<CodeListValue>('PUT', codePath(codePath(CODE_LISTS_PATH, value.categoryCode), value.code), value);
export const deleteCodeValue = (value: CodeListValue) =>
  apiSend<void>('DELETE', withVersion(codePath(codePath(CODE_LISTS_PATH, value.categoryCode), value.code), value.rowVersion!));

export const saveMapping = (m: CodeMapping) =>
  m.codeMappingId
    ? apiSend<CodeMapping>('PUT', `${CODE_MAPPINGS_PATH}/${m.codeMappingId}`, m)
    : apiSend<CodeMapping>('POST', CODE_MAPPINGS_PATH, m);
export const deleteMapping = (m: CodeMapping) =>
  apiSend<void>('DELETE', withVersion(`${CODE_MAPPINGS_PATH}/${m.codeMappingId}`, m.rowVersion!));

// Vocabularies — mirror the API's AllowedValues.
const opts = (values: string[], label?: (v: string) => string) => values.map(v => ({ value: v, label: label ? label(v) : v }));
export const FULL_EMPTY = opts(['FULL', 'EMPTY', 'ANY']);
export const DIRECTIONS = opts(['IN', 'OUT', 'INTERNAL', 'TRANSFER']);
export const MODULES = opts(['TOS', 'CFS', 'TRUCKING', 'BOTH']);
export const SERVICE_FORMS = opts(['CY', 'CFS', 'DOOR', 'RAMP', 'VESSEL', 'BREAKBULK']);
export const TAX_TYPES = opts(['VAT', 'GST', 'SST', 'SALES_TAX', 'WITHHOLDING', 'ZERO_RATED', 'EXEMPT']);
export const MAPPING_TYPES = opts(['CODE_LIST', 'CARGO_CLASS', 'PARTY', 'VESSEL', 'PORT', 'ORDER_TYPE', 'CHARGE_CODE', 'MOVEMENT', 'HOLD', 'REPAIR_CODE', 'DAMAGE_CODE', 'CONTAINER_CONDITION', 'EQUIPMENT_TYPE']);
export const CHANNELS = opts(['ANY', 'EDI_CODECO', 'EDI_COPARN', 'EDI_COARRI', 'EDI_BAPLIE', 'EDI_CUSCAR', 'API', 'EXCEL', 'LEGACY_VECTOR']);
export const MAPPING_DIRECTIONS = opts(['INBOUND', 'OUTBOUND', 'BOTH']);

// ── truck categories at the gate and the window ─────────────────────────────

export const TRUCK_CATEGORY_PATH = `${CODE_LISTS_PATH}/TRUCK_CATEGORY`;

/**
 * The truck sizes this tenant prices by. TRUCK_CATEGORY is a tariff axis, so
 * the value picked here decides what the move costs — it is not decoration.
 */
/**
 * The movement catalogue, which is the only place that says whether a movement
 * code goes IN or OUT and whether it is full or empty.
 *
 * A booking's own steps carry the movement CODE and nothing else, so anything
 * that needs the direction of a pending step — the gate's booking picker, for
 * one — joins to this rather than reading meaning into the string "FULL_OUT".
 */
/** The box conditions a clerk may put on an EIR — Vector's "Status". */
export function useConditions(): { conditions: ContainerCondition[]; loading: boolean } {
  const { data, loading } = useApi<{ items: ContainerCondition[] }>(`${CONDITIONS_PATH}?pageSize=200`);
  return { conditions: data?.items ?? NO_CONDITIONS, loading };
}

const NO_CONDITIONS: ContainerCondition[] = [];

export function useMovements(): { movements: Movement[]; loading: boolean } {
  const { data, loading } = useApi<{ items: Movement[] }>(`${MOVEMENTS_PATH}?pageSize=200`);
  return { movements: data?.items ?? NO_MOVEMENTS, loading };
}

const NO_MOVEMENTS: Movement[] = [];

export function useTruckCategories(): { categories: CodeListValue[]; loading: boolean } {
  const { data, loading } = useApi<CodeListValue[]>(TRUCK_CATEGORY_PATH);
  return { categories: data ?? NO_CODES, loading };
}

const NO_CODES: CodeListValue[] = [];

export interface ResolvedSetting {
  settingKey: string;
  value: string | null;
  valueType: string;
  resolvedFrom: string;
}

/**
 * One declared setting, already resolved for this branch. Used for
 * `gate.default_truck_category` — the depot's usual truck, which the gate and
 * the window both start from. The server applies the same default when the UI
 * sends nothing, so this only saves the clerk a click; it never invents a value.
 */
export function useSetting(settingKey: string): { value: string | null; loading: boolean } {
  const { data, loading } = useApi<ResolvedSetting[]>('/api/master/settings');
  const row = (data ?? []).find(s => s.settingKey === settingKey);
  return { value: row?.value ?? null, loading };
}

/** Any code list, by category — labels for a code the API hands back. */
export function useCodeList(categoryCode: string): { values: CodeListValue[]; loading: boolean } {
  const { data, loading } = useApi<CodeListValue[]>(`${CODE_LISTS_PATH}/${encodeURIComponent(categoryCode)}`);
  return { values: data ?? NO_CODES, loading };
}

/** The label a tenant gave a code, falling back to the code itself. */
export function codeLabel(values: CodeListValue[], code: string | null | undefined): string {
  if (!code) return '—';
  return values.find(v => v.code === code)?.descriptionEn || code;
}
