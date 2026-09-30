"use client";

/**
 * ACCOUNTS REPORTS — cash receipts, live against GET /api/revenue/reports/receipts
 * (totals) and /receipts/list (the receipts).
 *
 * A receipt is a tax invoice from the cash window. ISSUED receipts are counted;
 * VOIDED ones are shown apart and never added in. Days are the depot's; cashiers
 * are named from Identity. The old catalogue of ~21 WinForms reports generated
 * nothing; the charge lines themselves are Service Orders, credit lines Unbilled.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useServerList } from '@/lib/api/use-server-list';
import { saveBlob } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { formatDateTime, formatTime } from '@/lib/api/tos';
import { money } from '@/lib/api/revenue';
import {
  RECEIPTS_LIST_PATH, RECEIPTS_PATH, REPORT_PERMISSIONS, presetRange, reportPath, toCsv,
  type ReceiptRow, type ReceiptsReport,
} from '@/lib/api/reports';
import { ReportKpi, ReportParams, ReportTable, type Depot } from '../_components/ReportParams';

const TOP = 15;
const CHANNEL: Record<string, string> = { CASH: 'Cash', TRANSFER: 'Transfer', CHEQUE: 'Cheque', CARD: 'Card' };

export default function AccountsReportsPage() {
  const { branchesFor } = useSession();
  const [picked, setPicked] = useState('');
  const [range, setRange] = useState(() => presetRange('today'));
  const [status, setStatus] = useState<'' | 'ISSUED' | 'VOIDED'>('');

  const { data: branchRows } = useApiList<Depot>('/api/branches?pageSize=100');
  const mine = new Set(branchesFor(REPORT_PERMISSIONS.receipts));
  const depots = (branchRows ?? []).filter(b => mine.size === 0 || mine.has(b.branchId));
  const branchId = picked || depots[0]?.branchId || '';

  const report = useApi<ReceiptsReport>(branchId ? reportPath(RECEIPTS_PATH, branchId, range.from, range.to) : null);
  const r = report.data;
  const cur = r?.currencies.length === 1 ? r.currencies[0] : 'THB';
  const m = (v: number) => money(v, cur);

  const list = useServerList<ReceiptRow>(RECEIPTS_LIST_PATH, {
    branchId: branchId || undefined, from: range.from, to: range.to, status: status || undefined,
  }, 'receipts');
  const rows = list.rows ?? [];
  const error = report.error ?? list.error;

  const exportSummary = () => {
    if (!r) return;
    const out: (string | number | null)[][] = [
      ...r.days.map(d => ['Day', d.day, d.tally.receipts, d.tally.subtotal, d.tally.tax, d.tally.total]),
      ...r.shifts.map(s => ['Shift', `${s.cashierName ?? ''} ${s.openedAt ?? ''}`.trim(), s.tally.receipts, s.tally.subtotal, s.tally.tax, s.tally.total]),
      ...r.cashiers.map(c => ['Cashier', c.cashierName ?? c.cashierUserId, c.tally.receipts, c.tally.subtotal, c.tally.tax, c.tally.total]),
      ...r.customers.map(c => ['Customer', c.payerCode ? `${c.payerCode} ${c.payerName}` : c.payerName, c.tally.receipts, c.tally.subtotal, c.tally.tax, c.tally.total]),
      ...r.channels.map(c => ['Channel', CHANNEL[c.channel] ?? c.channel, c.payments, null, null, c.amount]),
      ['Total', 'issued', r.total.receipts, r.total.subtotal, r.total.tax, r.total.total],
      ['Voided', 'not counted', r.voided.receipts, r.voided.subtotal, r.voided.tax, r.voided.total],
    ];
    saveBlob(toCsv(['Group', 'Key', 'Receipts', 'Before VAT', 'VAT', 'Total'], out), `cash-receipts-${r.branchCode}-${r.from}-${r.to}.csv`);
  };

  const exportList = () => {
    saveBlob(toCsv(['Receipt', 'Time', 'Cashier', 'Order', 'Payer code', 'Payer', 'Tax id', 'Branch no', 'Before VAT', 'VAT', 'Total', 'Currency', 'Channels', 'Status', 'Void reason'],
      rows.map(x => [x.receiptNo, x.receiptAt, x.cashierName, x.orderNo, x.payerCode, x.payerName, x.payerTaxId, x.payerBranchNo,
        x.subtotal, x.tax, x.total, x.currencyCode, x.channels.join(' + '), x.status, x.voidReason])),
      `receipts-${range.from}-${range.to}.csv`);
  };

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Accounts Reports</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
          </div>
          <p className="gecko-page-subtitle gecko-mt-1">
            Cash receipts — what the cash window took over a range of days, by shift, cashier, customer and payment channel.
          </p>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportSummary} disabled={!r}>
            <Icon name="download" size={14} /> Summary
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => { report.reload(); list.reload(); }}>
            <Icon name="refreshCcw" size={14} /> Refresh
          </button>
        </div>
      </div>

      <ReportParams depots={depots} branchId={branchId} onBranch={setPicked}
                    from={range.from} to={range.to} onRange={(from, to) => setRange({ from, to })} />

      {error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{error.title}</div>
            {error.explanation && <div>{error.explanation}</div>}
          </div>
        </div>
      )}
      {r && r.currencies.length > 1 && (
        <div className="gecko-alert gecko-alert-warning">
          <Icon name="alertCircle" size={18} />
          <div>Receipts in more than one currency ({r.currencies.join(', ')}) — the totals add them as they are.</div>
        </div>
      )}

      {/* KPIs */}
      <div className="gecko-grid-5">
        <ReportKpi label="Receipts issued" value={r?.total.receipts.toLocaleString()} tone="primary" />
        <ReportKpi label="Before VAT" value={r ? m(r.total.subtotal) : undefined} />
        <ReportKpi label="VAT" value={r ? m(r.total.tax) : undefined} />
        <ReportKpi label="Total taken" value={r ? m(r.total.total) : undefined} tone="success" />
        <ReportKpi label="Voided" value={r?.voided.receipts.toLocaleString()} sub={r && r.voided.receipts ? `${m(r.voided.total)} · not counted` : 'not counted'}
                   tone={r && r.voided.receipts ? 'warning' : 'neutral'} />
      </div>

      {r && (
        <>
          <div className="gecko-grid-2" style={{ alignItems: 'flex-start' }}>
            <ReportTable
              title="By shift"
              head={[{ label: 'Cashier' }, { label: 'Drawer' }, { label: 'Receipts', num: true }, { label: 'Total', num: true }]}
              rows={r.shifts.map(s => [
                s.cashierName ?? 'Unknown cashier',
                <span key="t" className="gecko-cell-meta">
                  {s.openedAt ? formatDateTime(s.openedAt) : '—'} → {s.closedAt ? formatTime(s.closedAt) : 'open'}
                </span>,
                s.tally.receipts, <strong key="m">{m(s.tally.total)}</strong>,
              ])}
            />
            <div className="gecko-stack">
              <ReportTable
                title="By payment channel"
                head={[{ label: 'Channel' }, { label: 'Payments', num: true }, { label: 'Amount', num: true }]}
                rows={r.channels.map(c => [CHANNEL[c.channel] ?? c.channel, c.payments, <strong key="a">{m(c.amount)}</strong>])}
              />
              <ReportTable
                title="By cashier"
                head={[{ label: 'Cashier' }, { label: 'Receipts', num: true }, { label: 'Total', num: true }]}
                rows={r.cashiers.map(c => [c.cashierName ?? 'Unknown cashier', c.tally.receipts, <strong key="m">{m(c.tally.total)}</strong>])}
              />
            </div>
          </div>

          <div className="gecko-grid-2" style={{ alignItems: 'flex-start' }}>
            <ReportTable
              title="By customer"
              head={[{ label: 'Customer' }, { label: 'Receipts', num: true }, { label: 'Total', num: true }]}
              rows={r.customers.slice(0, TOP).map(c => [
                <><div key="n" className="gecko-cell-primary gecko-truncate" style={{ maxWidth: 260 }}>{c.payerName}</div>
                  <div className="gecko-cell-meta gecko-mono">{c.payerCode ?? 'walk-in'}</div></>,
                c.tally.receipts, <strong key="m">{m(c.tally.total)}</strong>,
              ])}
              foot={r.customers.length > TOP ? `and ${r.customers.length - TOP} more — in the summary CSV` : undefined}
            />
            <ReportTable
              title="By day"
              head={[{ label: 'Day' }, { label: 'Receipts', num: true }, { label: 'Before VAT', num: true }, { label: 'VAT', num: true }, { label: 'Total', num: true }]}
              rows={r.days.map(d => [
                <span key="d" style={{ color: d.tally.receipts ? undefined : 'var(--gecko-text-disabled)' }}>{d.day}</span>,
                d.tally.receipts, m(d.tally.subtotal), m(d.tally.tax), <strong key="t">{m(d.tally.total)}</strong>,
              ])}
            />
          </div>
        </>
      )}

      {/* The receipts */}
      <div className="gecko-row gecko-row-between gecko-row-wrap" style={{ gap: 8 }}>
        <div className="gecko-eyebrow">Receipts · {list.total.toLocaleString()}</div>
        <div className="gecko-row" style={{ gap: 8 }}>
          <select className="gecko-input gecko-input-sm" value={status} onChange={e => setStatus(e.target.value as '' | 'ISSUED' | 'VOIDED')}>
            <option value="">Issued and voided</option>
            <option value="ISSUED">Issued</option>
            <option value="VOIDED">Voided</option>
          </select>
          <input className="gecko-input gecko-input-sm" value={list.search} placeholder="Receipt no, order, payer or tax id"
                 onChange={e => list.setSearch(e.target.value)} style={{ width: 240 }} />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportList} disabled={rows.length === 0}>
            <Icon name="download" size={14} /> Export page
          </button>
        </div>
      </div>
      <div className="gecko-table-wrapper">
        <table className="gecko-table gecko-table-compact">
          <thead>
            <tr>
              <th>Receipt</th><th>Time</th><th>Payer</th><th>Order</th><th>Cashier</th><th>Paid by</th>
              <th className="gecko-num">Before VAT</th><th className="gecko-num">VAT</th><th className="gecko-num">Total</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!list.loading && rows.length === 0 && (
              <tr><td colSpan={10} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 16 }}>No receipts in this range.</td></tr>
            )}
            {rows.map(x => (
              <tr key={x.receiptId} style={x.status === 'VOIDED' ? { opacity: 0.6 } : undefined}>
                <td className="gecko-mono-strong">{x.receiptNo}</td>
                <td>{formatDateTime(x.receiptAt)}</td>
                <td>
                  <div className="gecko-truncate" style={{ maxWidth: 220 }}>{x.payerName}</div>
                  <div className="gecko-cell-meta gecko-mono">{x.payerCode ?? 'walk-in'}{x.payerTaxId ? ` · ${x.payerTaxId}` : ''}</div>
                </td>
                <td className="gecko-mono">{x.orderNo ?? '—'}</td>
                <td>{x.cashierName ?? '—'}</td>
                <td>{x.channels.map(c => CHANNEL[c] ?? c).join(' + ') || '—'}</td>
                <td className="gecko-num gecko-mono">{money(x.subtotal, x.currencyCode)}</td>
                <td className="gecko-num gecko-mono">{money(x.tax, x.currencyCode)}</td>
                <td className="gecko-num gecko-mono" style={{ fontWeight: 700 }}>{money(x.total, x.currencyCode)}</td>
                <td>
                  <span className={`gecko-badge ${x.status === 'VOIDED' ? 'gecko-badge-gray' : 'gecko-badge-success'}`}>{x.status === 'VOIDED' ? 'Voided' : 'Issued'}</span>
                  {x.voidReason && <div className="gecko-cell-meta gecko-truncate" style={{ maxWidth: 160 }} title={x.voidReason}>{x.voidReason}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.footer}
      </div>

      <div className="gecko-row gecko-row-wrap" style={{ gap: 8 }}>
        <span className="gecko-cell-meta">The lines behind the money:</span>
        <Link href="/billing/service-orders" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="clipboardList" size={13} /> Service orders</Link>
        <Link href="/billing/unbilled" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="fileText" size={13} /> Unbilled</Link>
        <Link href="/billing/cash-window" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="arrowRight" size={13} /> Cash window</Link>
      </div>
    </div>
  );
}
