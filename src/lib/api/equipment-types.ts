/**
 * Container (equipment) types — Gecko.MasterData /api/master/equipment-types.
 *
 * The tenant's own vocabulary (KORAKIT says 20GP / 40HC, another depot 20DV /
 * 40HQ), each mapped to the global ISO 6346 codes it answers to; exactly one of
 * those is the default outbound code written back on EDI.
 *
 * Who may do what, tenant-wide: read mdm.equipment.view (also ACCOUNTS, which
 * prices per type); create/edit/delete mdm.equipment.manage (TENANT_OWNER,
 * OPS_MANAGER). Types are addressed by id. Every write names the rowVersion it
 * read; the ISO mapping is a whole-set replace that answers with the new one.
 */
import { apiSend } from './client';
import { useApi, type Paged } from './use-api';

export interface EquipmentType {
  equipmentTypeId: string;
  typeCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  lengthFt: number;
  heightClass: string;
  isoGroupCode: string;
  teu: number;
  isReefer: boolean;
  isOog: boolean;
  isTank: boolean;
  tareWeightKg: number | null;
  maxPayloadKg: number | null;
  maxGrossKg: number | null;
  displayColorHex: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  rowVersion: string;
}

export interface IsoMapping { isoCode: string; isDefaultOutbound: boolean; isoDescription: string | null }

export interface EquipmentTypeDetail { type: EquipmentType; isoCodes: IsoMapping[] }

/** Body of POST (typeCode set) and PUT (rowVersion + isActive set). */
export interface SaveEquipmentType {
  typeCode?: string;
  rowVersion?: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  lengthFt: number;
  heightClass: string;
  isoGroupCode: string;
  teu: number;
  isReefer: boolean;
  isOog: boolean;
  isTank: boolean;
  tareWeightKg: number | null;
  maxPayloadKg: number | null;
  maxGrossKg: number | null;
  displayColorHex: string | null;
  sortOrder: number;
  isActive?: boolean;
}

export interface IsoCode {
  isoCode: string;
  groupCode: string;
  lengthFt: number | null;
  heightMm: number | null;
  descriptionEn: string;
  supersededBy: string | null;
}

export interface EquipmentVocabulary {
  lengths: number[];
  heightClasses: string[];
  isoGroups: { code: string; name: string; isReefer: boolean; isOpenTop: boolean; isPlatform: boolean; isTank: boolean }[];
}

export const equipmentTypePath = (id: string) => `/api/master/equipment-types/${encodeURIComponent(id)}`;

export const useEquipmentVocabulary = () => useApi<EquipmentVocabulary>('/api/master/vocabulary/equipment');

/** Registry containers per type, counted by the database over the whole registry. */
export const useContainerCounts = () =>
  useApi<{ equipmentTypeId: string; containers: number }[]>('/api/master/equipment-types/container-counts');

/** ISO 6346 reference search for the picker (global, read-only). */
export const isoSearchPath = (search: string) =>
  `/api/master/iso-codes?${new URLSearchParams({ search, pageSize: '20' }).toString()}`;
export type IsoPage = Paged<IsoCode>;

export const createEquipmentType = (body: SaveEquipmentType) =>
  apiSend<EquipmentTypeDetail>('POST', '/api/master/equipment-types', body);

export const updateEquipmentType = (id: string, body: SaveEquipmentType) =>
  apiSend<EquipmentType>('PUT', equipmentTypePath(id), body);

export const replaceIsoCodes = (id: string, isoCodes: { isoCode: string; isDefaultOutbound: boolean }[], rowVersion: string) =>
  apiSend<EquipmentTypeDetail>('PUT', `${equipmentTypePath(id)}/iso-codes`, { isoCodes, rowVersion });

export const deleteEquipmentType = (id: string, rowVersion: string) =>
  apiSend<void>('DELETE', `${equipmentTypePath(id)}?rowVersion=${encodeURIComponent(rowVersion)}`);
