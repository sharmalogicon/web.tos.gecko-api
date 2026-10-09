"use client";
import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterPopover, type FilterField } from '@/components/ui/FilterPopover';
import { TablePagination } from '@/components/ui/TablePagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
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
  const [sortBy, setSortBy] = useState('newest');

  // Which page of the register the clerk is on. The API pages, not the screen:
  // it lists EVERY booking of the branch now, so slicing a 200-row fetch
  // locally would show the newest 200 and quietly call that "all".
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const path = useMemo(() => {
    const q = { ...blankUnbilledQuery() };
    if (filters.bookingTypeCode) q.bookingTypeCode = filters.bookingTypeCode;
    if (filters.orderTypeCode) q.orderTypeCode = filters.orderTypeCode;
    if (filters.paymentTermCode) q.paymentTermCode = filters.paymentTermCode;
    if (filters.progress) q.progress = filters.progress as typeof q.progress;
    // IncludeSettled (API 2026-10-07) turns this from "orders with something
    // unbilled" into "every booking of the branch, newest first" — including
    // ones with no charge lines at all, which a clerk opens to add a manual
    // charge. PascalCase like its neighbours; `page`/`pageSize` are lowercase
    // on THIS endpoint, unlike /api/tos/bookings.
    const p = new URLSearchParams({
      ...unbilledParams(q, branchId),
      IncludeSettled: 'true',
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    return `${UNBILLED_ORDERS_PATH}?${p.toString()}`;
  }, [filters, branchId, page]);

  // Every filter below the search box narrows by CHARGE LINE, so with one set
  // the API lists only bookings that have such lines. The empty state has to
  // say that, or an empty page reads as an empty branch.
  const anyFilterSet = Boolean(filters.bookingTypeCode || filters.orderTypeCode
    || filters.paymentTermCode || filters.progress);

  const { data, error, loading, reload } = useApi<UnbilledOrdersPage>(path);
  const orders = useMemo(() => data?.items ?? [], [data]);
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  /**
   * The text box and the sort act on the PAGE that is loaded, not on the whole
   * register: this endpoint has no free-text search, and sorting server-side is
   * not offered either. Saying so in the placeholder is better than a search
   * that looks global and is not.
   */
  const rows = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const out = orders.filter(o => !q
      || o.orderNo.toLowerCase().includes(q)
      || (o.carrierRef ?? '').toLowerCase().includes(q)
      || (o.subBlNo ?? '').toLowerCase().includes(q)
      || (o.customerName ?? '').toLowerCase().includes(q)
      || (o.agentName ?? '').toLowerCase().includes(q));
    const by: Record<string, (a: UnbilledOrder, b: UnbilledOrder) => number> = {
      // The API already answers newest first, so this is the order it arrived in.
      newest: () => 0,
      unbilled_desc: (a, b) => (b.unbilledAmount ?? b.total) - (a.unbilledAmount ?? a.total),
      orderNo: (a, b) => a.orderNo.localeCompare(b.orderNo),
      customer: (a, b) => (a.customerName ?? '').localeCompare(b.customerName ?? ''),
    };
    return [...out].sort(by[sortBy] ?? by.newest);
  }, [orders, filters.query, sortBy]);

  const distinct = (pick: (o: UnbilledOrder) => string | null) =>
    [...new Set(orders.map(pick).filter((v): v is string => Boolean(v)))].sort();

  const fields: FilterField[] = [
    { type: 'search', key: 'query', placeholder: 'Filter this page: order, B/L, customer…' },
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
      <div className="gecko-table-card gecko-table-card-menus">
        <div className="gecko-table-toolbar">
          <Icon name="fileText" size={13} />
          <span>
            <strong>{totalCount}</strong> booking{totalCount === 1 ? '' : 's'}
            {rows.length !== orders.length && <> · {rows.length} shown on this page</>}
          </span>
          <span className="gecko-table-toolbar-spacer" />
          {data && (
            <span title="Counts UNBILLED lines only, across the whole register">
              Unbilled <strong className="gecko-mono">{money(data.total, 'THB')}</strong> over {data.lines} lines
            </span>
          )}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={13} /> Refresh
          </button>
          <FilterPopover
            fields={fields}
            values={filters}
            tone="orange"
            onChange={setFilters}
            onApply={v => { setFilters(v); setPage(1); }}
            onClear={() => { setFilters({ query: '', bookingTypeCode: '', orderTypeCode: '', paymentTermCode: '', progress: '' }); setPage(1); }}
            sortOptions={[
              { label: 'Newest first', value: 'newest' },
              { label: 'Most unbilled first', value: 'unbilled_desc' },
              { label: 'Order number', value: 'orderNo' },
              { label: 'Customer', value: 'customer' },
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

        <div className="gecko-table-clip">
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
            {loading && <TableSkeleton columns={9} />}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 0 }}>
                  {/* With a charge-line filter set the API lists only bookings
                      that HAVE such lines, so an empty result means the filter,
                      not an empty branch. */}
                  <EmptyState icon="search"
                    title={anyFilterSet ? 'No booking matches the filter' : 'No bookings yet'}
                    description={anyFilterSet
                      ? 'Payment term, charge, movement, date and progress all filter by CHARGE LINE, so a booking with none is left out. Clear the filter to see every booking.'
                      : 'Bookings appear here as they are raised.'} />
                </td>
              </tr>
            )}
            {rows.map(o => (
              <tr key={o.orderNo} className="gecko-row-clickable" onClick={() => onOpen(o.orderNo)}>
                {/* THE NUMBER THE DEPOT QUOTES COMES FIRST (owner, 2026-10-08):
                    the carrier's booking number, or the B/L. Gecko's own order
                    number is underneath in small type — it is how the system
                    files the booking, not how anyone asks for it. The row still
                    OPENS on the order number, which is what the API takes. */}
                <td>
                  <button className="gecko-mono-strong gecko-link gecko-cell-tight"
                    onClick={e => { e.stopPropagation(); onOpen(o.orderNo); }}>
                    {o.carrierRef || o.subBlNo || o.orderNo}
                  </button>
                  {(o.carrierRef || o.subBlNo) && (
                    <div className="gecko-cell-meta gecko-mono gecko-cell-tight">{o.orderNo}</div>
                  )}
                  {/* Both of them exist on plenty of bookings; the one not used
                      as the heading still has to be findable. */}
                  {o.carrierRef && o.subBlNo && (
                    <div className="gecko-cell-meta gecko-mono gecko-cell-tight">{o.subBlNo}</div>
                  )}
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
                {/* No charge lines yet is normal, not missing data: the money
                    reads 0.00 and the box count a dash. The row still opens —
                    that is where a manual charge is added. */}
                <td className="gecko-num gecko-mono">{o.boxes > 0 ? o.boxes : '—'}</td>
                <td className="gecko-num gecko-mono">
                  {money(o.totalBillable ?? 0, o.currencyCode)}
                </td>
                <td className="gecko-num gecko-mono">
                  {money(o.billedAmount ?? 0, o.currencyCode)}
                </td>
                <td className="gecko-num gecko-mono gecko-register-unbilled">
                  {money(o.unbilledAmount ?? o.total ?? 0, o.currencyCode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        </div>

        {totalCount > 0 && (
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={totalCount}
            totalPages={totalPages}
            startRow={(page - 1) * PAGE_SIZE + 1}
            endRow={Math.min(page * PAGE_SIZE, totalCount)}
            loading={loading}
            onPageChange={setPage}
            // The API's page size, not the screen's: changing it would have to
            // re-ask the server, and 50 is the size the owner set.
            onPageSizeChange={() => {}}
            noun="bookings"
          />
        )}
      </div>
    </div>
  );
}
