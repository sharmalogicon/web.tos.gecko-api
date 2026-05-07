'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Category = 'GP' | 'RF' | 'OT' | 'FR' | 'TK' | 'BK' | '';

interface FormState {
  isoTypeCode: string;
  category: Category;
  commonName: string;
  nominalLength: string;
  nominalHeight: string;
  internalCube: string;
  maxPayload: string;
  tareWeight: string;
  slotsPerTEU: string;
  requiresReeferPlug: boolean;
  oogSpecialHandling: boolean;
  active: boolean;
}

const INITIAL: FormState = {
  isoTypeCode: '',
  category: '',
  commonName: '',
  nominalLength: '',
  nominalHeight: '',
  internalCube: '',
  maxPayload: '',
  tareWeight: '',
  slotsPerTEU: '',
  requiresReeferPlug: false,
  oogSpecialHandling: false,
  active: true,
};

// ─── Category config ────────────────────────────────────────────────────────────

const CAT_CONFIG: Record<string, { label: string; cat: string; color: string; bg: string }> = {
  GP: { label: 'General Purpose', cat: 'GENERAL',  color: 'var(--gecko-primary-500)', bg: 'var(--gecko-primary-50)' },
  RF: { label: 'Reefer',          cat: 'REEFER',   color: 'var(--gecko-info-500)',    bg: 'var(--gecko-info-50)'    },
  OT: { label: 'Open Top',        cat: 'SPECIAL',  color: 'var(--gecko-warning-500)', bg: 'var(--gecko-warning-50)' },
  FR: { label: 'Flat Rack',       cat: 'SPECIAL',  color: 'var(--gecko-warning-500)', bg: 'var(--gecko-warning-50)' },
  TK: { label: 'Tank',            cat: 'SPECIAL',  color: 'var(--gecko-warning-500)', bg: 'var(--gecko-warning-50)' },
  BK: { label: 'Bulk',            cat: 'SPECIAL',  color: 'var(--gecko-warning-500)', bg: 'var(--gecko-warning-50)' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmtNum(val: string, suffix: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString() + ' ' + suffix;
}

function dimsLabel(length: string, height: string): string {
  const lenMap: Record<string, string> = {
    "20ft": "20'", "40ft": "40'", "45ft": "45'", "48ft": "48'", "53ft": "53'",
  };
  const htMap: Record<string, string> = {
    standard: "8'6\"",
    highcube: "9'6\"",
  };
  const l = lenMap[length] || '';
  const h = htMap[height] || '';
  if (!l && !h) return '—';
  if (l && h) return `${l} × ${h}`;
  return l || h;
}

// ─── ContainerGraphic (mirrored from list page) ──────────────────────────────

function ContainerGraphic({ width, height, color }: { width: number; height: number; color: string }) {
  return (
    <div style={{ width: '100%', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width, height, border: `2px solid ${color}`,
        background: 'rgba(255,255,255,0.5)', position: 'relative',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0',
      }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ width: '100%', height: 1, background: color, opacity: 0.3 }} />
        ))}
        <div style={{ position: 'absolute', right: 4, top: '30%', width: 2, height: '40%', background: color }} />
        <div style={{ position: 'absolute', top: -2,    left: -2,  width: 4, height: 4, background: color }} />
        <div style={{ position: 'absolute', top: -2,    right: -2, width: 4, height: 4, background: color }} />
        <div style={{ position: 'absolute', bottom: -2, left: -2,  width: 4, height: 4, background: color }} />
        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 4, height: 4, background: color }} />
      </div>
    </div>
  );
}

// ─── Preview Card ───────────────────────────────────────────────────────────────

function PreviewCard({ form }: { form: FormState }) {
  const cfg = form.category ? CAT_CONFIG[form.category] : null;
  const color = cfg?.color ?? 'var(--gecko-gray-400)';
  const bg    = cfg?.bg    ?? 'var(--gecko-bg-subtle)';
  const cat   = cfg?.cat   ?? '—';

  const isHighCube = form.nominalHeight === 'highcube';
  const is40plus   = ['40ft', '45ft', '48ft', '53ft'].includes(form.nominalLength);
  const gWidth  = is40plus ? 140 : 80;
  const gHeight = isHighCube ? 50 : 40;

  const dims = dimsLabel(form.nominalLength, form.nominalHeight);

  return (
    <div style={{
      background: 'var(--gecko-bg-surface)',
      border: '1px solid var(--gecko-border)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: 'var(--gecko-shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Graphic area */}
      <div style={{ background: bg, padding: 16, borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.05em' }}>{cat}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>
            {form.isoTypeCode || '????'}
          </span>
        </div>
        <ContainerGraphic width={gWidth} height={gHeight} color={color} />
      </div>

      {/* Info area */}
      <div style={{ padding: 16, flex: 1 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--gecko-text-primary)' }}>
          {form.commonName || <span style={{ color: 'var(--gecko-text-disabled)' }}>Common Name</span>}
        </h3>
        <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginBottom: 16 }}>
          {dims} {form.category ? `· ${form.category}` : ''}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Payload</div>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>
              {form.maxPayload ? fmtNum(form.maxPayload, 'kg') : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Tare</div>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>
              {form.tareWeight ? fmtNum(form.tareWeight, 'kg') : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Cube</div>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>
              {form.internalCube ? `${form.internalCube} m³` : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>TEU</div>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>
              {form.slotsPerTEU === '1teu' ? '1 TEU' : form.slotsPerTEU === '2teu' ? '2 TEU' : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Flags row */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
          background: form.active ? 'var(--gecko-success-100)' : 'var(--gecko-gray-100)',
          color: form.active ? 'var(--gecko-success-700)' : 'var(--gecko-text-disabled)',
        }}>
          {form.active ? 'Active' : 'Inactive'}
        </span>
        {form.requiresReeferPlug && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)' }}>
            Reefer Plug
          </span>
        )}
        {form.oogSpecialHandling && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)' }}>
            OOG / Special
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Toggle component ───────────────────────────────────────────────────────────

function Toggle({
  value, onChange, activeColor = 'var(--gecko-success-600)',
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  activeColor?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
        background: value ? activeColor : 'var(--gecko-gray-300)',
        position: 'relative', flexShrink: 0, transition: 'background 0.18s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.18s', display: 'block',
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      }} />
    </button>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase',
      letterSpacing: '0.09em', color: 'var(--gecko-primary-600)',
      marginBottom: 16, paddingBottom: 8,
      borderBottom: '2px solid rgba(var(--gecko-primary-rgb,37,99,235),0.12)',
    }}>
      {children}
    </div>
  );
}

// ─── Field wrapper ──────────────────────────────────────────────────────────────

function Field({
  label, required, hint, children, span,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  span?: number;
}) {
  return (
    <div className="gecko-form-group" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// ─── Suffixed number input ──────────────────────────────────────────────────────

function NumInput({
  placeholder, value, onChange, suffix,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="number"
        min={0}
        className="gecko-input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 36 }}
      />
      <span style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600, pointerEvents: 'none',
      }}>
        {suffix}
      </span>
    </div>
  );
}

// ─── Toggle row ─────────────────────────────────────────────────────────────────

function ToggleRow({
  label, desc, value, onChange, activeColor,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  activeColor?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '12px 14px', borderRadius: 8,
      border: `1px solid ${value ? 'var(--gecko-success-200)' : 'var(--gecko-border)'}`,
      background: value ? 'var(--gecko-success-50)' : 'var(--gecko-bg-surface)',
    }}>
      <Toggle value={value} onChange={onChange} activeColor={activeColor} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: value ? 'var(--gecko-success-700)' : 'var(--gecko-text-primary)' }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────────

export default function NewContainerTypePage() {
  const [form, setFormRaw] = useState<FormState>(INITIAL);
  const set = (partial: Partial<FormState>) => setFormRaw(prev => ({ ...prev, ...partial }));

  const canSave = form.isoTypeCode.trim().length === 4 && form.category !== '' && form.commonName.trim() !== '';

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 80 }}>

      {/* Breadcrumb */}
      <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
        <Link href="/masters" className="gecko-breadcrumb-item">Master Data</Link>
        <span className="gecko-breadcrumb-sep" />
        <Link href="/masters/container-types" className="gecko-breadcrumb-item">ISO Container Types</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">New Type</span>
      </nav>

      {/* Page header */}
      <div style={{ paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Link
            href="/masters/container-types"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-secondary)', textDecoration: 'none' }}
          >
            <Icon name="arrowLeft" size={15} />
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>New ISO Container Type</h1>
        </div>
        <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', paddingLeft: 42 }}>
          Define a new ISO 6346 container type. It will become available in the rate matrix, yard slot dimensions, and vessel stow planning.
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'start' }}>

        {/* ── LEFT: form ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Section: ISO Identity */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '22px 24px', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <SectionHead>ISO Identity</SectionHead>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 16 }}>

              <Field
                label="ISO Type Code"
                required
                hint="ISO 6346 format: length + width/height group + type + variant"
              >
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="22G1"
                  maxLength={4}
                  value={form.isoTypeCode}
                  onChange={e => set({ isoTypeCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  style={{ fontFamily: 'var(--gecko-font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 16, fontWeight: 700 }}
                />
              </Field>

              <Field label="Category" required>
                <select
                  className="gecko-input"
                  value={form.category}
                  onChange={e => {
                    const cat = e.target.value as Category;
                    set({ category: cat, requiresReeferPlug: cat === 'RF' ? form.requiresReeferPlug : false });
                  }}
                >
                  <option value="">— select —</option>
                  <option value="GP">General Purpose (GP)</option>
                  <option value="RF">Reefer (RF)</option>
                  <option value="OT">Special / Open Top (OT)</option>
                  <option value="FR">Flat Rack (FR)</option>
                  <option value="TK">Tank (TK)</option>
                  <option value="BK">Bulk (BK)</option>
                </select>
              </Field>

              <Field label="Common Name" required>
                <input
                  className="gecko-input"
                  placeholder="e.g. 20' Standard"
                  value={form.commonName}
                  onChange={e => set({ commonName: e.target.value })}
                />
              </Field>

            </div>
          </div>

          {/* Section: Dimensions */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '22px 24px', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <SectionHead>Dimensions</SectionHead>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

              <Field label="Nominal Length">
                <select className="gecko-input" value={form.nominalLength} onChange={e => set({ nominalLength: e.target.value })}>
                  <option value="">— select —</option>
                  <option value="20ft">20&apos;</option>
                  <option value="40ft">40&apos;</option>
                  <option value="45ft">45&apos;</option>
                  <option value="48ft">48&apos;</option>
                  <option value="53ft">53&apos;</option>
                </select>
              </Field>

              <Field label="Nominal Height">
                <select className="gecko-input" value={form.nominalHeight} onChange={e => set({ nominalHeight: e.target.value })}>
                  <option value="">— select —</option>
                  <option value="standard">8&apos;6&quot; Standard</option>
                  <option value="highcube">9&apos;6&quot; High-Cube</option>
                </select>
              </Field>

              <Field label="Internal Cube">
                <NumInput
                  placeholder="e.g. 33.2"
                  value={form.internalCube}
                  onChange={v => set({ internalCube: v })}
                  suffix="m³"
                />
              </Field>

            </div>
          </div>

          {/* Section: Weights */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '22px 24px', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <SectionHead>Weights</SectionHead>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              <Field label="Max Payload">
                <NumInput
                  placeholder="e.g. 28230"
                  value={form.maxPayload}
                  onChange={v => set({ maxPayload: v })}
                  suffix="kg"
                />
              </Field>

              <Field label="Tare Weight">
                <NumInput
                  placeholder="e.g. 2300"
                  value={form.tareWeight}
                  onChange={v => set({ tareWeight: v })}
                  suffix="kg"
                />
              </Field>

            </div>
          </div>

          {/* Section: Operational */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '22px 24px', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <SectionHead>Operational</SectionHead>

            <div style={{ marginBottom: 20 }}>
              <Field label="Slots per TEU">
                <select className="gecko-input" value={form.slotsPerTEU} onChange={e => set({ slotsPerTEU: e.target.value })} style={{ maxWidth: 280 }}>
                  <option value="">— select —</option>
                  <option value="1teu">1 TEU (20&apos;)</option>
                  <option value="2teu">2 TEU (40&apos;/45&apos;)</option>
                </select>
              </Field>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {form.category === 'RF' && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '12px 14px', borderRadius: 8,
                  border: `1px solid ${form.requiresReeferPlug ? 'var(--gecko-info-300)' : 'var(--gecko-border)'}`,
                  background: form.requiresReeferPlug ? 'var(--gecko-info-50)' : 'var(--gecko-bg-surface)',
                }}>
                  <Toggle
                    value={form.requiresReeferPlug}
                    onChange={v => set({ requiresReeferPlug: v })}
                    activeColor="var(--gecko-info-600)"
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.requiresReeferPlug ? 'var(--gecko-info-700)' : 'var(--gecko-text-primary)' }}>
                      Requires Reefer Plug
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
                      Container must be assigned an active reefer plug point in the yard
                    </div>
                  </div>
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '12px 14px', borderRadius: 8,
                border: `1px solid ${form.oogSpecialHandling ? 'var(--gecko-warning-300)' : 'var(--gecko-border)'}`,
                background: form.oogSpecialHandling ? 'var(--gecko-warning-50)' : 'var(--gecko-bg-surface)',
              }}>
                <Toggle
                  value={form.oogSpecialHandling}
                  onChange={v => set({ oogSpecialHandling: v })}
                  activeColor="var(--gecko-warning-600)"
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: form.oogSpecialHandling ? 'var(--gecko-warning-700)' : 'var(--gecko-text-primary)' }}>
                    OOG / Special Handling
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
                    Out-of-gauge or non-standard cargo; requires stowage plan before vessel load
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '12px 14px', borderRadius: 8,
                border: `1px solid ${form.active ? 'var(--gecko-success-200)' : 'var(--gecko-border)'}`,
                background: form.active ? 'var(--gecko-success-50)' : 'var(--gecko-bg-surface)',
              }}>
                <Toggle value={form.active} onChange={v => set({ active: v })} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: form.active ? 'var(--gecko-success-700)' : 'var(--gecko-text-secondary)' }}>
                    {form.active ? 'Active' : 'Inactive'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
                    {form.active
                      ? 'This type is live and will appear in rate matrix, EIR, and yard operations'
                      : 'Disabled — type will not appear in operational selectors'}
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* ── RIGHT: live preview ── */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Live Preview
          </div>
          <PreviewCard form={form} />
          <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', textAlign: 'center' }}>
            Preview updates as you fill in the form
          </div>
        </div>

      </div>

      {/* ── Sticky footer ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gecko-bg-surface)',
        borderTop: '1px solid var(--gecko-border)',
        padding: '14px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        zIndex: 100,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)' }}>
          * ISO Type Code, Category, and Common Name are required
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/masters/container-types" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            Cancel
          </Link>
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={!canSave}
            style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
          >
            <Icon name="save" size={15} /> Save Type
          </button>
        </div>
      </div>

    </div>
  );
}
