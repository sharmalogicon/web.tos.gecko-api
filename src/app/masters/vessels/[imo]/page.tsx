"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { ExportButton } from '@/components/ui/ExportButton';

// ── Vessel catalog (mirrors the list page) ────────────────────────────────────
const VESSELS = [
  {
    imo: '9345612', name: 'MSC LISBON',
    line: 'MSC', flag: 'PA', flagFull: 'Panama',
    class: 'Post-Panamax', loa: '299.9', beam: '48.2', draft: '14.5',
    teuNominal: '11,312', teuMax: '12,000', reeferPlugs: '800',
    built: '2008', shipbuilder: 'Samsung Heavy Industries',
    callSign: '3EXM9', mmsi: '352285000',
    status: 'Expected', notes: '',
    nextVoyageEta: 'Apr 24 06:00',
  },
  {
    imo: '9776418', name: 'OOCL SEOUL',
    line: 'OOCL', flag: 'HK', flagFull: 'Hong Kong',
    class: 'ULCV', loa: '399.9', beam: '58.8', draft: '16.0',
    teuNominal: '21,413', teuMax: '23,500', reeferPlugs: '1,500',
    built: '2017', shipbuilder: 'Samsung Heavy Industries',
    callSign: 'VRDD6', mmsi: '477347200',
    status: 'Arriving', notes: 'Reefer block B-deck — priority monitoring.',
    nextVoyageEta: 'Apr 23 14:00',
  },
  {
    imo: '9778820', name: 'MAERSK HONAM',
    line: 'Maersk', flag: 'SG', flagFull: 'Singapore',
    class: 'ULCV', loa: '399.9', beam: '58.8', draft: '16.0',
    teuNominal: '15,262', teuMax: '16,500', reeferPlugs: '1,100',
    built: '2017', shipbuilder: 'Hyundai Heavy Industries',
    callSign: '9V9876', mmsi: '566229000',
    status: 'Expected', notes: '',
    nextVoyageEta: 'Apr 25 22:00',
  },
  {
    imo: '9839891', name: 'CMA CGM JACQUES SAADE',
    line: 'CMA CGM', flag: 'FR', flagFull: 'France',
    class: 'ULCV', loa: '400.0', beam: '61.3', draft: '17.0',
    teuNominal: '23,000', teuMax: '23,000', reeferPlugs: '1,500',
    built: '2020', shipbuilder: 'China State Shipbuilding Corporation',
    callSign: 'FMCJ', mmsi: '228373600',
    status: 'Scheduled', notes: 'LNG dual-fuel. First LNG bunkering on arrival.',
    nextVoyageEta: 'Apr 28 08:00',
  },
  {
    imo: '9302555', name: 'EVER GIVEN',
    line: 'Evergreen', flag: 'PA', flagFull: 'Panama',
    class: 'ULCV', loa: '399.9', beam: '58.8', draft: '14.5',
    teuNominal: '20,124', teuMax: '20,388', reeferPlugs: '1,296',
    built: '2018', shipbuilder: 'Imabari Shipbuilding',
    callSign: '3EVG3', mmsi: '353136000',
    status: 'Scheduled', notes: '',
    nextVoyageEta: 'May 02 06:00',
  },
  {
    imo: '9725132', name: 'ONE STORK',
    line: 'ONE', flag: 'JP', flagFull: 'Japan',
    class: 'Post-Panamax', loa: '364.0', beam: '51.2', draft: '15.5',
    teuNominal: '14,052', teuMax: '14,500', reeferPlugs: '900',
    built: '2015', shipbuilder: 'Imabari Shipbuilding',
    callSign: '7JGH', mmsi: '432853000',
    status: 'Scheduled', notes: '',
    nextVoyageEta: 'Apr 26 10:00',
  },
  {
    imo: '9501578', name: 'HYUNDAI EARTH',
    line: 'Hapag-Lloyd', flag: 'MH', flagFull: 'Marshall Islands',
    class: 'Post-Panamax', loa: '366.5', beam: '48.4', draft: '15.0',
    teuNominal: '13,100', teuMax: '13,800', reeferPlugs: '700',
    built: '2012', shipbuilder: 'Hyundai Heavy Industries',
    callSign: 'V7VY7', mmsi: '538004744',
    status: 'Archived', notes: 'Vessel transferred to Hapag-Lloyd charter pool Apr 2025.',
    nextVoyageEta: '—',
  },
];

// ── Per-vessel voyage history ─────────────────────────────────────────────────
const VOYAGES: Record<string, { voyage: string; pol: string; pod: string; etd: string; eta: string; status: string; fill: number }[]> = {
  '9345612': [
    { voyage: '142E', pol: 'SGSIN', pod: 'THBKK', etd: 'Apr 22 18:00', eta: 'Apr 24 06:00', status: 'In Progress', fill: 88 },
    { voyage: '140E', pol: 'CNSHA', pod: 'SGSIN', etd: 'Apr 10 12:00', eta: 'Apr 13 08:00', status: 'Completed',   fill: 92 },
    { voyage: '138W', pol: 'THBKK', pod: 'CNSHA', etd: 'Mar 28 20:00', eta: 'Apr 01 10:00', status: 'Completed',   fill: 74 },
    { voyage: '136E', pol: 'SGSIN', pod: 'THBKK', etd: 'Mar 15 09:00', eta: 'Mar 17 06:00', status: 'Completed',   fill: 81 },
  ],
  '9776418': [
    { voyage: '512E', pol: 'CNSHA', pod: 'THBKK', etd: 'Apr 21 22:00', eta: 'Apr 23 14:00', status: 'Arriving',    fill: 95 },
    { voyage: '510W', pol: 'THBKK', pod: 'DEHAM', etd: 'Apr 08 06:00', eta: 'Apr 30 14:00', status: 'In Progress', fill: 87 },
    { voyage: '508E', pol: 'NLRTM', pod: 'THBKK', etd: 'Mar 20 12:00', eta: 'Apr 07 18:00', status: 'Completed',   fill: 91 },
  ],
  '9778820': [
    { voyage: '804W', pol: 'SGSIN', pod: 'THBKK', etd: 'Apr 24 08:00', eta: 'Apr 25 22:00', status: 'Expected',    fill: 79 },
    { voyage: '802E', pol: 'THBKK', pod: 'CNSHA', etd: 'Apr 12 14:00', eta: 'Apr 15 10:00', status: 'Completed',   fill: 85 },
    { voyage: '800W', pol: 'DEHAM', pod: 'THBKK', etd: 'Mar 25 08:00', eta: 'Apr 11 06:00', status: 'Completed',   fill: 88 },
  ],
  '9839891': [
    { voyage: '0FTE4W1MA', pol: 'FRLEH', pod: 'THBKK', etd: 'Apr 20 06:00', eta: 'Apr 28 08:00', status: 'Expected',  fill: 82 },
    { voyage: '0FTE3E1MA', pol: 'THBKK', pod: 'CNSHA', etd: 'Apr 05 16:00', eta: 'Apr 08 12:00', status: 'Completed', fill: 93 },
  ],
  '9302555': [
    { voyage: '0112E', pol: 'GBFXT', pod: 'THBKK', etd: 'Apr 25 20:00', eta: 'May 02 06:00', status: 'Expected',  fill: 76 },
    { voyage: '0110W', pol: 'THBKK', pod: 'NLRTM', etd: 'Apr 10 10:00', eta: 'May 01 18:00', status: 'In Progress', fill: 89 },
  ],
  '9725132': [
    { voyage: '055E', pol: 'JPYOK', pod: 'THBKK', etd: 'Apr 24 08:00', eta: 'Apr 26 10:00', status: 'Expected',    fill: 71 },
    { voyage: '054W', pol: 'THBKK', pod: 'JPYOK', etd: 'Apr 14 22:00', eta: 'Apr 18 12:00', status: 'Completed',   fill: 78 },
    { voyage: '053E', pol: 'JPYOK', pod: 'THBKK', etd: 'Apr 04 08:00', eta: 'Apr 06 18:00', status: 'Completed',   fill: 82 },
  ],
  '9501578': [
    { voyage: '—',    pol: '—',     pod: '—',     etd: '—',           eta: '—',           status: 'Archived',    fill: 0  },
  ],
};

// ── Audit history ─────────────────────────────────────────────────────────────
const HISTORY: Record<string, { date: string; user: string; action: string; detail: string }[]> = {
  '9345612': [
    { date: '2026-04-20 09:14', user: 'Somchai K.',  action: 'Voyage 142E created',        detail: 'POL SGSIN → POD THBKK, ETA Apr 24 06:00' },
    { date: '2025-01-08 14:22', user: 'Apirak P.',   action: 'Reefer plug count updated',  detail: '720 → 800 (post-refit survey)' },
    { date: '2024-03-15 10:00', user: 'System',      action: 'Vessel imported',             detail: 'Migrated from legacy TMS v2.1 — IMO verified' },
    { date: '2024-03-15 10:01', user: 'System',      action: 'Record created',              detail: 'Initial vessel registration' },
  ],
  '9776418': [
    { date: '2026-04-21 16:45', user: 'Naphat W.',   action: 'Voyage 512E created',        detail: 'POL CNSHA → POD THBKK, ETA Apr 23 14:00' },
    { date: '2026-01-10 11:30', user: 'Somchai K.',  action: 'Status updated',             detail: 'Expected → Arriving (AIS confirmed)' },
    { date: '2023-06-01 08:00', user: 'System',      action: 'Record created',             detail: 'Initial vessel registration' },
  ],
  default: [
    { date: '2026-03-01 10:00', user: 'System',      action: 'Record last verified',       detail: 'IMO registry cross-check passed' },
    { date: '2024-01-01 00:00', user: 'System',      action: 'Record created',             detail: 'Initial vessel registration' },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Expected:    { bg: 'var(--gecko-info-100)',    color: 'var(--gecko-info-700)' },
    Arriving:    { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)' },
    'In Progress':{ bg: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)' },
    Scheduled:   { bg: 'var(--gecko-gray-100)',    color: 'var(--gecko-gray-700)' },
    Completed:   { bg: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)' },
    Archived:    { bg: 'var(--gecko-gray-100)',    color: 'var(--gecko-text-disabled)' },
  };
  const s = map[status] ?? { bg: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, border: `1px solid ${s.bg.replace('100', '200')}` }}>
      {status}
    </span>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid var(--gecko-border)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>{title}</h3>
      {sub && <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function FillBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'var(--gecko-success-600)' : pct >= 70 ? 'var(--gecko-warning-600)' : 'var(--gecko-info-600)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--gecko-bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'var(--gecko-font-mono)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
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

// ── Main component ────────────────────────────────────────────────────────────
export default function VesselDetailPage() {
  const params = useParams();
  const imo = Array.isArray(params.imo) ? params.imo[0] : (params.imo ?? '');

  const vessel = VESSELS.find(v => v.imo === imo) ?? VESSELS[0];
  const voyages = VOYAGES[vessel.imo] ?? VOYAGES['9345612'];
  const history = HISTORY[vessel.imo] ?? HISTORY['default'];

  const [activeTab, setActiveTab] = useState<'identity' | 'voyages' | 'documents' | 'history'>('identity');
  const [editMode, setEditMode] = useState(false);

  // Local editable copy
  const [form, setForm] = useState({ ...vessel });
  function set(key: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const TABS = [
    { id: 'identity',  label: 'Identity',   icon: 'anchor'   },
    { id: 'voyages',   label: 'Voyages',    icon: 'navigation'},
    { id: 'documents', label: 'Documents',  icon: 'fileText' },
    { id: 'history',   label: 'History',    icon: 'activity' },
  ] as const;

  const inputProps = (value: string, key: keyof typeof form, mono = false) => ({
    className: `gecko-input${mono ? ' gecko-text-mono' : ''}`,
    value: editMode ? (form[key] as string) : value,
    readOnly: !editMode,
    onChange: editMode ? (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, e.target.value) : undefined,
    style: !editMode ? { background: 'var(--gecko-bg-subtle)' } : {},
  });

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* Breadcrumb + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
          <Link href="/masters" className="gecko-breadcrumb-item">Masters</Link>
          <span className="gecko-breadcrumb-sep" />
          <Link href="/masters/vessels" className="gecko-breadcrumb-item">Vessels &amp; Voyages</Link>
          <span className="gecko-breadcrumb-sep" />
          <span className="gecko-breadcrumb-current">{vessel.imo} — {vessel.name}</span>
        </nav>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="copy" size={15} /> Clone</button>
          <ExportButton resource="Vessel" iconSize={15} />
          {editMode ? (
            <>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => { setForm({ ...vessel }); setEditMode(false); }}>
                Cancel
              </button>
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setEditMode(false)}>
                <Icon name="save" size={15} /> Save Changes
              </button>
            </>
          ) : (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setEditMode(true)}>
              <Icon name="edit" size={15} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Icon name="anchor" size={24} style={{ color: 'var(--gecko-info-500)' }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)', letterSpacing: '0.01em' }}>{vessel.name}</h1>
            <StatusBadge status={vessel.status} />
            <span style={{ fontSize: 12, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>IMO {vessel.imo}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 8 }}>
            {vessel.line} · {vessel.class} · Flag {vessel.flag} · Built {vessel.built}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--gecko-border)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
        {[
          { label: 'Flag',              value: vessel.flagFull,     sub: `ISO: ${vessel.flag}`,          icon: 'flag',     color: 'var(--gecko-primary-600)',  bg: 'var(--gecko-primary-50)' },
          { label: 'TEU Capacity',      value: vessel.teuNominal,   sub: `Max structural: ${vessel.teuMax}`, icon: 'layers',   color: 'var(--gecko-info-600)',     bg: 'var(--gecko-info-50)' },
          { label: 'Year Built',        value: vessel.built,        sub: vessel.shipbuilder,             icon: 'tool',     color: 'var(--gecko-accent-600)',   bg: 'var(--gecko-accent-50)' },
          { label: 'Next Voyage ETA',   value: vessel.nextVoyageEta, sub: voyages[0]?.voyage !== '—' ? `Voyage ${voyages[0]?.voyage ?? '—'}` : '—', icon: 'calendar', color: 'var(--gecko-warning-600)', bg: 'var(--gecko-warning-50)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--gecko-bg-surface)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={k.icon} size={14} style={{ color: k.color }} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gecko-text-primary)', lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', lineHeight: 1.4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--gecko-border)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'none', border: 'none',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--gecko-primary-600)' : 'var(--gecko-text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--gecko-primary-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Identity */}
      {activeTab === 'identity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Identity section */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '24px 28px', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <SectionHead title="Identity" sub="IMO-registered identifiers." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">IMO Number</label>
                <input {...inputProps(vessel.imo, 'imo', true)} />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Vessel Name</label>
                <input {...inputProps(vessel.name, 'name')} />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Call Sign</label>
                <input {...inputProps(vessel.callSign, 'callSign', true)} />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">MMSI</label>
                <input {...inputProps(vessel.mmsi, 'mmsi', true)} />
              </div>
            </div>
          </div>

          {/* Classification section */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '24px 28px', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <SectionHead title="Classification" sub="Operator, class, flag, and build details." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div className="gecko-form-group">
                <label className="gecko-label">Shipping Line</label>
                {editMode ? (
                  <select className="gecko-select" value={form.line} onChange={e => set('line', e.target.value)}>
                    <option value="MSC">MSC</option>
                    <option value="OOCL">OOCL</option>
                    <option value="Maersk">Maersk</option>
                    <option value="CMA CGM">CMA CGM</option>
                    <option value="Evergreen">Evergreen</option>
                    <option value="Hapag-Lloyd">Hapag-Lloyd</option>
                    <option value="ONE">ONE</option>
                    <option value="Yang Ming">Yang Ming</option>
                  </select>
                ) : (
                  <input className="gecko-input" value={vessel.line} readOnly style={{ background: 'var(--gecko-bg-subtle)' }} />
                )}
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Vessel Class</label>
                {editMode ? (
                  <select className="gecko-select" value={form.class} onChange={e => set('class', e.target.value)}>
                    <option value="ULCV">ULCV</option>
                    <option value="Post-Panamax">Post-Panamax</option>
                    <option value="Panamax">Panamax</option>
                    <option value="Sub-Panamax">Sub-Panamax</option>
                    <option value="Feeder">Feeder</option>
                    <option value="RoRo">RoRo</option>
                  </select>
                ) : (
                  <input className="gecko-input" value={vessel.class} readOnly style={{ background: 'var(--gecko-bg-subtle)' }} />
                )}
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Flag</label>
                {editMode ? (
                  <select className="gecko-select" value={form.flag} onChange={e => set('flag', e.target.value)}>
                    {FLAG_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                ) : (
                  <input className="gecko-input" value={`${vessel.flag} — ${vessel.flagFull}`} readOnly style={{ background: 'var(--gecko-bg-subtle)' }} />
                )}
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Year Built</label>
                <input {...inputProps(vessel.built, 'built', true)} />
              </div>
              <div className="gecko-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="gecko-label">Shipbuilder</label>
                <input {...inputProps(vessel.shipbuilder, 'shipbuilder')} />
              </div>
            </div>
          </div>

          {/* Dimensions section */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '24px 28px', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <SectionHead title="Dimensions" sub="Physical measurements and capacity." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
              <div className="gecko-form-group">
                <label className="gecko-label">LOA (m)</label>
                <input {...inputProps(vessel.loa, 'loa', true)} placeholder="metres" />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Beam (m)</label>
                <input {...inputProps(vessel.beam, 'beam', true)} placeholder="metres" />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Draft (m)</label>
                <input {...inputProps(vessel.draft, 'draft', true)} placeholder="metres" />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">TEU Nominal</label>
                <input {...inputProps(vessel.teuNominal, 'teuNominal', true)} />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">TEU Max (structural)</label>
                <input {...inputProps(vessel.teuMax, 'teuMax', true)} />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Reefer Plugs</label>
                <input {...inputProps(vessel.reeferPlugs, 'reeferPlugs', true)} />
              </div>
            </div>
          </div>

          {/* Settings section */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '24px 28px', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <SectionHead title="Settings" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="gecko-form-group">
                <label className="gecko-label">Status</label>
                {editMode ? (
                  <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
                    {(['Active', 'Inactive', 'Archived'] as const).map(s => (
                      <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: form.status === s ? 700 : 500, color: form.status === s ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)' }}>
                        <input type="radio" name="status-edit" value={s} checked={form.status === s} onChange={() => set('status', s)} style={{ accentColor: 'var(--gecko-primary-600)' }} />
                        {s}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 4 }}>
                    <StatusBadge status={vessel.status} />
                  </div>
                )}
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Notes</label>
                <textarea
                  className="gecko-input"
                  rows={3}
                  value={editMode ? form.notes : vessel.notes}
                  readOnly={!editMode}
                  onChange={editMode ? (e) => set('notes', e.target.value) : undefined}
                  placeholder={vessel.notes ? undefined : 'No notes.'}
                  style={{ resize: 'vertical', lineHeight: 1.6, ...(!editMode ? { background: 'var(--gecko-bg-subtle)' } : {}) }}
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Tab: Voyages */}
      {activeTab === 'voyages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Voyage History</h3>
              <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>{voyages.length} voyages recorded for {vessel.name}</div>
            </div>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm">
              <Icon name="plus" size={15} /> New Voyage
            </button>
          </div>

          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Voyage #</th>
                  <th>POL</th>
                  <th>POD</th>
                  <th>ETD</th>
                  <th>ETA</th>
                  <th>Status</th>
                  <th style={{ minWidth: 120 }}>TEU Fill %</th>
                </tr>
              </thead>
              <tbody>
                {voyages.map(v => (
                  <tr key={v.voyage}>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-primary-600)' }}>{v.voyage}</td>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, fontSize: 12 }}>{v.pol}</td>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, fontSize: 12 }}>{v.pod}</td>
                    <td style={{ color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{v.etd}</td>
                    <td style={{ color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{v.eta}</td>
                    <td><StatusBadge status={v.status} /></td>
                    <td style={{ minWidth: 120 }}>{v.fill > 0 ? <FillBar pct={v.fill} /> : <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 12 }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Documents */}
      {activeTab === 'documents' && (
        <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '32px 28px', boxShadow: 'var(--gecko-shadow-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--gecko-text-disabled)' }}>
          <Icon name="fileText" size={40} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>No documents attached</div>
          <div style={{ fontSize: 13 }}>Upload certificates, surveys, and compliance documents.</div>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ marginTop: 8 }}>
            <Icon name="upload" size={15} /> Upload Document
          </button>
        </div>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Audit Log</h3>

          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '8px 0', boxShadow: 'var(--gecko-shadow-sm)' }}>
            {history.map((entry, i) => (
              <div
                key={entry.date + i}
                style={{
                  display: 'flex', gap: 16, padding: '16px 24px',
                  borderBottom: i < history.length - 1 ? '1px solid var(--gecko-border)' : 'none',
                  alignItems: 'flex-start',
                }}
              >
                {/* Timeline dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, paddingTop: 4, flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? 'var(--gecko-primary-500)' : 'var(--gecko-border)', border: '2px solid var(--gecko-bg-surface)', outline: `2px solid ${i === 0 ? 'var(--gecko-primary-200)' : 'var(--gecko-border)'}` }} />
                </div>

                {/* Date */}
                <div style={{ width: 148, flexShrink: 0, fontSize: 11, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)', paddingTop: 2 }}>
                  {entry.date}
                </div>

                {/* User */}
                <div style={{ width: 100, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>{entry.user}</span>
                </div>

                {/* Action */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{entry.action}</div>
                  <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>{entry.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
