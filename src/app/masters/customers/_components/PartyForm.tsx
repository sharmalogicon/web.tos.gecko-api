"use client";
import React from 'react';
import { ApiError } from '@/lib/api/problem';
import { PARTY_ROLES, isThaiTaxId, type PartyDetail, type PartyRole, type SavePartyRequest } from '@/lib/api/parties';

/** The editable fields, as strings — what the inputs hold. */
export interface PartyFormValue {
  nameEn: string;
  nameLocal: string;
  shortName: string;
  taxId: string;
  branchNo: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  email: string;
  website: string;
  registrationNo: string;
  /** '' = let the API choose (the company's currency) on create; unchanged on edit. */
  defaultCurrency: string;
  remarks: string;
  roles: PartyRole[];
  isActive: boolean;
}

export const EMPTY_PARTY: PartyFormValue = {
  nameEn: '', nameLocal: '', shortName: '', taxId: '', branchNo: '00000',
  address: '', address2: '', city: '', state: '', postcode: '', phone: '', email: '',
  website: '', registrationNo: '', defaultCurrency: '', remarks: '',
  roles: ['CUSTOMER'], isActive: true,
};

export function formFromParty(p: PartyDetail): PartyFormValue {
  return {
    nameEn: p.nameEn, nameLocal: p.nameLocal ?? '', shortName: p.shortName ?? '',
    taxId: p.taxId ?? '', branchNo: p.branchNo ?? '',
    address: p.address ?? '', address2: p.address2 ?? '', city: p.city ?? '', state: p.state ?? '',
    postcode: p.postcode ?? '', phone: p.phone ?? '', email: p.email ?? '',
    website: p.website ?? '', registrationNo: p.registrationNo ?? '', defaultCurrency: p.defaultCurrency ?? '',
    remarks: p.remarks ?? '',
    roles: p.roles, isActive: p.isActive,
  };
}

/**
 * Empty inputs are sent as '' so a PUT really clears the optional extras — except
 * the currency: an empty one is not sent (the API defaults it on create and keeps
 * it on edit), because a customer without a currency cannot be invoiced.
 */
export function requestFromForm(f: PartyFormValue, rowVersion?: string): SavePartyRequest {
  return {
    nameEn: f.nameEn.trim(),
    nameLocal: f.nameLocal.trim(),
    shortName: f.shortName.trim(),
    taxId: f.taxId.trim(),
    branchNo: f.branchNo.trim(),
    address: f.address.trim(),
    address2: f.address2.trim(),
    city: f.city.trim(),
    state: f.state.trim(),
    postcode: f.postcode.trim(),
    phone: f.phone.trim(),
    email: f.email.trim(),
    website: f.website.trim(),
    registrationNo: f.registrationNo.trim(),
    remarks: f.remarks.trim(),
    defaultCurrency: f.defaultCurrency.trim() ? f.defaultCurrency.trim().toUpperCase() : undefined,
    roles: f.roles,
    isActive: f.isActive,
    rowVersion,
  };
}

/**
 * Client-side checks that mirror the API; the API stays the authority. On edit,
 * pass the stored values: like the API, only a CHANGED tax id / branch is
 * format-checked, so a migrated legacy value does not block an unrelated edit.
 */
export function localErrors(f: PartyFormValue, original?: PartyFormValue | null): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.nameEn.trim()) errors.nameEn = 'The English name is required.';
  const tax = f.taxId.trim();
  if (tax && tax !== original?.taxId && !isThaiTaxId(tax)) errors.taxId = 'A Thai tax id is exactly 13 digits.';
  const branch = f.branchNo.trim();
  if (branch && branch !== original?.branchNo && !/^\d{1,10}$/.test(branch)) errors.branchNo = 'Digits only — 00000 is the head office.';
  const email = f.email.trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Not an e-mail address.';
  const currency = f.defaultCurrency.trim();
  if (currency && !/^[A-Za-z]{3}$/.test(currency)) errors.defaultCurrency = 'A 3-letter currency code, e.g. THB.';
  if (f.remarks.trim().length > 1000) errors.remarks = 'At most 1,000 characters.';
  if (f.roles.length === 0) errors.roles = 'Pick at least one role.';
  return errors;
}

function Field({ label, required, hint, error, children, span }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode; span?: number;
}) {
  return (
    <div style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
      {error
        ? <div style={{ marginTop: 3, fontSize: 11, color: 'var(--gecko-error-600)' }}>{error}</div>
        : hint ? <div className="gecko-cell-meta" style={{ marginTop: 3, fontSize: 11 }}>{hint}</div> : null}
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)', marginBottom: 12 }}>
      {children}
    </div>
  );
}

/**
 * The customer form, shared by "New customer" and the detail page's Edit mode.
 * `showErrors` switches on the local checks after the first submit attempt;
 * `apiError` carries the server's field errors (400) on top.
 */
export function PartyForm({ value, original, onChange, showErrors, apiError, mode }: {
  value: PartyFormValue;
  /** The stored values, on edit. */
  original?: PartyFormValue | null;
  onChange: (next: PartyFormValue) => void;
  showErrors: boolean;
  apiError: ApiError | null;
  mode: 'create' | 'edit';
}) {
  const local = showErrors ? localErrors(value, original) : {};
  const err = (name: string) => local[name] ?? apiError?.forField(name);
  const set = (patch: Partial<PartyFormValue>) => onChange({ ...value, ...patch });
  const input = (name: keyof PartyFormValue, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      className={`gecko-input${err(name) ? ' gecko-input-error' : ''}`}
      value={value[name] as string}
      onChange={e => set({ [name]: e.target.value } as Partial<PartyFormValue>)}
      {...props}
    />
  );
  const toggleRole = (role: PartyRole) =>
    set({ roles: value.roles.includes(role) ? value.roles.filter(r => r !== role) : [...value.roles, role] });

  return (
    <div className="gecko-stack gecko-stack-xl">
      <div>
        <SectionHead>Identity</SectionHead>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <Field label="Name (English)" required error={err('nameEn')} span={2}>
            {input('nameEn', { placeholder: 'e.g. Thai Agro Export Co., Ltd.', maxLength: 255, autoFocus: mode === 'create' })}
          </Field>
          <Field label="Name (Thai)" hint="Legal name as printed on the tax invoice" error={err('nameLocal')} span={2}>
            {input('nameLocal', { placeholder: 'เช่น บริษัท ไทย อะโกร เอ็กซ์ปอร์ต จำกัด', maxLength: 255, lang: 'th' })}
          </Field>
          <Field label="Tax ID" hint="13 digits" error={err('taxId')}>
            {input('taxId', { inputMode: 'numeric', maxLength: 13, placeholder: '0105539900112', className: `gecko-input gecko-text-mono${err('taxId') ? ' gecko-input-error' : ''}` })}
          </Field>
          <Field label="Tax branch" hint="00000 = head office" error={err('branchNo')}>
            {input('branchNo', { inputMode: 'numeric', maxLength: 10, className: `gecko-input gecko-text-mono${err('branchNo') ? ' gecko-input-error' : ''}` })}
          </Field>
          <Field label="Short name" hint="What the gate screen shows" error={err('shortName')}>
            {input('shortName', { maxLength: 60 })}
          </Field>
          <Field label="Registration no." hint="DBD number, if different from the tax id" error={err('registrationNo')}>
            {input('registrationNo', { maxLength: 100, className: `gecko-input gecko-text-mono${err('registrationNo') ? ' gecko-input-error' : ''}` })}
          </Field>
          <Field label="Currency" hint={mode === 'create' ? "Blank = the company's currency (THB)" : 'ISO code, e.g. THB'} error={err('defaultCurrency')}>
            {input('defaultCurrency', { maxLength: 3, placeholder: 'THB', style: { textTransform: 'uppercase' }, className: `gecko-input gecko-text-mono${err('defaultCurrency') ? ' gecko-input-error' : ''}` })}
          </Field>
        </div>
      </div>

      <div>
        <SectionHead>Roles</SectionHead>
        <div className="gecko-row gecko-row-wrap" style={{ gap: 8 }}>
          {PARTY_ROLES.map(r => {
            const on = value.roles.includes(r.value);
            return (
              <button
                key={r.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleRole(r.value)}
                className={`gecko-btn gecko-btn-sm ${on ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
              >
                {on ? '✓ ' : ''}{r.label}
              </button>
            );
          })}
        </div>
        {err('roles') && <div style={{ marginTop: 3, fontSize: 11, color: 'var(--gecko-error-600)' }}>{err('roles')}</div>}
        {mode === 'edit' && (
          <div className="gecko-cell-meta" style={{ marginTop: 6, fontSize: 11 }}>
            Removing a role keeps its settings in history; adding it back restores them.
          </div>
        )}
      </div>

      <div>
        <SectionHead>Address &amp; contact</SectionHead>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <Field label="Address" error={err('address')} span={2}>{input('address', { maxLength: 255 })}</Field>
          <Field label="Address line 2" error={err('address2')} span={2}>{input('address2', { maxLength: 255 })}</Field>
          <Field label="City / District" error={err('city')}>{input('city', { maxLength: 100 })}</Field>
          <Field label="Province" error={err('state')}>{input('state', { maxLength: 100 })}</Field>
          <Field label="Postcode" error={err('postcode')}>{input('postcode', { maxLength: 25 })}</Field>
          <Field label="Phone" error={err('phone')}>{input('phone', { maxLength: 50, type: 'tel' })}</Field>
          <Field label="E-mail" error={err('email')}>{input('email', { maxLength: 255, type: 'email' })}</Field>
          <Field label="Website" error={err('website')}>{input('website', { maxLength: 500, type: 'url', placeholder: 'https://' })}</Field>
        </div>
      </div>

      <div>
        <SectionHead>Remarks</SectionHead>
        <Field label="Remarks" hint="Internal note — never printed on documents" error={err('remarks')}>
          <textarea
            className={`gecko-input${err('remarks') ? ' gecko-input-error' : ''}`}
            rows={3}
            maxLength={1000}
            value={value.remarks}
            onChange={e => set({ remarks: e.target.value })}
            style={{ resize: 'vertical', minHeight: 64 }}
          />
        </Field>
      </div>

      {mode === 'edit' && (
        <label className="gecko-row" style={{ gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={value.isActive} onChange={e => set({ isActive: e.target.checked })} />
          Active — inactive customers stay on file but are not offered for new work
        </label>
      )}
    </div>
  );
}
