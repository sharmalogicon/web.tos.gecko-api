/**
 * Order types — Gecko.MasterData /api/master/order-types.
 *
 * An order type is what the depot is asked to do ('CUSOMER MTY', 'EXP CY/CY').
 * It expands into gate STEPS (a movement each, walked 1..n, with five gate rules
 * per step) and the CHARGES it raises (optionally pinned to one step).
 *
 * Who may do what (gecko_identity 14_mdm_permissions.sql), tenant-wide only:
 *   read               mdm.commercial.view
 *   create/edit/delete mdm.commercial.manage   (TENANT_OWNER, ACCOUNTS)
 *
 * Codes are human phrases with spaces and '/' — always build URLs with
 * orderTypePath(). Steps and charges are replaced as whole sets, each an edit of
 * the order type: send its rowVersion, get the order type back at the new one.
 */
import { apiSend } from './client';
import { useApi } from './use-api';

export interface OrderType {
  orderTypeId: string;
  orderTypeCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  directionCode: string;
  serviceTypeId: string | null;
  serviceCode: string | null;
  cargoClassCode: string;
  bookingTypeCode: string | null;
  isActive: boolean;
  rowVersion: string;
}

export interface OrderTypeStep {
  orderTypeMovementId: string;
  movementId: string;
  movementCode: string;
  movementDescription: string;
  sequenceNo: number;
  isRequired: boolean;
  isBillable: boolean;
  checkSealNo: boolean;
  checkGrossWeight: boolean;
  requireVesselVoyage: boolean;
  allowDamagedRelease: boolean;
  skipEdi: boolean;
  pudoMode: string | null;
}

export interface OrderTypeCharge {
  orderTypeChargeId: string;
  chargeCodeId: string;
  chargeCode: string;
  chargeDescription: string;
  movementId: string | null;
  movementCode: string | null;
  paymentTo: string;
  paymentTermCode: string | null;
  isDefault: boolean;
  isOptional: boolean;
  isCargoCharge: boolean;
  isValueAddedService: boolean;
  raiseAtGateIn: boolean;
  defaultQty: number | null;
}

export interface OrderTypeDetail {
  orderType: OrderType;
  movements: OrderTypeStep[];
  charges: OrderTypeCharge[];
}

export interface SaveOrderType {
  orderTypeCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  directionCode: string;
  cargoClassCode: string;
  serviceCode: string | null;
  bookingTypeCode: string | null;
  isActive: boolean;
  rowVersion?: string;
}

export interface SaveOrderTypeStep {
  movementCode: string;
  sequenceNo: number;
  isRequired: boolean;
  isBillable: boolean;
  checkSealNo: boolean;
  checkGrossWeight: boolean;
  requireVesselVoyage: boolean;
  allowDamagedRelease: boolean;
  skipEdi: boolean;
  pudoMode: string | null;
}

export interface SaveOrderTypeCharge {
  chargeCode: string;
  paymentTo: string;
  movementCode: string | null;
  paymentTermCode: string | null;
  isDefault: boolean;
  isOptional: boolean;
  isCargoCharge: boolean;
  isValueAddedService: boolean;
  raiseAtGateIn: boolean;
  defaultQty: number | null;
}

export interface CodeName { code: string; name: string; nameLocal: string | null }

export interface OrderTypeVocabulary {
  directions: CodeName[];
  cargoClasses: CodeName[];
  bookingTypes: CodeName[];
  serviceTypes: CodeName[];
  pudoModes: CodeName[];
  movements: { code: string; name: string; direction: string; fullEmpty: string }[];
  chargeCodes: { code: string; name: string; moduleCode: string }[];
}

export const orderTypePath = (code: string) => `/api/master/order-types/${encodeURIComponent(code)}`;

export const useOrderTypeVocabulary = () => useApi<OrderTypeVocabulary>('/api/master/vocabulary/order-types');

export const createOrderType = (body: SaveOrderType) =>
  apiSend<OrderTypeDetail>('POST', '/api/master/order-types', body);

export const updateOrderType = (code: string, body: SaveOrderType) =>
  apiSend<OrderType>('PUT', orderTypePath(code), body);

export const replaceSteps = (code: string, movements: SaveOrderTypeStep[], rowVersion: string) =>
  apiSend<OrderTypeDetail>('PUT', `${orderTypePath(code)}/movements`, { movements, rowVersion });

export const replaceCharges = (code: string, charges: SaveOrderTypeCharge[], rowVersion: string) =>
  apiSend<OrderTypeDetail>('PUT', `${orderTypePath(code)}/charges`, { charges, rowVersion });

export const deleteOrderType = (code: string, rowVersion: string) =>
  apiSend<void>('DELETE', `${orderTypePath(code)}?rowVersion=${encodeURIComponent(rowVersion)}`);
