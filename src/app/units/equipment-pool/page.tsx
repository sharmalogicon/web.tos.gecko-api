"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { ExportButton } from '@/components/ui/ExportButton';
import { RefreshButton } from '@/components/ui/RefreshButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type Grade = 'A' | 'B' | 'C' | 'NEW';

interface PoolRow {
  line: string;
  size: string;
  type: string;
  grade: Grade;
  available: number;
  damaged: number;
  surveyPending: number;
  reserved: number;
  outsideDepot: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const POOLS: PoolRow[] = [
  { line: 'EVERGREEN', size: '20', type: 'GP', grade: 'A',   available: 142, damaged: 4, surveyPending: 6, reserved: 18,  outsideDepot: 22 },
  { line: 'EVERGREEN', size: '40', type: 'GP', grade: 'A',   available: 88,  damaged: 2, surveyPending: 3, reserved: 12,  outsideDepot: 16 },
  { line: 'EVERGREEN', size: '40', type: 'HC', grade: 'A',   available: 204, damaged: 6, surveyPending: 5, reserved: 28,  outsideDepot: 31 },
  { line: 'EVERGREEN', size: '45', type: 'HC', grade: 'A',   available: 14,  damaged: 0, surveyPending: 0, reserved: 2,   outsideDepot: 1  },
  { line: 'EVERGREEN', size: '20', type: 'RF', grade: 'A',   available: 12,  damaged: 1, surveyPending: 2, reserved: 4,   outsideDepot: 3  },
  { line: 'EVERGREEN', size: '40', type: 'RH', grade: 'A',   available: 22,  damaged: 0, surveyPending: 1, reserved: 6,   outsideDepot: 5  },
  { line: 'COSCO',     size: '20', type: 'GP', grade: 'A',   available: 96,  damaged: 3, surveyPending: 2, reserved: 14,  outsideDepot: 18 },
  { line: 'COSCO',     size: '40', type: 'HC', grade: 'A',   available: 156, damaged: 4, surveyPending: 4, reserved: 22,  outsideDepot: 26 },
  { line: 'COSCO',     size: '40', type: 'RH', grade: 'A',   available: 18,  damaged: 0, surveyPending: 1, reserved: 4,   outsideDepot: 4  },
  { line: 'MAERSK',    size: '20', type: 'GP', grade: 'A',   available: 110, damaged: 5, surveyPending: 4, reserved: 16,  outsideDepot: 20 },
  { line: 'MAERSK',    size: '40', type: 'GP', grade: 'A',   available: 72,  damaged: 1, surveyPending: 2, reserved: 9,   outsideDepot: 12 },
  { line: 'MAERSK',    size: '40', type: 'HC', grade: 'A',   available: 188, damaged: 8, surveyPending: 6, reserved: 24,  outsideDepot: 30 },
  { line: 'MAERSK',    size: '20', type: 'RF', grade: 'A',   available: 16,  damaged: 1, surveyPending: 3, reserved: 5,   outsideDepot: 4  },
  { line: 'MSC',       size: '40', type: 'HC', grade: 'A',   available: 134, damaged: 3, surveyPending: 2, reserved: 19,  outsideDepot: 22 },
  { line: 'MSC',       size: '40', type: 'OT', grade: 'A',   available: 6,   damaged: 0, surveyPending: 0, reserved: 1,   outsideDepot: 0  },
  { line: 'OOIL',      size: '40', type: 'HC', grade: 'A',   available: 92,  damaged: 2, surveyPending: 3, reserved: 11,  outsideDepot: 14 },
  { line: 'OOIL',      size: '20', type: 'GP', grade: 'B',   available: 28,  damaged: 1, surveyPending: 1, reserved: 3,   outsideDepot: 5  },
  { line: 'YML',       size: '40', type: 'HC', grade: 'A',   available: 78,  damaged: 2, surveyPending: 2, reserved: 9,   outsideDepot: 11 },
  { line: 'HAPAG',     size: '40', type: 'HC', grade: 'A',   available: 64,  damaged: 1, surveyPending: 1, reserved: 8,   outsideDepot: 9  },
  { line: 'APL',       size: '40', type: 'GP', grade: 'A',   available: 40,  damaged: 0, surveyPending: 1, reserved: 5,   outsideDepot: 7  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function totalOf(p: PoolRow) {
  return p.available + p.damaged + p.surveyPending + p.reserved + p.outsideDepot;
}

function utilisation(p: PoolRow) {
  const t = totalOf(p);
  if (t === 0) return 0;
  return Math.round(((p.reserved + p.outsideDepot) / t) * 100);
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  GP: { label: 'General Purpose', color: 'var(--gecko-primary-700)' },
  HC: { label: 'High-Cube',       color: 'var(--gecko-primary-700)' },
  RF: { label: 'Reefer',          color: 'var(--gecko-info-700)'    },
  RH: { label: 'Reefer HC',       color: 'var(--gecko-info-700)'    },
  OT: { label: 'Open Top',        color: 'var(--gecko-warning-700)' },
  FR: { label: 'Flat Rack',       color: 'var(--gecko-warning-700)' },
  TK: { label: 'Tank',            color: 'var(--gecko-warning-700)' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipmentPoolPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    query: '', line: '', size: '', type: '', grade: '',
  });
  const [sortBy, setSortBy] = useState('line_asc');
  const { toast } = useToast();

  // Filter & sort
  const filtered = useMemo(() => {
    let rows = POOLS.filter(p => {
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!p.line.toLowerCase().includes(q) && !p.type.toLowerCase().includes(q)) return false;
      }
      if (filters.line  && p.line  !== filters.line)  return false;
      if (filters.size  && p.size  !== filters.size)  return false;
      if (filters.type  && p.type  !== filters.type)  return false;
      if (filters.grade && p.grade !== filters.grade) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      switch (sortBy) {
        case 'line_asc':       return a.line.localeCompare(b.line);
        case 'available_desc': return b.available - a.available;
        case 'damaged_desc':   return b.damaged - a.damaged;
        case 'utilisation_desc': return utilisation(b) - utilisation(a);
        default: return 0;
      }
    });
    return rows;
  }, [filters, sortBy]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered, 15);

  // KPI totals
  const kpi = useMemo(() => {
    const t = filtered.reduce((acc, p) => {
      acc.available += p.available;
      acc.damaged += p.damaged;
      acc.surveyPending += p.surveyPending;
      acc.reserved += p.reserved;
      acc.outsideDepot += p.outsideDepot;
      return acc;
    }, { available: 0, damaged: 0, surveyPending: 0, reserved: 0, outsideDepot: 0 });
    return { ...t, total: t.available + t.damaged + t.surveyPending + t.reserved + t.outsideDepot };
  }, [filtered]);

  const filterFields: FilterField[] = [
    { type: 'search', key: 'query',  placeholder: 'Search line or type…' },
    { type: 'select', key: 'line',   label: 'Line', options: [
        { value: '', label: 'All lines' },
        ...Array.from(new Set(POOLS.map(p => p.line))).sort().map(l => ({ value: l, label: l })),
    ] },
    { type: 'select', key: 'size',   label: 'Size', options: [
        { value: '', label: 'All sizes' }, { value: '20', label: '20\'' }, { value: '40', label: '40\'' }, { value: '45', label: '45\'' },
    ] },
    { type: 'select', key: 'type',   label: 'Type', options: [
        { value: '', label: 'All types' },
        ...Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: `${k} — ${v.label}` })),
    ] },
    { type: 'select', key: 'grade',  label: 'Grade', options: [
        { value: '', label: 'All grades' }, { value: 'A', label: 'Grade A' }, { value: 'B', label: 'Grade B' }, { value: 'C', label: 'Grade C' }, { value: 'NEW', label: 'New' },
    ] },
  ];

  const sortOptions: SortOption[] = [
    { value: 'line_asc',         label: 'Line (A → Z)' },
    { value: 'available_desc',   label: 'Available (high → low)' },
    { value: 'damaged_desc',     label: 'Damaged (high → low)' },
    { value: 'utilisation_desc', label: 'Utilisation (high → low)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gecko-text-primary)', margin: 0 }}>Equipment Pool</h1>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', border: '1px solid var(--gecko-primary-200)' }}>
              {filtered.length} of {POOLS.length} pools
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
            Empty container inventory by line × size × type × grade — Laem Chabang ICD
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ExportButton resource="Equipment pool" iconSize={13} />
          <RefreshButton resource="Equipment pool" iconSize={13} />
          <button
            onClick={() => toast({ variant: 'info', title: 'Inter-depot transfer', message: 'Transfer workflow coming soon.' })}
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
          >
            <Icon name="transferH" size={13} /> Inter-depot Transfer
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {[
          { label: 'Available',      value: kpi.available,      icon: 'check',         color: 'var(--gecko-success-700)', bg: 'var(--gecko-success-50)' },
          { label: 'Damaged',        value: kpi.damaged,        icon: 'alertTriangle', color: 'var(--gecko-error-700)',   bg: 'var(--gecko-error-50)'   },
          { label: 'Survey Pending', value: kpi.surveyPending,  icon: 'clock',         color: 'var(--gecko-warning-700)', bg: 'var(--gecko-warning-50)' },
          { label: 'Reserved',       value: kpi.reserved,       icon: 'lock',          color: 'var(--gecko-info-700)',    bg: 'var(--gecko-info-50)'    },
          { label: 'Outside Depot',  value: kpi.outsideDepot,   icon: 'truck',         color: 'var(--gecko-text-secondary)', bg: 'var(--gecko-bg-subtle)' },
        ].map(k => (
          <div key={k.label} style={{ padding: '12px 14px', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={k.icon} size={17} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--gecko-text-primary)' }}>{k.value.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{k.label}</div>
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
        onClear={() => setFilters({ query: '', line: '', size: '', type: '', grade: '' })}
        sortOptions={sortOptions}
        sortValue={sortBy}
        onSortChange={setSortBy}
      />

      {/* ── Table ── */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table className="gecko-table">
          <thead>
            <tr>
              <th>Line</th>
              <th>Size · Type</th>
              <th style={{ width: 110 }}>Grade</th>
              <th style={{ width: 110, textAlign: 'right' }}>Available</th>
              <th style={{ width: 100, textAlign: 'right' }}>Damaged</th>
              <th style={{ width: 120, textAlign: 'right' }}>Survey Pending</th>
              <th style={{ width: 100, textAlign: 'right' }}>Reserved</th>
              <th style={{ width: 130, textAlign: 'right' }}>Outside Depot</th>
              <th style={{ width: 90,  textAlign: 'right' }}>Total</th>
              <th style={{ width: 130 }}>Utilisation</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <EmptyState
                    icon="search"
                    title="No pools match the current filters"
                    description="Try clearing the search or adjusting line / size / type / grade filters."
                  />
                </td>
              </tr>
            )}
            {pageItems.map((p, i) => {
              const t = totalOf(p);
              const util = utilisation(p);
              return (
                <tr key={`${p.line}-${p.size}${p.type}-${p.grade}-${i}`}>
                  <td>
                    <div style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{p.line}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)' }}>{p.size}{p.type}</span>
                      <span style={{ fontSize: 11, color: TYPE_META[p.type]?.color ?? 'var(--gecko-text-secondary)' }}>{TYPE_META[p.type]?.label ?? p.type}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`gecko-badge ${p.grade === 'NEW' ? 'gecko-badge-success' : p.grade === 'A' ? 'gecko-badge-primary' : 'gecko-badge-gray'}`}>
                      {p.grade === 'NEW' ? 'New' : `Grade ${p.grade}`}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-success-700)' }}>{p.available}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', color: p.damaged > 0 ? 'var(--gecko-error-700)' : 'var(--gecko-text-disabled)' }}>{p.damaged}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', color: p.surveyPending > 0 ? 'var(--gecko-warning-700)' : 'var(--gecko-text-disabled)' }}>{p.surveyPending}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>{p.reserved}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>{p.outsideDepot}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{t}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${util}%`, height: '100%',
                          background: util > 80 ? 'var(--gecko-error-500)' : util > 60 ? 'var(--gecko-warning-500)' : 'var(--gecko-success-500)',
                          transition: 'width 300ms',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{util}%</span>
                    </div>
                  </td>
                  <td>
                    <Link href="/units/unit-inquiry" className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" title="Drill into containers" style={{ textDecoration: 'none' }}>
                      <Icon name="arrowRight" size={13} />
                    </Link>
                  </td>
                </tr>
              );
            })}
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
