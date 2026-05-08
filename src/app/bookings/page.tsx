"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { BarcodeScanInput } from '@/components/ui/BarcodeDisplay';
import { ExportButton } from '@/components/ui/ExportButton';
import { RefreshButton } from '@/components/ui/RefreshButton';

// ─── Types ─────────────────────────────────────────────────────────────────────

type BookingDir = 'EXPORT' | 'IMPORT' | 'ALL';
type BookingStatus = 'ACTIVE' | 'CLOSED' | 'CANCELLED' | 'DRAFT';

interface BookingRow {
  id: string;
  bookingNo: string;
  orderNo: string;
  direction: 'EXPORT' | 'IMPORT';
  orderType: string;
  status: BookingStatus;
  agent: string;
  customer: string;
  vessel: string;
  voyageNo: string;
  loadPort: string;
  dischargePort: string;
  etd: string;
  cyCutoff: string;
  totalCtrs: number;
  fullIn: number;
  loaded: number;
  commodity: string;
  createdOn: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────────

const BOOKINGS: BookingRow[] = [
  { id: '1',  bookingNo: 'EGLV149602390729', orderNo: 'ESCT1260402925', direction: 'EXPORT', orderType: 'EXP CY/CY',  status: 'ACTIVE',    agent: 'EVERGREEN',  customer: 'TCL ELECTRONICS (THAILAND)',      vessel: 'EVER WEB',       voyageNo: '0344-022B', loadPort: 'SCT',  dischargePort: 'SGSIN', etd: '2026-06-21', cyCutoff: '2026-06-21T09:45', totalCtrs: 8,  fullIn: 7,  loaded: 0,  commodity: 'CONSUMER ELECTRONICS', createdOn: '2026-04-23' },
  { id: '2',  bookingNo: 'COSCO2604081142',  orderNo: 'ESCT1260403001', direction: 'EXPORT', orderType: 'EXP CY/CY',  status: 'ACTIVE',    agent: 'COSCO',      customer: 'THAI UNION GROUP PCL',            vessel: 'COSCO YANTIAN',  voyageNo: '026E',      loadPort: 'SCT',  dischargePort: 'CNSHA', etd: '2026-06-23', cyCutoff: '2026-06-22T12:00', totalCtrs: 20, fullIn: 18, loaded: 0,  commodity: 'FROZEN SEAFOOD',        createdOn: '2026-04-22' },
  { id: '3',  bookingNo: 'MAEU4260419834',   orderNo: 'ESCT1260402881', direction: 'EXPORT', orderType: 'EXP CFS/CY', status: 'ACTIVE',    agent: 'MSC',        customer: 'BANGCHAK CORPORATION PCL',        vessel: 'MSC LISBON',     voyageNo: 'FE025W',    loadPort: 'SCT',  dischargePort: 'NLRTM', etd: '2026-06-18', cyCutoff: '2026-06-17T14:00', totalCtrs: 4,  fullIn: 4,  loaded: 4,  commodity: 'LUBRICANTS',             createdOn: '2026-04-20' },
  { id: '4',  bookingNo: 'HLCU4260411078',   orderNo: 'ESCT1260402760', direction: 'EXPORT', orderType: 'EXP CY/CY',  status: 'CLOSED',    agent: 'HAPAG',      customer: 'PTT GLOBAL CHEMICAL',             vessel: 'HYUNDAI PRIDE',  voyageNo: '2612E',     loadPort: 'SCT',  dischargePort: 'DEHAM', etd: '2026-06-14', cyCutoff: '2026-06-13T08:00', totalCtrs: 12, fullIn: 12, loaded: 12, commodity: 'PETROCHEMICALS',         createdOn: '2026-04-18' },
  { id: '5',  bookingNo: 'OOLU2604022341',   orderNo: 'ISCT1260401922', direction: 'IMPORT', orderType: 'IMP CY/CY',  status: 'ACTIVE',    agent: 'OOIL',       customer: 'SIAM CEMENT GROUP (SCG)',         vessel: 'OOCL BERLIN',    voyageNo: '112W',      loadPort: 'CNSHA', dischargePort: 'SCT', etd: '2026-06-10', cyCutoff: '2026-06-09T10:00', totalCtrs: 15, fullIn: 0,  loaded: 0,  commodity: 'BUILDING MATERIALS',     createdOn: '2026-04-19' },
  { id: '6',  bookingNo: 'YMLU4260388001',   orderNo: 'ISCT1260401801', direction: 'IMPORT', orderType: 'IMP CY/CY',  status: 'ACTIVE',    agent: 'YML',        customer: 'CENTRAL RETAIL CORPORATION',      vessel: 'YM UPRIGHTNESS', voyageNo: '009W',      loadPort: 'CNNGB', dischargePort: 'SCT', etd: '2026-06-08', cyCutoff: '2026-06-07T09:00', totalCtrs: 30, fullIn: 0,  loaded: 0,  commodity: 'GENERAL MERCHANDISE',   createdOn: '2026-04-17' },
  { id: '7',  bookingNo: 'EGLV149601884312', orderNo: 'ESCT1260402100', direction: 'EXPORT', orderType: 'EXP CY/CY',  status: 'CANCELLED', agent: 'EVERGREEN',  customer: 'AEON CO. (THAILAND)',             vessel: 'EVER GIVEN',     voyageNo: '0341-019W', loadPort: 'SCT',  dischargePort: 'JPTYO', etd: '2026-06-05', cyCutoff: '2026-06-04T11:00', totalCtrs: 6,  fullIn: 0,  loaded: 0,  commodity: 'RETAIL GOODS',           createdOn: '2026-04-15' },
  { id: '8',  bookingNo: 'MSMU7226041109',   orderNo: 'ISCT1260401650', direction: 'IMPORT', orderType: 'IMP CFS/CY', status: 'ACTIVE',    agent: 'MSC',        customer: 'MINOR INTERNATIONAL PCL',         vessel: 'MSC SILVANA',    voyageNo: 'FW023E',    loadPort: 'ITMIL', dischargePort: 'SCT', etd: '2026-06-03', cyCutoff: '2026-06-02T08:00', totalCtrs: 2,  fullIn: 0,  loaded: 0,  commodity: 'FOOD & BEVERAGES',       createdOn: '2026-04-14' },
  { id: '9',  bookingNo: 'COSU4260407771',   orderNo: 'ESCT1260402480', direction: 'EXPORT', orderType: 'EXP CY/CFS', status: 'DRAFT',     agent: 'COSCO',      customer: 'INDORAMA VENTURES PCL',           vessel: 'COSCO SHIPPING', voyageNo: '113E',      loadPort: 'SCT',  dischargePort: 'INNSA', etd: '2026-06-28', cyCutoff: '2026-06-27T10:00', totalCtrs: 5,  fullIn: 0,  loaded: 0,  commodity: 'POLYESTER FIBERS',       createdOn: '2026-04-24' },
  { id: '10', bookingNo: 'APLU4260319102',   orderNo: 'ESCT1260402200', direction: 'EXPORT', orderType: 'EXP CY/CY',  status: 'ACTIVE',    agent: 'APL',        customer: 'CP GROUP (CHAROEN POKPHAND)',    vessel: 'APL SENTOSA',    voyageNo: '0234W',     loadPort: 'SCT',  dischargePort: 'USNYC', etd: '2026-07-02', cyCutoff: '2026-07-01T14:00', totalCtrs: 25, fullIn: 3,  loaded: 0,  commodity: 'AGRI-FOOD PRODUCTS',    createdOn: '2026-04-24' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_META: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  ACTIVE:    { label: 'Active',    color: 'var(--gecko-success-700)', bg: 'var(--gecko-success-50)' },
  CLOSED:    { label: 'Closed',    color: 'var(--gecko-text-secondary)', bg: 'var(--gecko-bg-subtle)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--gecko-danger-700)',  bg: 'var(--gecko-danger-50)'  },
  DRAFT:     { label: 'Draft',     color: 'var(--gecko-warning-700)', bg: 'var(--gecko-warning-50)' },
};

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - new Date('2026-04-26').getTime();
  return Math.ceil(diff / 86400000);
}

function cutoffColor(iso: string) {
  const d = daysUntil(iso);
  if (d < 0)  return { color: 'var(--gecko-danger-700)',  bg: 'var(--gecko-danger-50)'  };
  if (d <= 3) return { color: 'var(--gecko-danger-600)',  bg: 'var(--gecko-danger-50)'  };
  if (d <= 7) return { color: 'var(--gecko-warning-700)', bg: 'var(--gecko-warning-50)' };
  return       { color: 'var(--gecko-success-700)', bg: 'var(--gecko-success-50)' };
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2,'0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}-${d.getFullYear()}`;
}

function ProgressPip({ total, done, label }: { total: number; done: number; label: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 44 }}>
      <div style={{ fontSize: 9.5, color: 'var(--gecko-text-disabled)', textAlign: 'center' }}>{label}</div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--gecko-border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--gecko-success-500)' : 'var(--gecko-primary-500)', borderRadius: 2, transition: 'width 300ms' }} />
      </div>
      <div style={{ fontSize: 10, fontFamily: 'var(--gecko-font-mono)', textAlign: 'center', color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>{done}/{total}</div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function BookingRegisterPage() {
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState<BookingDir>('ALL');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<'etd' | 'cyCutoff' | 'createdOn'>('createdOn');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    return BOOKINGS
      .filter(b => {
        if (dirFilter !== 'ALL' && b.direction !== dirFilter) return false;
        if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            b.bookingNo.toLowerCase().includes(q) ||
            b.orderNo.toLowerCase().includes(q) ||
            b.customer.toLowerCase().includes(q) ||
            b.agent.toLowerCase().includes(q) ||
            b.vessel.toLowerCase().includes(q) ||
            b.commodity.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const va = a[sortKey], vb = b[sortKey];
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
  }, [search, dirFilter, statusFilter, sortKey, sortDir]);

  const allSelected = filtered.length > 0 && filtered.every(b => selected.has(b.id));
  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      filtered.forEach(b => next.delete(b.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach(b => next.add(b.id));
      setSelected(next);
    }
  };
  const toggleRow = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: typeof sortKey }) => (
    <Icon name={sortKey === col ? (sortDir === 'asc' ? 'chevronUp' : 'chevronDown') : 'chevronDown'}
      size={11} style={{ opacity: sortKey === col ? 1 : 0.3, marginLeft: 3 }} />
  );

  // KPI counts
  const totalActive  = BOOKINGS.filter(b => b.status === 'ACTIVE').length;
  const totalCtrs    = BOOKINGS.reduce((s, b) => s + b.totalCtrs, 0);
  const pendingFullIn = BOOKINGS.filter(b => b.status === 'ACTIVE').reduce((s, b) => s + (b.totalCtrs - b.fullIn), 0);
  const draftCount   = BOOKINGS.filter(b => b.status === 'DRAFT').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gecko-text-primary)', margin: 0 }}>Booking Register</h1>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', border: '1px solid var(--gecko-primary-200)' }}>
              {filtered.length} of {BOOKINGS.length}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
            Gate-to-vessel lifecycle tracker — Laem Chabang ICD · Import Yard
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ExportButton resource="Bookings" iconSize={13} />
          <RefreshButton resource="Bookings" iconSize={13} />
          <Link href="/bookings/new" className="gecko-btn gecko-btn-primary gecko-btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={13} />New Booking
          </Link>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Active Bookings',    value: totalActive,   icon: 'clipboardList', color: 'var(--gecko-primary-700)',  bg: 'var(--gecko-primary-50)' },
          { label: 'Total Containers',   value: totalCtrs,     icon: 'box',           color: 'var(--gecko-info-700)',    bg: 'var(--gecko-info-50)'    },
          { label: 'Pending Gate-In',    value: pendingFullIn, icon: 'truck',         color: 'var(--gecko-warning-700)', bg: 'var(--gecko-warning-50)' },
          { label: 'Draft Bookings',     value: draftCount,    icon: 'layers',        color: 'var(--gecko-text-secondary)', bg: 'var(--gecko-bg-subtle)' },
        ].map(k => (
          <div key={k.label} style={{ padding: '12px 14px', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={k.icon} size={17} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--gecko-text-primary)' }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters + Search ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <BarcodeScanInput
          onScan={v => setSearch(v)}
          placeholder="Scan booking no…"
          size="sm"
          style={{ width: 200 }}
        />
        {/* Direction toggle */}
        <div style={{ display: 'flex', background: 'var(--gecko-bg-subtle)', borderRadius: 8, padding: 2, border: '1px solid var(--gecko-border)' }}>
          {(['ALL', 'EXPORT', 'IMPORT'] as const).map(d => (
            <button key={d} onClick={() => setDirFilter(d)} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              background: dirFilter === d ? 'var(--gecko-bg-surface)' : 'transparent',
              color: dirFilter === d ? (d === 'EXPORT' ? 'var(--gecko-primary-700)' : d === 'IMPORT' ? 'var(--gecko-info-700)' : 'var(--gecko-text-primary)') : 'var(--gecko-text-secondary)',
              boxShadow: dirFilter === d ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>{d === 'ALL' ? 'All' : d === 'EXPORT' ? '↑ Export' : '↓ Import'}</button>
          ))}
        </div>

        {/* Status filter */}
        <select className="gecko-input gecko-input-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          style={{ width: 130, fontSize: 12 }}>
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="CLOSED">Closed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 360, position: 'relative' }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
          <input className="gecko-input gecko-input-sm" placeholder="Search booking no, order no, customer, vessel…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, paddingRight: search ? 30 : 10 }} />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-disabled)', padding: 0, lineHeight: 1 }}>
              <Icon name="close" size={13} />
            </button>
          )}
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
          Sort by:
        </div>
        {(['etd', 'cyCutoff', 'createdOn'] as const).map(k => (
          <button key={k} onClick={() => toggleSort(k)} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: sortKey === k ? 700 : 500, cursor: 'pointer',
            border: '1px solid var(--gecko-border)', background: sortKey === k ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
            color: sortKey === k ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
          }}>
            {k === 'etd' ? 'ETD' : k === 'cyCutoff' ? 'CY Cut-off' : 'Booking Date'}<SortIcon col={k} />
          </button>
        ))}
      </div>

      {/* ── Bulk Actions ── */}
      {selected.size > 0 && (
        <div style={{ padding: '10px 14px', background: 'var(--gecko-primary-50)', border: '1px solid var(--gecko-primary-200)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-primary-700)' }}>{selected.size} booking{selected.size > 1 ? 's' : ''} selected</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <ExportButton label="Export Selected" resource="Selected bookings" variant="outline" iconSize={12} />
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="transferH" size={12} />Bulk Transfer</button>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-danger-600)' }}><Icon name="close" size={12} />Cancel Selected</button>
          </div>
          <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-secondary)', fontSize: 11, fontFamily: 'inherit' }}>Clear selection</button>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table className="gecko-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 172 }} />
            <col style={{ width: 148 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 64 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--gecko-primary-600)' }} />
              </th>
              <th>Booking No / Order No</th>
              <th>Customer</th>
              <th>Dir / Type</th>
              <th>Status</th>
              <th>Agent</th>
              <th>Vessel</th>
              <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('etd')}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>ETD / CY Cut-off <SortIcon col="etd" /></span>
              </th>
              <th>Containers</th>
              <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('createdOn')}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>Booking Date <SortIcon col="createdOn" /></span>
              </th>
              <th style={{ width: 64 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--gecko-text-secondary)' }}>
                    <Icon name="clipboardList" size={32} style={{ opacity: 0.25, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>No bookings found</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters or search query</div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map(b => {
              const sm = STATUS_META[b.status];
              const cc = cutoffColor(b.cyCutoff);
              const daysLeft = daysUntil(b.cyCutoff);
              const isSelected = selected.has(b.id);
              return (
                <tr key={b.id} style={{ background: isSelected ? 'var(--gecko-primary-50)' : undefined }} className="gecko-table-row">
                  <td>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(b.id)}
                      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--gecko-primary-600)' }} />
                  </td>
                  <td style={{ cursor: 'pointer' }}>
                    <Link href={`/bookings/${b.bookingNo}`} style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-primary-600)', letterSpacing: '0.01em' }}>
                        {b.bookingNo}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)', marginTop: 1 }}>{b.orderNo}</div>
                    </Link>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.customer}>{b.customer}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
                      background: b.direction === 'EXPORT' ? 'var(--gecko-primary-50)' : 'var(--gecko-info-50)',
                      color:      b.direction === 'EXPORT' ? 'var(--gecko-primary-700)' : 'var(--gecko-info-700)',
                      border:     `1px solid ${b.direction === 'EXPORT' ? 'var(--gecko-primary-200)' : 'var(--gecko-info-200)'}`,
                      display: 'inline-block',
                    }}>{b.direction === 'EXPORT' ? '↑ EXP' : '↓ IMP'}</span>
                    <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.orderType}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: sm.bg, color: sm.color }}>{sm.label}</span>
                  </td>
                  <td>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{b.agent}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.vessel}>{b.vessel}</div>
                    <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)', marginTop: 1 }}>{b.voyageNo}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{formatDate(b.etd)}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: cc.bg, color: cc.color, fontFamily: 'var(--gecko-font-mono)', display: 'inline-block', marginTop: 3 }}>
                      {daysLeft < 0 ? 'EXPIRED' : daysLeft === 0 ? 'TODAY' : `${daysLeft}d`}
                    </span>
                    <div style={{ fontSize: 9.5, color: 'var(--gecko-text-disabled)', marginTop: 1, fontFamily: 'var(--gecko-font-mono)' }}>Cut: {formatDate(b.cyCutoff)}</div>
                  </td>
                  <td>
                    <ProgressPip total={b.totalCtrs} done={b.fullIn} label="Full In" />
                  </td>
                  <td>
                    <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>{formatDate(b.createdOn)}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Link href={`/bookings/${b.bookingNo}`}
                        className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                        title="Open booking"
                        style={{ textDecoration: 'none' }}>
                        <Icon name="arrowRight" size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--gecko-bg-subtle)' }}>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
            Showing <span style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{filtered.length}</span> booking{filtered.length !== 1 ? 's' : ''}
            {selected.size > 0 && <span style={{ marginLeft: 8 }}>· <span style={{ fontWeight: 600, color: 'var(--gecko-primary-700)' }}>{selected.size} selected</span></span>}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1].map(p => (
              <button key={p} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--gecko-primary-300)', background: 'var(--gecko-primary-600)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
