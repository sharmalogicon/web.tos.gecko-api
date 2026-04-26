"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PageToolbar, Field } from '@/components/ui/OpsPrimitives';

function SectionHeader({ icon, title, subtitle, step, right }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
      {step && (
        <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--gecko-primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{step}</div>
      )}
      <Icon name={icon} size={15} style={{ color: 'var(--gecko-text-secondary)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function TotalRow({ label, value, negative }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--gecko-text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: negative ? 'var(--gecko-error-600)' : 'var(--gecko-text-primary)' }}>{value}</span>
    </div>
  );
}

function PaymentRail({ tariff, subtotal, vat, wht, net, vatRate, whtRate }: any) {
  return (
    <aside className="gecko-card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Charges</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Auto-calculated from tariff</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)' }}>
            <Icon name="lock" size={10} />TARIFF LOCKED
          </span>
        </div>
      </div>

      {/* Line items */}
      <div style={{ padding: '10px 0', maxHeight: 280, overflow: 'auto' }}>
        {tariff.map((t: any) => (
          <div key={t.code} style={{ padding: '8px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--gecko-text-primary)', fontWeight: 500 }}>{t.desc}</div>
              <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)', marginTop: 1 }}>{t.code} · {t.qty} × ฿{t.rate.toLocaleString()}/{t.unit}</div>
            </div>
            <div style={{ fontSize: 13, fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, textAlign: 'right' }}>฿{t.amount.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div style={{ borderTop: '1px solid var(--gecko-border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <TotalRow label="Subtotal" value={`฿${subtotal.toLocaleString()}`} />
        <TotalRow label={`VAT ${(vatRate*100).toFixed(0)}%`} value={`฿${vat.toLocaleString()}`} />
        <TotalRow label={`Withholding ${(whtRate*100).toFixed(0)}%`} value={`-฿${wht.toLocaleString()}`} negative />
      </div>
      <div style={{ borderTop: '1px solid var(--gecko-border)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: 'var(--gecko-bg-subtle)' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.08em' }}>NET PAYABLE</div>
          <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>THB</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', letterSpacing: '-0.02em' }}>฿{net.toLocaleString()}</div>
      </div>

      {/* Invoice controls */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--gecko-border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="print" size={12} />EIR Form</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="print" size={12} />Coupon (ABB)</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="invoice" size={12} />Tax Invoice</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="print" size={12} />Pick-up Form</button>
        </div>
        <button className="gecko-btn gecko-btn-primary" aria-label="Commit visit and open gate" style={{ marginTop: 4 }}>
          <Icon name="check" size={14} />Commit Visit · Open Gate
        </button>
        <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', textAlign: 'center' }}>Committing issues EIR + invoice and releases the truck</div>
      </div>
    </aside>
  );
}

function VasServicesCard() {
  const services = [
    { code: 'REEFER-MON',   name: 'Reefer Monitoring',           unit: 'day',   applied: false },
    { code: 'WASH',         name: 'Container Wash (interior)',   unit: 'move',  applied: true  },
    { code: 'FUMIGATION',   name: 'Fumigation Service',           unit: 'move',  applied: false },
    { code: 'DG-SEG',       name: 'DG Segregation Handling',      unit: 'move',  applied: true  },
  ];
  return (
    <section className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
      <SectionHeader
        icon="tag"
        title="Value-Added Services"
        subtitle="Optional chargeable services for this truck visit · rates from tariff"
        step={4}
      />
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {services.map(s => (
          <div key={s.code} style={{
            padding: 12, borderRadius: 8,
            border: `1px solid ${s.applied ? 'var(--gecko-primary-600)' : 'var(--gecko-border)'}`,
            background: s.applied ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
            cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 10, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>{s.code}</span>
              <input type="checkbox" className="gecko-checkbox" defaultChecked={s.applied} aria-label={`Enable ${s.name}`} />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: s.applied ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)', marginBottom: 3 }}>{s.name}</div>
            <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>Billed per {s.unit}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DamageTab({ line }: any) {
  const panels = [
    { id: 'front',  label: 'Front (Door End)', codes: [] },
    { id: 'back',   label: 'Back (Blind End)', codes: [{ x: 45, y: 55, code: 'DT', sev: 'minor' }] },
    { id: 'lsw',    label: 'Left Side Wall',   codes: [{ x: 70, y: 30, code: 'SC', sev: 'minor' }] },
    { id: 'rsw',    label: 'Right Side Wall',  codes: [] },
    { id: 'roof',   label: 'Roof',             codes: [] },
    { id: 'floor',  label: 'Floor',            codes: [] },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>IICL 6-Panel Survey</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {panels.map((p: any) => (
            <div key={p.id} style={{ position: 'relative', aspectRatio: '1.6 / 1', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 6, padding: 4, cursor: 'crosshair' }}>
              <div style={{ position: 'absolute', top: 4, left: 6, fontSize: 9, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{p.label}</div>
              <svg viewBox="0 0 100 60" style={{ width: '100%', height: '100%' }}>
                <rect x="4" y="12" width="92" height="44" fill="none" stroke="var(--gecko-border-strong)" strokeWidth="0.5" strokeDasharray="2 2" />
                {[20, 28, 36, 44, 52].map(y => <line key={y} x1="4" y1={y} x2="96" y2={y} stroke="var(--gecko-border-strong)" strokeWidth="0.2" />)}
                {p.codes.map((c: any, i: number) => (
                  <g key={i}>
                    <circle cx={c.x} cy={c.y} r="3.5" fill={c.sev === 'minor' ? 'var(--gecko-warning-500)' : 'var(--gecko-error-500)'} stroke="#fff" strokeWidth="0.7" />
                    <text x={c.x} y={c.y + 1.3} fontSize="3" fill="#fff" textAnchor="middle" fontWeight="700">{c.code}</text>
                  </g>
                ))}
              </svg>
              {p.codes.length > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 6, padding: '0 5px', fontSize: 9, fontWeight: 700, background: 'var(--gecko-warning-500)', color: '#fff', borderRadius: 3 }}>{p.codes.length}</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: 'var(--gecko-bg-subtle)', borderRadius: 6, fontSize: 11 }}>
          <Icon name="help" size={13} style={{ color: 'var(--gecko-text-secondary)' }} />
          <span style={{ color: 'var(--gecko-text-secondary)' }}>Click any panel to drop a damage marker. Codes follow IICL-6 (DT · SC · BE · HO · CR · DN).</span>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recorded Damage</div>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="plus" size={12} />Add</button>
        </div>

        <div style={{ border: '1px solid var(--gecko-border)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { panel: 'Back',      code: 'DT', desc: 'Dent (≤ 25mm)',     sev: 'Minor',  cost: '—' },
            { panel: 'Left Wall', code: 'SC', desc: 'Scratch (surface)', sev: 'Minor',  cost: '—' },
          ].map((d, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 60px 1fr 70px 24px', gap: 8, padding: '10px 12px', borderBottom: i === 1 ? 'none' : '1px solid var(--gecko-border)', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: 'var(--gecko-text-secondary)' }}>{d.panel}</span>
              <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, padding: '2px 6px', background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', borderRadius: 3, textAlign: 'center', fontSize: 11 }}>{d.code}</span>
              <span>{d.desc}</span>
              <span className="gecko-badge gecko-badge-warning" style={{ fontSize: 10, justifySelf: 'start' }}>{d.sev}</span>
              <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--gecko-text-disabled)' }}><Icon name="trash" size={13} /></button>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <Field label="Surveyor"><input className="gecko-input gecko-input-sm" defaultValue="J. Pattana" /></Field>
          <Field label="Photos">
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ width: '100%', height: 32 }}><Icon name="camera" size={13} />Attach (3)</button>
          </Field>
          <Field label="Notes" span={2}>
            <textarea className="gecko-input gecko-input-sm" rows={2} defaultValue="Minor transit damage, no structural impact. Photos taken from 3 angles." style={{ fontFamily: 'inherit', padding: 8, resize: 'vertical' }} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function SealRow({ label, required, value, verified, placeholder }: any) {
  return (
    <div>
      <label className={`gecko-label ${required ? 'gecko-label-required' : ''}`} style={{ marginBottom: 4 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <Icon name="lock" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)' }} />
        <input className="gecko-input gecko-input-sm" defaultValue={value} placeholder={placeholder} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: value ? 600 : 400, paddingLeft: 32, paddingRight: verified ? 30 : 10 }} />
        {verified && <Icon name="shieldCheck" size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-success-600)' }} />}
      </div>
    </div>
  );
}

function SealsWeightsTab({ line }: any) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* Seals */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Seal Chain</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SealRow label="Shipper Seal" required value="SH-884221" verified />
          <SealRow label="Line Seal"    required value="CMA-AZ-74421" verified />
          <SealRow label="Customs Seal"          value="TH-CUS-02914" verified />
          <SealRow label="Terminal Seal"        value="" placeholder="Apply at gate" />
        </div>
      </div>

      {/* Weights + VGM */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Weights · VGM (SOLAS)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Tare (kg)"><input className="gecko-input gecko-input-sm" defaultValue={line.tare} style={{ fontFamily: 'var(--gecko-font-mono)', textAlign: 'right' }} /></Field>
          <Field label="Max Gross (kg)"><input className="gecko-input gecko-input-sm" defaultValue={line.max} style={{ fontFamily: 'var(--gecko-font-mono)', textAlign: 'right' }} /></Field>
          <Field label="Cargo (kg)"><input className="gecko-input gecko-input-sm" defaultValue={line.cargo || ''} placeholder="—" style={{ fontFamily: 'var(--gecko-font-mono)', textAlign: 'right' }} /></Field>
          <Field label="VGM (kg)" required helper="Verified Gross Mass">
            <input className="gecko-input gecko-input-sm" defaultValue={line.vgm || ''} placeholder="Required" style={{ fontFamily: 'var(--gecko-font-mono)', textAlign: 'right', fontWeight: 700, background: line.vgm ? '#fff' : 'var(--gecko-warning-50)' }} />
          </Field>
          <Field label="VGM Method" span={2}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="gecko-btn gecko-btn-sm" style={{ flex: 1, height: 32, background: 'var(--gecko-primary-600)', color: '#fff', border: '1px solid var(--gecko-primary-600)' }}><Icon name="scale" size={13} />Method 1 · Weighbridge</button>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ flex: 1, height: 32 }}>Method 2 · Calculated</button>
            </div>
          </Field>
          <Field label="Weighbridge Ticket" span={2}>
            <input className="gecko-input gecko-input-sm" defaultValue="WB-26042614341" style={{ fontFamily: 'var(--gecko-font-mono)' }} />
          </Field>
        </div>

        <div style={{ marginTop: 12, padding: 10, background: 'var(--gecko-info-50)', borderRadius: 6, fontSize: 11, color: 'var(--gecko-info-700)', display: 'flex', gap: 8 }}>
          <Icon name="help" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>VGM must be declared per SOLAS VI Regulation 2. Terminal may refuse loading if not verified.</span>
        </div>
      </div>
    </div>
  );
}

function UnitTab({ line }: any) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      <Field label="Unit No." required span={2}>
        <div style={{ position: 'relative' }}>
          <input className="gecko-input gecko-input-sm" defaultValue={line.unit} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 14, paddingRight: 60 }} />
          <div style={{ position: 'absolute', right: 4, top: 4, display: 'flex', gap: 2 }}>
            <button title="OCR capture" style={{ height: 24, width: 24, border: 'none', background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', borderRadius: 4, cursor: 'pointer' }}><Icon name="camera" size={14} /></button>
            <button title="Check digit valid" style={{ height: 24, width: 24, border: 'none', background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)', borderRadius: 4, cursor: 'pointer' }}><Icon name="shieldCheck" size={14} /></button>
          </div>
        </div>
      </Field>
      <Field label="ISO Type" required>
        <input className="gecko-input gecko-input-sm" defaultValue={line.iso} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} />
      </Field>
      <Field label="Size">
        <select className="gecko-input gecko-input-sm" defaultValue={line.iso.startsWith('40') ? "40'" : "20'"}>
          <option>20'</option><option>40'</option><option>45'</option>
        </select>
      </Field>

      <Field label="Status">
        <select className="gecko-input gecko-input-sm" defaultValue={line.laden}><option value="F">Full</option><option value="E">Empty</option></select>
      </Field>
      <Field label="IICL Grade" helper="Condition grade">
        <select className="gecko-input gecko-input-sm" defaultValue="A"><option>A (Food)</option><option>B</option><option>C</option><option>D (Repair)</option></select>
      </Field>
      <Field label="Material">
        <select className="gecko-input gecko-input-sm" defaultValue="STEEL"><option>STEEL</option><option>ALUM</option></select>
      </Field>
      <Field label="Height Class">
        <select className="gecko-input gecko-input-sm" defaultValue="HC"><option value="HC">High-Cube (9'6")</option><option value="ST">Standard (8'6")</option></select>
      </Field>

      <Field label="Reefer · Setpoint">
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="gecko-input gecko-input-sm" placeholder="—" disabled style={{ flex: 1, background: 'var(--gecko-bg-subtle)' }} />
          <select className="gecko-input gecko-input-sm" disabled style={{ width: 70, background: 'var(--gecko-bg-subtle)' }}><option>°C</option><option>°F</option></select>
        </div>
      </Field>
      <Field label="Vent · Mode">
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="gecko-input gecko-input-sm" placeholder="—" disabled style={{ flex: 1, background: 'var(--gecko-bg-subtle)' }} />
          <select className="gecko-input gecko-input-sm" disabled style={{ width: 80, background: 'var(--gecko-bg-subtle)' }}><option>CBM</option><option>%</option></select>
        </div>
      </Field>
      <Field label="Genset">
        <div style={{ display: 'flex', gap: 6 }}>
          <select className="gecko-input gecko-input-sm" defaultValue="NO" style={{ width: 80 }}><option>YES</option><option>NO</option></select>
          <input className="gecko-input gecko-input-sm" placeholder="Genset no." disabled style={{ flex: 1, background: 'var(--gecko-bg-subtle)' }} />
        </div>
      </Field>
      <Field label="Clip-on / Overside">
        <select className="gecko-input gecko-input-sm" defaultValue="STD"><option>Standard</option><option>Clip-on</option><option>Overside</option></select>
      </Field>

      {/* DG row — full width */}
      <div style={{ gridColumn: 'span 4', padding: 14, background: line.dg ? 'var(--gecko-error-50)' : 'var(--gecko-bg-subtle)', borderRadius: 8, border: `1px solid ${line.dg ? 'var(--gecko-error-200)' : 'var(--gecko-border)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: line.dg ? 12 : 0 }}>
            <Icon name="flame" size={16} style={{ color: line.dg ? 'var(--gecko-error-600)' : 'var(--gecko-text-secondary)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: line.dg ? 'var(--gecko-error-700)' : 'var(--gecko-text-primary)' }}>
              {line.dg ? 'Dangerous Goods Declared' : 'Dangerous Goods'}
            </span>
            <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked={line.dg} />
              <span>This shipment contains DG</span>
            </label>
          </div>
          {line.dg && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <Field label="IMDG Class" required><input className="gecko-input gecko-input-sm" defaultValue="3" style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} /></Field>
              <Field label="UN No." required><input className="gecko-input gecko-input-sm" defaultValue="UN1263" style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} /></Field>
              <Field label="Packing Group"><select className="gecko-input gecko-input-sm" defaultValue="III"><option>I</option><option>II</option><option>III</option></select></Field>
              <Field label="Flashpoint (°C)"><input className="gecko-input gecko-input-sm" defaultValue="23" style={{ fontFamily: 'var(--gecko-font-mono)' }} /></Field>
            </div>
          )}
      </div>

      <Field label="Customs Permit No." span={2}><input className="gecko-input gecko-input-sm" defaultValue="A-26-04-88321" style={{ fontFamily: 'var(--gecko-font-mono)' }} /></Field>
      <Field label="Next Destination"><input className="gecko-input gecko-input-sm" defaultValue="CY · Block B · Row 04" /></Field>
      <Field label="Commodity"><input className="gecko-input gecko-input-sm" defaultValue="Canned tuna — HS 160414" /></Field>
    </div>
  );
}

function MovementTab({ line }: any) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      <Field label="Trip Type" required>
        <div style={{ display: 'flex', gap: 6 }}>
          {['RCV', 'DLV'].map(t => (
            <button key={t} className="gecko-btn gecko-btn-sm" style={{
              flex: 1, height: 32,
              background: t === line.type ? 'var(--gecko-primary-600)' : 'var(--gecko-bg-surface)',
              color:      t === line.type ? '#fff' : 'var(--gecko-text-secondary)',
              border: `1px solid ${t === line.type ? 'var(--gecko-primary-600)' : 'var(--gecko-border)'}`,
            }}>{t === 'RCV' ? 'Receive' : 'Deliver'}</button>
          ))}
        </div>
      </Field>
      <Field label="Laden / Empty" required>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{k:'F',label:'Laden'},{k:'E',label:'Empty'}].map(o => (
            <button key={o.k} className="gecko-btn gecko-btn-sm" style={{
              flex: 1, height: 32,
              background: o.k === line.laden ? 'var(--gecko-primary-600)' : 'var(--gecko-bg-surface)',
              color:      o.k === line.laden ? '#fff' : 'var(--gecko-text-secondary)',
              border: `1px solid ${o.k === line.laden ? 'var(--gecko-primary-600)' : 'var(--gecko-border)'}`,
            }}>{o.label}</button>
          ))}
        </div>
      </Field>
      <Field label="Booking Type" required>
        <select className="gecko-input gecko-input-sm" defaultValue="EXPORT">
          <option>EXPORT</option><option>IMPORT</option><option>TRANSHIP</option><option>DOMESTIC</option>
        </select>
      </Field>
      <Field label="Order Type">
        <select className="gecko-input gecko-input-sm" defaultValue="STD">
          <option value="STD">Standard</option><option>Priority</option><option>VIP</option>
        </select>
      </Field>

      <Field label="Booking / BL No." required span={2}>
        <div style={{ position: 'relative' }}>
          <input className="gecko-input gecko-input-sm" defaultValue={line.bkg} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, paddingRight: 30 }} />
          <Icon name="check" size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-success-600)' }} />
        </div>
      </Field>
      <Field label="Line Operator" required>
        <input className="gecko-input gecko-input-sm" defaultValue={line.line} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} />
      </Field>
      <Field label="Consignee">
        <input className="gecko-input gecko-input-sm" defaultValue={line.consignee} />
      </Field>

      <Field label="Vessel · Voyage" span={2}>
        <input className="gecko-input gecko-input-sm" defaultValue={line.vessel} style={{ fontFamily: 'var(--gecko-font-mono)' }} />
      </Field>
      <Field label="e-Customs Ref" helper="Paperless declaration no.">
        <input className="gecko-input gecko-input-sm" defaultValue="03012604429" style={{ fontFamily: 'var(--gecko-font-mono)' }} />
      </Field>
      <Field label="Required Date">
        <input className="gecko-input gecko-input-sm" type="datetime-local" defaultValue="2026-04-25T08:00" />
      </Field>
    </div>
  );
}

function TripLinesCard({ lines, activeLine, onSelect, lineTab, onTabChange, line }: any) {
  return (
    <section className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
      <SectionHeader
        icon="box"
        title="Trip Lines"
        subtitle={`${lines.length} unit${lines.length === 1 ? '' : 's'} on this truck visit · each container is one trip line`}
        step={3}
        right={<button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="plus" size={12} />Add Line</button>}
      />

      {/* Line tabs / summary pills */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', overflow: 'auto' }} role="list">
        {lines.map((l: any, i: number) => {
          const on = i === activeLine;
          const done = l.status === 'completed';
          return (
            <button key={l.id} onClick={() => onSelect(i)} role="listitem" style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${on ? 'var(--gecko-primary-600)' : 'var(--gecko-border)'}`,
              background: on ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
              cursor: 'pointer', minWidth: 240, textAlign: 'left', fontFamily: 'inherit',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                background: done ? 'var(--gecko-success-500)' : on ? 'var(--gecko-primary-600)' : 'var(--gecko-gray-200)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
              }}>{done ? <Icon name="check" size={13} /> : l.id}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 700 }}>{l.unit}</span>
                  {l.dg && <span style={{ padding: '1px 4px', fontSize: 9, fontWeight: 700, borderRadius: 3, background: 'var(--gecko-error-100)', color: 'var(--gecko-error-700)' }}>DG</span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', display: 'flex', gap: 6 }}>
                  <span>{l.iso}</span>·<span>{l.laden === 'F' ? 'Laden' : 'MT'}</span>·<span>{l.line}</span>
                </div>
              </div>
              <Icon name="chevronDown" size={12} style={{ color: 'var(--gecko-text-disabled)', transform: on ? 'rotate(180deg)' : 'none' }} />
            </button>
          );
        })}
        <button style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
          border: '1px dashed var(--gecko-border-strong)', background: 'transparent', cursor: 'pointer',
          fontSize: 12, color: 'var(--gecko-text-secondary)', fontWeight: 500, fontFamily: 'inherit', minWidth: 140,
        }}><Icon name="plus" size={12} />Add Line</button>
      </div>

      {/* Inner tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '0 18px', borderBottom: '1px solid var(--gecko-border)' }} role="tablist">
        {[
          { k: 'movement',     label: 'Movement',      icon: 'arrowRight', badge: null },
          { k: 'unit',         label: 'Unit & Cargo',   icon: 'box',       badge: line.dg ? 'DG' : null },
          { k: 'sealsWeights', label: 'Seals & Weights', icon: 'lock',     badge: line.vgm ? null : '!' },
          { k: 'damage',       label: 'Damage Survey',   icon: 'warning',  badge: '2' },
        ].map(t => {
          const on = lineTab === t.k;
          return (
            <button key={t.k} onClick={() => onTabChange(t.k)} role="tab" aria-selected={lineTab === t.k} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px',
              border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              color: on ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
              fontSize: 12, fontWeight: 600,
              borderBottom: `2px solid ${on ? 'var(--gecko-primary-600)' : 'transparent'}`,
              marginBottom: -1,
            }}>
              <Icon name={t.icon} size={13} />
              {t.label}
              {t.badge && <span style={{
                padding: '1px 5px', fontSize: 9, fontWeight: 700, borderRadius: 3, marginLeft: 2,
                background: t.badge === '!' ? 'var(--gecko-warning-100)' : t.badge === 'DG' ? 'var(--gecko-error-100)' : 'var(--gecko-gray-200)',
                color:      t.badge === '!' ? 'var(--gecko-warning-700)' : t.badge === 'DG' ? 'var(--gecko-error-700)' : 'var(--gecko-text-secondary)',
              }}>{t.badge}</span>}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ margin: '6px 0', color: 'var(--gecko-error-600)' }}><Icon name="trash" size={12} />Remove Line</button>
      </div>

      {/* Tab body */}
      <div style={{ padding: 20 }}>
        {lineTab === 'movement'     && <MovementTab line={line} />}
        {lineTab === 'unit'         && <UnitTab line={line} />}
        {lineTab === 'sealsWeights' && <SealsWeightsTab line={line} />}
        {lineTab === 'damage'       && <DamageTab line={line} />}
      </div>

      {/* Line footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', flex: 1 }}>
          Trip line <strong style={{ color: 'var(--gecko-text-primary)' }}>{line.id} of {2}</strong> · Auto-saved 14:41
        </div>
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="arrowRight" size={12} style={{ transform: 'rotate(180deg)' }} />Previous</button>
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="check" size={12} />Save Trip Line</button>
      </div>
    </section>
  );
}

function BillingPartyCard({ billTo }: any) {
  return (
    <section className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
      <SectionHeader icon="invoice" title="Billing Party" subtitle="Determines tariff schedule and invoice bill-to" step={2} />
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 14 }}>
        <Field label="Customer Code" required>
          <input className="gecko-input gecko-input-sm" defaultValue={billTo.code} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} />
        </Field>
        <Field label="Name">
          <input className="gecko-input gecko-input-sm" defaultValue={billTo.name} readOnly style={{ background: 'var(--gecko-bg-subtle)' }} />
        </Field>
        <Field label="Tax ID">
          <input className="gecko-input gecko-input-sm" defaultValue={billTo.tax} readOnly style={{ background: 'var(--gecko-bg-subtle)', fontFamily: 'var(--gecko-font-mono)' }} />
        </Field>
        <Field label="Invoice Address" span={3}>
          <input className="gecko-input gecko-input-sm" defaultValue={billTo.address} readOnly style={{ background: 'var(--gecko-bg-subtle)' }} />
        </Field>
      </div>
    </section>
  );
}

function TruckDriverCard({ visit }: any) {
  return (
    <section className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
      <SectionHeader icon="truck" title="Truck & Driver" subtitle={`Arrived ${visit.startedAt} · Gate 1 · Lane 3`} step={1} />
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Field label="Truck Plate" required>
          <div style={{ position: 'relative' }}>
            <input className="gecko-input gecko-input-sm" defaultValue={visit.truck.plate} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, paddingRight: 30 }} />
            <button title="OCR capture" style={{ position: 'absolute', right: 4, top: 4, height: 24, width: 24, border: 'none', background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', borderRadius: 4, cursor: 'pointer' }}>
              <Icon name="camera" size={14} />
            </button>
          </div>
        </Field>
        <Field label="Trucker (Haulier)" required>
          <input className="gecko-input gecko-input-sm" defaultValue={visit.truck.trucker} />
        </Field>
        <Field label="Driver Name" required>
          <input className="gecko-input gecko-input-sm" defaultValue={visit.truck.driver} />
        </Field>
        <Field label="License No.">
          <input className="gecko-input gecko-input-sm" defaultValue={visit.truck.license} style={{ fontFamily: 'var(--gecko-font-mono)' }} />
        </Field>
        <Field label="Contact" span={1}>
          <input className="gecko-input gecko-input-sm" defaultValue={visit.truck.phone} style={{ fontFamily: 'var(--gecko-font-mono)' }} />
        </Field>
        <Field label="Trailer / Chassis">
          <input className="gecko-input gecko-input-sm" defaultValue="TLR-442-9" style={{ fontFamily: 'var(--gecko-font-mono)' }} />
        </Field>
        <Field label="Driver ID Verified">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            <Icon name="shieldCheck" size={14} /> Verified 14:34
          </div>
        </Field>
        <Field label="Safety Briefing">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            <Icon name="check" size={14} /> Acknowledged
          </div>
        </Field>
      </div>
    </section>
  );
}

export default function EirInPage() {
  const [activeLine, setActiveLine] = useState(0);
  const [lineTab, setLineTab] = useState('movement');
  const [vasDrawerOpen, setVasDrawerOpen] = useState(false);

  const visit = {
    eir: 'EIR-2026-04-4429',
    status: 'In Progress',
    appt: 'APT-2026-04-4432',
    source: 'Portal appointment',
    truck: { plate: '70-4455', trucker: 'Laem Chabang Trans.', driver: 'Prem Kanchana', license: 'TH-D-8841-22', phone: '+66 87 341 2200' },
    billTo: { code: 'C-00142', name: 'Thai Union Group PCL', address: '72/1 Rama III Rd, Bangkok 10120', tax: '0107537000084' },
    startedAt: '14:34:08',
  };

  const lines = [
    { id: 1, type: 'RCV', laden: 'F', unit: 'CMAU 331876-2', iso: '40HC', bkg: 'BKG-2026-04-8655', line: 'CMA',
      vessel: 'CMA CGM ARKAS · 301E', consignee: 'Thai Union Group', status: 'completed',
      dg: true, reefer: false, vgm: 28450, tare: 3800, max: 32500, cargo: 24650 },
    { id: 2, type: 'RCV', laden: 'F', unit: 'CMAU 445002-1', iso: '20GP', bkg: 'BKG-2026-04-8655', line: 'CMA',
      vessel: 'CMA CGM ARKAS · 301E', consignee: 'Thai Union Group', status: 'in-progress',
      dg: false, reefer: false, vgm: null, tare: 2200, max: 24000, cargo: null },
  ];

  const tariff = [
    { code: 'LIFT-ON',   desc: 'Container lift-on (Full, 40\')',         qty: 1, unit: 'move', rate: 850,  amount: 850 },
    { code: 'GATE-IN',   desc: 'Gate-in transaction fee',                 qty: 2, unit: 'move', rate: 150,  amount: 300 },
    { code: 'DG-HNDL',   desc: 'Dangerous goods handling surcharge',     qty: 1, unit: 'move', rate: 1200, amount: 1200 },
    { code: 'VGM-VERIF', desc: 'VGM verification (SOLAS)',               qty: 2, unit: 'move', rate: 50,   amount: 100 },
    { code: 'DOC-FEE',   desc: 'Documentation — EIR issuance',            qty: 1, unit: 'doc',  rate: 200,  amount: 200 },
  ];
  const subtotal = tariff.reduce((s, t) => s + t.amount, 0);
  const vatRate = 0.07;
  const whtRate = 0.03;
  const vat = Math.round(subtotal * vatRate);
  const wht = Math.round(subtotal * whtRate);
  const net = subtotal + vat - wht;

  const line = lines[activeLine];

  return (
    <div role="main" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageToolbar
        title="EIR-In · Receive Transaction"
        subtitle={<>From appointment <span style={{ fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', fontWeight: 600 }}>{visit.appt}</span> · {visit.source}</>}
        badges={[
          { label: visit.eir, kind: 'gray' },
          { label: visit.status, kind: 'warning' },
        ]}
        actions={
          <>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="x" size={13} />Cancel Visit</button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="check" size={13} />Save Draft</button>
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="print" size={13} />Commit &amp; Print EIR</button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <TruckDriverCard visit={visit} />
          <BillingPartyCard billTo={visit.billTo} />
          <TripLinesCard
            lines={lines}
            activeLine={activeLine}
            onSelect={setActiveLine}
            lineTab={lineTab}
            onTabChange={setLineTab}
            line={line}
          />
          <VasServicesCard />
        </div>

        <PaymentRail tariff={tariff} subtotal={subtotal} vat={vat} wht={wht} net={net} vatRate={vatRate} whtRate={whtRate} />
      </div>
    </div>
  );
}
