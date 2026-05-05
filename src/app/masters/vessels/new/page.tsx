"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid var(--gecko-border)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>{title}</h3>
      {sub && <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Field({ label, required, children, span }: { label: string; required?: boolean; children: React.ReactNode; span?: number }) {
  return (
    <div className="gecko-form-group" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
    </div>
  );
}

const FLAG_OPTIONS = [
  { value: 'PA', label: 'PA — Panama' },
  { value: 'MH', label: 'MH — Marshall Islands' },
  { value: 'LR', label: 'LR — Liberia' },
  { value: 'BS', label: 'BS — Bahamas' },
  { value: 'CY', label: 'CY — Cyprus' },
  { value: 'MT', label: 'MT — Malta' },
  { value: 'SG', label: 'SG — Singapore' },
  { value: 'HK', label: 'HK — Hong Kong' },
  { value: 'CN', label: 'CN — China' },
  { value: 'JP', label: 'JP — Japan' },
  { value: 'KR', label: 'KR — South Korea' },
  { value: 'TW', label: 'TW — Taiwan' },
  { value: 'DE', label: 'DE — Germany' },
  { value: 'GB', label: 'GB — United Kingdom' },
  { value: 'NO', label: 'NO — Norway' },
  { value: 'DK', label: 'DK — Denmark' },
  { value: 'GR', label: 'GR — Greece' },
  { value: 'FR', label: 'FR — France' },
  { value: 'IT', label: 'IT — Italy' },
  { value: 'OTHER', label: 'Other' },
];

interface VesselForm {
  imo: string;
  name: string;
  callSign: string;
  mmsi: string;
  shippingLine: string;
  vesselClass: string;
  flag: string;
  yearBuilt: string;
  shipbuilder: string;
  loa: string;
  beam: string;
  draft: string;
  teuNominal: string;
  teuMax: string;
  reeferPlugs: string;
  status: 'Active' | 'Inactive' | 'Archived';
  notes: string;
}

const INITIAL: VesselForm = {
  imo: '', name: '', callSign: '', mmsi: '',
  shippingLine: '', vesselClass: '', flag: '', yearBuilt: '', shipbuilder: '',
  loa: '', beam: '', draft: '', teuNominal: '', teuMax: '', reeferPlugs: '',
  status: 'Active', notes: '',
};

export default function NewVesselPage() {
  const [form, setForm] = useState<VesselForm>(INITIAL);

  function set(key: keyof VesselForm, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 96 }}>

      {/* Breadcrumb */}
      <nav className="gecko-breadcrumb" aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <Link href="/masters" className="gecko-breadcrumb-item">Masters</Link>
        <span className="gecko-breadcrumb-sep" />
        <Link href="/masters/vessels" className="gecko-breadcrumb-item">Vessels &amp; Voyages</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">New Vessel</span>
        <span style={{ marginLeft: 12, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)' }}>
          IMO Registry
        </span>
      </nav>

      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <Link href="/masters/vessels" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-secondary)', textDecoration: 'none' }}>
          <Icon name="arrowLeft" size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>New Vessel</h1>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>Register a new vessel in the IMO-keyed vessel catalog.</div>
        </div>
      </div>

      {/* Form body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Identity */}
        <section style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '24px 28px', boxShadow: 'var(--gecko-shadow-sm)' }}>
          <SectionHead title="Identity" sub="Core vessel identifiers registered with the IMO and ITU." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <Field label="IMO Number" required>
              <input
                className="gecko-input gecko-text-mono"
                placeholder="e.g. 9345612"
                maxLength={7}
                value={form.imo}
                onChange={e => set('imo', e.target.value.replace(/\D/g, '').slice(0, 7))}
              />
            </Field>
            <Field label="Vessel Name" required>
              <input
                className="gecko-input"
                placeholder="e.g. MSC LISBON"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                style={{ textTransform: 'uppercase' }}
              />
            </Field>
            <Field label="Call Sign">
              <input
                className="gecko-input gecko-text-mono"
                placeholder="e.g. 3EFG4"
                value={form.callSign}
                onChange={e => set('callSign', e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="MMSI (9-digit)">
              <input
                className="gecko-input gecko-text-mono"
                placeholder="e.g. 215123456"
                maxLength={9}
                value={form.mmsi}
                onChange={e => set('mmsi', e.target.value.replace(/\D/g, '').slice(0, 9))}
              />
            </Field>
          </div>
        </section>

        {/* Classification */}
        <section style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '24px 28px', boxShadow: 'var(--gecko-shadow-sm)' }}>
          <SectionHead title="Classification" sub="Shipping line ownership, vessel class, registry flag, and build details." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <Field label="Shipping Line">
              <select className="gecko-select" value={form.shippingLine} onChange={e => set('shippingLine', e.target.value)}>
                <option value="">— Select line —</option>
                <option value="MSC">MSC — Mediterranean Shipping Company</option>
                <option value="OOCL">OOCL — Orient Overseas Container Line</option>
                <option value="MAEU">Maersk Line</option>
                <option value="CMA">CMA CGM</option>
                <option value="EMC">Evergreen Marine Corporation</option>
                <option value="HLC">Hapag-Lloyd</option>
                <option value="ONE">ONE — Ocean Network Express</option>
                <option value="YML">Yang Ming Marine Transport</option>
              </select>
            </Field>
            <Field label="Vessel Class">
              <select className="gecko-select" value={form.vesselClass} onChange={e => set('vesselClass', e.target.value)}>
                <option value="">— Select class —</option>
                <option value="ULCV">ULCV (18,000+ TEU)</option>
                <option value="Post-Panamax">Post-Panamax (5,000–18,000 TEU)</option>
                <option value="Panamax">Panamax (3,000–5,000 TEU)</option>
                <option value="Sub-Panamax">Sub-Panamax (1,000–3,000 TEU)</option>
                <option value="Feeder">Feeder (&lt;1,000 TEU)</option>
                <option value="RoRo">RoRo — Roll-on/Roll-off</option>
              </select>
            </Field>
            <Field label="Flag">
              <select className="gecko-select" value={form.flag} onChange={e => set('flag', e.target.value)}>
                <option value="">— Select flag —</option>
                {FLAG_OPTIONS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Year Built">
              <input
                className="gecko-input gecko-text-mono"
                placeholder="e.g. 2017"
                maxLength={4}
                value={form.yearBuilt}
                onChange={e => set('yearBuilt', e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </Field>
            <Field label="Shipbuilder" span={2}>
              <input
                className="gecko-input"
                placeholder="e.g. Samsung Heavy Industries, Hyundai Heavy Industries"
                value={form.shipbuilder}
                onChange={e => set('shipbuilder', e.target.value)}
              />
            </Field>
          </div>
        </section>

        {/* Dimensions */}
        <section style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '24px 28px', boxShadow: 'var(--gecko-shadow-sm)' }}>
          <SectionHead title="Dimensions" sub="Physical measurements and capacity figures as per vessel certificate." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
            <Field label="LOA (metres)">
              <div style={{ position: 'relative' }}>
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. 399.9"
                  value={form.loa}
                  onChange={e => set('loa', e.target.value)}
                  style={{ paddingRight: 32 }}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>m</span>
              </div>
            </Field>
            <Field label="Beam (metres)">
              <div style={{ position: 'relative' }}>
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. 58.6"
                  value={form.beam}
                  onChange={e => set('beam', e.target.value)}
                  style={{ paddingRight: 32 }}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>m</span>
              </div>
            </Field>
            <Field label="Draft (metres)">
              <div style={{ position: 'relative' }}>
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. 16.0"
                  value={form.draft}
                  onChange={e => set('draft', e.target.value)}
                  style={{ paddingRight: 32 }}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>m</span>
              </div>
            </Field>
            <Field label="TEU Nominal">
              <input
                className="gecko-input gecko-text-mono"
                placeholder="e.g. 21413"
                value={form.teuNominal}
                onChange={e => set('teuNominal', e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="TEU Max (structural)">
              <input
                className="gecko-input gecko-text-mono"
                placeholder="e.g. 23000"
                value={form.teuMax}
                onChange={e => set('teuMax', e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="Reefer Plugs">
              <input
                className="gecko-input gecko-text-mono"
                placeholder="e.g. 1500"
                value={form.reeferPlugs}
                onChange={e => set('reeferPlugs', e.target.value.replace(/\D/g, ''))}
              />
            </Field>
          </div>
        </section>

        {/* Settings */}
        <section style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '24px 28px', boxShadow: 'var(--gecko-shadow-sm)' }}>
          <SectionHead title="Settings" sub="Operational status and internal notes." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="gecko-form-group">
              <label className="gecko-label">Status</label>
              <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
                {(['Active', 'Inactive', 'Archived'] as const).map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: form.status === s ? 700 : 500, color: form.status === s ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)' }}>
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      checked={form.status === s}
                      onChange={() => set('status', s)}
                      style={{ accentColor: 'var(--gecko-primary-600)' }}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div className="gecko-form-group">
              <label className="gecko-label">Notes</label>
              <textarea
                className="gecko-input"
                rows={4}
                placeholder="Internal notes, special handling requirements, certifications, etc."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                style={{ resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          </div>
        </section>

      </div>

      {/* Sticky action bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--gecko-bg-surface)',
        borderTop: '1px solid var(--gecko-border)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.07)',
        padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
      }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
          {form.imo && form.name
            ? <span>Ready to save: <strong style={{ color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{form.imo}</strong> — {form.name}</span>
            : <span style={{ color: 'var(--gecko-text-disabled)' }}>Complete IMO Number and Vessel Name to save.</span>
          }
        </div>
        <Link href="/masters/vessels" className="gecko-btn gecko-btn-ghost gecko-btn-sm">
          Cancel
        </Link>
        <button
          className="gecko-btn gecko-btn-primary gecko-btn-sm"
          disabled={!form.imo || !form.name}
          style={{ opacity: (!form.imo || !form.name) ? 0.5 : 1, cursor: (!form.imo || !form.name) ? 'not-allowed' : 'pointer' }}
        >
          <Icon name="save" size={15} />
          Save Vessel
        </button>
      </div>

    </div>
  );
}
