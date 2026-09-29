"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FormGrid, Field } from '@/components/ui/FormGrid';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { useApi, type Paged } from '@/lib/api/use-api';
import {
  EDI_MESSAGES, createShippingLine, shippingLinesQueryPath, updateShippingLine,
  type LineRole, type SaveShippingLineRequest, type ShippingLine,
} from '@/lib/api/shipping-lines';

interface LineForm extends Omit<SaveShippingLineRequest, 'rowVersion'> {
  nameEn: string;
  nameLocal: string;
  shortName: string;
}

const EMPTY_FORM: LineForm = {
  nameEn: '', nameLocal: '', shortName: '',
  lineRole: 'LINE', principalLineCode: null,
  scacCode: null, smdgCode: null, operatorCode: null, imoCompanyNo: null,
  allianceCode: null, allianceName: null, ediPartnerCode: null,
  ediSupportsCoparn: false, ediSupportsCodeco: false, ediSupportsCoarri: false, ediSupportsBaplie: false,
  brandColorHex: null,
};

const toForm = (l: ShippingLine): LineForm => ({
  nameEn: l.nameEn, nameLocal: l.nameLocal ?? '', shortName: l.shortName ?? '',
  lineRole: l.lineRole, principalLineCode: l.principalLineCode,
  scacCode: l.scacCode, smdgCode: l.smdgCode, operatorCode: l.operatorCode, imoCompanyNo: l.imoCompanyNo,
  allianceCode: l.allianceCode, allianceName: l.allianceName, ediPartnerCode: l.ediPartnerCode,
  ediSupportsCoparn: l.ediSupportsCoparn, ediSupportsCodeco: l.ediSupportsCodeco,
  ediSupportsCoarri: l.ediSupportsCoarri, ediSupportsBaplie: l.ediSupportsBaplie,
  brandColorHex: l.brandColorHex,
});

const blank = (s: string | null) => (s?.trim() ? s.trim() : null);

/** Client-side mirror of the API rules, so the obvious mistakes show before a round trip. */
function localErrors(f: LineForm, isNew: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (isNew && !f.nameEn.trim()) e.nameEn = 'Required.';
  if (f.lineRole === 'AGENT' && !f.principalLineCode) e.principalLineCode = 'An agent needs the line it acts for.';
  if (f.scacCode && !/^[A-Za-z]{4}$/.test(f.scacCode.trim())) e.scacCode = 'A SCAC is 4 letters.';
  return e;
}

const sectionHead = (title: string) => (
  <div style={{
    fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--gecko-primary-600)',
    marginBottom: 14, paddingBottom: 7, borderBottom: '2px solid rgba(var(--gecko-primary-rgb, 37,99,235), 0.12)',
  }}>{title}</div>
);

/**
 * New / edit a shipping line. `line` null = new. `readOnly` for a viewer without
 * mdm.party.manage: the same form, nothing to save.
 */
export function LineModal({ line, readOnly, onClose, onSaved }: {
  line: ShippingLine | null; readOnly: boolean; onClose: () => void; onSaved: () => void;
}) {
  const isNew = line === null;
  const [form, setForm] = useState<LineForm>(line ? toForm(line) : { ...EMPTY_FORM });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { toast } = useToast();
  const set = (partial: Partial<LineForm>) => setForm(prev => ({ ...prev, ...partial }));

  // Principals: every LINE (agents act for lines, never for agents), except this one.
  const { data: principals } = useApi<Paged<ShippingLine>>(
    form.lineRole === 'AGENT' ? shippingLinesQueryPath({ lineRole: 'LINE', pageSize: 200, includeInactive: true }) : null);
  const principalOptions = (principals?.items ?? []).filter(p => p.partyCode !== line?.partyCode);

  const local = submitted ? localErrors(form, isNew) : {};
  const fieldError = (name: string) => local[name] ?? error?.forField(name);

  const lineBody = (): Omit<SaveShippingLineRequest, 'rowVersion'> => ({
    lineRole: form.lineRole,
    principalLineCode: form.lineRole === 'AGENT' ? form.principalLineCode : null,
    scacCode: blank(form.scacCode)?.toUpperCase() ?? null,
    smdgCode: blank(form.smdgCode),
    operatorCode: blank(form.operatorCode),
    imoCompanyNo: blank(form.imoCompanyNo),
    allianceCode: blank(form.allianceCode),
    allianceName: blank(form.allianceName),
    ediPartnerCode: blank(form.ediPartnerCode),
    ediSupportsCoparn: form.ediSupportsCoparn,
    ediSupportsCodeco: form.ediSupportsCodeco,
    ediSupportsCoarri: form.ediSupportsCoarri,
    ediSupportsBaplie: form.ediSupportsBaplie,
    brandColorHex: form.brandColorHex,
  });

  const save = async () => {
    setSubmitted(true);
    if (readOnly || Object.keys(localErrors(form, isNew)).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      const saved = isNew
        ? await createShippingLine({ ...lineBody(), nameEn: form.nameEn.trim(), nameLocal: blank(form.nameLocal), shortName: blank(form.shortName) })
        : await updateShippingLine(line.partyCode, { ...lineBody(), rowVersion: line.rowVersion });
      toast({ variant: 'success', title: isNew ? 'Line registered' : 'Line updated', message: `${saved.line.partyCode} · ${saved.line.nameEn}` });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setSaving(false);
    }
  };

  const text = (key: keyof LineForm, props: React.InputHTMLAttributes<HTMLInputElement> & { upper?: boolean } = {}) => {
    const { upper, ...rest } = props;
    return (
      <input className={`gecko-input${upper ? ' gecko-text-mono' : ''}`} disabled={readOnly || saving}
        value={(form[key] as string | null) ?? ''}
        onChange={e => set({ [key]: upper ? e.target.value.toUpperCase() : e.target.value } as Partial<LineForm>)}
        {...rest} />
    );
  };

  return (
    <div className="gecko-overlay" onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="gecko-modal gecko-modal-lg gecko-stack" style={{ gap: 0 }} role="dialog" aria-modal="true"
        aria-label={isNew ? 'New shipping line' : `Shipping line ${line.partyCode}`}>

        <div className="gecko-row gecko-row-start gecko-row-between gecko-flex-shrink-0" style={{ padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-primary-50)', borderRadius: '12px 12px 0 0', gap: 16 }}>
          <div>
            <div className="gecko-row">
              <Icon name="ship" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>
                {isNew ? 'New Shipping Line' : `${line.partyCode} · ${line.nameEn}`}
              </span>
            </div>
            <div className="gecko-cell-meta" style={{ fontSize: 12, marginTop: 3 }}>
              {isNew
                ? 'Registers a party with the shipping-line role. The code is assigned when you save.'
                : <>Name, address, status and delete are on the <Link href={`/masters/customers/${encodeURIComponent(line.partyCode)}`} className="gecko-id-link">party record</Link>.</>}
            </div>
          </div>
          <button onClick={onClose} disabled={saving} aria-label="Close" className="gecko-mini-icon gecko-mini-icon-neutral"
            style={{ border: '1px solid var(--gecko-border)', borderRadius: 7, background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-secondary)', fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}>
            ×
          </button>
        </div>

        <div className="gecko-stack gecko-stack-xl gecko-flex-1" style={{ padding: '22px 24px', overflowY: 'auto' }}>
          {error && (
            <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
              <Icon name="alertCircle" size={16} /><span>{error.message}</span>
            </div>
          )}

          {isNew && (
            <div>
              {sectionHead('Identity')}
              <FormGrid columns={2}>
                <Field label="Full Name" required error={fieldError('nameEn')} full>
                  {text('nameEn', { placeholder: 'e.g. Mediterranean Shipping Co.', maxLength: 255 })}
                </Field>
                <Field label="Name (Thai)" error={fieldError('nameLocal')}>
                  {text('nameLocal', { maxLength: 255, lang: 'th' })}
                </Field>
                <Field label="Short Name" helper='e.g. "MSC"' error={fieldError('shortName')}>
                  {text('shortName', { maxLength: 60 })}
                </Field>
              </FormGrid>
            </div>
          )}

          <div>
            {sectionHead('Role')}
            <FormGrid columns={2}>
              <Field label="Line or agent" error={fieldError('lineRole')}>
                <select className="gecko-input" value={form.lineRole} disabled={readOnly || saving}
                  onChange={e => set({ lineRole: e.target.value as LineRole })}>
                  <option value="LINE">Line — the carrier itself</option>
                  <option value="AGENT">Agent — acts for a line</option>
                </select>
              </Field>
              {form.lineRole === 'AGENT' && (
                <Field label="Acts for" required error={fieldError('principalLineCode')}>
                  <select className="gecko-input" value={form.principalLineCode ?? ''} disabled={readOnly || saving}
                    onChange={e => set({ principalLineCode: e.target.value || null })}>
                    <option value="">— Select a line —</option>
                    {principalOptions.map(p => (
                      <option key={p.partyCode} value={p.partyCode}>{p.partyCode} · {p.nameEn}{p.isActive ? '' : ' (inactive)'}</option>
                    ))}
                  </select>
                </Field>
              )}
            </FormGrid>
          </div>

          <div>
            {sectionHead('Carrier codes')}
            <FormGrid columns={2}>
              <Field label="SCAC Code" helper="4 letters, e.g. MSCU" error={fieldError('scacCode')}>
                {text('scacCode', { upper: true, maxLength: 4, placeholder: 'e.g. MSCU' })}
              </Field>
              <Field label="SMDG Code" helper="Liner code used in BAPLIE / CODECO" error={fieldError('smdgCode')}>
                {text('smdgCode', { upper: true, maxLength: 10, placeholder: 'e.g. MSC' })}
              </Field>
              <Field label="Operator Code" error={fieldError('operatorCode')}>
                {text('operatorCode', { upper: true, maxLength: 10 })}
              </Field>
              <Field label="IMO Company No." error={fieldError('imoCompanyNo')}>
                {text('imoCompanyNo', { maxLength: 15, className: 'gecko-input gecko-text-mono' })}
              </Field>
              <Field label="Alliance Code" error={fieldError('allianceCode')}>
                {text('allianceCode', { upper: true, maxLength: 20, placeholder: 'e.g. GEMINI' })}
              </Field>
              <Field label="Alliance Name" error={fieldError('allianceName')}>
                {text('allianceName', { maxLength: 100, placeholder: 'e.g. Gemini Cooperation' })}
              </Field>
            </FormGrid>
          </div>

          <div>
            {sectionHead('EDI')}
            <FormGrid columns={2}>
              <Field label="Messages exchanged" helper="None selected = manual">
                <div className="gecko-row gecko-row-wrap" style={{ gap: 6, paddingTop: 2 }}>
                  {EDI_MESSAGES.map(({ key, label }) => {
                    const on = form[key];
                    return (
                      <button key={key} type="button" aria-pressed={on} disabled={readOnly || saving}
                        onClick={() => set({ [key]: !on } as Partial<LineForm>)}
                        style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          cursor: readOnly ? 'default' : 'pointer',
                          border: on ? 'none' : '1px solid var(--gecko-border)',
                          background: on ? 'var(--gecko-primary-600)' : 'transparent',
                          color: on ? '#fff' : 'var(--gecko-text-secondary)',
                          fontFamily: 'var(--gecko-font-mono)', letterSpacing: '0.04em',
                        }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="EDI Partner Code" helper="UNB sender / recipient id" error={fieldError('ediPartnerCode')}>
                {text('ediPartnerCode', { maxLength: 35, className: 'gecko-input gecko-text-mono' })}
              </Field>
              <Field label="Brand Colour" error={fieldError('brandColorHex')}>
                <div className="gecko-row" style={{ gap: 8 }}>
                  <input type="color" aria-label="Brand colour" value={form.brandColorHex ?? '#9CA3AF'} disabled={readOnly || saving}
                    onChange={e => set({ brandColorHex: e.target.value.toUpperCase() })}
                    style={{ width: 40, height: 32, padding: 0, border: '1px solid var(--gecko-border)', borderRadius: 6, background: 'none' }} />
                  <span className="gecko-text-mono gecko-cell-meta">{form.brandColorHex ?? 'none'}</span>
                  {form.brandColorHex && !readOnly && (
                    <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => set({ brandColorHex: null })}>Clear</button>
                  )}
                </div>
              </Field>
            </FormGrid>
          </div>
        </div>

        <div className="gecko-row gecko-flex-shrink-0" style={{ padding: '14px 24px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', borderRadius: '0 0 12px 12px', gap: 10 }}>
          <div className="gecko-flex-1" style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>
            {readOnly ? 'You can view this line; changing it needs party-manage permission.' : isNew ? '* Full Name is required' : ''}
          </div>
          <div className="gecko-action-toolbar">
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={saving}>{readOnly ? 'Close' : 'Cancel'}</button>
            {!readOnly && (
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={save} disabled={saving}>
                <Icon name="save" size={14} /> {saving ? 'Saving…' : isNew ? 'Register Line' : 'Save Line'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
