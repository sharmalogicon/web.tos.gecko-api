/**
 * Tier 2 logistics masters — Gecko.MasterData /api/master/ports, /vessels,
 * /commodities, /locations. Read: mdm.logistics.view; change:
 * mdm.logistics.manage. Every row carries a Base64 rowVersion for PUT / DELETE.
 * KORAKIT starts with none of these: the tenant adds what it needs.
 */
import { apiSend } from './client';
import { codePath, withVersion } from './lookups';

export interface Port {
  portId?: string;
  portCode: string;
  unLocode: string | null;
  portNameEn: string;
  portNameLocal: string | null;
  portType: string;
  countryCode: string;
  tradeMode: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  postcode: string | null;
  ediMappingCode: string | null;
  paperlessCode: string | null;
  isActive: boolean;
  rowVersion?: string;
}

export const PORTS_PATH = '/api/master/ports';

/** POST for a new row, PUT (with its rowVersion) for an existing one. */
export function saveCoded<T>(base: string, code: string, row: T, isNew: boolean) {
  return isNew ? apiSend<T>('POST', base, row) : apiSend<T>('PUT', codePath(base, code), row);
}
export const deleteCoded = (base: string, code: string, rowVersion: string) =>
  apiSend<void>('DELETE', withVersion(codePath(base, code), rowVersion));

const opts = (values: string[]) => values.map(v => ({ value: v, label: v.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) }));
export const PORT_TYPES = opts(['SEAPORT', 'RIVER_PORT', 'DRY_PORT', 'ICD', 'AIRPORT', 'RAIL_TERMINAL', 'BORDER', 'OTHER']);
export const TRADE_MODES = opts(['INTERNATIONAL', 'DOMESTIC', 'BOTH']);

export interface Vessel {
  vesselId?: string;
  vesselCode: string;
  vesselName: string;
  vesselNameLocal: string | null;
  /** 7 digits with a check digit; a new or changed one is checked. */
  imoNumber: string | null;
  callSign: string | null;
  /** 9 digits. */
  mmsi: string | null;
  vesselType: string | null;
  /** A party holding the SHIPPING_LINE role. */
  operatorPartyCode: string | null;
  operatorName?: string | null;
  flagCountryCode: string | null;
  teuCapacity: number | null;
  grossTonnage: number | null;
  loaM: number | null;
  isActive: boolean;
  updatedAt?: string;
  rowVersion?: string;
}

export const VESSELS_PATH = '/api/master/vessels';
export const vesselPath = (code: string) => codePath(VESSELS_PATH, code);
export const VESSEL_TYPES = opts(['CONTAINER', 'FEEDER', 'BARGE', 'RORO', 'GENERAL_CARGO', 'BULK', 'TANKER', 'OTHER']);

/** Client mirror of the API's IMO check digit, for instant feedback. */
export function imoCheckDigitOk(imo: string): boolean {
  if (!/^\d{7}$/.test(imo)) return false;
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += Number(imo[i]) * (7 - i);
  return sum % 10 === Number(imo[6]);
}

export interface Commodity {
  commodityId?: string;
  commodityCode: string;
  /** 6, 8 or 10 digits. */
  hsCode: string | null;
  descriptionEn: string;
  descriptionLocal: string | null;
  isDangerous: boolean;
  /** lookup.imdg_class — only on a dangerous commodity. */
  imdgClassCode: string | null;
  unNumber: string | null;
  packingGroup: string | null;
  isTemperatureControlled: boolean;
  defaultMinTempC: number | null;
  defaultMaxTempC: number | null;
  isActive: boolean;
  rowVersion?: string;
}
export const COMMODITIES_PATH = '/api/master/commodities';
export const IMDG_CLASSES = ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '2.1', '2.2', '2.3', '3', '4.1', '4.2', '4.3', '5.1', '5.2', '6.1', '6.2', '7', '8', '9']
  .map(v => ({ value: v, label: `Class ${v}` }));
export const PACKING_GROUPS = ['I', 'II', 'III'].map(v => ({ value: v, label: v }));

export interface Location {
  locationId?: string;
  locationCode: string;
  locationNameEn: string;
  locationNameLocal: string | null;
  locationType: string;
  areaCode: string | null;
  /** Whose premises — any party. */
  partyCode: string | null;
  partyName?: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  rowVersion?: string;
}
export const LOCATIONS_PATH = '/api/master/locations';
export const LOCATION_TYPES = opts(['FACTORY', 'WAREHOUSE', 'INDUSTRIAL_ESTATE', 'CFS', 'DEPOT', 'PORT_AREA', 'TERMINAL', 'CUSTOMS', 'OTHER']);

/** A line's seal numbers held at one depot. Read: mdm.party.view; change: mdm.party.manage AT that depot. */
export interface SealRange {
  sealRangeId?: string;
  branchId: string;
  partyCode: string;
  partyName?: string;
  sealPrefix: string;
  seriesStart: number;
  seriesEnd: number;
  numberLength: number | null;
  lastIssuedNumber: number | null;
  remaining?: number;
  receivedOn: string | null;
  isActive: boolean;
  rowVersion?: string;
}
export const SEAL_RANGES_PATH = '/api/master/seal-ranges';

/** ISO 3166 — global, read-only. */
export interface Country {
  countryCode: string;
  iso3Code: string;
  numericCode: string;
  nameEn: string;
  officialNameEn: string | null;
  nameLocal: string | null;
  defaultCurrency: string | null;
  isActive: boolean;
}
export const COUNTRIES_PATH = '/api/master/countries';

/** branchId null = every depot (needs mdm.org.manage tenant-wide); a depot's own needs it at that depot. */
export interface PublicHoliday {
  publicHolidayId?: string;
  branchId: string | null;
  /** yyyy-mm-dd */
  holidayDate: string;
  nameEn: string;
  nameLocal: string | null;
  isHalfDay: boolean;
  rowVersion?: string;
}
export const HOLIDAYS_PATH = '/api/master/public-holidays';

/** POST for a new row, PUT to /{id} for an existing one — the masters addressed by id. */
export function saveById<T>(base: string, id: string | undefined, row: T) {
  return id ? apiSend<T>('PUT', `${base}/${id}`, row) : apiSend<T>('POST', base, row);
}
export const deleteById = (base: string, id: string, rowVersion: string) =>
  apiSend<void>('DELETE', withVersion(`${base}/${id}`, rowVersion));
