"use client";

/**
 * CASH RECEIPTS — the register of what was taken.
 *
 * Every receipt the depot issued, wherever it came from: the gate, the cash
 * window, or a Customer Cash Bill. In Thailand the receipt IS the tax invoice,
 * so this is the register a clerk goes to when a customer rings up quoting a
 * number, and the one an accounts user works through at the end of a day.
 *
 * It existed as a REPORT (/reports/accounts-api, with the day / shift / cashier
 * / customer tallies around it) but not as a register, so /billing/receipts —
 * which the detail pages and every receipt link sit under — answered 404.
 *
 * Bound to GET /api/revenue/reports/receipts/list, paged server-side with the
 * same date range, search and status the report uses. The money is the API's;
 * nothing here adds anything up.
 *
 * STILL MISSING FROM THE API (asked 2026-10-08): the row carries no
 * `issuedFrom`, so this cannot say which receipts came from the gate — the set
 * a clerk splits — and no `splitFromReceiptNo` / `splitIntoReceiptNos`, so a
 * split pair reads as an unexplained void. Both exist on ReceiptResponse
 * already; see docs/CASH_BILL_FOR_API.md.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { FilterPopover, type FilterField } from '@/components/ui/FilterPopover';
import { useServerList } from '@/lib/api/use-server-list';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { saveBlob } from '@/lib/api/client';
import { amount } from '@/lib/api/charges';
import { formatDateTime } from '@/lib/format';
import {
  presetRange, RECEIPTS_LIST_PATH, REPORT_PERMISSIONS, toCsv, type ReceiptRow,
} from '@/lib/api/reports';
import { CHANNEL_LABEL } from '@/lib/api/window';

type Preset = 'today' | 'yesterday' | 'thisMonth' | 'lastMonth';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
];

const DEFAULTS: Record<string, string> = { preset: 'today', status: '' };

export default function CashReceiptsPage() {
  const router = useRouter();
  const { branch } = useFacility();
  const { can } = useSession();
  const branchId = branch?.branchId ?? '';
  const mayView = can(REPORT_PERMISSIONS.receipts);

  const [filters, setFilters] = useState<Record<string, string>>(DEFAULTS);
  const range = presetRange((filters.preset || 'today') as Preset);

  // The search, the page and the footer are the server's: a day of a busy depot
  // is more receipts than a screen should ever slice locally.
  const list = useServerList<ReceiptRow>(RECEIPTS_LIST_PATH, {
    branchId: branchId || undefined,
    from: range.from,
    to: range.to,
    status: filters.status || undefined,
  }, 'receipts', Boolean(branchId && mayView));

  const rows = list.rows ?? [];
  const m = (v: number, cur: string) => amount(v, cur);

  const fields: FilterField[] = [
    {
      type: 'select', key: 'preset', label: 'Period',
      options: PRESETS.map(p => ({ label: p.label, value: p.value })),
    },
    {
      type: 'select', key: 'status', label: 'Status',
      options: [
        { label: 'All', value: '' },
        { label: 'Issued', value: 'ISSUED' },
        { label: 'Voided', value: 'VOIDED' },
      ],
    },
  ];

  const exportCsv = () => {
    saveBlob(
      toCsv(
        ['Receipt', 'Time', 'Cashier', 'Order', 'Customer code', 'Customer', 'Tax id', 'Branch no',
          'Before VAT', 'VAT', 'Total', 'Currency', 'Paid by', 'Status', 'Void reason'],
        rows.map(x => [x.receiptNo, x.receiptAt, x.cashierName, x.orderNo, x.payerCode, x.payerName,
          x.payerTaxId, x.payerBranchNo, x.subtotal, x.tax, x.total, x.currencyCode,
          x.channels.join(' + '), x.status, x.voidReason]),
      ),
      `cash-receipts-${range.from}-${range.to}.csv`,
    );
  };

  return (
    <div className="gecko-stack gecko-stack-xl gecko-cashbill-page">
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Cash Receipts</h1>
          <div className="gecko-page-subtitle gecko-mt-1">
            Every receipt this depot issued — the gate, the cash window and cash bills.
            The receipt is the tax invoice.
          </div>
        </div>
        {/* Customer Cash Bill came off the menu on 2026-10-08, so the way to
            raise one is from the register of what has already been raised. */}
        <div className="gecko-toolbar">
          <Link href="/billing/cash-bills" className="gecko-btn gecko-btn-primary gecko-btn-sm">
            <Icon name="plus" size={13} /> New cash bill
          </Link>
        </div>
      </div>

      {!mayView && (
        <div role="status" className="gecko-alert gecko-alert-warning">
          <Icon name="lock" size={16} />
          <span>Reading receipts needs the charge-view permission. Ask an accounts user to raise it.</span>
        </div>
      )}

      {list.error && mayView && (
        <div role="alert" className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <strong>{list.error.title}</strong>
            {list.error.explanation && <div>{list.error.explanation}</div>}
          </div>
        </div>
      )}

      <section className="gecko-table-card gecko-table-card-menus">
        <div className="gecko-table-toolbar">
          <Icon name="invoice" size={13} />
          <span>
            <strong>{list.total}</strong> receipt{list.total === 1 ? '' : 's'}
            {' '}· {range.from === range.to ? range.from : `${range.from} → ${range.to}`}
          </span>
          <span className="gecko-table-toolbar-spacer" />
          <input
            className="gecko-input gecko-input-sm gecko-cashbill-lookup-input"
            aria-label="Search receipts"
            placeholder="Receipt no, customer, order…"
            value={list.search}
            onChange={e => list.setSearch(e.target.value)}
          />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Icon name="download" size={13} /> CSV
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={list.reload}>
            <Icon name="refreshCcw" size={13} /> Refresh
          </button>
          <FilterPopover
            fields={fields} values={filters} defaultValues={DEFAULTS} tone="orange"
            onChange={setFilters} onApply={setFilters} onClear={() => setFilters(DEFAULTS)}
          />
        </div>

        <div className="gecko-table-clip">
          <table className="gecko-table gecko-table-compact gecko-table-fixed">
            <thead>
              <tr>
                <th style={{ width: '16%' }}>Receipt no</th>
                <th style={{ width: '13%' }}>Taken at</th>
                <th>Customer</th>
                <th style={{ width: '13%' }}>Booking</th>
                <th style={{ width: '11%' }}>Paid by</th>
                <th className="gecko-num" style={{ width: '10%' }}>Before VAT</th>
                <th className="gecko-num" style={{ width: '8%' }}>VAT</th>
                <th className="gecko-num" style={{ width: '11%' }}>Total</th>
                <th style={{ width: '9%' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.loading && <TableSkeleton columns={9} />}
              {!list.loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="gecko-cell-bleed">
                    <EmptyState icon="invoice"
                      title={list.search ? 'Nothing matches that' : 'No receipts in this period'}
                      description={list.search
                        ? 'Try the receipt number, the customer, or the booking.'
                        : 'Widen the period in the filter, or take a payment at the gate or the cash window.'} />
                  </td>
                </tr>
              )}
              {!list.loading && rows.map(r => (
                <tr key={r.receiptId} className="gecko-row-clickable"
                  onClick={() => router.push(`/billing/receipts/${encodeURIComponent(r.receiptId)}`)}>
                  <td className="gecko-mono-strong gecko-cell-tight">{r.receiptNo}</td>
                  <td className="gecko-cell-meta">{formatDateTime(r.receiptAt)}</td>
                  <td>
                    <span className="gecko-cell-tight">{r.payerName || 'Walk-in (cash)'}</span>
                    {r.payerCode && <span className="gecko-cell-meta gecko-mono">{r.payerCode}</span>}
                  </td>
                  <td className="gecko-mono gecko-cell-tight">{r.orderNo ?? '—'}</td>
                  <td className="gecko-cell-meta gecko-cell-tight">
                    {r.channels.length > 0
                      ? r.channels.map(c => CHANNEL_LABEL[c as keyof typeof CHANNEL_LABEL] ?? c).join(' + ')
                      : '—'}
                  </td>
                  <td className="gecko-num gecko-mono">{m(r.subtotal, r.currencyCode)}</td>
                  <td className="gecko-num gecko-mono gecko-cell-meta">{m(r.tax, r.currencyCode)}</td>
                  <td className="gecko-num gecko-mono gecko-mono-strong">{m(r.total, r.currencyCode)}</td>
                  <td>
                    <span className={`gecko-badge gecko-badge-xs ${r.status === 'VOIDED' ? 'gecko-badge-gray' : 'gecko-badge-success'}`}
                      title={r.status === 'VOIDED' ? r.voidReason ?? undefined : undefined}>
                      {r.status === 'VOIDED' ? 'Voided' : 'Issued'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {list.total > 0 && list.footer}
      </section>
    </div>
  );
}
