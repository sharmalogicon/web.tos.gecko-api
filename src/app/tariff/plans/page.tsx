"use client";
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApiList } from '@/lib/api/use-api';
import {
  formatDate, partySummary, STATUS_TONE, TYPE_TONE,
  type Schedule, type ScheduleLifecycle,
} from '@/lib/api/revenue';

/**
 * LIVE against gecko_revenue (Gecko.Revenue).
 *
 * TWO state columns, not one. `status` is where a version sits in the
 * maker-checker workflow (DRAFT → PENDING → APPROVED); `lifecycle` is where it
 * sits in time (SCHEDULED / ACTIVE / EXPIRED / SUPERSEDED) and is derived from
 * the dates and the next version, never stored. The old single "Active /
 * Draft / Expired" column could not show an approved tariff that starts in
 * November, which is exactly what a pricing clerk needs to see.
 */

const FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search schedule no or name…' },
  {
    type: 'select', key: 'scheduleType', label: 'Type', options: [
      { label: 'All', value: '' },
      { label: 'Public', value: 'PUBLIC' },
      { label: 'Contract', value: 'CONTRACT' },
      { label: 'Spot', value: 'SPOT' },
    ],
  },
  {
    type: 'select', key: 'status', label: 'Approval status', options: [
      { label: 'All', value: '' },
      { label: 'Draft', value: 'DRAFT' },
      { label: 'Pending approval', value: 'PENDING' },
      { label: 'Approved', value: 'APPROVED' },
      { label: 'Rejected', value: 'REJECTED' },
      { label: 'Withdrawn', value: 'WITHDRAWN' },
    ],
  },
  {
    type: 'select', key: 'lifecycle', label: 'In force', options: [
      { label: 'All', value: '' },
      { label: 'Active today', value: 'ACTIVE' },
      { label: 'Starts later', value: 'SCHEDULED' },
      { label: 'Expired', value: 'EXPIRED' },
      { label: 'Superseded', value: 'SUPERSEDED' },
    ],
  },
];

const SORT_OPTIONS: SortOption[] = [
  { label: 'Precedence (most specific first)', value: 'scope' },
  { label: 'Effective date (newest)', value: 'effective_desc' },
  { label: 'Schedule no A → Z', value: 'no' },
];

export default function TariffPlansPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', scheduleType: '', status: '', lifecycle: '' });
  const [sortBy, setSortBy] = useState('scope');

  // Type, status and search are filtered by the API; lifecycle is derived per
  // row (from dates and the next version), so it is filtered here.
  const query = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '200', moduleCode: 'TOS' });
    if (filters.query) params.set('search', filters.query);
    if (filters.scheduleType) params.set('scheduleType', filters.scheduleType);
    if (filters.status) params.set('status', filters.status);
    return `/api/revenue/tariffs?${params.toString()}`;
  }, [filters.query, filters.scheduleType, filters.status]);

  const { data, error, loading, reload } = useApiList<Schedule>(query);

  const rows = useMemo(() => {
    const all = (data ?? []).filter(s => !filters.lifecycle || s.lifecycle === (filters.lifecycle as ScheduleLifecycle));
    const sorted = [...all];
    if (sortBy === 'effective_desc') sorted.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    else if (sortBy === 'no') sorted.sort((a, b) => a.scheduleNo.localeCompare(b.scheduleNo) || a.versionNo - b.versionNo);
    else sorted.sort((a, b) => a.scopeRank - b.scopeRank || a.scheduleNo.localeCompare(b.scheduleNo) || a.versionNo - b.versionNo);
    return sorted;
  }, [data, filters.lifecycle, sortBy]);

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline" style={{ gap: 12 }}>
            <h1 className="gecko-page-title">Tariff Schedules</h1>
            <span className="gecko-count-badge">{loading && !data ? '…' : `${rows.length} version${rows.length === 1 ? '' : 's'}`}</span>
          </div>
          <p className="gecko-page-subtitle" style={{ marginTop: 4 }}>
            One row per version of a price agreement. The resolver picks the most specific one in force on the day of the move.
          </p>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={16} /> Refresh
          </button>
          <FilterPopover
            fields={FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', scheduleType: '', status: '', lifecycle: '' })}
            sortOptions={SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <Link href="/tariff/plans/new" className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={16} /> New Tariff Schedule</Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} />
          <span>{error.message}</span>
          {error.status === 401 && <Link href="/login" className="gecko-link">Sign in</Link>}
        </div>
      )}

      {/* Table */}
      <div className="gecko-table-card">
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Schedule</th>
              <th>Name</th>
              <th>Type</th>
              <th>Applies to</th>
              <th>Precedence</th>
              <th>Effective</th>
              <th>Until</th>
              <th style={{ textAlign: 'right' }}>Rates</th>
              <th>Approval</th>
              <th>In force</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--gecko-text-secondary)' }}>Loading tariffs…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 0 }}>
                <EmptyState
                  icon="dollarSign"
                  title={data && data.length > 0 ? 'Nothing matches those filters' : 'No tariff schedules yet'}
                  description={data && data.length > 0
                    ? 'Clear a filter, or look for a superseded version.'
                    : 'A tariff is the input to every charge the gate raises. Start with the public list.'}
                />
              </td></tr>
            ) : rows.map((s) => {
              const tone = TYPE_TONE[s.scheduleType];
              return (
                <tr key={s.scheduleId} className="gecko-row-clickable">
                  <td>
                    <Link href={`/tariff/plans/${s.scheduleId}`} className="gecko-id-link">{s.scheduleNo}</Link>
                    <span className="gecko-cell-meta" style={{ marginLeft: 6 }}>v{s.versionNo}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
                    <Link href={`/tariff/plans/${s.scheduleId}`} style={{ color: 'inherit', textDecoration: 'none' }}>{s.name}</Link>
                  </td>
                  <td>
                    <span className={`gecko-pill gecko-pill-${tone.tone}`}>
                      <Icon name={tone.icon} size={11} style={{ marginBottom: -1, marginRight: 4 }} /> {tone.label}
                    </span>
                  </td>
                  <td style={{ color: 'var(--gecko-text-secondary)' }}>{partySummary(s)}</td>
                  <td className="gecko-cell-meta">rank {s.scopeRank}</td>
                  <td className="gecko-text-mono">{formatDate(s.effectiveFrom)}</td>
                  <td className="gecko-text-mono" style={{ color: s.lifecycle === 'EXPIRED' ? 'var(--gecko-error-600)' : undefined }}>
                    {s.effectiveUntil ? formatDate(s.effectiveUntil) : 'open-ended'}
                  </td>
                  <td style={{ textAlign: 'right' }} className="gecko-text-mono">{s.rateCount}</td>
                  <td><span className={`gecko-pill gecko-pill-${STATUS_TONE[s.status] ?? 'neutral'}`}>{s.status}</span></td>
                  <td><span className={`gecko-pill gecko-pill-${STATUS_TONE[s.lifecycle] ?? 'neutral'}`}>{s.lifecycle}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
