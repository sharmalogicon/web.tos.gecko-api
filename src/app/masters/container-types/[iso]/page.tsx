"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { ExportButton } from '@/components/ui/ExportButton';
import { useToast } from '@/components/ui/Toast';

const CONTAINER_TYPES = [
  { id: '22G1', iso: '22G1', name: "20' Standard", dims: "20' × 8'6\"", type: 'GP', cat: 'GENERAL', payload: '28,230 kg', tare: '2,300 kg', cube: '33.2 m³', active: 12 },
  { id: '42G1', iso: '42G1', name: "40' Standard", dims: "40' × 8'6\"", type: 'GP', cat: 'GENERAL', payload: '26,700 kg', tare: '3,750 kg', cube: '67.7 m³', active: 18 },
  { id: '45G1', iso: '45G1', name: "40' High-Cube", dims: "40' × 9'6\"", type: 'GP', cat: 'GENERAL', payload: '26,500 kg', tare: '3,900 kg', cube: '76.3 m³', active: 14 },
  { id: 'L5G1', iso: 'L5G1', name: "45' High-Cube", dims: "45' × 9'6\"", type: 'GP', cat: 'GENERAL', payload: '26,500 kg', tare: '4,800 kg', cube: '86 m³', active: 3 },
  { id: '22R1', iso: '22R1', name: "20' Reefer", dims: "20' × 8'6\"", type: 'RF', cat: 'REEFER', payload: '27,400 kg', tare: '3,000 kg', cube: '28.1 m³', active: 4 },
  { id: '42R1', iso: '42R1', name: "40' Reefer", dims: "40' × 8'6\"", type: 'RF', cat: 'REEFER', payload: '26,900 kg', tare: '4,800 kg', cube: '57.8 m³', active: 3 },
  { id: '45R1', iso: '45R1', name: "40' Reefer HC", dims: "40' × 9'6\"", type: 'RF', cat: 'REEFER', payload: '29,520 kg', tare: '4,580 kg', cube: '67.3 m³', active: 5 },
  { id: '22U1', iso: '22U1', name: "20' Open Top", dims: "20' × 8'6\"", type: 'OT', cat: 'SPECIAL', payload: '28,080 kg', tare: '2,450 kg', cube: '32 m³', active: 2 },
  { id: '42U1', iso: '42U1', name: "40' Open Top", dims: "40' × 8'6\"", type: 'OT', cat: 'SPECIAL', payload: '26,580 kg', tare: '3,870 kg', cube: '65.4 m³', active: 3 },
];

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  GENERAL: { bg: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)' },
  REEFER:  { bg: 'var(--gecko-info-100)',    color: 'var(--gecko-info-700)' },
  SPECIAL: { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)' },
  HAZMAT:  { bg: 'var(--gecko-danger-100)',  color: 'var(--gecko-danger-700)' },
};

const TABS = [
  { id: 'details',   label: 'Details',          icon: 'fileText' },
  { id: 'inyard',    label: 'In Yard Units',     icon: 'box' },
  { id: 'tariff',    label: 'Tariff Bindings',   icon: 'tag' },
  { id: 'history',   label: 'History',           icon: 'activity' },
];

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--gecko-border)' }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>{title}</h3>
      {sub && <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{sub}</div>}
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

type ContainerType = typeof CONTAINER_TYPES[number];

function TabDetails({ ct, edit }: { ct: ContainerType; edit: boolean }) {
  const [features, setFeatures] = useState<string[]>(
    ct.type === 'RF' ? ['refrigeration', 'reeferPlugs'] : ct.type === 'OT' ? ['openTop'] : []
  );

  function toggleFeature(key: string) {
    setFeatures(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);
  }

  const ALL_FEATURES = [
    { key: 'refrigeration', label: 'Refrigeration unit built-in' },
    { key: 'reeferPlugs',   label: 'Reefer plugs required' },
    { key: 'openTop',       label: 'Open top (no roof)' },
    { key: 'flatRack',      label: 'Flat rack (no walls/roof)' },
    { key: 'tank',          label: 'Tank container' },
    { key: 'hazmat',        label: 'Hazmat rated' },
    { key: 'ventilated',    label: 'Ventilated' },
  ];

  const lengthStr = ct.dims.startsWith("20") ? "20ft" : ct.dims.startsWith("40") ? "40ft" : "45ft";
  const heightStr = ct.dims.includes("9'6") ? "highcube" : "standard";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ISO Identity */}
      <div>
        <SectionHead title="ISO Identity" sub="Core code reference — used in tariff, EIR, and vessel stow." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="ISO Code" required>
            <input
              className="gecko-input"
              defaultValue={ct.iso}
              readOnly={!edit}
              style={{
                fontFamily: 'var(--gecko-font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontSize: 16,
                fontWeight: 700,
                background: !edit ? 'var(--gecko-bg-subtle)' : undefined,
              }}
            />
          </Field>
          <Field label="Type Name" required>
            <input className="gecko-input" defaultValue={ct.name} readOnly={!edit} />
          </Field>
          <Field label="Category" required>
            <select className="gecko-input" disabled={!edit} defaultValue={ct.cat}>
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
            <select className="gecko-input" disabled={!edit} defaultValue={ct.type}>
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
      </div>

      {/* Physical Dimensions */}
      <div>
        <SectionHead title="Physical Dimensions" sub="External size class and internal usable space." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <Field label="Length">
            <select className="gecko-input" disabled={!edit} defaultValue={lengthStr}>
              <option value="20ft">20 ft</option>
              <option value="40ft">40 ft</option>
              <option value="45ft">45 ft</option>
              <option value="48ft">48 ft</option>
              <option value="53ft">53 ft</option>
            </select>
          </Field>
          <Field label="Height">
            <select className="gecko-input" disabled={!edit} defaultValue={heightStr}>
              <option value="standard">Standard 8&apos;6&quot;</option>
              <option value="highcube">High-Cube 9&apos;6&quot;</option>
              <option value="lowcube">Low-Cube 8&apos;0&quot;</option>
              <option value="doublestack">Double Stack</option>
            </select>
          </Field>
          <Field label="Width" hint="ISO standard — locked">
            <input
              className="gecko-input"
              value={"8'0 (2,438 mm)"}
              readOnly
              style={{ background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', cursor: 'not-allowed' }}
            />
          </Field>
          <Field label="External LOA (m)">
            <input
              className="gecko-input"
              defaultValue={lengthStr === '20ft' ? '6.058' : lengthStr === '40ft' ? '12.192' : '13.716'}
              readOnly={!edit}
              style={{ fontFamily: 'var(--gecko-font-mono)' }}
            />
          </Field>
          <Field label="Internal Length (m)">
            <input
              className="gecko-input"
              defaultValue={lengthStr === '20ft' ? '5.898' : lengthStr === '40ft' ? '12.032' : '13.556'}
              readOnly={!edit}
              style={{ fontFamily: 'var(--gecko-font-mono)' }}
            />
          </Field>
          <Field label="Internal Width (m)">
            <input className="gecko-input" defaultValue="2.352" readOnly={!edit} style={{ fontFamily: 'var(--gecko-font-mono)' }} />
          </Field>
          <Field label="Internal Height (m)">
            <input
              className="gecko-input"
              defaultValue={heightStr === 'highcube' ? '2.698' : '2.393'}
              readOnly={!edit}
              style={{ fontFamily: 'var(--gecko-font-mono)' }}
            />
          </Field>
        </div>
      </div>

      {/* Weight & Capacity */}
      <div>
        <SectionHead title="Weight &amp; Capacity" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <Field label="Payload / Max Cargo (kg)" required>
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input"
                defaultValue={ct.payload.replace(' kg', '')}
                readOnly={!edit}
                style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 32 }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>kg</span>
            </div>
          </Field>
          <Field label="Tare Weight (kg)" required>
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input"
                defaultValue={ct.tare.replace(' kg', '')}
                readOnly={!edit}
                style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 32 }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>kg</span>
            </div>
          </Field>
          <Field label="Max Gross Weight (kg)" hint="= Payload + Tare">
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input"
                readOnly
                defaultValue={(() => {
                  const p = parseFloat(ct.payload.replace(/[^0-9.]/g, ''));
                  const t = parseFloat(ct.tare.replace(/[^0-9.]/g, ''));
                  return (p + t).toLocaleString();
                })()}
                style={{ background: 'var(--gecko-bg-subtle)', fontFamily: 'var(--gecko-font-mono)', paddingRight: 32, cursor: 'not-allowed' }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>kg</span>
            </div>
          </Field>
          <Field label="Cubic Capacity (m³)">
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input"
                defaultValue={ct.cube.replace(' m³', '')}
                readOnly={!edit}
                style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 28 }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>m³</span>
            </div>
          </Field>
          <Field label="Door Opening Width (mm)">
            <div style={{ position: 'relative' }}>
              <input className="gecko-input" defaultValue="2,286" readOnly={!edit} style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 36 }} />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>mm</span>
            </div>
          </Field>
          <Field label="Door Opening Height (mm)">
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input"
                defaultValue={heightStr === 'highcube' ? '2,585' : '2,261'}
                readOnly={!edit}
                style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 36 }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>mm</span>
            </div>
          </Field>
        </div>
      </div>

      {/* Special Features */}
      <div>
        <SectionHead title="Special Features" sub="Controls yard zoning, plug assignments, and DG segregation rules." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {ALL_FEATURES.map(feat => {
            const checked = features.includes(feat.key);
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
                  cursor: edit ? 'pointer' : 'default',
                  opacity: !edit && !checked ? 0.55 : 1,
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  className="gecko-checkbox"
                  checked={checked}
                  disabled={!edit}
                  onChange={() => edit && toggleFeature(feat.key)}
                />
                <span style={{ fontSize: 13, fontWeight: checked ? 600 : 500, color: checked ? 'var(--gecko-primary-800)' : 'var(--gecko-text-secondary)' }}>
                  {feat.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Tariff & Operations */}
      <div>
        <SectionHead title="Tariff &amp; Operations" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Default Tariff Row">
            <input
              className="gecko-input"
              defaultValue={`STOR-${lengthStr === '20ft' ? '20' : '40'}${ct.type}`}
              readOnly={!edit}
              style={{ fontFamily: 'var(--gecko-font-mono)' }}
            />
          </Field>
          <Field label="Yard Slot Size">
            <select className="gecko-input" disabled={!edit} defaultValue={lengthStr === '20ft' ? '1 TEU' : '2 TEU'}>
              <option value="1 TEU">1 TEU</option>
              <option value="2 TEU">2 TEU</option>
              <option value="0.5 TEU">0.5 TEU</option>
            </select>
          </Field>
          <Field label="Stack Height Limit">
            <input className="gecko-input" defaultValue="4" readOnly={!edit} type="number" style={{ fontFamily: 'var(--gecko-font-mono)' }} />
          </Field>
          <Field label="Status">
            <select className="gecko-input" disabled={!edit}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </Field>
        </div>
      </div>

    </div>
  );
}

function TabInYard({ iso }: { iso: string }) {
  const units = [
    { unit: `TCKU322048${iso.slice(0,1)}`, status: 'Full',  location: 'Block B / Row 3 / Bay 5', lastMove: 'Gate-In · Apr 29 08:14', statusColor: 'var(--gecko-success-600)', statusBg: 'var(--gecko-success-50)' },
    { unit: `MSCU441282${iso.slice(0,1)}`, status: 'Empty', location: 'Block D / Row 1 / Bay 2', lastMove: 'Discharge · Apr 28 14:32', statusColor: 'var(--gecko-info-600)', statusBg: 'var(--gecko-info-50)' },
    { unit: `HLBU224481${iso.slice(0,1)}`, status: 'Full',  location: 'Block B / Row 5 / Bay 8', lastMove: 'Gate-In · Apr 27 11:55', statusColor: 'var(--gecko-success-600)', statusBg: 'var(--gecko-success-50)' },
    { unit: `YMLU882044${iso.slice(0,1)}`, status: 'Hold',  location: 'Block A / Row 7 / Bay 1', lastMove: 'Hold Applied · Apr 26 09:30', statusColor: 'var(--gecko-warning-600)', statusBg: 'var(--gecko-warning-50)' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>
          Containers currently in yard matching ISO type <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{iso}</span>
        </div>
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm">
          <Icon name="download" size={14} /> Export
        </button>
      </div>
      <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th>Unit #</th>
            <th>Status</th>
            <th>Location</th>
            <th>Last Move</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {units.map(u => (
            <tr key={u.unit}>
              <td style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{u.unit}</td>
              <td>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: u.statusBg, color: u.statusColor,
                }}>
                  {u.status}
                </span>
              </td>
              <td style={{ color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{u.location}</td>
              <td style={{ color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{u.lastMove}</td>
              <td>
                <button style={{ background: 'none', border: 'none', color: 'var(--gecko-primary-600)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  View →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabTariff({ iso, type }: { iso: string; type: string }) {
  const bindings = [
    { plan: 'Standard LCB-2026', planType: 'Public',   rate: '฿2,800', notes: 'All containers, 20-day free period' },
    { plan: 'TU-2026',           planType: 'Contract', rate: '฿2,550', notes: 'Thai Union — negotiated -9%' },
    { plan: 'SCG-2026',          planType: 'Contract', rate: '฿2,650', notes: 'Volume 3k TEU+' },
    { plan: 'PTT-2026',          planType: 'Contract', rate: '฿2,600', notes: 'Bulk chemical discount' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>
          Tariff schedules with a rate line referencing type <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{iso}</span>
        </div>
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm">
          <Icon name="plus" size={14} /> Bind to Schedule
        </button>
      </div>
      <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th>Tariff Plan</th>
            <th>Type</th>
            <th>Effective Rate</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bindings.map(b => (
            <tr key={b.plan}>
              <td style={{ fontWeight: 600, color: 'var(--gecko-primary-700)' }}>{b.plan}</td>
              <td>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  background: b.planType === 'Contract' ? 'var(--gecko-warning-100)' : 'var(--gecko-primary-50)',
                  color: b.planType === 'Contract' ? 'var(--gecko-warning-700)' : 'var(--gecko-primary-700)',
                }}>
                  {b.planType}
                </span>
              </td>
              <td style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{b.rate}</td>
              <td style={{ color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{b.notes}</td>
              <td>
                <button style={{ background: 'none', border: 'none', color: 'var(--gecko-primary-600)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  View →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabHistory({ iso }: { iso: string }) {
  const logs = [
    { date: '2026-04-10 11:25', user: 'Apirak P.',   action: 'Updated Stack Height Limit', detail: '3 → 4 tiers (yard restructure project)' },
    { date: '2026-01-15 09:08', user: 'Somchai K.',  action: 'Payload weight corrected',   detail: `${iso} — data import correction from BIC registry` },
    { date: '2025-07-01 00:00', user: 'System',      action: 'Record created',             detail: 'Migrated from legacy TMS v2.1 — ISO 6346 seed data' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {logs.map((log, i) => (
        <div
          key={log.date}
          style={{
            display: 'flex',
            gap: 16,
            padding: '16px 0',
            borderBottom: i < logs.length - 1 ? '1px solid var(--gecko-border)' : 'none',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gecko-primary-400)', flexShrink: 0, marginTop: 5 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{log.action}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>{log.user}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginBottom: 4 }}>{log.detail}</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>{log.date}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ContainerTypeDetailPage() {
  const params = useParams();
  const iso = (params?.iso as string) ?? '';
  const { toast } = useToast();

  const ct = CONTAINER_TYPES.find(c => c.iso === iso);

  const [activeTab, setActiveTab] = useState('details');
  const [editing, setEditing] = useState(false);

  if (!ct) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--gecko-danger-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="alertCircle" size={26} style={{ color: 'var(--gecko-danger-500)' }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>ISO type not found</h2>
        <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>
          No container type with ISO code <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{iso}</span> exists in this catalog.
        </div>
        <Link href="/masters/container-types" className="gecko-btn gecko-btn-outline gecko-btn-sm">
          <Icon name="arrowLeft" size={14} /> Back to Container Types
        </Link>
      </div>
    );
  }

  const catStyle = CAT_COLORS[ct.cat] ?? CAT_COLORS['GENERAL'];

  const tabContent: Record<string, React.ReactNode> = {
    details: <TabDetails ct={ct} edit={editing} />,
    inyard:  <TabInYard iso={ct.iso} />,
    tariff:  <TabTariff iso={ct.iso} type={ct.type} />,
    history: <TabHistory iso={ct.iso} />,
  };

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Breadcrumb + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
          <Link href="/masters" className="gecko-breadcrumb-item">Masters</Link>
          <span className="gecko-breadcrumb-sep" />
          <Link href="/masters/container-types" className="gecko-breadcrumb-item">ISO Container Types</Link>
          <span className="gecko-breadcrumb-sep" />
          <span className="gecko-breadcrumb-current" style={{ fontFamily: 'var(--gecko-font-mono)' }}>{ct.iso}</span>
        </nav>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => toast({ variant: 'success', title: 'Container type cloned', message: `Copy of ${iso} created as a draft.` })}><Icon name="copy" size={14} /> Clone</button>
          <ExportButton resource="Container type" iconSize={14} />
          {editing ? (
            <>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setEditing(false)}>
                <Icon name="save" size={14} /> Save Changes
              </button>
            </>
          ) : (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setEditing(true)}>
              <Icon name="edit" size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Title + Badge header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)', letterSpacing: '0.06em' }}>
              {ct.iso}
            </h1>
            <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>{ct.name}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
              background: catStyle.bg, color: catStyle.color,
            }}>
              {ct.cat}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)' }}>
              Active
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 8 }}>
            {ct.dims} · Type Code: <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{ct.type}</span> · ISO 6346
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--gecko-border)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
        {[
          { label: 'Payload',          value: ct.payload,       sub: 'max cargo weight' },
          { label: 'Tare Weight',      value: ct.tare,          sub: 'container self-weight' },
          { label: 'Cubic Capacity',   value: ct.cube,          sub: 'usable volume' },
          { label: 'In Yard',          value: `${ct.active}`,   sub: 'containers currently in yard', highlight: true },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: 'var(--gecko-bg-surface)', padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: kpi.highlight ? 'var(--gecko-primary-600)' : 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--gecko-border)', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (editing) setEditing(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--gecko-primary-600)' : 'var(--gecko-text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--gecko-primary-600)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ paddingBottom: 40 }}>
        {tabContent[activeTab]}
      </div>

    </div>
  );
}
