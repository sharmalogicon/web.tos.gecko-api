"use client";

/**
 * INVOICES — the June 2026 register, bound to GET /api/revenue/invoices
 * (live 2026-10-07). It was seven hardcoded rows and a count of "14,208"
 * until today, which is why the route was blocked.
 *
 * CREDIT ONLY, and that is the whole shape of the screen. A cash charge is
 * collected at the cash window and its RECEIPT is the tax invoice — it never
 * becomes one of these. So there is no "new invoice" button here: an invoice is
 * raised from the charges themselves, on the Booking Statement, by ticking
 * credit lines and pressing Send to.
 *
 * What June drew and the API cannot answer, so it is gone rather than faked:
 * a due date (the API carries issuedAt and the payment term, not a due date),
 * Draft / Overdue statuses (an invoice is issued at once and final), and the
 * batch print. See docs/STATEMENT_CHARGE_EDIT_FOR_API.md §7.
 */

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterPopover, type FilterField } from '@/components/ui/FilterPopover';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { useApi } from '@/lib/api/use-api';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { saveBlob } from '@/lib/api/client';
import { toCsv } from '@/lib/api/reports';
import { amount } from '@/lib/api/charges';
import {
  INVOICE_PERMISSIONS, INVOICE_STATUS, invoicesPath,
  type InvoiceSummary,
} from '@/lib/api/invoices';

interface Page { items: InvoiceSummary[]; page: number; pageSize: number; totalCount: number; totalPages: number }

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="gecko-cell-meta" style={{ padding: 24 }}>Loading…</div>}>
      <Invoices />
    </Suspense>
  );
}

function Invoices() {
  const { branch } = useFacility();
  const { user } = useSession();
  const mayView = (user?.permissions ?? []).includes(INVOICE_PERMISSIONS.view);

  const [filters, setFilters] = useState<Record<string, string>>({ query: '', payerCode: '', orderNo: '', status: '' });
  const [sortBy, setSortBy] = useState('issued_desc');

  const path = useMemo(
    () => invoicesPath({ search: filters.query, payerCode: filters.payerCode, orderNo: filters.orderNo },
      branch?.branchId ?? '', 1, 200),
    [filters.query, filters.payerCode, filters.orderNo, branch?.branchId]);

  const { data, error, loading, reload } = useApi<Page>(mayView ? path : null);
  const invoices = useMemo(() => data?.items ?? [], [data]);

  const rows = useMemo(() => {
    const out = invoices.filter(i => !filters.status || i.status === filters.status);
    const by: Record<string, (a: InvoiceSummary, b: InvoiceSummary) => number> = {
      issued_desc: (a, b) => b.issuedAt.localeCompare(a.issuedAt),
      issued_asc: (a, b) => a.issuedAt.localeCompare(b.issuedAt),
      total_desc: (a, b) => b.total - a.total,
      payer: (a, b) => (a.payerName ?? '').localeCompare(b.payerName ?? ''),
    };
    return [...out].sort(by[sortBy] ?? by.issued_desc);
  }, [invoices, filters.status, sortBy]);

  const page = usePagination(rows, 25);
  const shownTotal = rows.reduce((n, i) => n + i.total, 0);
  const currency = invoices[0]?.currencyCode ?? 'THB';

  const fields: FilterField[] = [
    { type: 'search', key: 'query', placeholder: 'Invoice no or payer…' },
    {
      type: 'select', key: 'status', label: 'Status',
      options: [{ label: 'All', value: '' },
        ...[...new Set(invoices.map(i => i.status))].sort()
          .map(s => ({ label: INVOICE_STATUS[s]?.label ?? s, value: s }))],
    },
    {
      type: 'select', key: 'payerCode', label: 'Payer',
      options: [{ label: 'All payers', value: '' },
        ...[...new Map(invoices.filter(i => i.payerCode).map(i => [i.payerCode!, i.payerName ?? i.payerCode!])).entries()]
          .sort((a, b) => a[1].localeCompare(b[1]))
          .map(([code, name]) => ({ label: name, value: code }))],
    },
  ];

  const exportCsv = () => saveBlob(toCsv(
    ['Invoice', 'Issued', 'Payer code', 'Payer', 'Bill to', 'Term', 'Lines', 'Amount', 'VAT', 'Total', 'Status', 'Remarks'],
    rows.map(i => [i.invoiceNo, i.issuedAt, i.payerCode ?? '', i.payerName ?? '', i.billTo, i.paymentTermCode,
      i.lines, i.amount, i.tax, i.total, i.status, i.remarks ?? '']),
  ), 'invoices.csv');

  if (!mayView) {
    return (
      <div className="gecko-card">
        <EmptyState icon="lock" title="Not your screen"
          description="Reading invoices needs revenue.charge.view. Ask a supervisor." />
      </div>
    );
  }

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 40 }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Invoices</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
            <span className="gecko-count-badge">
              {loading && !data ? '…' : `${data?.totalCount ?? 0} issued`}
            </span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            Credit invoices raised from charges. Cash is collected at the window — its receipt is the tax invoice.
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Icon name="download" size={14} /> Export
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={14} /> Refresh
          </button>
          <FilterPopover
            fields={fields} values={filters} tone="orange"
            onChange={setFilters} onApply={setFilters}
            onClear={() => setFilters({ query: '', payerCode: '', orderNo: '', status: '' })}
            sortOptions={[
              { label: 'Newest first', value: 'issued_desc' },
              { label: 'Oldest first', value: 'issued_asc' },
              { label: 'Largest first', value: 'total_desc' },
              { label: 'Payer A → Z', value: 'payer' },
            ]}
            sortValue={sortBy} onSortChange={setSortBy}
          />
          <Link href="/billing/statement" className="gecko-btn gecko-btn-primary gecko-btn-sm">
            <Icon name="plus" size={15} /> Raise one from a statement
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <strong>{error.title}</strong>
            {error.explanation && <div>{error.explanation}</div>}
          </div>
        </div>
      )}

      <div className="gecko-table-card gecko-table-card-menus">
        <div className="gecko-table-toolbar">
          <Icon name="invoice" size={13} />
          <span>Showing <strong>{rows.length}</strong>{data && data.totalCount > invoices.length ? ` of ${data.totalCount}` : ''}</span>
          <span className="gecko-table-toolbar-spacer" />
          <span>Shown total <strong className="gecko-mono">{amount(shownTotal, currency)}</strong></span>
        </div>

        <div className="gecko-table-clip">
        <table className="gecko-table gecko-table-compact gecko-table-fixed">
          <thead>
            <tr>
              <th style={{ width: '18%' }}>Invoice no</th>
              <th style={{ width: '13%' }}>Issued</th>
              <th>Payer</th>
              <th style={{ width: '9%' }}>Term</th>
              <th className="gecko-num" style={{ width: '7%' }}>Lines</th>
              <th className="gecko-num" style={{ width: '12%' }}>Amount</th>
              <th className="gecko-num" style={{ width: '10%' }}>VAT</th>
              <th className="gecko-num" style={{ width: '12%' }}>Total</th>
              <th style={{ width: '9%' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <TableSkeleton columns={9} />}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 0 }}>
                  <EmptyState icon="invoice" title="No invoice has been raised yet"
                    description="An invoice is made from a booking's credit charges: open a statement, tick the credit lines and press Send to." />
                </td>
              </tr>
            )}
            {page.pageItems.map(i => {
              const st = INVOICE_STATUS[i.status];
              return (
                <tr key={i.invoiceId}>
                  <td>
                    <Link href={`/billing/invoices/${encodeURIComponent(i.invoiceId)}`} className="gecko-mono-strong gecko-link gecko-cell-tight">
                      {i.invoiceNo}
                    </Link>
                    {i.remarks && <div className="gecko-cell-meta gecko-cell-tight" title={i.remarks}>{i.remarks}</div>}
                  </td>
                  <td className="gecko-cell-tight">{i.issuedAt.slice(0, 10)}</td>
                  <td>
                    <span className="gecko-cell-tight">{i.payerName ?? '—'}</span>
                    <span className="gecko-cell-meta gecko-mono">{i.payerCode ?? ''} · {i.billTo.toLowerCase()}</span>
                  </td>
                  <td><span className="gecko-badge gecko-badge-xs gecko-badge-gray">{i.paymentTermCode}</span></td>
                  <td className="gecko-num gecko-mono">{i.lines}</td>
                  <td className="gecko-num gecko-mono">{amount(i.amount, i.currencyCode)}</td>
                  <td className="gecko-num gecko-mono">{amount(i.tax, i.currencyCode)}</td>
                  <td className="gecko-num gecko-mono" style={{ fontWeight: 700 }}>{amount(i.total, i.currencyCode)}</td>
                  <td>
                    <span className={`gecko-badge gecko-badge-xs ${st?.badge ?? 'gecko-badge-gray'}`}>{st?.label ?? i.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        </div>

        {rows.length > 0 && (
          <TablePagination
            page={page.page} pageSize={page.pageSize} totalItems={page.totalItems} totalPages={page.totalPages}
            startRow={page.startRow} endRow={page.endRow}
            onPageChange={page.setPage} onPageSizeChange={page.setPageSize} noun="invoices" loading={loading}
          />
        )}
      </div>
    </div>
  );
}
