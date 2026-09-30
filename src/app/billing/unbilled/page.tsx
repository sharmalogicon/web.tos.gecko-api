"use client";

/**
 * UNBILLED — credit charges not yet on an invoice, live against gecko_revenue
 * `billing.charge` status UNBILLED (GET /api/revenue/charges/unbilled, per payer;
 * the lines from GET /api/revenue/charges?status=UNBILLED&payerCode=).
 *
 * UNBILLED lines are raised by the gate for credit customers (PLAN_BILLING 6.3,
 * credit accrual), which is not running yet — and a cash depot pays at the window,
 * so for it this page stays empty and says why. Invoices have no tables yet, so
 * there is no "create invoice" here: the page shows what is owed on credit, and
 * nothing it cannot back.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useServerList } from '@/lib/api/use-server-list';
import { saveBlob } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { formatContainerNo, formatDateTime } from '@/lib/api/tos';
import { money } from '@/lib/api/revenue';
import {
  CHARGES_PATH, CHARGE_PERMISSIONS, payerLabel, unbilledPath,
  type Charge, type Unbilled, type UnbilledPayer,
} from '@/lib/api/charges';

interface Branch { branchId: string; branchCode: string; displayName: string }

const payerKey = (p: UnbilledPayer) => `${p.payerCode ?? ''}|${p.billTo}|${p.currencyCode}`;
const dayOf = (iso: string) => iso.slice(0, 10);

export default function UnbilledPage() {
  const { branchesFor } = useSession();
  const [branchId, setBranchId] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  const { data: branchRows } = useApiList<Branch>('/api/branches?pageSize=100');
  const mine = new Set(branchesFor(CHARGE_PERMISSIONS.view));
  const depots = (branchRows ?? []).filter(b => mine.size === 0 || mine.has(b.branchId));
  const branchCode = new Map((branchRows ?? []).map(b => [b.branchId, b.branchCode]));

  const summary = useApi<Unbilled>(unbilledPath(branchId || undefined));
  const payers = summary.data?.payers ?? [];
  const selected = payers.find(p => payerKey(p) === picked) ?? null;
  const currencies = new Set(payers.map(p => p.currencyCode));
  const oneCurrency = currencies.size <= 1 ? (payers[0]?.currencyCode ?? 'THB') : null;

  const lines = useServerList<Charge>(CHARGES_PATH, {
    status: 'UNBILLED', branchId, payerCode: selected?.payerCode ?? undefined,
  }, 'lines');
  const rows = (lines.rows ?? []).filter(c => !selected || (c.billTo === selected.billTo && c.currencyCode === selected.currencyCode));

  const reload = () => { summary.reload(); lines.reload(); };

  const exportCsv = () => {
    const head = ['Payer', 'Payer name', 'Bill to', 'Currency', 'Lines', 'Boxes', 'Amount', 'VAT', 'Total', 'Oldest', 'Newest'];
    const cell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const out = payers.map(p => [p.payerCode, p.payerName, p.billTo, p.currencyCode, p.lines, p.boxes, p.amount, p.tax, p.total,
      dayOf(p.oldest), dayOf(p.newest)].map(cell).join(','));
    saveBlob(new Blob([[head.join(','), ...out].join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'unbilled-by-payer.csv');
  };

  const error = summary.error ?? lines.error;

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Unbilled Services</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
          </div>
          <div className="gecko-page-subtitle">
            Credit charges raised but not yet on an invoice, per payer
            {summary.data ? ` · as at ${formatDateTime(summary.data.asAt)}` : ''}
          </div>
        </div>
        <div className="gecko-toolbar">
          <select className="gecko-input gecko-input-sm" aria-label="Depot" value={branchId}
                  onChange={e => { setBranchId(e.target.value); setPicked(null); }} style={{ minWidth: 170 }}>
            <option value="">All my depots</option>
            {depots.map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
          </select>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportCsv} disabled={payers.length === 0}>
            <Icon name="download" size={14} /> Export
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{error.title}</div>
            {error.explanation && <div>{error.explanation}</div>}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="gecko-grid-4">
        <Kpi icon="users" tone="primary" label="Payers owing" value={summary.data ? payers.length.toLocaleString() : undefined} />
        <Kpi icon="clipboardList" tone="info" label="Unbilled lines" value={summary.data?.lines.toLocaleString()} />
        <Kpi icon="invoice" tone="neutral" label="Before VAT"
             value={summary.data ? (oneCurrency ? money(summary.data.amount, oneCurrency) : 'mixed currencies') : undefined} />
        <Kpi icon="fileText" tone="warning" label="Total with VAT"
             value={summary.data ? (oneCurrency ? money(summary.data.total, oneCurrency) : 'see per payer') : undefined} />
      </div>

      {summary.data && payers.length === 0 ? (
        <div className="gecko-card">
          <EmptyState
            icon="invoice"
            title="Nothing unbilled"
            description="Unbilled lines are credit charges the gate raises for customers who are invoiced monthly. None are waiting. A cash customer pays at the cash window — those lines are under Service Orders."
            action={<Link href="/billing/service-orders" className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="clipboardList" size={14} /> Service Orders</Link>}
          />
        </div>
      ) : (
        <>
          {/* Per payer */}
          <div className="gecko-table-wrapper">
            <table className="gecko-table">
              <thead>
                <tr>
                  <th>Payer</th>
                  <th>Bill to</th>
                  <th className="gecko-num">Lines</th>
                  <th className="gecko-num">Boxes</th>
                  <th className="gecko-num">Amount</th>
                  <th className="gecko-num">VAT</th>
                  <th className="gecko-num">Total</th>
                  <th>Oldest line</th>
                </tr>
              </thead>
              <tbody>
                {payers.map(p => {
                  const key = payerKey(p);
                  const on = key === picked;
                  return (
                    <tr key={key} onClick={() => setPicked(on ? null : key)} style={{ cursor: 'pointer', background: on ? 'var(--gecko-primary-50)' : undefined }}>
                      <td>
                        <div className="gecko-cell-primary gecko-truncate" style={{ maxWidth: 280 }}>{payerLabel(p.payerCode, p.payerName)}</div>
                        {p.payerName && p.payerCode && <div className="gecko-cell-meta gecko-mono">{p.payerCode}</div>}
                      </td>
                      <td>{p.billTo.toLowerCase()}</td>
                      <td className="gecko-num gecko-mono">{p.lines}</td>
                      <td className="gecko-num gecko-mono">{p.boxes}</td>
                      <td className="gecko-num gecko-mono">{money(p.amount, p.currencyCode)}</td>
                      <td className="gecko-num gecko-mono">{money(p.tax, p.currencyCode)}</td>
                      <td className="gecko-num gecko-mono" style={{ fontWeight: 700 }}>{money(p.total, p.currencyCode)}</td>
                      <td>{dayOf(p.oldest)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Lines */}
          <div className="gecko-row gecko-row-between">
            <div className="gecko-eyebrow">
              Lines · {selected ? payerLabel(selected.payerCode, selected.payerName) : 'every payer'}
            </div>
            <div className="gecko-row" style={{ gap: 8 }}>
              <input className="gecko-input gecko-input-sm" value={lines.search} placeholder="Container, order or EIR"
                     onChange={e => lines.setSearch(e.target.value)} style={{ width: 220 }} />
              {selected && (
                <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setPicked(null)}>
                  <Icon name="x" size={12} /> Every payer
                </button>
              )}
            </div>
          </div>
          <div className="gecko-table-wrapper">
            <table className="gecko-table">
              <thead>
                <tr>
                  <th>Raised</th>
                  <th>Container / order</th>
                  <th>Movement</th>
                  <th>Charge</th>
                  {!selected && <th>Payer</th>}
                  <th className="gecko-num">Amount</th>
                  <th className="gecko-num">VAT</th>
                  <th className="gecko-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {!lines.loading && rows.length === 0 && (
                  <tr><td colSpan={selected ? 7 : 8} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 20 }}>No lines match.</td></tr>
                )}
                {rows.map(c => (
                  <tr key={c.chargeId}>
                    <td>
                      {formatDateTime(c.createdAt)}
                      <div className="gecko-cell-meta">{branchCode.get(c.branchId) ?? ''}</div>
                    </td>
                    <td>
                      {c.containerNo
                        ? <Link href={`/units/unit-inquiry?no=${encodeURIComponent(c.containerNo)}`} className="gecko-mono-strong gecko-link">{formatContainerNo(c.containerNo)}</Link>
                        : '—'}
                      {c.orderNo && <div className="gecko-cell-meta gecko-mono">{c.orderNo}</div>}
                    </td>
                    <td>
                      <span className="gecko-mono">{c.movementCode ?? '—'}</span>
                      {c.eirNo && <div className="gecko-cell-meta gecko-mono">{c.eirNo}</div>}
                      {c.serviceFrom && <div className="gecko-cell-meta">{c.serviceFrom} → {c.serviceTo ?? '…'}</div>}
                    </td>
                    <td>
                      <div className="gecko-mono-strong">{c.chargeCode}</div>
                      {c.chargeName && <div className="gecko-cell-meta">{c.chargeName}</div>}
                    </td>
                    {!selected && <td className="gecko-truncate" style={{ maxWidth: 200 }}>{payerLabel(c.payerCode, c.payerName)}</td>}
                    <td className="gecko-num gecko-mono">{money(c.amount, c.currencyCode)}</td>
                    <td className="gecko-num gecko-mono">{money(c.taxAmount, c.currencyCode)}</td>
                    <td className="gecko-num gecko-mono" style={{ fontWeight: 700 }}>{money(c.total, c.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lines.footer}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, tone, label, value }: {
  icon: string; tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'; label: string; value: string | undefined;
}) {
  return (
    <div className="gecko-kpi-tile">
      <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${tone}`}>
        <Icon name={icon} size={16} />
      </div>
      <div>
        <div className="gecko-kpi-tile-value">{value ?? '…'}</div>
        <div className="gecko-kpi-tile-label">{label}</div>
      </div>
    </div>
  );
}
