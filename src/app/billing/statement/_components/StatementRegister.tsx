"use client";
import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterPopover, type FilterField } from '@/components/ui/FilterPopover';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { useApi } from '@/lib/api/use-api';
import { useFacility } from '@/lib/api/facility';
import {
  blankUnbilledQuery, money, UNBILLED_ORDERS_PATH, unbilledParams,
  type UnbilledOrder, type UnbilledOrdersPage,
} from '@/lib/api/unbilled-orders';

/**
 * VIEW A — the register of statements, as the June screen opened on it.
 *
 * Bound to GET /api/revenue/charges/unbilled/orders, which IS Vector's
 * UnBilledOrders: one row per booking, with the agent, the customer, the
 * vessel, the boxes, the lines and what they come to, and the desktop's own
 * filters behind it.
 *
 * It asks for `includeSettled=true` (API 2026-10-07), so every booking is
 * listed — not only the ones with money outstanding — and each row carries the
 * June screen's "Total billable / Billed / Unbilled" triple. Those three
 * columns are the point of the register: a booking that is fully billed should
 * be visibly fully billed, not absent.
 */
export function StatementRegister({ onOpen }: { onOpen: (orderNo: string) => void }) {
  const { branch } = useFacility();
  const branchId = branch?.branchId ?? '';
  const [filters, setFilters] = useState<Record<string, string>>({
    query: '', bookingTypeCode: '', orderTypeCode: '', paymentTermCode: '', progress: '',
  });
  const [sortBy, setSortBy] = useState('unbilled_desc');

  const path = useMemo(() => {
    const q = { ...blankUnbilledQuery() };
    if (filters.bookingTypeCode) q.bookingTypeCode = filters.bookingTypeCode;
    if (filters.orderTypeCode) q.orderTypeCode = filters.orderTypeCode;
    if (filters.paymentTermCode) q.paymentTermCode = filters.paymentTermCode;
    if (filters.progress) q.progress = filters.progress as typeof q.progress;
    // unbilledParams answers a plain record (the API wants PascalCase keys),
    // so the page size is added before it becomes a query string.
    // includeSettled (API 2026-10-07): without it a booking billed or paid in
    // full has nothing unbilled and so never appears, and the clerk can only
    // reach it by typing the order number. With it every booking is listed and
    // each row carries totalBillable / billedAmount / unbilledAmount.
    const p = new URLSearchParams({
      ...unbilledParams(q, branchId), pageSize: '200', includeSettled: 'true',
    });
    return `${UNBILLED_ORDERS_PATH}?${p.toString()}`;
  }, [filters, branchId]);

  const { data, error, loading, reload } = useApi<UnbilledOrdersPage>(path);
  const orders = data?.items ?? [];

  const rows = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const out = orders.filter(o => !q
      || o.orderNo.toLowerCase().includes(q)
      || (o.carrierRef ?? '').toLowerCase().includes(q)
      || (o.subBlNo ?? '').toLowerCase().includes(q)
      || (o.customerName ?? '').toLowerCase().includes(q)
      || (o.agentName ?? '').toLowerCase().includes(q));
    const by: Record<string, (a: UnbilledOrder, b: UnbilledOrder) => number> = {
      unbilled_desc: (a, b) => b.total - a.total,
      orderNo: (a, b) => a.orderNo.localeCompare(b.orderNo),
      customer: (a, b) => (a.customerName ?? '').localeCompare(b.customerName ?? ''),
      newest: (a, b) => (b.bookedAt ?? '').localeCompare(a.bookedAt ?? ''),
    };
    return [...out].sort(by[sortBy] ?? by.unbilled_desc);
  }, [orders, filters.query, sortBy]);

  const page = usePagination(rows);

  const distinct = (pick: (o: UnbilledOrder) => string | null) =>
    [...new Set(orders.map(pick).filter((v): v is string => Boolean(v)))].sort();

  const fields: FilterField[] = [
    { type: 'search', key: 'query', placeholder: 'Order, B/L, customer or agent…' },
    {
      type: 'select', key: 'bookingTypeCode', label: 'Booking type',
      options: [{ label: 'All', value: '' }, ...distinct(o => o.bookingTypeCode).map(v => ({ label: v, value: v }))],
    },
    {
      type: 'select', key: 'orderTypeCode', label: 'Order type',
      options: [{ label: 'All', value: '' }, ...distinct(o => o.orderTypeCode).map(v => ({ label: v, value: v }))],
    },
    {
      type: 'select', key: 'paymentTermCode', label: 'Payment term',
      options: [{ label: 'All', value: '' }, { label: 'Cash', value: 'CASH' }, { label: 'Credit', value: 'CREDIT' }],
    },
    {
      type: 'select', key: 'progress', label: 'Progress',
      options: [
        { label: 'All', value: '' },
        { label: 'Completed', value: 'COMPLETED' },
        { label: '50% completed', value: 'HALF_COMPLETED' },
        { label: 'Delivered', value: 'DELIVERED' },
      ],
    },
  ];

  return (
    <div className="gecko-stack gecko-stack-md">
      <div className="gecko-table-card">
        <div className="gecko-table-toolbar">
          <Icon name="fileText" size={13} />
          <span>
            <strong>{rows.length}</strong> booking{rows.length === 1 ? '' : 's'}
          </span>
          <span className="gecko-table-toolbar-spacer" />
          {data && <span>Unbilled <strong className="gecko-mono">{money(data.total, 'THB')}</strong> over {data.lines} lines</span>}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={13} /> Refresh
          </button>
          <FilterPopover
            fields={fields}
            values={filters}
            tone="orange"
            onChange={setFilters}
            onApply={setFilters}
            onClear={() => setFilters({ query: '', bookingTypeCode: '', orderTypeCode: '', paymentTermCode: '', progress: '' })}
            sortOptions={[
              { label: 'Most unbilled first', value: 'unbilled_desc' },
              { label: 'Order number', value: 'orderNo' },
              { label: 'Customer', value: 'customer' },
              { label: 'Newest booking', value: 'newest' },
            ]}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
        </div>

        {error && (
          <div className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={18} />
            <div><strong>{error.title}</strong>{error.explanation && <div>{error.explanation}</div>}</div>
          </div>
        )}

        <table className="gecko-table gecko-table-compact gecko-table-fixed">
          <thead>
            <tr>
              <th style={{ width: '14%' }}>Booking</th>
              <th style={{ width: '11%' }}>Type</th>
              <th>Customer</th>
              <th style={{ width: '14%' }}>Agent</th>
              <th style={{ width: '10%' }}>Vessel</th>
              <th className="gecko-num" style={{ width: '6%' }}>Boxes</th>
              <th className="gecko-num" style={{ width: '11%' }}>Billable</th>
              <th className="gecko-num" style={{ width: '11%' }}>Billed</th>
              <th className="gecko-num" style={{ width: '11%' }}>Unbilled</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr><td colSpan={9} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 28 }}>Loading statements…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 0 }}>
                  <EmptyState icon="checkCircle" title="No bookings with charges"
                    description="Bookings appear here as their boxes are quoted and gated." />
                </td>
              </tr>
            )}
            {page.pageItems.map(o => (
              <tr key={o.orderNo} className="gecko-row-clickable" onClick={() => onOpen(o.orderNo)}>
                <td>
                  <button className="gecko-mono-strong gecko-link gecko-cell-tight" onClick={e => { e.stopPropagation(); onOpen(o.orderNo); }}>
                    {o.orderNo}
                  </button>
                  {o.subBlNo && <div className="gecko-cell-meta gecko-mono gecko-cell-tight">{o.subBlNo}</div>}
                </td>
                <td>
                  <span className="gecko-badge gecko-badge-xs gecko-badge-gray">{o.bookingTypeCode}</span>
                  <div className="gecko-cell-meta gecko-cell-tight">{o.orderTypeCode}</div>
                </td>
                <td>
                  <span className="gecko-cell-tight">{o.customerName ?? '—'}</span>
                  {o.customerCode && <span className="gecko-cell-meta gecko-mono">{o.customerCode}</span>}
                </td>
                <td>
                  <span className="gecko-cell-tight">{o.agentName ?? '—'}</span>
                  {o.agentCode && <span className="gecko-cell-meta gecko-mono">{o.agentCode}</span>}
                </td>
                <td>
                  <span className="gecko-cell-tight">{o.vesselCode ?? '—'}</span>
                  {o.voyage && <span className="gecko-cell-meta gecko-cell-tight">{o.voyage}</span>}
                </td>
                <td className="gecko-num gecko-mono">{o.boxes}</td>
                <td className="gecko-num gecko-mono">
                  {o.totalBillable == null ? '—' : money(o.totalBillable, o.currencyCode)}
                </td>
                <td className="gecko-num gecko-mono">
                  {o.billedAmount == null ? '—' : money(o.billedAmount, o.currencyCode)}
                </td>
                <td className="gecko-num gecko-mono gecko-register-unbilled">
                  {money(o.unbilledAmount ?? o.total, o.currencyCode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length > 0 && (
          <TablePagination
            page={page.page} pageSize={page.pageSize} totalItems={page.totalItems} totalPages={page.totalPages}
            startRow={page.startRow} endRow={page.endRow}
            onPageChange={page.setPage} onPageSizeChange={page.setPageSize} noun="bookings"
          />
        )}
      </div>
    </div>
  );
}
