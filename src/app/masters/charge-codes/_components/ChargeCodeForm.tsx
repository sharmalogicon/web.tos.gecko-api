"use client";
import React from 'react';
import { Field } from '@/components/ui/FormGrid';
import type { ApiError } from '@/lib/api/problem';
import type { ChargeCode, CommercialVocabulary, SaveChargeCode } from '@/lib/api/charge-codes';

/**
 * The charge code's own fields, shared by "New charge code" and the detail page's
 * Edit. Every list comes from /api/master/vocabulary/commercial — the same values
 * the API validates against — so nothing here can offer a choice the save refuses.
 *
 * Deliberately absent (the old mock had them, nothing stores them): base rate,
 * min/max, VAT %, GL on the code, applicability matrix, usage. A price is
 * Revenue's; tax and GL live on each billing variant.
 */

export interface ChargeFormValue {
  chargeCode: string;
  descriptionEn: string;
  descriptionLocal: string;
  moduleCode: string;
  chargeType: string;
  chargeCategory: string;
  billingUnitCode: string;
  isByService: boolean;
  isActive: boolean;
}

export const EMPTY_CHARGE: ChargeFormValue = {
  chargeCode: '', descriptionEn: '', descriptionLocal: '', moduleCode: 'TOS', chargeType: '',
  chargeCategory: 'GENERAL', billingUnitCode: 'PER_CONTAINER', isByService: false, isActive: true,
};

export const formFromCharge = (c: ChargeCode): ChargeFormValue => ({
  chargeCode: c.chargeCode,
  descriptionEn: c.descriptionEn,
  descriptionLocal: c.descriptionLocal ?? '',
  moduleCode: c.moduleCode,
  chargeType: c.chargeType,
  chargeCategory: c.chargeCategory,
  billingUnitCode: c.billingUnitCode,
  isByService: c.isByService,
  isActive: c.isActive,
});

export const requestFromCharge = (f: ChargeFormValue, rowVersion?: string): SaveChargeCode => ({
  chargeCode: f.chargeCode.trim().toUpperCase(),
  descriptionEn: f.descriptionEn.trim(),
  descriptionLocal: f.descriptionLocal.trim() || null,
  moduleCode: f.moduleCode,
  chargeType: f.chargeType,
  chargeCategory: f.chargeCategory,
  billingUnitCode: f.billingUnitCode,
  isByService: f.isByService,
  isActive: f.isActive,
  rowVersion,
});

const CODE_SHAPE = /^[A-Z0-9][A-Z0-9._-]{0,14}$/;

/** The checks the API would make anyway, run first so the user is not sent round-trip for a typo. */
export function chargeErrors(f: ChargeFormValue): Record<string, string> {
  const e: Record<string, string> = {};
  if (!CODE_SHAPE.test(f.chargeCode.trim().toUpperCase()))
    e.chargeCode = "Upper-case letters, digits, '.', '_' and '-', up to 15 characters — e.g. S-002 or LIFTIN.";
  if (!f.descriptionEn.trim()) e.descriptionEn = 'Describe the charge as it should read on an invoice line.';
  if (!f.moduleCode) e.moduleCode = 'Pick the module that raises it.';
  if (!f.chargeType) e.chargeType = 'Pick a charge type.';
  if (!f.billingUnitCode) e.billingUnitCode = 'Pick what one unit of this charge is.';
  return e;
}

const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function ChargeCodeForm({ value, onChange, vocabulary, localErrors, apiError, mode }: {
  value: ChargeFormValue;
  onChange: (next: ChargeFormValue) => void;
  vocabulary: CommercialVocabulary;
  /** Shown once the user has tried to save. */
  localErrors: Record<string, string>;
  apiError: ApiError | null;
  mode: 'create' | 'edit';
}) {
  const err = (name: keyof ChargeFormValue) => localErrors[name] ?? apiError?.forField(name);
  const set = (patch: Partial<ChargeFormValue>) => onChange({ ...value, ...patch });
  const cls = (name: keyof ChargeFormValue, extra = '') => `gecko-input${extra}${err(name) ? ' gecko-input-error' : ''}`;

  return (
    <div className="gecko-form-grid gecko-form-grid-2">
      <Field label="Charge code" required error={err('chargeCode')}
        helper={mode === 'edit' ? 'The code cannot change — tariffs and invoices refer to it.' : 'As it appears on the invoice, e.g. S-002'}>
        <input className={cls('chargeCode', ' gecko-text-mono')} value={value.chargeCode} maxLength={15}
          disabled={mode === 'edit'} autoFocus={mode === 'create'}
          onChange={e => set({ chargeCode: e.target.value.toUpperCase() })} />
      </Field>
      <Field label="Module" required error={err('moduleCode')} helper="The part of the platform that raises this charge">
        <select className={`gecko-select${err('moduleCode') ? ' gecko-input-error' : ''}`} value={value.moduleCode}
          onChange={e => set({ moduleCode: e.target.value })}>
          <option value="">Choose…</option>
          {vocabulary.modules.map(m => <option key={m.code} value={m.code}>{m.code} — {m.name}</option>)}
        </select>
      </Field>

      <Field label="Description (English)" required full error={err('descriptionEn')}>
        <input className={cls('descriptionEn')} value={value.descriptionEn} maxLength={200}
          placeholder="e.g. In-yard lift service" onChange={e => set({ descriptionEn: e.target.value })} />
      </Field>
      <Field label="Description (Thai)" full error={err('descriptionLocal')} helper="Printed on Thai receipts when present">
        <input className={cls('descriptionLocal')} value={value.descriptionLocal} maxLength={200} lang="th"
          placeholder="เช่น ค่าบริการยกตู้ในลาน" onChange={e => set({ descriptionLocal: e.target.value })} />
      </Field>

      <Field label="Charge type" required error={err('chargeType')}>
        <select className={`gecko-select${err('chargeType') ? ' gecko-input-error' : ''}`} value={value.chargeType}
          onChange={e => set({ chargeType: e.target.value })}>
          <option value="">Choose…</option>
          {vocabulary.chargeTypes.map(t => <option key={t} value={t}>{label(t)}</option>)}
        </select>
      </Field>
      <Field label="Category" error={err('chargeCategory')} helper="Laden / empty / reefer … — how tariffs group it">
        <select className="gecko-select" value={value.chargeCategory} onChange={e => set({ chargeCategory: e.target.value })}>
          {vocabulary.chargeCategories.map(c => <option key={c} value={c}>{label(c)}</option>)}
        </select>
      </Field>

      <Field label="Billing unit" required error={err('billingUnitCode')} helper="What one unit of this charge is">
        <select className={`gecko-select${err('billingUnitCode') ? ' gecko-input-error' : ''}`} value={value.billingUnitCode}
          onChange={e => set({ billingUnitCode: e.target.value })}>
          <option value="">Choose…</option>
          {vocabulary.billingUnits.map(u => <option key={u.code} value={u.code}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="Priced per service type" helper="On = the tariff sets a different price for each service (CY-CY, CFS-CY …)">
        <label className="gecko-row gecko-mt-2">
          <input type="checkbox" className="gecko-checkbox" checked={value.isByService} onChange={e => set({ isByService: e.target.checked })} />
          <span>By service type</span>
        </label>
      </Field>
    </div>
  );
}
