"use client";

/**
 * EQUIPMENT POOL — live against gecko_tos `yard.vw_container_in_yard`, counted by
 * GET /api/tos/yard/stock into pools of type × line × grade × condition.
 *
 * Stock on hand only: the boxes in the yard now. Reservations, boxes outside the
 * depot, survey-pending counts and inter-depot transfers have no model, so they
 * are not on this screen. The box-by-box list is the stock list (/gate/stock).
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi, useApiList } from '@/lib/api/use-api';
import { saveBlob } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { formatDateTime } from '@/lib/api/tos';
import {
  YARD_STOCK_PERMISSIONS, teuLabel, yardStockPath,
  type StockLoad, type YardStock, type YardStockPool,
} from '@/lib/api/yard-stock';

interface Branch { branchId: string; branchCode: string; displayName: string }

const EMPTY_FILTERS = { query: '', line: '', type: '', grade: '', condition: '' };

const opt = (v: string | null) => v ?? '';
const distinct = (rows: YardStockPool[], pick: (p: YardStockPool) => string | null) =>
  Array.from(new Set(rows.map(pick).filter((v): v is string => !!v))).sort();

export default function EquipmentPoolPage() {
  const { can, branchesFor } = useSession();
  const [branchId, setBranchId] = useState('');
  const [load, setLoad] = useState<StockLoad>('EMPTY');
  const [filters, setFilters] = useState<Record<string, string>>(EMPTY_FILTERS);
  const [sortBy, setSortBy] = useState('boxes_desc');

  const { data: branchRows } = useApiList<Branch>('/api/branches?pageSize=100');
  const mine = new Set(branchesFor(YARD_STOCK_PERMISSIONS.view));
  const depots = (branchRows ?? []).filter(b => mine.size === 0 || mine.has(b.branchId));
  const mayView = can(YARD_STOCK_PERMISSIONS.view) || mine.size > 0;

  const stock = useApi<YardStock>(mayView ? yardStockPath({ branchId, fullEmpty: load }) : null);
  const pools = useMemo(() => stock.data?.pools ?? [], [stock.data]);

  const filtered = useMemo(() => {
    const rows = pools.filter(p => {
      if (filters.query) {
        const q = filters.query.toLowerCase();
        const hay = [p.lineCode, p.lineName, p.equipmentTypeCode, p.gradeCode, p.conditionCode].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.line && p.lineCode !== filters.line) return false;
      if (filters.type && opt(p.equipmentTypeCode) !== filters.type) return false;
      if (filters.grade && opt(p.gradeCode) !== filters.grade) return false;
      if (filters.condition && opt(p.conditionCode) !== filters.condition) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      switch (sortBy) {
        case 'line_asc':  return a.lineCode.localeCompare(b.lineCode) || opt(a.equipmentTypeCode).localeCompare(opt(b.equipmentTypeCode));
        case 'type_asc':  return opt(a.equipmentTypeCode).localeCompare(opt(b.equipmentTypeCode)) || a.lineCode.localeCompare(b.lineCode);
        case 'held_desc': return b.tally.held - a.tally.held;
        case 'aged_desc': return b.tally.daysOver30 - a.tally.daysOver30;
        default:          return b.tally.boxes - a.tally.boxes;
      }
    });
  }, [pools, filters, sortBy]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered, 15);

  // KPI totals over the filtered pools
  const kpi = useMemo(() => filtered.reduce((acc, p) => {
    acc.boxes += p.tally.boxes; acc.teu += p.tally.teu; acc.full += p.tally.full; acc.empty += p.tally.empty;
    acc.held += p.tally.held; acc.aged += p.tally.daysOver30;
    return acc;
  }, { boxes: 0, teu: 0, full: 0, empty: 0, held: 0, aged: 0 }), [filtered]);

  const filterFields: FilterField[] = [
    { type: 'search', key: 'query', placeholder: 'Search line, type, grade…' },
    { type: 'select', key: 'line', label: 'Line', options: [
        { value: '', label: 'All lines' },
        ...distinct(pools, p => p.lineCode).map(l => ({ value: l, label: pools.find(p => p.lineCode === l)?.lineName ? `${l} — ${pools.find(p => p.lineCode === l)?.lineName}` : l })),
    ] },
    { type: 'select', key: 'type', label: 'Type', options: [
        { value: '', label: 'All types' }, ...distinct(pools, p => p.equipmentTypeCode).map(t => ({ value: t, label: t })),
    ] },
    { type: 'select', key: 'grade', label: 'Grade', options: [
        { value: '', label: 'All grades' }, ...distinct(pools, p => p.gradeCode).map(g => ({ value: g, label: `Grade ${g}` })),
    ] },
    { type: 'select', key: 'condition', label: 'Condition', options: [
        { value: '', label: 'All conditions' }, ...distinct(pools, p => p.conditionCode).map(c => ({ value: c, label: c })),
    ] },
  ];

  const sortOptions: SortOption[] = [
    { value: 'boxes_desc', label: 'Boxes (high → low)' },
    { value: 'line_asc',   label: 'Line (A → Z)' },
    { value: 'type_asc',   label: 'Type (A → Z)' },
    { value: 'held_desc',  label: 'On hold (high → low)' },
    { value: 'aged_desc',  label: 'Over 30 days (high → low)' },
  ];

  const exportCsv = () => {
    const head = ['Line', 'Line name', 'Type', 'Size', 'Grade', 'Condition', 'Full', 'Empty', 'Boxes', 'TEU', 'Reefer', 'On hold', 'Over 30 days', 'Longest days'];
    const cell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = filtered.map(p => [p.lineCode, p.lineName, p.equipmentTypeCode, p.sizeCode, p.gradeCode, p.conditionCode,
      p.tally.full, p.tally.empty, p.tally.boxes, p.tally.teu, p.tally.reefer, p.tally.held, p.tally.daysOver30, p.tally.maxDays].map(cell).join(','));
    saveBlob(new Blob([[head.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'equipment-pool.csv');
  };

  const loadLabel = load === 'EMPTY' ? 'Empty' : load === 'FULL' ? 'Full' : 'All';
  const error = stock.error;

  return (
    <div className="gecko-stack">

      {/* ── Header ── */}
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <div className="gecko-row gecko-row-baseline">
            <h1 className="gecko-page-title">Equipment Pool</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
            <span className="gecko-count-badge">
              {stock.loading && !stock.data ? '…' : `${filtered.length} of ${pools.length} pools`}
            </span>
          </div>
          <p className="gecko-page-subtitle">
            {loadLabel === 'All' ? 'Stock' : `${loadLabel} stock`} on hand by type × line × grade × condition
            {stock.data ? ` · as at ${formatDateTime(stock.data.asAt)}` : ''}
          </p>
        </div>
        <div className="gecko-page-header-actions">
          <select className="gecko-input gecko-input-sm" aria-label="Depot" value={branchId} onChange={e => setBranchId(e.target.value)} style={{ minWidth: 170 }}>
            <option value="">All my depots</option>
            {depots.map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
          </select>
          <div className="gecko-segctrl">
            {([['EMPTY', 'Empty'], ['FULL', 'Full'], ['', 'All']] as const).map(([v, label]) => (
              <button key={v} onClick={() => { setLoad(v); setPage(1); }} className={`gecko-segctrl-btn${load === v ? ' gecko-segctrl-btn-active' : ''}`}>
                {label}
              </button>
            ))}
          </div>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Icon name="download" size={13} /> Export
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={stock.reload}>
            <Icon name="refreshCcw" size={13} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{error.title}</div>
            {error.explanation && <div>{error.explanation}</div>}
          </div>
        </div>
      )}

      {/* ── KPI Strip ── */}
      <div className="gecko-grid-5">
        {[
          { label: 'Boxes',        value: kpi.boxes.toLocaleString(), icon: 'box',           tone: 'primary' as const },
          { label: 'TEU',          value: teuLabel(kpi.teu),          icon: 'layers',        tone: 'info'    as const },
          { label: load === '' ? 'Full · Empty' : load === 'FULL' ? 'Full' : 'Empty',
            value: load === '' ? `${kpi.full.toLocaleString()} · ${kpi.empty.toLocaleString()}` : (load === 'FULL' ? kpi.full : kpi.empty).toLocaleString(),
            icon: 'packageOpen', tone: 'success' as const },
          { label: 'On hold',      value: kpi.held.toLocaleString(),  icon: 'lock',          tone: 'warning' as const },
          { label: 'Over 30 days', value: kpi.aged.toLocaleString(),  icon: 'clock',         tone: 'error'   as const },
        ].map(k => (
          <div key={k.label} className="gecko-card gecko-card-tight gecko-row">
            <div className={`gecko-mini-icon gecko-mini-icon-lg gecko-mini-icon-${k.tone}`}>
              <Icon name={k.icon} size={17} />
            </div>
            <div>
              <div className="gecko-stat-num gecko-stat-num-sm gecko-mono">{stock.data ? k.value : '…'}</div>
              <div className="gecko-cell-meta">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter ── */}
      <FilterPopover
        fields={filterFields}
        values={filters}
        onChange={setFilters}
        onApply={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
        sortOptions={sortOptions}
        sortValue={sortBy}
        onSortChange={setSortBy}
      />

      {/* ── Table ── */}
      <div className="gecko-table-card">
        <table className="gecko-table">
          <thead>
            <tr>
              <th>Line</th>
              <th>Size · Type</th>
              <th style={{ width: 100 }}>Grade</th>
              <th style={{ width: 110 }}>Condition</th>
              <th style={{ width: 80, textAlign: 'right' }}>Full</th>
              <th style={{ width: 80, textAlign: 'right' }}>Empty</th>
              <th style={{ width: 90, textAlign: 'right' }}>Boxes</th>
              <th style={{ width: 80, textAlign: 'right' }}>TEU</th>
              <th style={{ width: 90, textAlign: 'right' }}>On hold</th>
              <th style={{ width: 110, textAlign: 'right' }}>Over 30 days</th>
              <th style={{ width: 90, textAlign: 'right' }}>Longest</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {stock.data && filtered.length === 0 && (
              <tr>
                <td colSpan={12}>
                  <EmptyState
                    icon="search"
                    title={pools.length === 0 ? `No ${load === '' ? '' : loadLabel.toLowerCase() + ' '}boxes in the yard` : 'No pools match the current filters'}
                    description={pools.length === 0 ? 'Pools appear here as boxes are gated in.' : 'Try clearing the search or adjusting line / type / grade / condition.'}
                  />
                </td>
              </tr>
            )}
            {pageItems.map(p => (
              <tr key={`${p.lineCode}|${p.equipmentTypeCode}|${p.gradeCode}|${p.conditionCode}`}>
                <td>
                  <div className="gecko-mono-strong">{p.lineCode}</div>
                  {p.lineName && <div className="gecko-cell-meta gecko-truncate" style={{ maxWidth: 200 }}>{p.lineName}</div>}
                </td>
                <td>
                  <span className="gecko-mono-strong">{p.equipmentTypeCode ?? '—'}</span>
                  {p.tally.reefer > 0 && <span style={{ fontSize: 11, marginLeft: 6, color: 'var(--gecko-info-700)' }}>Reefer</span>}
                </td>
                <td>
                  {p.gradeCode
                    ? <span className={`gecko-badge ${p.gradeCode === 'A' ? 'gecko-badge-primary' : 'gecko-badge-gray'}`}>Grade {p.gradeCode}</span>
                    : <span className="gecko-cell-meta">—</span>}
                </td>
                <td><span className="gecko-mono">{p.conditionCode ?? '—'}</span></td>
                <td className="gecko-num-tabular">{p.tally.full}</td>
                <td className="gecko-num-tabular">{p.tally.empty}</td>
                <td className="gecko-num-tabular" style={{ fontWeight: 700 }}>{p.tally.boxes}</td>
                <td className="gecko-num-tabular">{teuLabel(p.tally.teu)}</td>
                <td className="gecko-num-tabular" style={{ color: p.tally.held > 0 ? 'var(--gecko-warning-700)' : 'var(--gecko-text-disabled)' }}>{p.tally.held}</td>
                <td className="gecko-num-tabular" style={{ color: p.tally.daysOver30 > 0 ? 'var(--gecko-error-700)' : 'var(--gecko-text-disabled)' }}>{p.tally.daysOver30}</td>
                <td className="gecko-num-tabular">{p.tally.maxDays}d</td>
                <td>
                  <Link href="/gate/stock" className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" title="The boxes, one by one">
                    <Icon name="arrowRight" size={13} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <TablePagination
          page={page} pageSize={pageSize} totalItems={totalItems} totalPages={totalPages}
          startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={setPageSize}
          noun="pools"
        />
      </div>
    </div>
  );
}
