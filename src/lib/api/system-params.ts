/**
 * Tenant settings and document number series — Gecko.MasterData
 * /api/master/settings and /api/master/number-series. Read: mdm.config.view;
 * change: mdm.config.manage.
 *
 * Settings are DECLARED by the platform (lookup.setting_definition): the list
 * always has every one, with the value in force and where it comes from
 * (DEFAULT → TENANT → BRANCH). Writing a scope sends that scope's rowVersion;
 * a null value clears the scope, so the next layer applies again.
 *
 * A number series that has issued numbers cannot change how it counts (reset,
 * date part, start number) — that would repeat numbers — and cannot be deleted.
 */
import { apiSend } from './client';

export type SettingValueType = 'BOOL' | 'INT' | 'DECIMAL' | 'STRING' | 'DATE' | 'JSON';

export interface TenantSetting {
  settingKey: string;
  /** The value in force for the branch asked about (or the tenant). */
  value: string | null;
  tenantValue: string | null;
  branchValue: string | null;
  defaultValue: string | null;
  valueType: SettingValueType;
  /** TENANT: one value for the whole tenant. BRANCH: may differ per depot. */
  allowedScope: 'TENANT' | 'BRANCH';
  owningModule: string;
  descriptionEn: string;
  resolvedFrom: 'DEFAULT' | 'TENANT' | 'BRANCH';
  tenantRowVersion: string | null;
  branchRowVersion: string | null;
}

export interface NumberSeries {
  numberSeriesId?: string;
  branchId: string | null;
  seriesKey: string;
  documentTypeCode: string | null;
  description: string | null;
  prefix: string | null;
  separator: string;
  includeBranchCode: boolean;
  datePartFormat: 'NONE' | 'YY' | 'YYYY' | 'YYMM' | 'YYYYMM';
  resetPeriod: 'NEVER' | 'YEARLY' | 'MONTHLY';
  numberLength: number;
  startNumber: number;
  isGapFreeRequired: boolean;
  isActive: boolean;
  rowVersion?: string;
  /** Numbers have been issued: how it counts is locked, delete is refused. */
  hasIssuedNumbers?: boolean;
}

export const SETTINGS_PATH = '/api/master/settings';
export const NUMBER_SERIES_PATH = '/api/master/number-series';

export const settingsPath = (branchId: string | null) =>
  branchId ? `${SETTINGS_PATH}?branchId=${encodeURIComponent(branchId)}` : SETTINGS_PATH;

export const saveSetting = (settingKey: string, settingValue: string | null, branchId: string | null, rowVersion: string | null) =>
  apiSend<TenantSetting>('PUT', SETTINGS_PATH, { settingKey, settingValue, branchId, rowVersion });

export const saveSeries = (s: NumberSeries) =>
  s.numberSeriesId
    ? apiSend<NumberSeries>('PUT', `${NUMBER_SERIES_PATH}/${s.numberSeriesId}`, s)
    : apiSend<NumberSeries>('POST', NUMBER_SERIES_PATH, s);
export const deleteSeries = (s: NumberSeries) =>
  apiSend<void>('DELETE', `${NUMBER_SERIES_PATH}/${s.numberSeriesId}?rowVersion=${encodeURIComponent(s.rowVersion!)}`);

/** What the next numbers look like, e.g. INV-202609-00001 (the proc formats the real one). */
export function previewNumber(s: NumberSeries, branchCode = 'KTC', today = new Date()): string {
  const yyyy = String(today.getFullYear());
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const date = { NONE: '', YY: yyyy.slice(2), YYYY: yyyy, YYMM: yyyy.slice(2) + mm, YYYYMM: yyyy + mm }[s.datePartFormat] ?? '';
  const number = String(Math.max(1, s.startNumber || 1)).padStart(s.numberLength || 1, '0');
  return [s.prefix, s.includeBranchCode ? branchCode : null, date, number].filter(Boolean).join(s.separator ?? '');
}

export const DATE_PARTS = ['NONE', 'YY', 'YYYY', 'YYMM', 'YYYYMM'].map(v => ({ value: v, label: v }));
export const RESET_PERIODS = ['NEVER', 'YEARLY', 'MONTHLY'].map(v => ({ value: v, label: v }));
