"use client";

/**
 * Seal Series master data.
 *
 * Per-agent allocated seal number ranges; gate-out validates seals applied
 * to outbound containers against active series for the registered agent.
 *
 * List page with KPI strip + filters + table + drawer for create/edit.
 * Matches the convention used by /masters/charge-codes and /masters/customers.
 */

import React, { useState, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, type FilterField, type SortOption } from '@/components/ui/FilterPopover';
import { ExportButton } from '@/components/ui/ExportButton';
import { useToast } from '@/components/ui/Toast';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { FormGrid, Field } from '@/components/ui/FormGrid';
import {
  SEAL_SERIES, AGENT_DIRECTORY,
  type SealSeries, type SealSeriesStatus,
  statusOf, remainingOf, totalOf,
} from '@/lib/seal-series-mocks';

const STATUS_BADGE: Record<SealSeriesStatus, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Active',    cls: 'gecko-badge gecko-badge-success' },
  EXHAUSTED: { label: 'Exhausted', cls: 'gecko-badge gecko-badge-gray'    },
  SUSPENDED: { label: 'Suspended', cls: 'gecko-badge gecko-badge-error'   },
};

const FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query',  placeholder: 'Search agent or prefix…' },
  { type: 'select', key: 'agent',  label: 'Agent',
    options: [{ label: 'All', value: '' },
              ...AGENT_DIRECTORY.map(a => ({ label: a.code, value: a.code }))] },
  { type: 'select', key: 'status', label: 'Status',
    options: [
      { label: 'All',       value: '' },
      { label: 'Active',    value: 'ACTIVE' },
      { label: 'Exhausted', value: 'EXHAUSTED' },
      { label: 'Suspended', value: 'SUSPENDED' },
    ]
  },
];

const SORT_OPTIONS: SortOption[] = [
  { label: 'Agent · Prefix · Start', value: 'agent' },
  { label: 'Series Start (low → high)', value: 'start' },
  { label: 'Remaining (low → high)', value: 'remaining' },
  { label: 'Recently created', value: 'recent' },
];

export default function SealSeriesPage() {
  const [series, setSeries] = useState<SealSeries[]>(SEAL_SERIES);
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', agent: '', status: '' });
  const [sortBy, setSortBy] = useState('agent');
  const [drawerFor, setDrawerFor] = useState<SealSeries | 'new' | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    let rows = series.map(s => ({ ...s, status: statusOf(s), remaining: remainingOf(s) }));
    if (filters.query) {
      const q = filters.query.toLowerCase();
      rows = rows.filter(r =>
        r.agentCode.toLowerCase().includes(q) ||
        r.prefix.toLowerCase().includes(q) ||
        r.agentName.toLowerCase().includes(q),
      );
    }
    if (filters.agent)  rows = rows.filter(r => r.agentCode === filters.agent);
    if (filters.status) rows = rows.filter(r => r.status === filters.status);

    if (sortBy === 'agent')     rows = rows.sort((a, b) =>
      a.agentCode.localeCompare(b.agentCode) ||
      a.prefix.localeCompare(b.prefix) ||
      a.seriesStart - b.seriesStart);
    if (sortBy === 'start')     rows = [...rows].sort((a, b) => a.seriesStart - b.seriesStart);
    if (sortBy === 'remaining') rows = [...rows].sort((a, b) => a.remaining - b.remaining);
    if (sortBy === 'recent')    rows = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return rows;
  }, [series, filters, sortBy]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } =
    usePagination(filtered, 25);

  // KPI tallies
  const totals = useMemo(() => {
    const withStatus = series.map(s => ({ s, status: statusOf(s) }));
    const totalRemaining = withStatus
      .filter(x => x.status === 'ACTIVE')
      .reduce((sum, x) => sum + remainingOf(x.s), 0);
    return {
      total:     series.length,
      active:    withStatus.filter(x => x.status === 'ACTIVE').length,
      exhausted: withStatus.filter(x => x.status === 'EXHAUSTED').length,
      suspended: withStatus.filter(x => x.status === 'SUSPENDED').length,
      remaining: totalRemaining,
    };
  }, [series]);

  /* ── Drawer save handler ──────────────────────────────────────────────── */
  const upsert = (row: SealSeries) => {
    setSeries(prev => {
      const i = prev.findIndex(p => p.id === row.id);
      if (i === -1) return [row, ...prev];
      const next = [...prev]; next[i] = row; return next;
    });
    toast({ variant: 'success', title: drawerFor === 'new' ? 'Seal series created' : 'Seal series updated',
            message: `${row.agentCode} · ${row.prefix} · ${row.seriesStart} → ${row.seriesEnd}` });
    setDrawerFor(null);
  };

  const remove = (id: string) => {
    setSeries(prev => prev.filter(p => p.id !== id));
    toast({ variant: 'warning', title: 'Seal series removed' });
    setDrawerFor(null);
  };

  return (
    <div className="gecko-seal-series-page">
      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-seal-series-title-row">
            <h1 className="gecko-seal-series-title">Seal Series</h1>
            <span className="gecko-count-badge">{totals.total} series</span>
            <span className="gecko-seal-series-remaining-pill">
              {totals.remaining.toLocaleString()} seals available
            </span>
          </div>
          <div className="gecko-seal-series-sub">
            Per-agent allocated seal number ranges. Gate-out validates applied seals
            against an active series for the registered shipping line.
          </div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton resource="Seal series" iconSize={16} />
          <FilterPopover
            fields={FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', agent: '', status: '' })}
            sortOptions={SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button
            type="button"
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            onClick={() => setDrawerFor('new')}
          >
            <Icon name="plus" size={16} /> New Series
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="gecko-seal-series-kpi-strip">
        <KPI label="Total Series"  value={String(totals.total)}     sub="across all agents"   tone="primary" />
        <KPI label="Active"        value={String(totals.active)}    sub="accepting seals"     tone="success" />
        <KPI label="Exhausted"     value={String(totals.exhausted)} sub="fully consumed"      tone="neutral" />
        <KPI label="Suspended"     value={String(totals.suspended)} sub="agent / audit holds" tone="danger"  />
        <KPI label="Seals Available" value={totals.remaining.toLocaleString()} sub="in active series" tone="info" />
      </div>

      {/* Table */}
      <div className="gecko-seal-series-table-card">
        <table className="gecko-table gecko-table-comfortable gecko-seal-series-table">
          <thead>
            <tr>
              <th className="gecko-seal-series-th-agent">Agent</th>
              <th className="gecko-seal-series-th-prefix">Prefix</th>
              <th className="gecko-num">Series Start</th>
              <th className="gecko-num">Series End</th>
              <th className="gecko-num">Current</th>
              <th className="gecko-num">Remaining</th>
              <th className="gecko-num">Total</th>
              <th className="gecko-seal-series-th-status">Status</th>
              <th className="gecko-seal-series-th-remarks">Remarks</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map(r => (
              <tr key={r.id} onClick={() => setDrawerFor(r)} className="gecko-seal-series-row">
                <td>
                  <div className="gecko-seal-series-agent-cell">
                    <span className="gecko-seal-series-agent-code">{r.agentCode}</span>
                    <span className="gecko-seal-series-agent-name">{r.agentName}</span>
                  </div>
                </td>
                <td><span className="gecko-mono gecko-seal-series-prefix">{r.prefix}</span></td>
                <td className="gecko-num gecko-mono">{r.seriesStart.toLocaleString()}</td>
                <td className="gecko-num gecko-mono">{r.seriesEnd.toLocaleString()}</td>
                <td className="gecko-num gecko-mono">{r.currentSeal.toLocaleString()}</td>
                <td className="gecko-num gecko-mono gecko-seal-series-remaining">
                  {r.remaining.toLocaleString()}
                </td>
                <td className="gecko-num gecko-mono gecko-seal-series-total">{totalOf(r).toLocaleString()}</td>
                <td><span className={STATUS_BADGE[r.status].cls}>{STATUS_BADGE[r.status].label}</span></td>
                <td className="gecko-seal-series-remarks-cell">{r.remarks ?? '—'}</td>
                <td>
                  <button
                    type="button"
                    className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                    onClick={(e) => { e.stopPropagation(); setDrawerFor(r); }}
                    aria-label="Edit"
                  >
                    <Icon name="edit" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={page} pageSize={pageSize} totalItems={totalItems} totalPages={totalPages}
          startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={setPageSize}
          noun="seal series"
        />
      </div>

      {drawerFor && (
        <SealSeriesDrawer
          mode={drawerFor === 'new' ? 'new' : 'edit'}
          initial={drawerFor === 'new' ? null : drawerFor}
          onClose={() => setDrawerFor(null)}
          onSave={upsert}
          onDelete={drawerFor === 'new' ? undefined : () => remove(drawerFor.id)}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   KPI tile
   ────────────────────────────────────────────────────────────────────────── */

function KPI({
  label, value, sub, tone,
}: {
  label: string; value: string; sub?: string;
  tone: 'primary' | 'success' | 'danger' | 'info' | 'neutral';
}) {
  return (
    <div className="gecko-seal-series-kpi-tile">
      <div className="gecko-seal-series-kpi-label">{label}</div>
      <div className={`gecko-seal-series-kpi-value gecko-seal-series-kpi-${tone}`}>{value}</div>
      {sub && <div className="gecko-seal-series-kpi-sub">{sub}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Add / Edit drawer
   ────────────────────────────────────────────────────────────────────────── */

function SealSeriesDrawer({
  mode, initial, onClose, onSave, onDelete,
}: {
  mode: 'new' | 'edit';
  initial: SealSeries | null;
  onClose: () => void;
  onSave: (s: SealSeries) => void;
  onDelete?: () => void;
}) {
  const [agentCode, setAgentCode] = useState(initial?.agentCode ?? '');
  const [prefix, setPrefix] = useState(initial?.prefix ?? '');
  const [seriesStart, setSeriesStart] = useState(initial?.seriesStart?.toString() ?? '');
  const [seriesEnd, setSeriesEnd] = useState(initial?.seriesEnd?.toString() ?? '');
  const [currentSeal, setCurrentSeal] = useState(initial?.currentSeal?.toString() ?? '0');
  const [suspended, setSuspended] = useState(initial?.suspended ?? false);
  const [remarks, setRemarks] = useState(initial?.remarks ?? '');

  const agent = AGENT_DIRECTORY.find(a => a.code === agentCode);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const start = Number(seriesStart);
    const end = Number(seriesEnd);
    const cur = Number(currentSeal);
    if (!agent) return;
    if (!prefix.trim()) return;
    if (!(end >= start)) return;
    if (!(cur === 0 || (cur >= start - 1 && cur <= end))) return;

    onSave({
      id: initial?.id ?? `ss-${Date.now()}`,
      agentCode: agent.code,
      agentName: agent.name,
      prefix: prefix.trim().toUpperCase(),
      seriesStart: start,
      seriesEnd: end,
      currentSeal: cur,
      suspended,
      remarks: remarks.trim() || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString().slice(0, 10),
      createdBy: initial?.createdBy ?? 'WICHCHAKORN',
    });
  };

  return (
    <>
      <div className="gecko-drawer-scrim" onClick={onClose} />
      <aside className="gecko-drawer" role="dialog" aria-label={mode === 'new' ? 'New seal series' : 'Edit seal series'}>
        <div className="gecko-drawer-header">
          <div>
            <div className="gecko-drawer-title">
              {mode === 'new' ? 'New Seal Series' : 'Edit Seal Series'}
            </div>
            <div className="gecko-drawer-subtitle">
              {agent ? agent.name : 'Pick an agent to begin'}
            </div>
          </div>
          <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="gecko-drawer-body">
          <FormGrid columns={1}>
            <Field label="Agent" required htmlFor="ss-agent">
              <select
                id="ss-agent"
                className="gecko-input"
                value={agentCode}
                onChange={e => setAgentCode(e.target.value)}
                required
              >
                <option value="">— select agent —</option>
                {AGENT_DIRECTORY.map(a => (
                  <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Seal Prefix" required htmlFor="ss-prefix"
                   helper="Printed letter(s) on the physical seal — e.g. L0">
              <input
                id="ss-prefix"
                type="text"
                className="gecko-input gecko-seal-series-prefix-input"
                placeholder="e.g. L0"
                value={prefix}
                onChange={e => setPrefix(e.target.value.toUpperCase())}
                maxLength={6}
                required
              />
            </Field>
          </FormGrid>

          <FormGrid columns={2}>
            <Field label="Series Start" required htmlFor="ss-start">
              <input
                id="ss-start"
                type="number" required min={0}
                className="gecko-input"
                value={seriesStart}
                onChange={e => setSeriesStart(e.target.value)}
              />
            </Field>
            <Field label="Series End" required htmlFor="ss-end">
              <input
                id="ss-end"
                type="number" required min={0}
                className="gecko-input"
                value={seriesEnd}
                onChange={e => setSeriesEnd(e.target.value)}
              />
            </Field>
          </FormGrid>

          <FormGrid columns={1}>
            <Field label="Current Seal No." htmlFor="ss-current"
                   helper="Last allocated seal in this series. 0 = unused.">
              <input
                id="ss-current"
                type="number" min={0}
                className="gecko-input"
                value={currentSeal}
                onChange={e => setCurrentSeal(e.target.value)}
              />
            </Field>
          </FormGrid>

          <label className="gecko-seal-series-suspend-row">
            <input
              type="checkbox"
              checked={suspended}
              onChange={e => setSuspended(e.target.checked)}
            />
            <span>Suspend this series</span>
            <span className="gecko-seal-series-suspend-hint">Blocks new allocations</span>
          </label>

          <FormGrid columns={1}>
            <Field label="Remarks" htmlFor="ss-remarks">
              <input
                id="ss-remarks"
                type="text"
                className="gecko-input"
                placeholder="Optional — allocation batch, audit reason, etc."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              />
            </Field>
          </FormGrid>

          {Number(seriesStart) > 0 && Number(seriesEnd) >= Number(seriesStart) && (
            <div className="gecko-seal-series-preview">
              <Icon name="info" size={13} />
              <span>
                <strong>{(Number(seriesEnd) - Number(seriesStart) + 1).toLocaleString()}</strong>{' '}
                seals in this series ({prefix || '—'} {Number(seriesStart).toLocaleString()} →{' '}
                {Number(seriesEnd).toLocaleString()})
              </span>
            </div>
          )}

          <div className="gecko-drawer-footer">
            {mode === 'edit' && onDelete && (
              <button
                type="button"
                className="gecko-btn gecko-btn-danger gecko-btn-sm"
                onClick={onDelete}
              >
                <Icon name="trash" size={14} /> Delete
              </button>
            )}
            <div className="gecko-seal-series-footer-spacer" />
            <button type="button" className="gecko-btn gecko-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="gecko-btn gecko-btn-primary">
              {mode === 'new' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
