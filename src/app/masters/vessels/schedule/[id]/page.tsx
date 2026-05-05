"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

// ── Voyage master data (mirrors schedule/page.tsx) ────────────────────────────
const LINE_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  MSK:  { dot: '#0066CC', bg: '#EBF4FF', text: '#004A99' },
  OOCL: { dot: '#E65C00', bg: '#FFF3EB', text: '#C44A00' },
  EGL:  { dot: '#00873D', bg: '#EDFAF3', text: '#006830' },
  CMA:  { dot: '#D0021B', bg: '#FFEBEE', text: '#A80015' },
  HLC:  { dot: '#F47920', bg: '#FFF4E6', text: '#C05E00' },
  ONE:  { dot: '#E4002B', bg: '#FFEBEE', text: '#B30022' },
  HMM:  { dot: '#005BAC', bg: '#EBF2FF', text: '#004488' },
};

const VOYAGES = [
  { id: 'MSK-142E',  vessel: 'Maersk Kalmar',   line: 'MSK',  pol: 'THSGN', pod: 'CNSHA', etd: '2026-04-03', eta: '2026-04-09', status: 'Departed',  teu: 1800, filled: 1420, berth: 'B-2', wharf: 'Wharf 1', direction: 'Outbound', tradeService: 'AEX', agent: 'SEALC-TH', bookingType: 'EXPORT' },
  { id: 'OOL-089W',  vessel: 'OOCL Hamburg',    line: 'OOCL', pol: 'THLCB', pod: 'USLAX', etd: '2026-04-05', eta: '2026-04-22', status: 'En Route',  teu: 2100, filled: 1890, berth: 'C-1', wharf: 'Wharf 2', direction: 'Outbound', tradeService: 'TP1', agent: 'UNIOC-TH', bookingType: 'EXPORT' },
  { id: 'EGL-336N',  vessel: 'Ever Given',       line: 'EGL',  pol: 'CNSHA', pod: 'THLCB', etd: '2026-04-08', eta: '2026-04-28', status: 'En Route',  teu: 1650, filled: 980,  berth: 'A-3', wharf: 'Wharf 3', direction: 'Inbound',  tradeService: 'AEI', agent: 'EGLTH-01', bookingType: 'IMPORT' },
  { id: 'MSK-201W',  vessel: 'Maersk Honam',    line: 'MSK',  pol: 'THLCB', pod: 'NLRTM', etd: '2026-04-12', eta: '2026-05-02', status: 'En Route',  teu: 2400, filled: 2100, berth: 'B-1', wharf: 'Wharf 1', direction: 'Outbound', tradeService: 'FAL', agent: 'SEALC-TH', bookingType: 'EXPORT' },
  { id: 'CMA-771S',  vessel: 'CMA CGM Rossini', line: 'CMA',  pol: 'SGSIN', pod: 'THLCB', etd: '2026-04-14', eta: '2026-04-18', status: 'En Route',  teu: 900,  filled: 640,  berth: 'D-2', wharf: 'Wharf 4', direction: 'Inbound',  tradeService: 'SEA', agent: 'CMATH-02', bookingType: 'IMPORT' },
  { id: 'OOL-112E',  vessel: 'OOCL Seoul',      line: 'OOCL', pol: 'THLCB', pod: 'JPNGO', etd: '2026-04-17', eta: '2026-04-21', status: 'Open',      teu: 1400, filled: 320,  berth: null,  wharf: 'Wharf 3', direction: 'Outbound', tradeService: 'JAX', agent: 'UNIOC-TH', bookingType: 'EXPORT' },
  { id: 'MSK-198E',  vessel: 'Maersk Sentosa',  line: 'MSK',  pol: 'THLCB', pod: 'CNSHA', etd: '2026-04-22', eta: '2026-04-28', status: 'Open',      teu: 1600, filled: 440,  berth: null,  wharf: 'Wharf 2', direction: 'Outbound', tradeService: 'AEX', agent: 'SEALC-TH', bookingType: 'EXPORT' },
  { id: 'ONE-055E',  vessel: 'ONE Stork',       line: 'ONE',  pol: 'THLCB', pod: 'JPYOK', etd: '2026-04-22', eta: '2026-04-26', status: 'Open',      teu: 820,  filled: 190,  berth: null,  wharf: 'Wharf 4', direction: 'Outbound', tradeService: 'JSX', agent: 'ONETH-01', bookingType: 'EXPORT' },
  { id: 'HMM-088N',  vessel: 'HMM Le Havre',   line: 'HMM',  pol: 'THLCB', pod: 'FRLEH', etd: '2026-04-30', eta: '2026-05-20', status: 'Scheduled', teu: 1750, filled: 0,    berth: null,  wharf: null,       direction: 'Outbound', tradeService: 'EUX', agent: 'HMMTH-01', bookingType: 'EXPORT' },
];

// ── Mock bookings per voyage ───────────────────────────────────────────────────
type BookingStatus = 'Confirmed' | 'Pending' | 'Cancelled' | 'On Hold';
interface Booking {
  ref:       string;
  customer:  string;
  blType:    'FCL' | 'LCL';
  ctrType:   string;
  qty:       number;
  cargo:     string;
  weightKg:  number;
  reefer:    boolean;
  hazmat:    boolean;
  status:    BookingStatus;
}

const BOOKINGS: Record<string, Booking[]> = {
  'MSK-142E': [
    { ref: 'BK-2026-0441', customer: 'Thai Union Group PCL',         blType: 'FCL', ctrType: '40HC', qty: 24, cargo: 'Canned Tuna',           weightKg: 480000, reefer: false, hazmat: false, status: 'Confirmed' },
    { ref: 'BK-2026-0442', customer: 'Siam Cement Group',            blType: 'FCL', ctrType: '20GP', qty: 18, cargo: 'Cement Bags',           weightKg: 360000, reefer: false, hazmat: false, status: 'Confirmed' },
    { ref: 'BK-2026-0443', customer: 'PTT Global Chemical',          blType: 'FCL', ctrType: '20TK', qty: 6,  cargo: 'Chemical Resin (IMDG)', weightKg: 132000, reefer: false, hazmat: true,  status: 'Confirmed' },
    { ref: 'BK-2026-0444', customer: 'CP Foods Co., Ltd.',           blType: 'FCL', ctrType: '40RF', qty: 12, cargo: 'Frozen Poultry',        weightKg: 228000, reefer: true,  hazmat: false, status: 'Confirmed' },
    { ref: 'BK-2026-0445', customer: 'Indorama Ventures PCL',        blType: 'FCL', ctrType: '40HC', qty: 8,  cargo: 'PET Chips',             weightKg: 192000, reefer: false, hazmat: false, status: 'Pending'   },
    { ref: 'BK-2026-0446', customer: 'Bangchak Corporation PCL',     blType: 'LCL', ctrType: '20GP', qty: 2,  cargo: 'Lubricating Oil',       weightKg: 18000,  reefer: false, hazmat: true,  status: 'On Hold'   },
    { ref: 'BK-2026-0447', customer: 'Charoen Pokphand Foods PCL',   blType: 'FCL', ctrType: '40RF', qty: 14, cargo: 'Frozen Shrimp',         weightKg: 266000, reefer: true,  hazmat: false, status: 'Confirmed' },
    { ref: 'BK-2026-0448', customer: 'Betagro Public Co.',           blType: 'FCL', ctrType: '40RF', qty: 6,  cargo: 'Chilled Pork',          weightKg: 108000, reefer: true,  hazmat: false, status: 'Confirmed' },
  ],
  'OOL-089W': [
    { ref: 'BK-2026-0501', customer: 'Saha Pathanapibul PCL',        blType: 'FCL', ctrType: '40HC', qty: 30, cargo: 'Consumer Goods',        weightKg: 540000, reefer: false, hazmat: false, status: 'Confirmed' },
    { ref: 'BK-2026-0502', customer: 'Thai Union Group PCL',         blType: 'FCL', ctrType: '40RF', qty: 20, cargo: 'Frozen Seafood',        weightKg: 380000, reefer: true,  hazmat: false, status: 'Confirmed' },
    { ref: 'BK-2026-0503', customer: 'PTT Global Chemical',          blType: 'FCL', ctrType: '20TK', qty: 8,  cargo: 'Caustic Soda (IMDG)',   weightKg: 176000, reefer: false, hazmat: true,  status: 'Pending'   },
    { ref: 'BK-2026-0504', customer: 'Indorama Ventures PCL',        blType: 'FCL', ctrType: '40HC', qty: 42, cargo: 'Polyester Fibre',       weightKg: 756000, reefer: false, hazmat: false, status: 'Confirmed' },
  ],
  'OOL-112E': [
    { ref: 'BK-2026-0601', customer: 'CP Foods Co., Ltd.',           blType: 'FCL', ctrType: '40RF', qty: 8,  cargo: 'Frozen Ready Meals',    weightKg: 128000, reefer: true,  hazmat: false, status: 'Confirmed' },
    { ref: 'BK-2026-0602', customer: 'Siam Cement Group',            blType: 'FCL', ctrType: '20GP', qty: 10, cargo: 'Gypsum Board',          weightKg: 200000, reefer: false, hazmat: false, status: 'Pending'   },
    { ref: 'BK-2026-0603', customer: 'Thai Union Group PCL',         blType: 'LCL', ctrType: '20GP', qty: 3,  cargo: 'Canned Fish Misc.',     weightKg: 27000,  reefer: false, hazmat: false, status: 'Confirmed' },
  ],
  'MSK-198E': [
    { ref: 'BK-2026-0701', customer: 'Charoen Pokphand Foods PCL',   blType: 'FCL', ctrType: '40RF', qty: 16, cargo: 'Frozen Chicken',        weightKg: 304000, reefer: true,  hazmat: false, status: 'Confirmed' },
    { ref: 'BK-2026-0702', customer: 'PTT Global Chemical',          blType: 'FCL', ctrType: '40HC', qty: 12, cargo: 'HDPE Pellets',          weightKg: 288000, reefer: false, hazmat: false, status: 'Pending'   },
  ],
};

// ── Status helpers ────────────────────────────────────────────────────────────
function VoyageStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'Open':      { bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-700)' },
    'Accepting': { bg: 'var(--gecko-primary-50)',  color: 'var(--gecko-primary-700)' },
    'En Route':  { bg: 'var(--gecko-info-50)',     color: 'var(--gecko-info-700)'    },
    'Departed':  { bg: 'var(--gecko-gray-100)',    color: 'var(--gecko-gray-600)'    },
    'Scheduled': { bg: 'var(--gecko-warning-50)',  color: 'var(--gecko-warning-700)' },
    'Cancelled': { bg: 'var(--gecko-error-50)',    color: 'var(--gecko-error-700)'   },
  };
  const s = map[status] ?? map['Scheduled'];
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${s.color}33` }}>
      {status}
    </span>
  );
}

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const map: Record<BookingStatus, { bg: string; color: string }> = {
    'Confirmed': { bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-700)' },
    'Pending':   { bg: 'var(--gecko-warning-50)',  color: 'var(--gecko-warning-700)' },
    'On Hold':   { bg: 'var(--gecko-info-50)',     color: 'var(--gecko-info-700)'    },
    'Cancelled': { bg: 'var(--gecko-error-50)',    color: 'var(--gecko-error-700)'   },
  };
  const s = map[status];
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, border: `1px solid ${s.color}33` }}>
      {status}
    </span>
  );
}

// ── KPI box ───────────────────────────────────────────────────────────────────
function KpiBox({ label, value, sub, color, bg, icon }: {
  label: string; value: string | number; sub?: string;
  color: string; bg: string; icon: string;
}) {
  return (
    <div style={{ background: 'var(--gecko-bg-surface)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={18} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gecko-text-primary)', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 1 }}>{sub}</div>}
        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VoyageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'history'>('bookings');
  const [bkFilter, setBkFilter] = useState('');
  const [bkStatus, setBkStatus] = useState('');

  const voyage = VOYAGES.find(v => v.id === id);
  if (!voyage) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <Icon name="alertCircle" size={40} style={{ color: 'var(--gecko-text-disabled)' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Voyage not found</h2>
        <p style={{ color: 'var(--gecko-text-secondary)', margin: 0 }}>No voyage with ID <code>{id}</code> exists in this schedule.</p>
        <Link href="/masters/vessels/schedule" className="gecko-btn gecko-btn-primary gecko-btn-sm">
          <Icon name="chevronLeft" size={14} /> Back to Schedule
        </Link>
      </div>
    );
  }

  const allBookings: Booking[] = BOOKINGS[voyage.id] ?? [];
  const filtered = useMemo(() => {
    return allBookings.filter(b => {
      if (bkFilter) {
        const q = bkFilter.toLowerCase();
        if (!b.ref.toLowerCase().includes(q) && !b.customer.toLowerCase().includes(q) && !b.cargo.toLowerCase().includes(q)) return false;
      }
      if (bkStatus && b.status !== bkStatus) return false;
      return true;
    });
  }, [allBookings, bkFilter, bkStatus]);

  // Aggregates
  const totalBookings  = allBookings.length;
  const confirmed      = allBookings.filter(b => b.status === 'Confirmed').length;
  const pending        = allBookings.filter(b => b.status === 'Pending').length;
  const teuBooked      = allBookings.reduce((s, b) => s + b.qty, 0);
  const reeferCount    = allBookings.filter(b => b.reefer).reduce((s, b) => s + b.qty, 0);
  const hazmatCount    = allBookings.filter(b => b.hazmat).reduce((s, b) => s + b.qty, 0);
  const fillPct        = voyage.teu > 0 ? Math.round((voyage.filled / voyage.teu) * 100) : 0;

  const lc = LINE_COLORS[voyage.line] ?? { dot: '#6b7280', bg: '#f3f4f6', text: '#374151' };

  const TABS = [
    { key: 'overview',  label: 'Overview'                              },
    { key: 'bookings',  label: `Bookings`,   badge: totalBookings      },
    { key: 'history',   label: 'History'                               },
  ] as const;

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22, paddingBottom: 40 }}>

      {/* Breadcrumb */}
      <nav className="gecko-breadcrumb">
        <Link href="/masters" className="gecko-breadcrumb-item">Masters</Link>
        <span className="gecko-breadcrumb-sep" />
        <Link href="/masters/vessels/schedule" className="gecko-breadcrumb-item">Vessel Call Schedule</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">{voyage.id}</span>
      </nav>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: lc.bg, border: `2px solid ${lc.dot}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: lc.text }}>{voyage.line}</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{voyage.id}</h1>
              <VoyageStatusBadge status={voyage.status} />
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: voyage.direction === 'Inbound' ? 'var(--gecko-success-100)' : 'var(--gecko-primary-100)',
                color: voyage.direction === 'Inbound' ? 'var(--gecko-success-700)' : 'var(--gecko-primary-700)',
              }}>
                {voyage.direction === 'Inbound' ? '↓ Inbound' : '↑ Outbound'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
              {voyage.vessel} &nbsp;·&nbsp; {voyage.line} &nbsp;·&nbsp;
              <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{voyage.pol}</span>
              {' → '}
              <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{voyage.pod}</span>
              &nbsp;·&nbsp; ETD {voyage.etd}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="download" size={15} /> Export</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="printer" size={15} /> Print Manifest</button>
          <Link href={`/masters/vessels/schedule/new`} className="gecko-btn gecko-btn-primary gecko-btn-sm">
            <Icon name="edit" size={15} /> Edit Voyage
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: 'var(--gecko-border)', border: '1px solid var(--gecko-border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <KpiBox label="Total Bookings"  value={totalBookings}  icon="clipboardList"  color="var(--gecko-primary-600)"  bg="var(--gecko-primary-50)"  />
        <KpiBox label="Confirmed"       value={confirmed}      icon="checkCircle"    color="var(--gecko-success-600)"  bg="var(--gecko-success-50)"  sub={`${pending} pending`} />
        <KpiBox label="TEU Booked"      value={teuBooked}      icon="layers"         color="var(--gecko-info-600)"     bg="var(--gecko-info-50)"     sub={`of ${voyage.teu} capacity`} />
        <KpiBox label="TEU Fill"        value={`${fillPct}%`}  icon="barChart"       color={fillPct > 85 ? 'var(--gecko-error-600)' : fillPct > 60 ? 'var(--gecko-warning-600)' : 'var(--gecko-success-600)'}  bg={fillPct > 85 ? 'var(--gecko-error-50)' : fillPct > 60 ? 'var(--gecko-warning-50)' : 'var(--gecko-success-50)'}  />
        <KpiBox label="Reefer Ctrs"     value={reeferCount}    icon="thermometer"    color="var(--gecko-info-600)"     bg="var(--gecko-info-50)"     />
        <KpiBox label="Hazmat Ctrs"     value={hazmatCount}    icon="alertTriangle"  color="var(--gecko-error-600)"    bg="var(--gecko-error-50)"    />
      </div>

      {/* Tabs */}
      <div className="gecko-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`gecko-tab${activeTab === t.key ? ' gecko-tab-active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {'badge' in t && t.badge > 0 && (
              <span style={{
                marginLeft: 4, minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px',
                background: activeTab === t.key ? 'var(--gecko-primary-600)' : 'var(--gecko-gray-200)',
                color: activeTab === t.key ? '#fff' : 'var(--gecko-text-secondary)',
                fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: BOOKINGS ───────────────────────────────────────────────────── */}
      {activeTab === 'bookings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Summary strip */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'All',        value: '',           count: allBookings.length,                                      color: 'var(--gecko-text-secondary)', activeBg: 'var(--gecko-gray-100)' },
              { label: 'Confirmed',  value: 'Confirmed',  count: allBookings.filter(b => b.status === 'Confirmed').length, color: 'var(--gecko-success-700)', activeBg: 'var(--gecko-success-50)' },
              { label: 'Pending',    value: 'Pending',    count: allBookings.filter(b => b.status === 'Pending').length,   color: 'var(--gecko-warning-700)', activeBg: 'var(--gecko-warning-50)' },
              { label: 'On Hold',    value: 'On Hold',    count: allBookings.filter(b => b.status === 'On Hold').length,   color: 'var(--gecko-info-700)',    activeBg: 'var(--gecko-info-50)'    },
              { label: 'Cancelled',  value: 'Cancelled',  count: allBookings.filter(b => b.status === 'Cancelled').length, color: 'var(--gecko-error-700)',   activeBg: 'var(--gecko-error-50)'   },
            ].map(f => {
              const active = bkStatus === f.value;
              return (
                <button key={f.value} type="button" onClick={() => setBkStatus(f.value)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', border: `1px solid ${active ? f.color : 'var(--gecko-border)'}`,
                  background: active ? f.activeBg : 'var(--gecko-bg-surface)',
                  color: active ? f.color : 'var(--gecko-text-secondary)',
                  transition: 'all 100ms',
                }}>
                  {f.label}
                  <span style={{
                    background: active ? f.color : 'var(--gecko-gray-200)',
                    color: active ? '#fff' : 'var(--gecko-gray-600)',
                    borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                  }}>{f.count}</span>
                </button>
              );
            })}

            {/* Search */}
            <div style={{ marginLeft: 'auto', position: 'relative' }}>
              <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
              <input
                className="gecko-input gecko-input-sm"
                placeholder="Search booking, customer, cargo…"
                value={bkFilter}
                onChange={e => setBkFilter(e.target.value)}
                style={{ paddingLeft: 32, width: 260 }}
              />
            </div>
          </div>

          {/* Bookings table */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--gecko-text-secondary)' }}>
                <Icon name="inbox" size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No bookings found</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {allBookings.length === 0
                    ? 'No bookings are linked to this voyage yet.'
                    : 'Try adjusting the filter or search.'}
                </div>
              </div>
            ) : (
              <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Booking Ref</th>
                    <th>Customer</th>
                    <th>B/L</th>
                    <th>Container</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th>Cargo Description</th>
                    <th style={{ textAlign: 'right' }}>Weight</th>
                    <th>Flags</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.ref}>
                      <td>
                        <Link
                          href={`/bookings?ref=${b.ref}`}
                          style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-primary-600)', fontSize: 12 }}
                        >
                          {b.ref}
                        </Link>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{b.customer}</div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: b.blType === 'FCL' ? 'var(--gecko-primary-50)' : 'var(--gecko-accent-50)',
                          color:      b.blType === 'FCL' ? 'var(--gecko-primary-700)' : 'var(--gecko-accent-700)',
                        }}>{b.blType}</span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 12 }}>{b.ctrType}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{b.qty}</span>
                        <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginLeft: 3 }}>ctrs</span>
                      </td>
                      <td style={{ color: 'var(--gecko-text-secondary)', maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.cargo}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 600 }}>
                          {(b.weightKg / 1000).toFixed(1)}t
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {b.reefer && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--gecko-info-50)', color: 'var(--gecko-info-700)', border: '1px solid var(--gecko-info-200)' }}>
                              ❄ RF
                            </span>
                          )}
                          {b.hazmat && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--gecko-error-50)', color: 'var(--gecko-error-700)', border: '1px solid var(--gecko-error-200)' }}>
                              ⚠ DG
                            </span>
                          )}
                        </div>
                      </td>
                      <td><BookingStatusBadge status={b.status} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          href={`/bookings?ref=${b.ref}`}
                          className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                          style={{ padding: '0 10px', fontSize: 12 }}
                          title="Open booking"
                        >
                          Open <Icon name="arrowRight" size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Table footer summary */}
            {filtered.length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', display: 'flex', alignItems: 'center', gap: 24, fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
                <span>{filtered.length} booking{filtered.length !== 1 ? 's' : ''} shown</span>
                <span style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
                  {filtered.reduce((s, b) => s + b.qty, 0)} containers
                </span>
                <span style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
                  {(filtered.reduce((s, b) => s + b.weightKg, 0) / 1000).toFixed(1)} t total
                </span>
                <span style={{ marginLeft: 'auto' }}>
                  <Link href="/bookings/new" className="gecko-btn gecko-btn-primary gecko-btn-sm">
                    <Icon name="plus" size={14} /> Add Booking
                  </Link>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: OVERVIEW ───────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Identity card */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gecko-text-secondary)' }}>
              Voyage Identity
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Voyage ID',      value: voyage.id,          mono: true  },
                { label: 'Vessel',         value: voyage.vessel,      mono: false },
                { label: 'Shipping Line',  value: voyage.line,        mono: false },
                { label: 'Booking Type',   value: voyage.bookingType, mono: false },
                { label: 'Trade Service',  value: voyage.tradeService || '—', mono: true },
                { label: 'Agent',          value: voyage.agent,       mono: true  },
                { label: 'Wharf',          value: voyage.wharf ?? '—',mono: false },
                { label: 'Berth',          value: voyage.berth ?? 'TBA', mono: true },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', flexShrink: 0 }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: row.mono ? 'var(--gecko-font-mono)' : undefined, textAlign: 'right' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timing card */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gecko-text-secondary)' }}>
              Port Call Timing
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'ETD (Departure)',      value: voyage.etd,   color: 'var(--gecko-primary-600)' },
                { label: 'ETA at Destination',   value: voyage.eta,   color: 'var(--gecko-info-600)'    },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)', marginBottom: 4 }}>{row.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: row.color }}>{row.value}</div>
                </div>
              ))}

              <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--gecko-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TEU Utilisation</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: 'var(--gecko-text-secondary)' }}>{voyage.filled.toLocaleString()} booked</span>
                  <span style={{ fontWeight: 700, color: fillPct > 85 ? 'var(--gecko-error-600)' : fillPct > 60 ? 'var(--gecko-warning-600)' : 'var(--gecko-success-600)' }}>{fillPct}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--gecko-gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${fillPct}%`, borderRadius: 4, background: fillPct > 85 ? 'var(--gecko-error-500)' : fillPct > 60 ? 'var(--gecko-warning-500)' : 'var(--gecko-success-500)', transition: 'width 400ms' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', marginTop: 4 }}>{voyage.teu.toLocaleString()} TEU total capacity</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: HISTORY ────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '20px 24px', boxShadow: 'var(--gecko-shadow-sm)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { date: '2026-03-12 09:14', user: 'Somchai K.',  action: 'Voyage Created',         detail: `Voyage ${voyage.id} scheduled. Status set to Open.` },
              { date: '2026-03-18 14:32', user: 'Nattaya P.',  action: 'ETD Updated',            detail: 'ETD revised from 2026-04-01 → ' + voyage.etd },
              { date: '2026-03-25 11:05', user: 'System EDI',  action: 'BAPLIE Received',        detail: `Bay plan received from ${voyage.line}. 340 slots pre-allocated.` },
              { date: '2026-04-01 08:00', user: 'Somchai K.',  action: 'Cut-offs Published',     detail: 'VGM, CY, and Port Closing cut-offs set and notified to agents.' },
              { date: '2026-04-02 16:45', user: 'System Auto', action: 'Status → ' + voyage.status, detail: 'Automatic status update triggered by ETD crossing.' },
            ].map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 0', borderBottom: i < 4 ? '1px solid var(--gecko-border)' : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 4 ? 'var(--gecko-primary-600)' : 'var(--gecko-gray-300)', marginTop: 3 }} />
                  {i < 4 && <div style={{ width: 1, flex: 1, background: 'var(--gecko-border)', marginTop: 6 }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{e.action}</span>
                    <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{e.user}</span>
                    <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', marginLeft: 'auto', fontFamily: 'var(--gecko-font-mono)' }}>{e.date}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{e.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
