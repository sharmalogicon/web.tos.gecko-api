"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { useCommercialVocabulary, type ChargeCode } from '@/lib/api/charge-codes';
import { isPathAvailable } from '@/lib/edition';

/**
 * LIVE against gecko_master (commercial.charge_code).
 *
 * What the API has and the mock did not: `moduleCode` validated against the
 * canonical module list — a charge on a non-operational module (REVENUE bills,
 * it does not lift boxes) is refused — and per-payer VARIANTS, where the tax
 * code and payment term live.
 *
 * What the mock had and the API does not, so it is gone rather than faked:
 * base rate, VAT %, GL account, "in use (30d)" and tariff counts. A price is
 * Revenue's (a charge code is the thing priced, not the price); GL mapping and
 * usage analytics are not modelled anywhere yet. Export is gone too: it was a
 * toast, not a file.
 */

/** The API's page-size ceiling (Gecko.Data PagingExtensions.MaxPageSize). */
const MAX_PAGE = 200;

const MODULE_COLOR: Record<string, string> = {
  TOS: 'var(--gecko-primary-600)',
  TRUCKING: 'var(--gecko-info-600)',
  CFS: 'var(--gecko-accent-600)',
  MNR: 'var(--gecko-warning-700)',
  FLEET: 'var(--gecko-success-700)',
  FREIGHT: 'var(--gecko-info-700)',
};

/** Module choices come from the vocabulary — the operational modules the API accepts — not a list typed here. */
const filterFields = (modules: { code: string; name: string }[]): FilterField[] => [
  { type: 'search', key: 'query', placeholder: 'Search code or description…' },
  {
    type: 'select', key: 'moduleCode', label: 'Module',
    options: [{ label: 'All', value: '' }, ...modules.map(m => ({ label: m.name, value: m.code }))],
  },
  {
    type: 'select', key: 'status', label: 'Status', options: [
      { label: 'Active', value: 'active' }, { label: 'All', value: 'all' },
    ],
  },
];

const SORT_OPTIONS: SortOption[] = [
  { label: 'Module, then code', value: 'module' },
  { label: 'Code A → Z', value: 'code' },
  { label: 'Charge type', value: 'type' },
];

export default function ChargeCodesPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', moduleCode: '', status: 'active' });
  const [sortBy, setSortBy] = useState('module');
  const { user } = useSession();
  const canManage = user?.permissions.includes('mdm.commercial.manage') ?? false;
  const { data: vocabulary } = useCommercialVocabulary();
  const fields = useMemo(() => filterFields(vocabulary?.modules ?? []), [vocabulary]);

  const path = useMemo(() => {
    const params = new URLSearchParams({ pageSize: String(MAX_PAGE) });
    if (filters.query) params.set('search', filters.query);
    if (filters.moduleCode) params.set('moduleCode', filters.moduleCode);
    if (filters.status === 'all') params.set('includeInactive', 'true');
    return `/api/master/charge-codes?${params.toString()}`;
  }, [filters.query, filters.moduleCode, filters.status]);

  const { data, error, loading, reload, totalCount } = useApiList<ChargeCode>(path);

  const rows = useMemo(() => {
    const all = [...(data ?? [])];
    if (sortBy === 'code') all.sort((a, b) => a.chargeCode.localeCompare(b.chargeCode));
    else if (sortBy === 'type') all.sort((a, b) => a.chargeType.localeCompare(b.chargeType) || a.chargeCode.localeCompare(b.chargeCode));
    else all.sort((a, b) => a.moduleCode.localeCompare(b.moduleCode) || a.chargeCode.localeCompare(b.chargeCode));
    return all;
  }, [data, sortBy]);

  const counts = useMemo(() => {
    const byModule = new Map<string, number>();
    for (const c of rows) byModule.set(c.moduleCode, (byModule.get(c.moduleCode) ?? 0) + 1);
    return {
      total: rows.length,
      modules: [...byModule.entries()].sort(([a], [b]) => a.localeCompare(b)),
      inactive: rows.filter(c => !c.isActive).length,
      byService: rows.filter(c => c.isByService).length,
    };
  }, [rows]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(rows);

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 60 }}>

      {/* Page Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Charge Codes</h1>
            <span className="gecko-count-badge">{loading && !data ? '…' : `${counts.total} codes`}</span>
            <span className="gecko-badge gecko-badge-info">{counts.modules.length} modules</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            The billable vocabulary. Every tariff row and every invoice line resolves to one of these — the price itself lives in Revenue.
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={16} /> Refresh
          </button>
          <FilterPopover
            fields={fields}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', moduleCode: '', status: 'active' })}
            sortOptions={SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          {canManage && isPathAvailable('/masters/charge-codes/new') && (
            <Link href="/masters/charge-codes/new" className="gecko-btn gecko-btn-primary gecko-btn-sm">
              <Icon name="plus" size={16} /> New Charge Code
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} />
          <span>{error.message}</span>
          {error.status === 401 && <Link href="/login" className="gecko-link">Sign in</Link>}
        </div>
      )}

      {totalCount > (data?.length ?? 0) && (
        <div role="status" className="gecko-alert gecko-alert-info gecko-row">
          <Icon name="alertCircle" size={16} />
          <span>Showing the first {data?.length} of {totalCount} charge codes — narrow the search or pick a module to see the rest.</span>
        </div>
      )}

      {/* Counts per module — the canonical module list, not invented categories */}
      <div className="gecko-kpi-strip gecko-kpi-strip-5">
        <div className="gecko-kpi-cell">
          <div className="gecko-stat-label">Total</div>
          <div className="gecko-stat-num">{counts.total}</div>
          <div className="gecko-card-subtitle">{counts.inactive > 0 ? `${counts.inactive} inactive` : 'all active'}</div>
        </div>
        {counts.modules.slice(0, 3).map(([module, n]) => (
          <div key={module} className="gecko-kpi-cell">
            <div className="gecko-stat-label">{module}</div>
            <div className="gecko-stat-num" style={{ color: MODULE_COLOR[module] ?? 'var(--gecko-text-primary)' }}>{n}</div>
            <div className="gecko-card-subtitle">charge codes</div>
          </div>
        ))}
        <div className="gecko-kpi-cell">
          <div className="gecko-stat-label">Service-based</div>
          <div className="gecko-stat-num" style={{ color: 'var(--gecko-info-700)' }}>{counts.byService}</div>
          <div className="gecko-card-subtitle">priced per service type</div>
        </div>
      </div>

      {/* Table */}
      <div className="gecko-table-card">
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={{ width: 150, whiteSpace: 'nowrap' }}>Code</th>
              <th>Description</th>
              <th style={{ width: 90 }}>Module</th>
              <th style={{ width: 130 }}>Charge type</th>
              <th style={{ width: 120 }}>Category</th>
              <th style={{ width: 140 }}>Billing unit</th>
              <th style={{ width: 90 }}>By service</th>
              <th style={{ width: 80 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--gecko-text-secondary)' }}>Loading charge codes…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 0 }}>
                <EmptyState
                  icon="invoice"
                  title={data && data.length === 0 ? 'No charge codes yet' : 'Nothing matches those filters'}
                  description="A charge code is what a tariff row prices and an invoice line names."
                />
              </td></tr>
            ) : pageItems.map(c => (
              <tr key={c.chargeCodeId} style={{ opacity: c.isActive ? 1 : 0.55 }}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {isPathAvailable(`/masters/charge-codes/${c.chargeCode}`) ? (
                    <Link href={`/masters/charge-codes/${encodeURIComponent(c.chargeCode)}`} className="gecko-id-link"
                      style={{ color: MODULE_COLOR[c.moduleCode] ?? undefined }}>
                      {c.chargeCode}
                    </Link>
                  ) : (
                    <span className="gecko-id-link" style={{ color: MODULE_COLOR[c.moduleCode] ?? undefined, cursor: 'default' }}>
                      {c.chargeCode}
                    </span>
                  )}
                </td>
                <td style={{ fontWeight: 500, color: 'var(--gecko-text-primary)' }}>
                  {c.descriptionEn}
                  {c.descriptionLocal && <div className="gecko-cell-meta">{c.descriptionLocal}</div>}
                </td>
                <td>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: MODULE_COLOR[c.moduleCode] ?? 'var(--gecko-text-secondary)',
                    background: 'var(--gecko-bg-subtle)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
                  }}>{c.moduleCode}</span>
                </td>
                <td className="gecko-page-subtitle">{c.chargeType}</td>
                <td className="gecko-page-subtitle">{c.chargeCategory ?? '—'}</td>
                <td className="gecko-page-subtitle">{c.billingUnitCode ?? '—'}</td>
                <td>{c.isByService ? <span className="gecko-badge gecko-badge-info">per service</span> : <span className="gecko-cell-meta">—</span>}</td>
                <td>
                  <span className={`gecko-status-dot gecko-status-dot-${c.isActive ? 'active' : 'neutral'}`}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          startRow={startRow}
          endRow={endRow}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          noun="charge codes"
        />
      </div>

    </div>
  );
}
