"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

interface FormState {
  isoCode: string;
  typeName: string;
  category: string;
  typeCode: string;
  length: string;
  height: string;
  externalLoa: string;
  internalLength: string;
  internalWidth: string;
  internalHeight: string;
  payload: string;
  tare: string;
  cubicCapacity: string;
  doorWidth: string;
  doorHeight: string;
  features: string[];
  defaultTariffRow: string;
  yardSlotSize: string;
  stackHeightLimit: string;
  status: string;
}

const INITIAL_FORM: FormState = {
  isoCode: '',
  typeName: '',
  category: '',
  typeCode: '',
  length: '',
  height: '',
  externalLoa: '',
  internalLength: '',
  internalWidth: '',
  internalHeight: '',
  payload: '',
  tare: '',
  cubicCapacity: '',
  doorWidth: '',
  doorHeight: '',
  features: [],
  defaultTariffRow: '',
  yardSlotSize: '1 TEU',
  stackHeightLimit: '4',
  status: 'Active',
};

const ALL_FEATURES = [
  { key: 'refrigeration', label: 'Refrigeration unit built-in' },
  { key: 'reeferPlugs', label: 'Reefer plugs required' },
  { key: 'openTop', label: 'Open top (no roof)' },
  { key: 'flatRack', label: 'Flat rack (no walls/roof)' },
  { key: 'tank', label: 'Tank container' },
  { key: 'hazmat', label: 'Hazmat rated' },
  { key: 'ventilated', label: 'Ventilated' },
];

function SectionCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ padding: '24px' }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, hint, children, span }: { label: string; required?: boolean; hint?: string; children: React.ReactNode; span?: number }) {
  return (
    <div className="gecko-form-group" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export default function NewContainerTypePage() {
  const [form, setFormRaw] = useState<FormState>(INITIAL_FORM);
  const set = (partial: Partial<FormState>) => setFormRaw(prev => ({ ...prev, ...partial }));

  const payloadNum = parseFloat(form.payload.replace(/,/g, '')) || 0;
  const tareNum = parseFloat(form.tare.replace(/,/g, '')) || 0;
  const maxGross = payloadNum + tareNum;

  function toggleFeature(key: string) {
    set({
      features: form.features.includes(key)
        ? form.features.filter(f => f !== key)
        : [...form.features, key],
    });
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 80 }}>

      {/* Breadcrumb */}
      <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
        <Link href="/masters" className="gecko-breadcrumb-item">Master Data</Link>
        <span className="gecko-breadcrumb-sep" />
        <Link href="/masters/container-types" className="gecko-breadcrumb-item">ISO Container Types</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">New Type</span>
      </nav>

      {/* Title */}
      <div style={{ paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>New ISO Container Type</h1>
        <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 6 }}>
          Define a new ISO 6346 container type. It will become available in the rate matrix, yard slot dimensions, and vessel stow planning.
        </div>
      </div>

      {/* Section: ISO Identity */}
      <SectionCard
        title="ISO Identity"
        sub="Core code reference used across all modules — tariff, EIR, and vessel stow."
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="ISO Code" required hint="4-character ISO 6346 type code">
            <input
              className="gecko-input"
              placeholder="e.g. 22G1"
              maxLength={4}
              value={form.isoCode}
              onChange={e => set({ isoCode: e.target.value.toUpperCase() })}
              style={{ fontFamily: 'var(--gecko-font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 16, fontWeight: 700 }}
            />
          </Field>
          <Field label="Type Name" required>
            <input
              className="gecko-input"
              placeholder="e.g. 20' Standard Dry"
              value={form.typeName}
              onChange={e => set({ typeName: e.target.value })}
            />
          </Field>
          <Field label="Category" required>
            <select className="gecko-input" value={form.category} onChange={e => set({ category: e.target.value })}>
              <option value="">— select —</option>
              <option value="GENERAL">GENERAL</option>
              <option value="REEFER">REEFER</option>
              <option value="SPECIAL">SPECIAL</option>
              <option value="HAZMAT">HAZMAT</option>
              <option value="FLAT RACK">FLAT RACK</option>
              <option value="TANK">TANK</option>
              <option value="PLATFORM">PLATFORM</option>
            </select>
          </Field>
          <Field label="Type Code" required>
            <select className="gecko-input" value={form.typeCode} onChange={e => set({ typeCode: e.target.value })}>
              <option value="">— select —</option>
              <option value="GP">GP — General Purpose</option>
              <option value="RF">RF — Reefer</option>
              <option value="OT">OT — Open Top</option>
              <option value="HZ">HZ — Hazmat</option>
              <option value="FT">FT — Flat Rack</option>
              <option value="TK">TK — Tank</option>
              <option value="PL">PL — Platform</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      {/* Section: Physical Dimensions */}
      <SectionCard
        title="Physical Dimensions"
        sub={"External size class and internal usable space. Width is fixed at 8’0 per ISO standard."}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <Field label="Length" required>
            <select className="gecko-input" value={form.length} onChange={e => set({ length: e.target.value })}>
              <option value="">— select —</option>
              <option value="20ft">20 ft</option>
              <option value="40ft">40 ft</option>
              <option value="45ft">45 ft</option>
              <option value="48ft">48 ft</option>
              <option value="53ft">53 ft</option>
            </select>
          </Field>
          <Field label="Height" required>
            <select className="gecko-input" value={form.height} onChange={e => set({ height: e.target.value })}>
              <option value="">— select —</option>
              <option value="standard">Standard 8&apos;6&quot;</option>
              <option value="highcube">High-Cube 9&apos;6&quot;</option>
              <option value="lowcube">Low-Cube 8&apos;0&quot;</option>
              <option value="doublestack">Double Stack</option>
            </select>
          </Field>
          <Field label="Width" hint="Locked — ISO standard">
            <input
              className="gecko-input"
              value={"8'0 (2,438 mm)"}
              readOnly
              style={{ background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', cursor: 'not-allowed' }}
            />
          </Field>
          <Field label="External LOA (m)" hint="Overall length in metres">
            <input
              className="gecko-input"
              placeholder="e.g. 6.058"
              value={form.externalLoa}
              onChange={e => set({ externalLoa: e.target.value })}
              style={{ fontFamily: 'var(--gecko-font-mono)' }}
            />
          </Field>
          <Field label="Internal Length (m)">
            <input
              className="gecko-input"
              placeholder="e.g. 5.898"
              value={form.internalLength}
              onChange={e => set({ internalLength: e.target.value })}
              style={{ fontFamily: 'var(--gecko-font-mono)' }}
            />
          </Field>
          <Field label="Internal Width (m)">
            <input
              className="gecko-input"
              placeholder="e.g. 2.352"
              value={form.internalWidth}
              onChange={e => set({ internalWidth: e.target.value })}
              style={{ fontFamily: 'var(--gecko-font-mono)' }}
            />
          </Field>
          <Field label="Internal Height (m)">
            <input
              className="gecko-input"
              placeholder="e.g. 2.393"
              value={form.internalHeight}
              onChange={e => set({ internalHeight: e.target.value })}
              style={{ fontFamily: 'var(--gecko-font-mono)' }}
            />
          </Field>
        </div>
      </SectionCard>

      {/* Section: Weight & Capacity */}
      <SectionCard
        title="Weight &amp; Capacity"
        sub="Payload and tare drive weight checks at gate-in and vessel load planning."
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <Field label="Payload / Max Cargo (kg)" required>
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input"
                placeholder="e.g. 28230"
                value={form.payload}
                onChange={e => set({ payload: e.target.value })}
                style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 32 }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>kg</span>
            </div>
          </Field>
          <Field label="Tare Weight (kg)" required>
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input"
                placeholder="e.g. 2300"
                value={form.tare}
                onChange={e => set({ tare: e.target.value })}
                style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 32 }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>kg</span>
            </div>
          </Field>
          <Field label="Max Gross Weight (kg)" hint="Auto-computed: Payload + Tare">
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input"
                value={maxGross > 0 ? maxGross.toLocaleString() : ''}
                readOnly
                placeholder="= Payload + Tare"
                style={{ background: 'var(--gecko-bg-subtle)', color: maxGross > 0 ? 'var(--gecko-text-primary)' : 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)', paddingRight: 32, cursor: 'not-allowed' }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>kg</span>
            </div>
          </Field>
          <Field label="Cubic Capacity (m³)">
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input"
                placeholder="e.g. 33.2"
                value={form.cubicCapacity}
                onChange={e => set({ cubicCapacity: e.target.value })}
                style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 28 }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>m³</span>
            </div>
          </Field>
          <Field label="Door Opening Width (mm)">
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input"
                placeholder="e.g. 2286"
                value={form.doorWidth}
                onChange={e => set({ doorWidth: e.target.value })}
                style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 36 }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>mm</span>
            </div>
          </Field>
          <Field label="Door Opening Height (mm)">
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input"
                placeholder="e.g. 2261"
                value={form.doorHeight}
                onChange={e => set({ doorHeight: e.target.value })}
                style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 36 }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>mm</span>
            </div>
          </Field>
        </div>
      </SectionCard>

      {/* Section: Special Features */}
      <SectionCard
        title="Special Features"
        sub="Check all features that apply to this container type. These control yard zoning, plug assignments, and DG segregation rules."
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {ALL_FEATURES.map(feat => {
            const checked = form.features.includes(feat.key);
            return (
              <label
                key={feat.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: `1px solid ${checked ? 'var(--gecko-primary-300)' : 'var(--gecko-border)'}`,
                  background: checked ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  className="gecko-checkbox"
                  checked={checked}
                  onChange={() => toggleFeature(feat.key)}
                />
                <span style={{ fontSize: 13, fontWeight: checked ? 600 : 500, color: checked ? 'var(--gecko-primary-800)' : 'var(--gecko-text-secondary)' }}>
                  {feat.label}
                </span>
              </label>
            );
          })}
        </div>
      </SectionCard>

      {/* Section: Tariff & Operations */}
      <SectionCard
        title="Tariff &amp; Operations"
        sub="Operational defaults applied when this container type is used in yard planning and billing."
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Default Tariff Row" hint="Tariff line code applied when no override exists">
            <input
              className="gecko-input"
              placeholder="e.g. STOR-20GP"
              value={form.defaultTariffRow}
              onChange={e => set({ defaultTariffRow: e.target.value.toUpperCase() })}
              style={{ fontFamily: 'var(--gecko-font-mono)' }}
            />
          </Field>
          <Field label="Yard Slot Size">
            <select className="gecko-input" value={form.yardSlotSize} onChange={e => set({ yardSlotSize: e.target.value })}>
              <option value="1 TEU">1 TEU</option>
              <option value="2 TEU">2 TEU</option>
              <option value="0.5 TEU">0.5 TEU</option>
            </select>
          </Field>
          <Field label="Stack Height Limit" hint="Maximum stacking height in yard">
            <input
              className="gecko-input"
              type="number"
              min={1}
              max={10}
              value={form.stackHeightLimit}
              onChange={e => set({ stackHeightLimit: e.target.value })}
              style={{ fontFamily: 'var(--gecko-font-mono)' }}
            />
          </Field>
          <Field label="Status">
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 6 }}>
              {['Active', 'Inactive'].map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                  <input
                    type="radio"
                    name="status"
                    value={opt}
                    checked={form.status === opt}
                    onChange={() => set({ status: opt })}
                    style={{ accentColor: 'var(--gecko-primary-600)', width: 16, height: 16 }}
                  />
                  <span style={{ color: form.status === opt ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)', fontWeight: form.status === opt ? 700 : 500 }}>
                    {opt}
                  </span>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </SectionCard>

      {/* Sticky bottom bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--gecko-bg-surface)',
        borderTop: '1px solid var(--gecko-border)',
        padding: '14px 32px',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 12,
        zIndex: 100,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
      }}>
        <Link href="/masters/container-types" className="gecko-btn gecko-btn-ghost gecko-btn-sm">
          Cancel
        </Link>
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm">
          <Icon name="save" size={15} /> Save Type
        </button>
      </div>

    </div>
  );
}
