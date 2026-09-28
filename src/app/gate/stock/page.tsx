"use client";
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { dwellLabel, formatContainerNo, formatDateTime, type YardContainer } from '@/lib/api/tos';

/**
 * WHAT IS IN THE YARD — live against gecko_tos `yard.vw_container_in_yard`.
 *
 * There is ONE answer here, and it is assembled rather than stored (D-5): the
 * gate-in time comes from the EIR, the hold flag from the hold rows, the dwell
 * is arithmetic. Vector kept all three in columns as well as in their sources,
 * and its four answers disagree by three boxes — which is three boxes nobody
 * can invoice or load.
 */
export default function YardStockPage() {
  const { user } = useSession();
  const branchId = user?.branches?.[0] ?? null;

  const [load, setLoad] = useState<'' | 'FULL' | 'EMPTY'>('');
  const [heldOnly, setHeldOnly] = useState(false);
  const [minDays, setMinDays] = useState('');
  const [search, setSearch] = useState('');

  const query = useMemo(() => {
    const parts = ['pageSize=200'];
    if (branchId) parts.push(`branchId=${branchId}`);
    if (load) parts.push(`fullEmpty=${load}`);
    if (heldOnly) parts.push('heldOnly=true');
    if (minDays) parts.push(`minDays=${minDays}`);
    if (search.trim()) parts.push(`search=${encodeURIComponent(search.trim())}`);
    return `/api/tos/yard/containers?${parts.join('&')}`;
  }, [branchId, load, heldOnly, minDays, search]);

  const { data, loading, error, totalCount, reload } = useApiList<YardContainer>(query);
  const rows = data ?? [];
  const { page, setPage, pageSize, setPageSize, pageItems, totalPages, totalItems, startRow, endRow } = usePagination(rows, 25);

  const summary = useMemo(() => ({
    full: rows.filter(r => r.fullEmpty === 'FULL').length,
    empty: rows.filter(r => r.fullEmpty === 'EMPTY').length,
    held: rows.filter(r => r.isHeld).length,
    ageing: rows.filter(r => r.daysInYard >= 7).length,
  }), [rows]);

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 60 }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Yard stock</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
            <span className="gecko-count-badge">{loading && !data ? '…' : `${totalCount} boxes`}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            One row per stay. Gate-in comes from the EIR, the hold flag from the hold rows, the dwell is
            arithmetic — nothing here is stored twice.
          </div>
        </div>
        <div className="gecko-toolbar">
          <Link href="/gate/desk" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            <Icon name="scan" size={16} /> Gate desk
          </Link>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="gecko-row gecko-stack-md" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Stat label="Laden" value={summary.full} />
        <Stat label="Empty" value={summary.empty} />
        <Stat label="Held" value={summary.held} tone={summary.held ? 'error' : undefined} />
        <Stat label="7 days or more" value={summary.ageing} tone={summary.ageing ? 'warning' : undefined} />
      </div>

      <div className="gecko-card" style={{ padding: 14 }}>
        <div className="gecko-row gecko-stack-md" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="gecko-form-group" style={{ flex: '1 1 220px' }}>
            <label className="gecko-form-label">Container or position</label>
            <input className="gecko-input" value={search} placeholder="ABCU1234567 or A-03"
                   onChange={e => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">Load</label>
            <select className="gecko-input" value={load} onChange={e => { setLoad(e.target.value as '' | 'FULL' | 'EMPTY'); setPage(0); }}>
              <option value="">All</option>
              <option value="FULL">Laden</option>
              <option value="EMPTY">Empty</option>
            </select>
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">Standing at least</label>
            <select className="gecko-input" value={minDays} onChange={e => { setMinDays(e.target.value); setPage(0); }}>
              <option value="">Any time</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
            </select>
          </div>
          <label className="gecko-row gecko-row-start" style={{ gap: 8, paddingBottom: 8 }}>
            <input type="checkbox" checked={heldOnly} onChange={e => { setHeldOnly(e.target.checked); setPage(0); }} />
            <span className="gecko-cell-meta">Held only</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>{error.message}</div>
        </div>
      )}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon="layers"
          title="Nothing standing"
          description="No box matches these filters. A box appears here the moment its gate-in is recorded, and leaves it the moment its gate-out is."
        />
      ) : (
        <div className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="gecko-table">
            <thead>
              <tr>
                <th>Container</th>
                <th>Type</th>
                <th>Line</th>
                <th>Load</th>
                <th>Grade</th>
                <th>Position</th>
                <th>Gated in</th>
                <th>Standing</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(row => (
                <tr key={row.containerVisitId}>
                  <td style={{ fontFamily: 'var(--gecko-font-mono, monospace)' }}>{formatContainerNo(row.containerNo)}</td>
                  <td>{row.equipmentTypeCode ?? '—'}</td>
                  <td>{row.lineCode}</td>
                  <td>
                    <span className={`gecko-badge gecko-badge-xs gecko-badge-${row.fullEmpty === 'FULL' ? 'info' : 'gray'}`}>
                      {row.fullEmpty === 'FULL' ? 'Laden' : 'Empty'}
                    </span>
                  </td>
                  <td>{row.gradeCode ?? '—'}</td>
                  <td>{row.positionText ?? <span className="gecko-cell-meta">no slot</span>}</td>
                  <td>
                    <div>{formatDateTime(row.gateInAt)}</div>
                    <div className="gecko-cell-meta">{row.gateInEirNo}</div>
                  </td>
                  <td>
                    <span className={row.daysInYard >= 7 ? 'gecko-badge gecko-badge-xs gecko-badge-warning' : undefined}>
                      {dwellLabel(row.daysInYard)}
                    </span>
                  </td>
                  <td>
                    {row.isHeld
                      ? <span className="gecko-badge gecko-badge-xs gecko-badge-error">held</span>
                      : <span className="gecko-cell-meta">free to move</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination
            page={page} pageSize={pageSize} totalPages={totalPages} totalItems={totalItems}
            startRow={startRow} endRow={endRow} noun="boxes"
            onPageChange={setPage} onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="gecko-card" style={{ padding: '12px 18px', minWidth: 140, background: tone ? `var(--gecko-${tone}-50)` : undefined }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      <div className="gecko-cell-meta">{label}</div>
    </div>
  );
}
