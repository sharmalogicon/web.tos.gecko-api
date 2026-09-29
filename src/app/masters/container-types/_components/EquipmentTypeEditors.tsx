"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Field, FormGrid } from '@/components/ui/FormGrid';
import { useApi } from '@/lib/api/use-api';
import type { ApiError } from '@/lib/api/problem';
import {
  isoSearchPath, type EquipmentType, type EquipmentVocabulary, type IsoMapping, type IsoPage, type SaveEquipmentType,
} from '@/lib/api/equipment-types';

/**
 * The container type's own fields, and its ISO 6346 mapping — shared by New and
 * the detail page. Lengths, height classes and ISO groups come from
 * /api/master/vocabulary/equipment; ISO codes from the global reference.
 *
 * Deliberately absent (the old mock had them, nothing stores them): cube,
 * door size, stack limit, slot size, a tariff row. Weights are optional —
 * Vector never recorded tare or max gross, so blank is the honest default.
 */

export interface TypeFormValue {
  typeCode: string;
  descriptionEn: string;
  descriptionLocal: string;
  lengthFt: string;
  heightClass: string;
  isoGroupCode: string;
  teu: string;
  isReefer: boolean;
  isOog: boolean;
  isTank: boolean;
  tareWeightKg: string;
  maxPayloadKg: string;
  maxGrossKg: string;
  sortOrder: string;
  isActive: boolean;
}

export const EMPTY_TYPE: TypeFormValue = {
  typeCode: '', descriptionEn: '', descriptionLocal: '', lengthFt: '20', heightClass: 'STANDARD', isoGroupCode: 'GP', teu: '1',
  isReefer: false, isOog: false, isTank: false, tareWeightKg: '', maxPayloadKg: '', maxGrossKg: '', sortOrder: '100', isActive: true,
};

const str = (n: number | null) => (n === null ? '' : String(n));
const num = (s: string) => (s.trim() ? Number(s) : null);

export const formFromType = (t: EquipmentType): TypeFormValue => ({
  typeCode: t.typeCode, descriptionEn: t.descriptionEn, descriptionLocal: t.descriptionLocal ?? '',
  lengthFt: String(t.lengthFt), heightClass: t.heightClass, isoGroupCode: t.isoGroupCode, teu: String(t.teu),
  isReefer: t.isReefer, isOog: t.isOog, isTank: t.isTank,
  tareWeightKg: str(t.tareWeightKg), maxPayloadKg: str(t.maxPayloadKg), maxGrossKg: str(t.maxGrossKg),
  sortOrder: String(t.sortOrder), isActive: t.isActive,
});

export const requestFromType = (f: TypeFormValue, edit?: { rowVersion: string; displayColorHex: string | null }): SaveEquipmentType => ({
  ...(edit ? { rowVersion: edit.rowVersion, isActive: f.isActive } : { typeCode: f.typeCode.trim().toUpperCase() }),
  descriptionEn: f.descriptionEn.trim(),
  descriptionLocal: f.descriptionLocal.trim() || null,
  lengthFt: Number(f.lengthFt),
  heightClass: f.heightClass,
  isoGroupCode: f.isoGroupCode,
  teu: Number(f.teu),
  isReefer: f.isReefer, isOog: f.isOog, isTank: f.isTank,
  tareWeightKg: num(f.tareWeightKg), maxPayloadKg: num(f.maxPayloadKg), maxGrossKg: num(f.maxGrossKg),
  displayColorHex: edit?.displayColorHex ?? null,
  sortOrder: Number(f.sortOrder) || 100,
});

export function typeErrors(f: TypeFormValue): Record<string, string> {
  const e: Record<string, string> = {};
  if (!/^[A-Z0-9][A-Z0-9-]{0,9}$/.test(f.typeCode.trim().toUpperCase())) e.typeCode = "Upper-case letters, digits and '-', 1–10 characters — e.g. 20GP.";
  if (!f.descriptionEn.trim()) e.descriptionEn = 'Describe the type, e.g. 20ft dry general purpose.';
  const teu = Number(f.teu);
  if (!(teu >= 0.25 && teu <= 4)) e.teu = 'Between 0.25 and 4.';
  const tare = num(f.tareWeightKg), gross = num(f.maxGrossKg);
  if (tare !== null && gross !== null && tare >= gross) e.maxGrossKg = 'Max gross must be more than the tare.';
  return e;
}

export function EquipmentTypeForm({ value, onChange, vocabulary, localErrors, apiError, mode }: {
  value: TypeFormValue;
  onChange: (next: TypeFormValue) => void;
  vocabulary: EquipmentVocabulary;
  localErrors: Record<string, string>;
  apiError: ApiError | null;
  mode: 'create' | 'edit';
}) {
  const err = (name: keyof TypeFormValue) => localErrors[name] ?? apiError?.forField(name);
  const set = (patch: Partial<TypeFormValue>) => onChange({ ...value, ...patch });
  const cls = (name: keyof TypeFormValue, base = 'gecko-input') => `${base}${err(name) ? ' gecko-input-error' : ''}`;
  const text = (name: keyof TypeFormValue, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input className={cls(name, props.className ?? 'gecko-input')} value={value[name] as string}
      {...props} onChange={e => set({ [name]: e.target.value } as Partial<TypeFormValue>)} />
  );
  const flag = (name: 'isReefer' | 'isOog' | 'isTank', label: string) => (
    <label className="gecko-row">
      <input type="checkbox" className="gecko-checkbox" checked={value[name]} onChange={e => set({ [name]: e.target.checked })} />
      <span>{label}</span>
    </label>
  );
  // Picking a group presets what it implies (RT/RS reefer, TN tank, PL/PF platform = out-of-gauge capable).
  const pickGroup = (code: string) => {
    const g = vocabulary.isoGroups.find(x => x.code === code);
    set({ isoGroupCode: code, ...(g ? { isReefer: g.isReefer, isTank: g.isTank } : {}) });
  };

  return (
    <FormGrid columns={3}>
      <Field label="Type code" required error={err('typeCode')}
        helper={mode === 'edit' ? 'The code cannot change — boxes and tariffs refer to it.' : 'Your own code, e.g. 20GP or 40HC'}>
        {text('typeCode', { className: 'gecko-input gecko-text-mono', maxLength: 10, disabled: mode === 'edit', autoFocus: mode === 'create' })}
      </Field>
      <Field label="Description (English)" required span2 error={err('descriptionEn')}>
        {text('descriptionEn', { maxLength: 200, placeholder: 'e.g. 40ft high cube dry' })}
      </Field>
      <Field label="Description (Thai)" full error={err('descriptionLocal')}>{text('descriptionLocal', { maxLength: 200, lang: 'th' })}</Field>

      <Field label="Length (ft)" required error={err('lengthFt')}>
        <select className={cls('lengthFt', 'gecko-select')} value={value.lengthFt} onChange={e => set({ lengthFt: e.target.value })}>
          {vocabulary.lengths.map(l => <option key={l} value={l}>{l}&apos;</option>)}
        </select>
      </Field>
      <Field label="Height" required error={err('heightClass')}>
        <select className={cls('heightClass', 'gecko-select')} value={value.heightClass} onChange={e => set({ heightClass: e.target.value })}>
          {vocabulary.heightClasses.map(h => <option key={h} value={h}>{h === 'HIGH_CUBE' ? "High cube (9'6\")" : h === 'STANDARD' ? "Standard (8'6\")" : 'Half height'}</option>)}
        </select>
      </Field>
      <Field label="TEU" required error={err('teu')} helper="1 for 20', 2 for 40' and 45'">
        {text('teu', { inputMode: 'decimal', maxLength: 5 })}
      </Field>

      <Field label="ISO type group" required error={err('isoGroupCode')}>
        <select className={cls('isoGroupCode', 'gecko-select')} value={value.isoGroupCode} onChange={e => pickGroup(e.target.value)}>
          {vocabulary.isoGroups.map(g => <option key={g.code} value={g.code}>{g.code} — {g.name}</option>)}
        </select>
      </Field>
      <Field label="Handling" span2>
        <div className="gecko-row gecko-row-wrap gecko-mt-2">
          {flag('isReefer', 'Reefer (needs power)')}
          {flag('isTank', 'Tank')}
          {flag('isOog', 'Out of gauge')}
        </div>
      </Field>

      <Field label="Tare (kg)" error={err('tareWeightKg')} helper="Blank if not known">{text('tareWeightKg', { inputMode: 'decimal' })}</Field>
      <Field label="Max payload (kg)" error={err('maxPayloadKg')}>{text('maxPayloadKg', { inputMode: 'decimal' })}</Field>
      <Field label="Max gross (kg)" error={err('maxGrossKg')}>{text('maxGrossKg', { inputMode: 'decimal' })}</Field>
      <Field label="Sort order" error={err('sortOrder')} helper="Lower comes first in pickers">{text('sortOrder', { inputMode: 'numeric', maxLength: 4 })}</Field>
    </FormGrid>
  );
}

// ── ISO 6346 mapping ─────────────────────────────────────────────────────────

export interface IsoRow { isoCode: string; isDefaultOutbound: boolean; description: string | null }

export const rowsFromIso = (m: IsoMapping[]): IsoRow[] =>
  m.map(x => ({ isoCode: x.isoCode, isDefaultOutbound: x.isDefaultOutbound, description: x.isoDescription }));

export function isoErrors(rows: IsoRow[]): Record<string, string> {
  if (rows.length === 0) return { isoCodes: 'Map at least one ISO code — inbound EDI resolves boxes through it.' };
  return rows.filter(r => r.isDefaultOutbound).length === 1 ? {} : { isoCodes: 'Mark exactly one code as the default written on outbound EDI.' };
}

/** Search the ISO 6346 reference, add codes, pick the one default outbound. */
export function IsoCodesEditor({ rows, onChange, localErrors, apiError }: {
  rows: IsoRow[];
  onChange: (rows: IsoRow[]) => void;
  localErrors: Record<string, string>;
  apiError: ApiError | null;
}) {
  const [search, setSearch] = useState('');
  const term = search.trim().toUpperCase();
  const { data: found } = useApi<IsoPage>(term.length >= 2 ? isoSearchPath(term) : null);
  const err = (key: string) => localErrors[key] ?? apiError?.forField(key);
  const add = (code: string, description: string) => {
    if (rows.some(r => r.isoCode === code)) return;
    onChange([...rows, { isoCode: code, isDefaultOutbound: rows.length === 0, description }]);
    setSearch('');
  };
  const matches = term.length >= 2 ? (found?.items ?? []).filter(i => !rows.some(r => r.isoCode === i.isoCode)) : [];

  return (
    <div className="gecko-stack gecko-stack-sm">
      {err('isoCodes') && <div className="gecko-field-error">{err('isoCodes')}</div>}
      {apiError?.status === 409 && <div className="gecko-field-error">{apiError.title} {apiError.detail}</div>}
      <div className="gecko-table-card">
        <table className="gecko-table">
          <thead><tr><th>ISO code</th><th>Meaning</th><th title="The code written back on outbound EDI">Default outbound</th><th aria-label="Remove" /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="gecko-cell-meta">No ISO codes mapped — search below to add one.</td></tr>}
            {rows.map((r, i) => (
              <React.Fragment key={r.isoCode}>
                <tr>
                  <td className="gecko-text-mono">{r.isoCode}</td>
                  <td>{r.description ?? '—'}</td>
                  <td>
                    <input type="radio" name="default-outbound" aria-label={`Default outbound ${r.isoCode}`} checked={r.isDefaultOutbound}
                      onChange={() => onChange(rows.map(x => ({ ...x, isDefaultOutbound: x.isoCode === r.isoCode })))} />
                  </td>
                  <td>
                    <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" aria-label={`Remove ${r.isoCode}`}
                      onClick={() => onChange(rows.filter(x => x.isoCode !== r.isoCode))}><Icon name="trash" size={14} /></button>
                  </td>
                </tr>
                {err(`isoCodes[${i}].isoCode`) && <tr><td colSpan={4} className="gecko-field-error">{r.isoCode}: {err(`isoCodes[${i}].isoCode`)}</td></tr>}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="gecko-stack gecko-stack-xs">
        <input className="gecko-input gecko-text-mono" aria-label="Search ISO 6346 codes" placeholder="Search ISO codes, e.g. 22G1 or 45R…"
          value={search} maxLength={4} onChange={e => setSearch(e.target.value)} />
        {matches.length > 0 && (
          <div className="gecko-table-card">
            <table className="gecko-table">
              <tbody>
                {matches.map(m => (
                  <tr key={m.isoCode}>
                    <td className="gecko-text-mono">{m.isoCode}</td>
                    <td>{m.descriptionEn}{m.supersededBy && <span className="gecko-cell-meta"> · 1984 code, now {m.supersededBy}</span>}</td>
                    <td>
                      <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => add(m.isoCode, m.descriptionEn)}>
                        <Icon name="plus" size={14} /> Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
