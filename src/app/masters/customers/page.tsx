"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { TablePagination } from '@/components/ui/TablePagination';
import { useApi, type Paged } from '@/lib/api/use-api';
import { PARTY_ROLES, partiesQueryPath, type PartyRole, type PartySummary } from '@/lib/api/parties';
import { RoleBadge } from './_components/RoleBadge';
import { useSession } from '@/lib/auth/session';

/** Waits until typing pauses, so each keystroke is not a query over 9,500 customers. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function CustomersListPage() {
  const router = useRouter();
  const { can } = useSession();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<PartyRole | ''>('CUSTOMER');
  // The API lists inactive parties by default; a counter clerk should not pick one by accident.
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(0);           // 0-based, as TablePagination counts
  const [pageSize, setPageSize] = useState(20);
  const debouncedSearch = useDebounced(search);

  // A new search starts again at page 1: remember which search the page belongs to.
  const [pageSearch, setPageSearch] = useState(debouncedSearch);
  if (pageSearch !== debouncedSearch) {
    setPageSearch(debouncedSearch);
    setPage(0);
  }

  const { data, error, loading } = useApi<Paged<PartySummary>>(
    partiesQueryPath({ search: debouncedSearch, role, page: page + 1, pageSize, includeInactive }));

  const rows = data?.items ?? [];
  const total = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRow = total === 0 ? 0 : page * pageSize + 1;
  const endRow = Math.min(total, (page + 1) * pageSize);
  const open = (p: PartySummary) => router.push(`/masters/customers/${encodeURIComponent(p.partyCode)}`);

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Customers</h1>
            <span className="gecko-count-badge">{loading && !data ? '…' : `${total.toLocaleString()} found`}</span>
          </div>
          <div className="gecko-page-subtitle">Party master — customers, shipping lines, forwarders, hauliers. One record, many roles.</div>
        </div>
        <div className="gecko-toolbar">
          {can('mdm.party.create') && (
            <Link href="/masters/customers/new" className="gecko-btn gecko-btn-primary gecko-btn-sm">
              <Icon name="plus" size={16} /> New customer
            </Link>
          )}
        </div>
      </div>

      <div className="gecko-row gecko-row-wrap" style={{ gap: 12 }}>
        <div className="gecko-row" style={{ gap: 8, flex: '1 1 320px', maxWidth: 520 }}>
          <Icon name="search" size={16} style={{ color: 'var(--gecko-text-secondary)' }} />
          <input
            className="gecko-input"
            type="search"
            placeholder="Search code, name (English or ไทย), tax ID or alias…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search customers"
          />
        </div>
        <select className="gecko-input" style={{ width: 200 }} value={role} aria-label="Role"
          onChange={e => { setRole(e.target.value as PartyRole | ''); setPage(0); }}>
          <option value="">All roles</option>
          {PARTY_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
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
        <table className="gecko-table gecko-table-comfortable">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Roles</th>
              <th>Tax ID</th>
              <th>Branch</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon="search"
                    title="No customers match"
                    description="Try another spelling, the Thai name, the tax ID — or register a new customer."
                  />
                </td>
              </tr>
            )}
            {rows.map(p => (
              <tr key={p.partyId} onClick={() => open(p)} style={{ cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                <td>
                  <Link href={`/masters/customers/${encodeURIComponent(p.partyCode)}`} className="gecko-id-link"
                    onClick={e => e.stopPropagation()}>{p.partyCode}</Link>
                </td>
                <td>
                  <div className="gecko-cell-two-line">
                    <div className="gecko-cell-primary">{p.nameEn}</div>
                    {p.nameLocal && <div className="gecko-cell-sub" lang="th">{p.nameLocal}</div>}
                  </div>
                </td>
                <td>
                  <div className="gecko-row gecko-row-wrap" style={{ gap: 4 }}>
                    {p.roles.map(r => <RoleBadge key={r} role={r} />)}
                  </div>
                </td>
                <td className="gecko-text-mono" style={{ color: 'var(--gecko-text-secondary)' }}>{p.taxId ?? '—'}</td>
                <td className="gecko-text-mono" style={{ color: 'var(--gecko-text-secondary)' }}>{p.branchNo ?? '—'}</td>
                <td>
                  <span className={`gecko-status-dot gecko-status-dot-${p.isActive ? 'active' : 'warning'}`}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={page} pageSize={pageSize} totalItems={total}
          totalPages={totalPages} startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(0); }}
          pageSizeOptions={[20, 50, 100]}
          noun="customers"
        />
      </div>
    </div>
  );
}
