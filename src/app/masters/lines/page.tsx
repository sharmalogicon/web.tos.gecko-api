"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExportButton } from '@/components/ui/ExportButton';
import { TablePagination } from '@/components/ui/TablePagination';
import { useApi, type Paged } from '@/lib/api/use-api';
import { EDI_MESSAGES, shippingLinesQueryPath, type LineRole, type ShippingLine } from '@/lib/api/shipping-lines';
import { useSession } from '@/lib/auth/session';
import { LineModal } from './_components/LineModal';

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** undefined = closed, null = new, a line = edit that line. */
type Editing = ShippingLine | null | undefined;

export default function ShippingLinesPage() {
  const { can } = useSession();
  const canManage = can('mdm.party.manage');
  const [search, setSearch] = useState('');
  const [lineRole, setLineRole] = useState<LineRole | ''>('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(0);           // 0-based, as TablePagination counts
  const [pageSize, setPageSize] = useState(50);
  const [editing, setEditing] = useState<Editing>(undefined);
  const debouncedSearch = useDebounced(search);

  const [pageSearch, setPageSearch] = useState(debouncedSearch);
  if (pageSearch !== debouncedSearch) {
    setPageSearch(debouncedSearch);
    setPage(0);
  }

  const { data, error, loading, reload } = useApi<Paged<ShippingLine>>(
    shippingLinesQueryPath({ search: debouncedSearch, lineRole, page: page + 1, pageSize, includeInactive }));

  const rows = data?.items ?? [];
  const total = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRow = total === 0 ? 0 : page * pageSize + 1;
  const endRow = Math.min(total, (page + 1) * pageSize);
  const ediLinked = rows.filter(l => EDI_MESSAGES.some(m => l[m.key])).length;

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Shipping Lines</h1>
            <span className="gecko-count-badge">{loading && !data ? '…' : `${total.toLocaleString()} found`}</span>
            {ediLinked > 0 && <span className="gecko-badge gecko-badge-info">{ediLinked} EDI-linked</span>}
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">Line operators and the agents that act for them. Each is a party with the shipping-line role.</div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton resource="Shipping lines" iconSize={16} />
          {canManage && (
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setEditing(null)}>
              <Icon name="plus" size={16} /> New Line
            </button>
          )}
        </div>
      </div>

      <div className="gecko-row gecko-row-wrap" style={{ gap: 12 }}>
        <div className="gecko-row" style={{ gap: 8, flex: '1 1 320px', maxWidth: 520 }}>
          <Icon name="search" size={16} style={{ color: 'var(--gecko-text-secondary)' }} />
          <input className="gecko-input" type="search" placeholder="Search code, name, SCAC or SMDG…"
            value={search} onChange={e => setSearch(e.target.value)} aria-label="Search shipping lines" />
        </div>
        <select className="gecko-input" style={{ width: 180 }} value={lineRole} aria-label="Line or agent"
          onChange={e => { setLineRole(e.target.value as LineRole | ''); setPage(0); }}>
          <option value="">Lines and agents</option>
          <option value="LINE">Lines only</option>
          <option value="AGENT">Agents only</option>
        </select>
        <label className="gecko-row gecko-cell-meta">
          <input type="checkbox" className="gecko-checkbox" checked={includeInactive}
            onChange={e => { setIncludeInactive(e.target.checked); setPage(0); }} />
          Show inactive
        </label>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>{error.message}</span>
        </div>
      )}

      <div className="gecko-table-card">
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 140 }}>Code</th>
              <th>SCAC</th>
              <th>Line Operator</th>
              <th>Role</th>
              <th>Alliance</th>
              <th>EDI Messages</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState icon="search" title="No shipping lines match"
                    description="Try another code or name, or show inactive lines." />
                </td>
              </tr>
            )}
            {rows.map(line => {
              const messages = EDI_MESSAGES.filter(m => line[m.key]);
              return (
                <tr key={line.partyCode} onClick={() => setEditing(line)} style={{ cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                  <td>
                    <div className="gecko-row">
                      <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: line.brandColorHex ?? 'transparent', border: line.brandColorHex ? 'none' : '1px dashed var(--gecko-border)' }} />
                      <span className="gecko-id-link" style={{ color: 'var(--gecko-primary-700)' }}>{line.partyCode}</span>
                    </div>
                  </td>
                  <td className="gecko-text-mono gecko-page-subtitle">{line.scacCode ?? '—'}</td>
                  <td>
                    <div className="gecko-cell-two-line">
                      <div className="gecko-cell-primary" style={{ fontSize: 13 }}>{line.nameEn}</div>
                      {line.nameLocal && <div className="gecko-cell-sub" lang="th">{line.nameLocal}</div>}
                    </div>
                  </td>
                  <td>
                    {line.lineRole === 'LINE'
                      ? <span className="gecko-badge gecko-badge-xs gecko-badge-info">Line</span>
                      : <span className="gecko-row" style={{ gap: 6 }}>
                          <span className="gecko-badge gecko-badge-xs gecko-badge-gray">Agent</span>
                          <span className="gecko-cell-meta">for {line.principalLineCode}</span>
                        </span>}
                  </td>
                  <td style={{ color: 'var(--gecko-text-secondary)' }}>{line.allianceName ?? line.allianceCode ?? '—'}</td>
                  <td>
                    <div className="gecko-row gecko-row-wrap" style={{ gap: 4 }}>
                      {messages.length === 0
                        ? <span className="gecko-badge gecko-badge-xs gecko-badge-gray" style={{ textTransform: 'lowercase' }}>manual</span>
                        : messages.map(m => <span key={m.key} className="gecko-badge gecko-badge-xs gecko-badge-info">{m.label}</span>)}
                    </div>
                  </td>
                  <td>
                    <span className={`gecko-status-dot gecko-status-dot-${line.isActive ? 'active' : 'warning'}`}>
                      {line.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/masters/customers/${encodeURIComponent(line.partyCode)}`} className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                      onClick={e => e.stopPropagation()} title="Name, address, status and delete">
                      Party record
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <TablePagination
          page={page} pageSize={pageSize} totalItems={total}
          totalPages={totalPages} startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(0); }}
          pageSizeOptions={[20, 50, 100]}
          noun="lines"
        />
      </div>

      {editing !== undefined && (
        <LineModal
          line={editing}
          readOnly={!canManage}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); reload(); }}
        />
      )}
    </div>
  );
}
