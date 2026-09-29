/**
 * Yards — Gecko.MasterData /api/master/yards.
 *
 *   list   GET /yards?branchId=&activeOnly=false   every signed-in user (the TOS header needs it)
 *   edit   PUT /yards/{yardId}                     mdm.org.manage AT the yard's branch (or tenant-wide)
 *
 * No create or delete: gate transactions and visits in gecko_tos point at the
 * yard. The code is fixed. Blocks / rows / slots are not edited here — KORAKIT
 * locates boxes at yard level.
 */
import { apiSend } from './client';

export interface Yard {
  yardId: string;
  yardCode: string;
  nameEn: string;
  nameLocal: string | null;
  yardType: string;
  fullEmpty: 'FULL' | 'EMPTY' | 'BOTH';
  /** lookup.direction_type; null = any. */
  directionCode: string | null;
  capacityTeu: number | null;
  isActive: boolean;
  /** Base64 ROWVERSION; send it back on PUT. */
  rowVersion: string;
}

export interface SaveYardRequest {
  nameEn: string;
  nameLocal: string | null;
  yardType: string;
  fullEmpty: string;
  directionCode: string | null;
  capacityTeu: number | null;
  rowVersion: string;
}

export const yardsPath = (branchId: string) => `/api/master/yards?branchId=${encodeURIComponent(branchId)}&activeOnly=false&pageSize=200`;

export const updateYard = (y: Yard) =>
  apiSend<Yard>('PUT', `/api/master/yards/${y.yardId}`, {
    nameEn: y.nameEn.trim(), nameLocal: y.nameLocal?.trim() || null, yardType: y.yardType, fullEmpty: y.fullEmpty,
    directionCode: y.directionCode || null, capacityTeu: y.capacityTeu, rowVersion: y.rowVersion,
  } satisfies SaveYardRequest);

/** Mirror the API's AllowedValues (org.yard ck_yard__type / ck_yard__full_empty). */
export const YARD_TYPES = ['CY', 'EMPTY', 'EXPORT', 'IMPORT', 'CFS', 'REEFER', 'DG', 'MNR', 'MIXED'].map(v => ({ value: v, label: v }));
export const YARD_FULL_EMPTY = [
  { value: 'BOTH', label: 'Full and empty' }, { value: 'FULL', label: 'Full only' }, { value: 'EMPTY', label: 'Empty only' },
];
/** lookup.direction_type — a global list; the API rejects anything else. */
export const YARD_DIRECTIONS = [
  { value: 'IMPORT', label: 'Import' }, { value: 'EXPORT', label: 'Export' }, { value: 'TRANSHIPMENT', label: 'Transhipment' },
  { value: 'DOMESTIC', label: 'Domestic' }, { value: 'INTRA_TERMINAL', label: 'Intra-terminal' },
];
