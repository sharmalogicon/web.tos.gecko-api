"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { DateField } from '@/components/ui/DateField';

type ChargeType = 'Revenue' | 'Cost' | 'Pass-through';
type ChargeModule = 'TOS' | 'Trucking' | 'CFS' | 'M&R';

interface FormState {
  code: string;
  description: string;
  shortName: string;
  module: ChargeModule | '';
  category: string;
  chargeType: ChargeType | '';
  billingUnit: string;
  basis: string;
  currency: string;
  baseRate: string;
  minCharge: string;
  maxCharge: string;
  freeQty: string;
  chargeTerm: string;
  paymentTerm: string;
  creditDays: string;
  vatCategory: string;
  vatRate: string;
  revenueGL: string;
  costGL: string;
  revenueStream: string;
  directions: string[];
  sizes: string[];
  containerTypes: string[];
  cargoStatus: string[];
  status: string;
  effectiveFrom: string;
  effectiveTo: string;
}

const INITIAL_FORM: FormState = {
  code: '', description: '', shortName: '',
  module: '', category: '', chargeType: '',
  billingUnit: '', basis: 'Flat', currency: 'THB',
  baseRate: '', minCharge: '', maxCharge: '', freeQty: '',
  chargeTerm: 'Prepaid', paymentTerm: 'Cash', creditDays: '30',
  vatCategory: 'Standard', vatRate: '7.00',
  revenueGL: '', costGL: '', revenueStream: '',
  directions: ['All'], sizes: ['All sizes'],
  containerTypes: ['All types'], cargoStatus: ['Both'],
  status: 'Active', effectiveFrom: '', effectiveTo: '',
};

const STEPS = [
  { id: 1, label: 'Identity & Class',     icon: 'tag' },
  { id: 2, label: 'Billing Setup',         icon: 'invoice' },
  { id: 3, label: 'Terms & Tax',           icon: 'fileText' },
  { id: 4, label: 'Applicability',         icon: 'filter' },
  { id: 5, label: 'Review & Save',         icon: 'check' },
];

function StepHeader({ step, form }: { step: number; form: FormState }) {
  const pct = ((step - 1) / (STEPS.length - 1)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: step > s.id ? 'var(--gecko-success-600)' : step === s.id ? 'var(--gecko-primary-600)' : 'var(--gecko-bg-subtle)',
                border: `2px solid ${step >= s.id ? 'transparent' : 'var(--gecko-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: step >= s.id ? '#fff' : 'var(--gecko-text-disabled)',
              }}>
                {step > s.id ? <Icon name="check" size={16} /> : <Icon name={s.icon} size={16} />}
              </div>
              <span style={{ fontSize: 11, fontWeight: step === s.id ? 700 : 500, color: step === s.id ? 'var(--gecko-primary-600)' : 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: 'var(--gecko-border)', margin: '0 8px', marginBottom: 26, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'var(--gecko-primary-600)', width: step > s.id ? '100%' : '0%', transition: 'width 0.3s' }} />
              </div>
            )}
          </React.Fragment>
        ))}
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

function ToggleChip({ value, checked, color, onChange }: { value: string; checked: boolean; color: string; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: checked ? 700 : 500, cursor: 'pointer',
      border: `1.5px solid ${checked ? color : 'var(--gecko-border)'}`,
      background: checked ? `color-mix(in srgb, ${color} 12%, transparent)` : 'var(--gecko-bg-surface)',
      color: checked ? color : 'var(--gecko-text-secondary)',
    }}>
      {value}
    </button>
  );
}

function Step1({ form, set }: { form: FormState; set: (f: Partial<FormState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 4 }}>Identity</div>
        <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginBottom: 18 }}>The charge code and description appear on all invoices and tariff plans that reference it.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Charge Code" required hint="Uppercase, hyphenated. e.g. GATE-IN, RF-PLUG">
            <input className="gecko-input gecko-text-mono" placeholder="e.g. LIFT-ON" value={form.code} onChange={e => set({ code: e.target.value.toUpperCase() })} style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label="Short Name">
            <input className="gecko-input" placeholder="e.g. Lift-On" value={form.shortName} onChange={e => set({ shortName: e.target.value })} />
          </Field>
          <Field label="Description" required span={2}>
            <input className="gecko-input" placeholder="Full description as it appears on the invoice line" value={form.description} onChange={e => set({ description: e.target.value })} />
          </Field>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 4 }}>Classification</div>
        <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginBottom: 18 }}>Module and category drive GL routing, rate matrix dimensions, and report grouping.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Module" required>
            <select className="gecko-input" value={form.module} onChange={e => set({ module: e.target.value as ChargeModule })}>
              <option value="">— select —</option>
              <option value="TOS">TOS — Terminal Operating System</option>
              <option value="Trucking">Trucking</option>
              <option value="CFS">CFS — Cargo Freight Station</option>
              <option value="M&R">M&R — Maintenance &amp; Repair</option>
            </select>
          </Field>
          <Field label="Category" required>
            <select className="gecko-input" value={form.category} onChange={e => set({ category: e.target.value })}>
              <option value="">— select —</option>
              <option>Gate &amp; Access</option>
              <option>Yard &amp; Handling</option>
              <option>Storage &amp; Demurrage</option>
              <option>Reefer &amp; DG</option>
              <option>CFS / Warehouse</option>
              <option>M&R / Depot</option>
              <option>Documentation &amp; VAS</option>
            </select>
          </Field>
          <Field label="Charge Type" required>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['Revenue', 'Cost', 'Pass-through'] as ChargeType[]).map(t => {
                const on = form.chargeType === t;
                const colors: Record<ChargeType, string> = { Revenue: 'var(--gecko-success-600)', Cost: 'var(--gecko-danger-600)', 'Pass-through': 'var(--gecko-warning-600)' };
                return (
                  <button key={t} onClick={() => set({ chargeType: t })} style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10, border: `1.5px solid ${on ? colors[t] : 'var(--gecko-border)'}`,
                    background: on ? `color-mix(in srgb, ${colors[t]} 10%, transparent)` : 'var(--gecko-bg-surface)',
                    color: on ? colors[t] : 'var(--gecko-text-secondary)', fontWeight: on ? 700 : 500,
                    fontSize: 12.5, cursor: 'pointer', textAlign: 'center',
                  }}>
                    {t}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Status">
            <select className="gecko-input" value={form.status} onChange={e => set({ status: e.target.value })}>
              <option>Active</option>
              <option>Draft</option>
              <option>Inactive</option>
            </select>
          </Field>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 18 }}>Effective Date</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Effective From">
            <DateField value={form.effectiveFrom} onChange={v => set({ effectiveFrom: v })} />
          </Field>
          <Field label="Effective To" hint="Leave blank for no expiry">
            <DateField value={form.effectiveTo} onChange={v => set({ effectiveTo: v })} placeholder="No expiry" />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Step2({ form, set }: { form: FormState; set: (f: Partial<FormState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 4 }}>Rate Configuration</div>
        <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginBottom: 18 }}>Unit of measure and basis determine how the rate engine calculates the invoice amount.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Billing Unit (UoM)" required>
            <select className="gecko-input" value={form.billingUnit} onChange={e => set({ billingUnit: e.target.value })}>
              <option value="">— select —</option>
              <option>Per move / lift</option>
              <option>Per TEU</option>
              <option>Per FEU</option>
              <option>Per TEU·day</option>
              <option>Per BL</option>
              <option>Per m³</option>
              <option>Per m²·day</option>
              <option>Per kg</option>
              <option>Per ton</option>
              <option>Per hour</option>
              <option>Per event</option>
              <option>Per appointment</option>
            </select>
          </Field>
          <Field label="Charge Basis" required>
            <select className="gecko-input" value={form.basis} onChange={e => set({ basis: e.target.value })}>
              <option value="Flat">Flat — fixed amount</option>
              <option value="Per-unit">Per-unit — qty × rate</option>
              <option value="Tiered">Tiered — escalating tiers</option>
              <option value="Min/Max capped">Min/Max capped</option>
            </select>
          </Field>
          <Field label="Currency">
            <select className="gecko-input" value={form.currency} onChange={e => set({ currency: e.target.value })}>
              <option value="THB">THB — Thai Baht</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </Field>
          <Field label="Base Rate" hint={form.basis === 'Tiered' ? 'Tier 1 starting rate — configure tiers after saving.' : undefined}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>
                {form.currency === 'USD' ? '$' : '฿'}
              </span>
              <input className="gecko-input gecko-text-mono" placeholder="0.00" value={form.baseRate} onChange={e => set({ baseRate: e.target.value })} style={{ paddingLeft: 22 }} />
            </div>
          </Field>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 18 }}>Thresholds</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <Field label="Minimum Charge" hint="Floor — charge never falls below this">
            <input className="gecko-input gecko-text-mono" placeholder="= Base Rate" value={form.minCharge} onChange={e => set({ minCharge: e.target.value })} />
          </Field>
          <Field label="Maximum Charge" hint="Cap — charge never exceeds this">
            <input className="gecko-input gecko-text-mono" placeholder="No cap" value={form.maxCharge} onChange={e => set({ maxCharge: e.target.value })} />
          </Field>
          <Field label="Free Quantity" hint="e.g. 5 free days before storage triggers">
            <input className="gecko-input gecko-text-mono" placeholder="0" value={form.freeQty} onChange={e => set({ freeQty: e.target.value })} />
          </Field>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 4 }}>Size Differentiation</div>
        <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginBottom: 18 }}>Override base rate per container ISO size. Leave blank to inherit base rate.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {["20' (TEU)", "40' (FEU)", "40' HC", "45'"].map(s => (
            <Field key={s} label={s}>
              <input className="gecko-input gecko-text-mono" placeholder="= Base" />
            </Field>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step3({ form, set }: { form: FormState; set: (f: Partial<FormState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 18 }}>Charge & Payment Terms</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Charge Term" required>
            <select className="gecko-input" value={form.chargeTerm} onChange={e => set({ chargeTerm: e.target.value })}>
              <option value="Prepaid">Prepaid — shipper pays before departure</option>
              <option value="Collect">Collect — consignee pays at destination</option>
              <option value="Either">Either — elected per shipment</option>
            </select>
          </Field>
          <Field label="Payment Term" required>
            <select className="gecko-input" value={form.paymentTerm} onChange={e => set({ paymentTerm: e.target.value })}>
              <option value="Cash">Cash on invoice</option>
              <option value="Credit">Credit (open account)</option>
              <option value="Advance">Advance payment</option>
            </select>
          </Field>
          {form.paymentTerm === 'Credit' && (
            <Field label="Credit Days" required>
              <input className="gecko-input gecko-text-mono" value={form.creditDays} onChange={e => set({ creditDays: e.target.value })} />
            </Field>
          )}
          <Field label="Invoice Grouping">
            <select className="gecko-input">
              <option>Per container (one line per box)</option>
              <option>Per booking</option>
              <option>Per vessel/voyage</option>
              <option>Per customer (monthly)</option>
            </select>
          </Field>
          <Field label="Billing Trigger">
            <select className="gecko-input">
              <option>On event (real-time)</option>
              <option>On gate-out</option>
              <option>On vessel departure</option>
              <option>End of day</option>
              <option>Manual</option>
            </select>
          </Field>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 18 }}>Tax</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Tax Category" required>
            <select className="gecko-input" value={form.vatCategory} onChange={e => set({ vatCategory: e.target.value })}>
              <option value="Standard">Standard rate (7% Thai VAT)</option>
              <option value="Zero">Zero-rated</option>
              <option value="Exempt">Exempt</option>
              <option value="Reverse">Reverse charge (B2B)</option>
              <option value="OutOfScope">Out of scope</option>
            </select>
          </Field>
          {form.vatCategory === 'Standard' && (
            <Field label="VAT Rate %">
              <div style={{ position: 'relative' }}>
                <input className="gecko-input gecko-text-mono" value={form.vatRate} onChange={e => set({ vatRate: e.target.value })} style={{ paddingRight: 28 }} />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-secondary)', fontSize: 13 }}>%</span>
              </div>
            </Field>
          )}
          <Field label="Revenue GL Account">
            <input className="gecko-input gecko-text-mono" placeholder="e.g. 4120" value={form.revenueGL} onChange={e => set({ revenueGL: e.target.value })} />
          </Field>
          <Field label="Revenue Stream">
            <select className="gecko-input" value={form.revenueStream} onChange={e => set({ revenueStream: e.target.value })}>
              <option value="">— select —</option>
              <option>Handling &amp; Moves</option>
              <option>Storage &amp; Demurrage</option>
              <option>Ancillary Services</option>
              <option>CFS Operations</option>
              <option>M&R / Depot</option>
            </select>
          </Field>
        </div>
      </div>
    </div>
  );
}

function Step4({ form, set }: { form: FormState; set: (f: Partial<FormState>) => void }) {
  function toggle(key: keyof FormState, value: string, allValue: string) {
    const arr = form[key] as string[];
    if (value === allValue) {
      set({ [key]: [allValue] });
      return;
    }
    const without = arr.filter(v => v !== allValue);
    const next = without.includes(value) ? without.filter(v => v !== value) : [...without, value];
    set({ [key]: next.length === 0 ? [allValue] : next });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {[
        {
          title: 'Trade Direction',
          key: 'directions' as const,
          allValue: 'All',
          items: ['Import', 'Export', 'Transshipment', 'Repositioning', 'All'],
          color: 'var(--gecko-primary-600)',
        },
        {
          title: 'Container Size',
          key: 'sizes' as const,
          allValue: 'All sizes',
          items: ["20'", "40'", "40' HC", "45'", 'All sizes'],
          color: 'var(--gecko-info-600)',
        },
        {
          title: 'Container Type',
          key: 'containerTypes' as const,
          allValue: 'All types',
          items: ['Dry / GP', 'Reefer (RF)', 'DG', 'OOG', 'Tank', 'Open-top', 'All types'],
          color: 'var(--gecko-accent-600)',
        },
        {
          title: 'Cargo Status',
          key: 'cargoStatus' as const,
          allValue: 'Both',
          items: ['Full (laden)', 'Empty', 'Both'],
          color: 'var(--gecko-success-600)',
        },
      ].map(group => (
        <div key={group.key}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 12 }}>{group.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {group.items.map(item => (
              <ToggleChip
                key={item}
                value={item}
                checked={(form[group.key] as string[]).includes(item)}
                color={group.color}
                onChange={() => toggle(group.key, item, group.allValue)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Step5({ form }: { form: FormState }) {
  const sections = [
    { label: 'Charge Code',     value: form.code || '—' },
    { label: 'Description',     value: form.description || '—' },
    { label: 'Module',          value: form.module || '—' },
    { label: 'Category',        value: form.category || '—' },
    { label: 'Charge Type',     value: form.chargeType || '—' },
    { label: 'Billing Unit',    value: form.billingUnit || '—' },
    { label: 'Basis',           value: form.basis },
    { label: 'Currency',        value: form.currency },
    { label: 'Base Rate',       value: form.baseRate ? `${form.currency === 'USD' ? '$' : '฿'}${form.baseRate}` : '—' },
    { label: 'Charge Term',     value: form.chargeTerm },
    { label: 'Payment Term',    value: form.paymentTerm },
    { label: 'VAT',             value: form.vatCategory === 'Standard' ? `${form.vatRate}%` : form.vatCategory },
    { label: 'Revenue GL',      value: form.revenueGL || '—' },
    { label: 'Directions',      value: form.directions.join(', ') },
    { label: 'Sizes',           value: form.sizes.join(', ') },
    { label: 'ISO Container Types', value: form.containerTypes.join(', ') },
    { label: 'Status',          value: form.status },
  ];

  const missing = [
    !form.code && 'Charge Code',
    !form.description && 'Description',
    !form.module && 'Module',
    !form.category && 'Category',
    !form.chargeType && 'Charge Type',
    !form.billingUnit && 'Billing Unit',
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {missing.length > 0 && (
        <div style={{ padding: '14px 18px', background: 'var(--gecko-danger-50)', border: '1px solid var(--gecko-danger-200)', borderRadius: 10, display: 'flex', gap: 10 }}>
          <Icon name="alertCircle" size={16} style={{ color: 'var(--gecko-danger-600)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-danger-700)' }}>Missing required fields</div>
            <div style={{ fontSize: 12, color: 'var(--gecko-danger-600)', marginTop: 2 }}>{missing.join(' · ')}</div>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Review before saving</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {sections.map((s, i) => (
            <div key={s.label} style={{ padding: '12px 20px', borderBottom: i < sections.length - 2 ? '1px solid var(--gecko-border)' : 'none', borderRight: i % 2 === 0 ? '1px solid var(--gecko-border)' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-secondary)', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: s.value === '—' ? 'var(--gecko-text-disabled)' : 'var(--gecko-text-primary)', fontFamily: ['Charge Code', 'Revenue GL'].includes(s.label) ? 'var(--gecko-font-mono)' : undefined }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NewChargeCodePage() {
  const [step, setStep] = useState(1);
  const [form, setFormRaw] = useState<FormState>(INITIAL_FORM);
  const set = (partial: Partial<FormState>) => setFormRaw(prev => ({ ...prev, ...partial }));

  const stepContent: Record<number, React.ReactNode> = {
    1: <Step1 form={form} set={set} />,
    2: <Step2 form={form} set={set} />,
    3: <Step3 form={form} set={set} />,
    4: <Step4 form={form} set={set} />,
    5: <Step5 form={form} />,
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 60 }}>

      {/* Breadcrumb */}
      <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
        <Link href="/masters" className="gecko-breadcrumb-item">Master Data</Link>
        <span className="gecko-breadcrumb-sep" />
        <Link href="/masters/charge-codes" className="gecko-breadcrumb-item">Charge Codes</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">New Charge Code</span>
      </nav>

      {/* Title */}
      <div style={{ paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>New Charge Code</h1>
        <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 6 }}>
          Define a billable service unit. It will be available immediately in tariff plans and rate cards.
        </div>
      </div>

      {/* Step Indicator */}
      <StepHeader step={step} form={form} />

      {/* Card */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, padding: '32px 36px', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 24 }}>
          {STEPS[step - 1].label}
        </div>
        {stepContent[step]}
      </div>

      {/* Nav Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="gecko-btn gecko-btn-outline"
          onClick={() => setStep(s => Math.max(1, s - 1))}
          style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
        >
          <Icon name="chevronLeft" size={16} /> Back
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/masters/charge-codes" className="gecko-btn gecko-btn-ghost">Cancel</Link>
          {step < STEPS.length ? (
            <button className="gecko-btn gecko-btn-primary" onClick={() => setStep(s => Math.min(STEPS.length, s + 1))}>
              Continue <Icon name="chevronRight" size={16} />
            </button>
          ) : (
            <Link href="/masters/charge-codes/LIFT-ON" className="gecko-btn gecko-btn-primary">
              <Icon name="save" size={16} /> Save Charge Code
            </Link>
          )}
        </div>
      </div>

    </div>
  );
}
