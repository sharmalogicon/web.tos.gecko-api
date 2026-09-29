/**
 * Charge codes — Gecko.MasterData /api/master/charge-codes.
 *
 * A charge code is the billable VOCABULARY (what is chargeable, per what unit, to
 * whom, on what terms, with which tax). It is never a price: the number lives in a
 * tariff in Revenue.
 *
 * Who may do what (gecko_identity 14_mdm_permissions.sql), tenant-wide only:
 *   read              mdm.commercial.view
 *   create/edit/delete mdm.commercial.manage   (TENANT_OWNER, ACCOUNTS)
 *
 * Concurrency: every write names the rowVersion it was read at. PUT and DELETE
 * carry the charge code's own; replacing the variants is an edit of the charge
 * code, so it carries that too and answers with the NEW one. A stale version is
 * 409 — show "someone else changed this" and reload, never overwrite.
 */
import { apiSend } from './client';
import { useApi } from './use-api';

export interface ChargeCode {
  chargeCodeId: string;
  chargeCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  moduleCode: string;
  chargeType: string;
  chargeCategory: string;
  billingUnitCode: string;
  isByService: boolean;
  isActive: boolean;
  rowVersion: string;
}

export interface ChargeVariant {
  chargeCodeVariantId: string;
  billTo: string;
  paymentTermCode: string;
  taxCodeId: string | null;
  taxCode: string | null;
  withholdingTaxCodeId: string | null;
  withholdingTaxCode: string | null;
  creditTermDays: number | null;
  revenueGl: string | null;
  costGl: string | null;
  legacyChargeCode: string | null;
  isActive: boolean;
}

export interface ChargeCodeDetail {
  charge: ChargeCode;
  variants: ChargeVariant[];
}

export interface SaveChargeCode {
  chargeCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  moduleCode: string;
  chargeType: string;
  chargeCategory: string;
  billingUnitCode: string;
  isByService: boolean;
  isActive: boolean;
  rowVersion?: string;
}

/** One row of the billing matrix as the API takes it. Codes, not ids. */
export interface SaveChargeVariant {
  billTo: string;
  paymentTermCode: string;
  taxCode: string | null;
  withholdingTaxCode: string | null;
  creditTermDays: number | null;
  revenueGl: string | null;
  costGl: string | null;
  legacyChargeCode: string | null;
}

export interface VocabularyItem { code: string; name: string; nameLocal: string | null }
export interface TaxCodeItem { code: string; name: string; taxType: string; ratePct: number }

export interface CommercialVocabulary {
  modules: VocabularyItem[];
  chargeTypes: string[];
  chargeCategories: string[];
  billingUnits: VocabularyItem[];
  billToRoles: VocabularyItem[];
  paymentTerms: VocabularyItem[];
  taxCodes: TaxCodeItem[];
}

/** Charge codes are [A-Z0-9._-] — no '/', but encode anyway so a URL is never hand-built. */
export const chargeCodePath = (code: string) => `/api/master/charge-codes/${encodeURIComponent(code)}`;

export const useCommercialVocabulary = () => useApi<CommercialVocabulary>('/api/master/vocabulary/commercial');

export const createChargeCode = (body: SaveChargeCode) =>
  apiSend<ChargeCodeDetail>('POST', '/api/master/charge-codes', body);

export const updateChargeCode = (code: string, body: SaveChargeCode) =>
  apiSend<ChargeCode>('PUT', chargeCodePath(code), body);

/** Replaces the whole matrix. Answers with the charge code at its new rowVersion. */
export const replaceVariants = (code: string, variants: SaveChargeVariant[], rowVersion: string) =>
  apiSend<ChargeCodeDetail>('PUT', `${chargeCodePath(code)}/variants`, { variants, rowVersion });

export const deleteChargeCode = (code: string, rowVersion: string) =>
  apiSend<void>('DELETE', `${chargeCodePath(code)}?rowVersion=${encodeURIComponent(rowVersion)}`);
