"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ExportButton } from '@/components/ui/ExportButton';

const TABS = [
  { id: 'general',      label: 'General',         icon: 'tag' },
  { id: 'billing',      label: 'Billing Setup',    icon: 'invoice' },
  { id: 'payment',      label: 'Payment & Terms',  icon: 'fileText' },
  { id: 'tax',          label: 'Tax',              icon: 'percent' },
  { id: 'gl',           label: 'GL & Finance',     icon: 'database' },
  { id: 'applicability',label: 'Applicability',    icon: 'filter' },
  { id: 'usage',        label: 'Usage & History',  icon: 'activity' },
];

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--gecko-border)' }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>{title}</h3>
      {sub && <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Field({ label, children, required, span = 1 }: { label: string; children: React.ReactNode; required?: boolean; span?: number }) {
  return (
    <div className="gecko-form-group" style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
    </div>
  );
}

function TabGeneral({ edit }: { edit: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <SectionHead title="Identity" sub="Core code reference used in tariffs, EIR, and invoices." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Charge Code" required>
            <input className="gecko-input" defaultValue="LIFT-ON" readOnly={!edit} style={edit ? {} : { background: 'var(--gecko-bg-subtle)' }} />
          </Field>
          <Field label="Description" required>
            <input className="gecko-input" defaultValue="Container lift-on (crane / RTG / RS)" readOnly={!edit} />
          </Field>
          <Field label="Short Name">
            <input className="gecko-input" defaultValue="Lift-On" readOnly={!edit} />
          </Field>
          <Field label="Module" required>
            <select className="gecko-input" disabled={!edit}>
              <option>TOS — Terminal Operating System</option>
              <option>Trucking</option>
              <option>CFS — Cargo Freight Station</option>
              <option>M&R — Maintenance & Repair</option>
            </select>
          </Field>
        </div>
      </div>

      <div>
        <SectionHead title="Classification" sub="Category and type drive GL routing and tariff matrix dimensions." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Category" required>
            <select className="gecko-input" disabled={!edit}>
              <option>Yard &amp; Handling</option>
              <option>Gate &amp; Access</option>
              <option>Storage &amp; Demurrage</option>
              <option>Reefer &amp; DG</option>
              <option>CFS / Warehouse</option>
              <option>M&R / Depot</option>
              <option>Documentation &amp; VAS</option>
            </select>
          </Field>
          <Field label="Sub-category">
            <select className="gecko-input" disabled={!edit}>
              <option>Container Handling</option>
              <option>Equipment Moves</option>
            </select>
          </Field>
          <Field label="Charge Type" required>
            <select className="gecko-input" disabled={!edit}>
              <option>Revenue — billed to customer</option>
              <option>Cost — internal / vendor cost</option>
              <option>Pass-through — carrier / authority</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="gecko-input" disabled={!edit}>
              <option>Active</option>
              <option>Inactive</option>
              <option>Draft</option>
            </select>
          </Field>
        </div>
      </div>

      <div>
        <SectionHead title="Validity Window" sub="Leave blank to indicate no expiry." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <Field label="Effective From">
            <input className="gecko-input" defaultValue="01-01-2024" readOnly={!edit} />
          </Field>
          <Field label="Effective To">
            <input className="gecko-input" placeholder="No expiry" readOnly={!edit} />
          </Field>
          <Field label="Supersedes Code">
            <input className="gecko-input" placeholder="—" readOnly={!edit} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function TabBilling({ edit }: { edit: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <SectionHead title="Rate Configuration" sub="Defines how price is computed per occurrence." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Billing Unit (UoM)" required>
            <select className="gecko-input" disabled={!edit}>
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
            <select className="gecko-input" disabled={!edit}>
              <option>Flat — fixed amount</option>
              <option>Per-unit — qty × rate</option>
              <option>Tiered — escalating tiers</option>
              <option>Min/Max capped</option>
            </select>
          </Field>
          <Field label="Default Currency" required>
            <select className="gecko-input" disabled={!edit}>
              <option>THB — Thai Baht</option>
              <option>USD — US Dollar</option>
              <option>EUR — Euro</option>
            </select>
          </Field>
          <Field label="Base Rate">
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-secondary)', fontSize: 13, fontWeight: 600 }}>฿</span>
              <input className="gecko-input gecko-text-mono" defaultValue="850.00" readOnly={!edit} style={{ paddingLeft: 22 }} />
            </div>
          </Field>
        </div>
      </div>

      <div>
        <SectionHead title="Thresholds" sub="Min/Max cap and free quantity before charge triggers." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <Field label="Minimum Charge">
            <input className="gecko-input gecko-text-mono" defaultValue="850.00" readOnly={!edit} />
          </Field>
          <Field label="Maximum Charge">
            <input className="gecko-input gecko-text-mono" placeholder="No cap" readOnly={!edit} />
          </Field>
          <Field label="Free Quantity">
            <input className="gecko-input gecko-text-mono" placeholder="0" readOnly={!edit} />
          </Field>
        </div>
      </div>

      <div>
        <SectionHead title="Size Differentiation" sub="Override base rate per container ISO size class." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 18 }}>
          {["20' (TEU)", "40' (FEU)", "40' HC", "45'"].map(size => (
            <Field key={size} label={size}>
              <input className="gecko-input gecko-text-mono" placeholder="= Base" readOnly={!edit} />
            </Field>
          ))}
        </div>
      </div>

      <div>
        <SectionHead title="Round-up Rule" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Rounding Method">
            <select className="gecko-input" disabled={!edit}>
              <option>Round up to nearest whole unit</option>
              <option>Round to 2 decimal places</option>
              <option>No rounding (exact)</option>
            </select>
          </Field>
          <Field label="Prorate Split">
            <select className="gecko-input" disabled={!edit}>
              <option>Not applicable</option>
              <option>By TEU weight</option>
              <option>Equally per container</option>
            </select>
          </Field>
        </div>
      </div>
    </div>
  );
}

function TabPayment({ edit }: { edit: boolean }) {
  const [payTerm, setPayTerm] = useState('Cash');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <SectionHead title="Charge & Payment Terms" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Charge Term" required>
            <select className="gecko-input" disabled={!edit}>
              <option>Prepaid — shipper pays before departure</option>
              <option>Collect — consignee pays at destination</option>
              <option>Either — per-shipment election</option>
            </select>
          </Field>
          <Field label="Payment Term" required>
            <select className="gecko-input" disabled={!edit} value={payTerm} onChange={e => setPayTerm(e.target.value)}>
              <option value="Cash">Cash on invoice</option>
              <option value="Credit">Credit (open account)</option>
              <option value="Advance">Advance payment</option>
            </select>
          </Field>
          {payTerm === 'Credit' && (
            <Field label="Credit Days" required>
              <input className="gecko-input gecko-text-mono" defaultValue="30" readOnly={!edit} />
            </Field>
          )}
        </div>
      </div>

      <div>
        <SectionHead title="Invoice Grouping" sub="Controls how events are consolidated on invoices." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Grouping Level">
            <select className="gecko-input" disabled={!edit}>
              <option>Per container (one line per box)</option>
              <option>Per booking</option>
              <option>Per vessel/voyage</option>
              <option>Per customer (monthly)</option>
            </select>
          </Field>
          <Field label="Billing Trigger">
            <select className="gecko-input" disabled={!edit}>
              <option>On event (real-time)</option>
              <option>On gate-out</option>
              <option>On vessel departure</option>
              <option>End of day</option>
              <option>Manual</option>
            </select>
          </Field>
        </div>
      </div>
    </div>
  );
}

function TabTax({ edit }: { edit: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <SectionHead title="Tax Classification" sub="Controls which tax rules apply when the code is invoiced." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Tax Category" required>
            <select className="gecko-input" disabled={!edit}>
              <option>Standard rate (7% Thai VAT)</option>
              <option>Zero-rated</option>
              <option>Exempt</option>
              <option>Reverse charge (B2B)</option>
              <option>Out of scope</option>
            </select>
          </Field>
          <Field label="VAT Rate %">
            <div style={{ position: 'relative' }}>
              <input className="gecko-input gecko-text-mono" defaultValue="7.00" readOnly={!edit} style={{ paddingRight: 28 }} />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-secondary)', fontSize: 13 }}>%</span>
            </div>
          </Field>
          <Field label="Tax Code">
            <input className="gecko-input gecko-text-mono" defaultValue="VAT-TH-S7" readOnly={!edit} />
          </Field>
          <Field label="Tax Group">
            <select className="gecko-input" disabled={!edit}>
              <option>TH Standard Services</option>
              <option>TH Export (Zero-rate)</option>
              <option>International Pass-through</option>
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--gecko-info-50)', borderRadius: 8, display: 'flex', gap: 10 }}>
          <Icon name="info" size={15} style={{ color: 'var(--gecko-info-600)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--gecko-info-800)', lineHeight: 1.5 }}>
            Charges invoiced to customers with overseas billing addresses and marked as export services are automatically zero-rated. Override using the Tax Group field.
          </div>
        </div>
      </div>

      <div>
        <SectionHead title="Withholding Tax" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="WHT Applicable">
            <select className="gecko-input" disabled={!edit}>
              <option>No</option>
              <option>Yes — 3% (services)</option>
              <option>Yes — 5% (transportation)</option>
            </select>
          </Field>
          <Field label="Revenue Department Code">
            <input className="gecko-input gecko-text-mono" placeholder="—" readOnly={!edit} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function TabGL({ edit }: { edit: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <SectionHead title="General Ledger Mapping" sub="Revenue and cost postings when the code is invoiced or accrued." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Revenue GL Account" required>
            <div style={{ position: 'relative' }}>
              <input className="gecko-input gecko-text-mono" defaultValue="4120 — Yard Handling Revenue" readOnly={!edit} />
            </div>
          </Field>
          <Field label="Cost GL Account">
            <input className="gecko-input gecko-text-mono" defaultValue="5120 — Equipment Operating Cost" readOnly={!edit} />
          </Field>
          <Field label="Deferred Revenue GL">
            <input className="gecko-input gecko-text-mono" placeholder="—" readOnly={!edit} />
          </Field>
          <Field label="Accruals GL">
            <input className="gecko-input gecko-text-mono" placeholder="—" readOnly={!edit} />
          </Field>
        </div>
      </div>

      <div>
        <SectionHead title="Cost & Revenue Centre" sub="Used for management reporting and P&L allocation." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <Field label="Revenue Stream">
            <select className="gecko-input" disabled={!edit}>
              <option>Handling &amp; Moves</option>
              <option>Storage &amp; Demurrage</option>
              <option>Ancillary Services</option>
              <option>CFS Operations</option>
              <option>M&R / Depot</option>
            </select>
          </Field>
          <Field label="Cost Centre">
            <select className="gecko-input" disabled={!edit}>
              <option>YARD-OPS</option>
              <option>GATE-OPS</option>
              <option>CFS-OPS</option>
              <option>ADMIN</option>
            </select>
          </Field>
          <Field label="Profit Centre">
            <select className="gecko-input" disabled={!edit}>
              <option>LCB-ICD</option>
              <option>LCB-CFS</option>
              <option>DEPOT-MR</option>
            </select>
          </Field>
        </div>
      </div>

      <div>
        <SectionHead title="EDI / Interface Codes" sub="Code mapping for carrier EDI, customs systems, and TradeLens." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <Field label="SMDG Charge Code">
            <input className="gecko-input gecko-text-mono" placeholder="e.g. THC, LFT" readOnly={!edit} />
          </Field>
          <Field label="UN/EDIFACT Qualifier">
            <input className="gecko-input gecko-text-mono" defaultValue="AB" readOnly={!edit} />
          </Field>
          <Field label="Customs Reference">
            <input className="gecko-input gecko-text-mono" placeholder="—" readOnly={!edit} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function CheckGroup({ items, selected, color }: { items: string[]; selected: string[]; color: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(item => {
        const on = selected.includes(item);
        return (
          <label key={item} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px',
            border: `1px solid ${on ? color : 'var(--gecko-border)'}`,
            borderRadius: 8,
            background: on ? `color-mix(in srgb, ${color} 10%, transparent)` : 'var(--gecko-bg-surface)',
            cursor: 'pointer', fontSize: 12.5, fontWeight: on ? 700 : 500,
            color: on ? color : 'var(--gecko-text-secondary)',
          }}>
            <input type="checkbox" defaultChecked={on} style={{ accentColor: color }} />
            {item}
          </label>
        );
      })}
    </div>
  );
}

function TabApplicability() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <SectionHead title="Trade Direction" sub="Which flow types this charge applies to." />
        <CheckGroup
          items={['Import', 'Export', 'Transshipment', 'Domestic Transfer', 'Repositioning', 'All']}
          selected={['All']}
          color="var(--gecko-primary-600)"
        />
      </div>

      <div>
        <SectionHead title="Container Size" />
        <CheckGroup
          items={["20'", "40'", "40' HC", "45'", "All sizes"]}
          selected={['All sizes']}
          color="var(--gecko-info-600)"
        />
      </div>

      <div>
        <SectionHead title="Container Type" />
        <CheckGroup
          items={['Dry / GP', 'Reefer (RF)', 'Dangerous Goods (DG)', 'Out-of-gauge (OOG)', 'Tank', 'Open-top', 'Flat-rack', 'All types']}
          selected={['Dry / GP', 'Reefer (RF)', 'Dangerous Goods (DG)', 'Out-of-gauge (OOG)']}
          color="var(--gecko-accent-600)"
        />
      </div>

      <div>
        <SectionHead title="Cargo Status" />
        <CheckGroup
          items={['Full (laden)', 'Empty', 'Both']}
          selected={['Both']}
          color="var(--gecko-success-600)"
        />
      </div>

      <div>
        <SectionHead title="Customer Tier Applicability" sub="Leave all enabled unless this code is tier-restricted." />
        <CheckGroup
          items={['Key', 'Standard', 'Spot', 'Agent', 'All tiers']}
          selected={['All tiers']}
          color="var(--gecko-warning-600)"
        />
      </div>

      <div>
        <SectionHead title="Rate Override Policy" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div className="gecko-form-group">
            <label className="gecko-label">Override in Tariff Schedule</label>
            <select className="gecko-input">
              <option>Allowed — tariff rate takes precedence</option>
              <option>Locked — always use base rate</option>
              <option>Surcharge only — tariff can add, not reduce</option>
            </select>
          </div>
          <div className="gecko-form-group">
            <label className="gecko-label">Manual Override on Invoice</label>
            <select className="gecko-input">
              <option>Requires supervisor approval</option>
              <option>Always allowed</option>
              <option>Never allowed</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabUsage() {
  const tariffBindings = [
    { plan: 'Standard LCB-2026', type: 'Public',   rate: '฿850', notes: 'All containers' },
    { plan: 'TU-2026',           type: 'Contract', rate: '฿780', notes: 'Negotiated -8%' },
    { plan: 'SCG-2026',          type: 'Contract', rate: '฿810', notes: 'Volume 5k TEU+' },
    { plan: 'PTT-2026',          type: 'Contract', rate: '฿800', notes: 'Bulk discount' },
  ];
  const recent = [
    { date: 'Apr 25 11:42', ctr: 'TCKU3220481', type: '40 HC', customer: 'Thai Union', invoice: 'INV-26042201', amt: '฿850' },
    { date: 'Apr 25 11:18', ctr: 'MSCU4412820', type: "20'",   customer: 'SCG',         invoice: 'INV-26042199', amt: '฿850' },
    { date: 'Apr 25 10:55', ctr: 'HLBU2244810', type: '40 HC', customer: 'CP Foods',    invoice: 'INV-26042197', amt: '฿850' },
    { date: 'Apr 25 10:30', ctr: 'YMLU8820443', type: "20'",   customer: 'Thai Union',  invoice: 'INV-26042196', amt: '฿850' },
    { date: 'Apr 25 09:55', ctr: 'TGHU2118840', type: "40'",   customer: 'Indorama',    invoice: 'INV-26042191', amt: '฿850' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Usage KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--gecko-border)', border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
        {[
          { label: 'Events (30d)',   value: '820',     sub: 'lift-on occurrences' },
          { label: 'Revenue (30d)', value: '฿696k',   sub: '+11% vs prior period' },
          { label: 'YTD Revenue',   value: '฿8.24M',  sub: 'Jan – Apr 2026' },
          { label: 'Tariff Schedules',  value: '14',   sub: 'schedules referencing code' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--gecko-bg-surface)', padding: '16px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tariff Bindings */}
      <div>
        <SectionHead title="Tariff Schedule Bindings" sub="Schedules where this code appears as a rate line." />
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Effective Rate</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tariffBindings.map(b => (
              <tr key={b.plan}>
                <td style={{ fontWeight: 600, color: 'var(--gecko-primary-600)' }}>{b.plan}</td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: b.type === 'Contract' ? 'var(--gecko-warning-100)' : 'var(--gecko-primary-50)', color: b.type === 'Contract' ? 'var(--gecko-warning-700)' : 'var(--gecko-primary-700)' }}>{b.type}</span>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{b.rate}</td>
                <td style={{ color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{b.notes}</td>
                <td><button style={{ background: 'none', border: 'none', color: 'var(--gecko-primary-600)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>View →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Events */}
      <div>
        <SectionHead title="Recent Events" sub="Last 5 invoiced occurrences." />
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Container</th>
              <th>Size</th>
              <th>Customer</th>
              <th>Invoice</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(r => (
              <tr key={r.ctr + r.date}>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{r.date}</td>
                <td style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{r.ctr}</td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{r.type}</td>
                <td style={{ fontWeight: 600 }}>{r.customer}</td>
                <td style={{ color: 'var(--gecko-primary-600)', fontFamily: 'var(--gecko-font-mono)', fontSize: 12 }}>{r.invoice}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{r.amt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Change Log */}
      <div>
        <SectionHead title="Change Log" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { date: '2026-01-15 09:30', user: 'Somchai K.', action: 'Updated base rate', detail: '฿780 → ฿850 (annual review)' },
            { date: '2025-07-01 14:12', user: 'Apirak P.',  action: 'Added 45\' size override', detail: '฿850 (same as base)' },
            { date: '2024-01-01 00:00', user: 'System',     action: 'Code created', detail: 'Migrated from legacy TMS v2.1' },
          ].map((log, i, arr) => (
            <div key={log.date} style={{ display: 'flex', gap: 16, padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--gecko-border)' : 'none' }}>
              <div style={{ width: 140, flexShrink: 0, fontSize: 11, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>{log.date}</div>
              <div style={{ width: 100, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>{log.user}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{log.action}</div>
                <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{log.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChargeCodeDetailPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);
  const [activeTab, setActiveTab] = useState('general');
  const [editing, setEditing] = useState(false);

  const tabContent: Record<string, React.ReactNode> = {
    general:       <TabGeneral edit={editing} />,
    billing:       <TabBilling edit={editing} />,
    payment:       <TabPayment edit={editing} />,
    tax:           <TabTax edit={editing} />,
    gl:            <TabGL edit={editing} />,
    applicability: <TabApplicability />,
    usage:         <TabUsage />,
  };

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Breadcrumb + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
          <Link href="/masters" className="gecko-breadcrumb-item">Master Data</Link>
          <span className="gecko-breadcrumb-sep" />
          <Link href="/masters/charge-codes" className="gecko-breadcrumb-item">Charge Codes</Link>
          <span className="gecko-breadcrumb-sep" />
          <span className="gecko-breadcrumb-current">{code}</span>
        </nav>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="copy" size={15} /> Clone</button>
          <ExportButton resource="Charge code" iconSize={15} />
          {editing ? (
            <>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setEditing(false)}><Icon name="save" size={15} /> Save Changes</button>
            </>
          ) : (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setEditing(true)}><Icon name="edit" size={15} /> Edit</button>
          )}
        </div>
      </div>

      {/* Title + Status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{code}</h1>
            <span style={{ background: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Active</span>
            <span style={{ background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>TOS</span>
            <span style={{ background: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Revenue</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--gecko-text-secondary)', marginTop: 8 }}>
            Container lift-on (crane / RTG / RS) · Yard &amp; Handling · per lift
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', marginTop: 4 }}>
            Effective 01-Jan-2024 · Supersedes — · GL 4120
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>

        {/* Left: Tabs */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--gecko-border)', marginBottom: 28, overflowX: 'auto' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none',
                  padding: '10px 14px',
                  fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
                  color: activeTab === tab.id ? 'var(--gecko-primary-600)' : 'var(--gecko-text-secondary)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--gecko-primary-600)' : '2px solid transparent',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                <Icon name={tab.icon} size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {tabContent[activeTab]}
        </div>

        {/* Right: Quick Facts */}
        <div style={{ width: 290, flexShrink: 0 }}>
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: 22, position: 'sticky', top: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 18px 0' }}>Quick Facts</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { icon: 'tag',       color: 'var(--gecko-primary-500)',  bg: 'var(--gecko-primary-50)',  label: 'CATEGORY',        value: 'Yard & Handling',      sub: 'Sub: Container Moves' },
                { icon: 'invoice',   color: 'var(--gecko-info-600)',     bg: 'var(--gecko-info-50)',     label: 'BILLING UNIT',    value: 'Per lift / move',      sub: 'Basis: Flat rate' },
                { icon: 'database',  color: 'var(--gecko-accent-600)',   bg: 'var(--gecko-accent-50)',   label: 'GL ACCOUNT',      value: '4120 — Yard Revenue',  sub: 'Cost: 5120' },
                { icon: 'layers',    color: 'var(--gecko-success-600)',  bg: 'var(--gecko-success-50)',  label: 'TARIFF PLANS',    value: '14 plans',             sub: 'Last: Standard LCB-2026' },
                { icon: 'activity',  color: 'var(--gecko-warning-600)',  bg: 'var(--gecko-warning-50)',  label: 'YTD REVENUE',     value: '฿8.24M',               sub: '820 events in last 30d' },
              ].map((fact, i, arr) => (
                <div key={fact.label} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 11,
                  padding: '13px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--gecko-border)' : 'none',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: fact.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={fact.icon} size={14} style={{ color: fact.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gecko-text-secondary)', marginBottom: 2 }}>{fact.label}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gecko-text-primary)', lineHeight: 1.2 }}>{fact.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{fact.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--gecko-border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-secondary)', marginBottom: 10 }}>Applicability Matrix</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {['Import', 'Export', 'TS', '20\'', '40\'', '45\'', 'GP', 'RF', 'DG', 'OOG'].map(tag => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', border: '1px solid var(--gecko-primary-200)' }}>{tag}</span>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--gecko-bg-subtle)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Last Modified</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Jan 15, 2026</div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>by Somchai K. — rate review</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
