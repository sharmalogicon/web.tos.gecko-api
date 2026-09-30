"use client";

/**
 * SERVICE ORDERS — the charge register, live against gecko_revenue `billing.charge`
 * (GET /api/revenue/charges).
 *
 * Every priced line: what it is for (box, order, movement, EIR), who pays on which
 * term, how much, and where it is in its life. A cash depot's lines come from the
 * cash window — PAID, then EARNED when the gate move happens, or WAIVED with a
 * reason; credit lines (UNBILLED → INVOICED) come from the gate once credit
 * accrual runs. Lines are written by the window and the gate, never typed here,
 * so there is no manual-charge entry and no service-order number to scan.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApiList } from '@/lib/api/use-api';
import { useServerList } from '@/lib/api/use-server-list';
import { saveBlob } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { formatContainerNo, formatDateTime } from '@/lib/api/tos';
import { dayBound } from '@/lib/api/reefer';
import { money } from '@/lib/api/revenue';
import {
  CHARGES_PATH, CHARGE_PERMISSIONS, CHARGE_SOURCE, CHARGE_STATUS, payerLabel,
  type Charge, type ChargeSource, type ChargeStatus,
} from '@/lib/api/charges';

interface Branch { branchId: string; branchCode: string; displayName: string }

export default function ServiceOrdersPage() {
  const { branchesFor } = useSession();
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState<'' | ChargeStatus>('');
  const [source, setSource] = useState<'' | ChargeSource>('');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');

  const { data: branchRows } = useApiList<Branch>('/api/branches?pageSize=100');
  const mine = new Set(branchesFor(CHARGE_PERMISSIONS.view));
  const depots = (branchRows ?? []).filter(b => mine.size === 0 || mine.has(b.branchId));
  const branchCode = new Map((branchRows ?? []).map(b => [b.branchId, b.branchCode]));

  const list = useServerList<Charge>(CHARGES_PATH, {
    branchId, status, source, from: dayBound(fromDay, false), to: dayBound(toDay, true),
  }, 'lines');
  const rows = list.rows ?? [];
  const filtered = !!(list.search.trim() || branchId || status || source || fromDay || toDay);

  const clear = () => { list.setSearch(''); setBranchId(''); setStatus(''); setSource(''); setFromDay(''); setToDay(''); };

  const exportCsv = () => {
    const head = ['Created', 'Depot', 'Container', 'Order', 'Movement', 'EIR', 'Charge', 'Charge name', 'Bill to', 'Term',
      'Payer', 'Payer name', 'Qty', 'Unit rate', 'Amount', 'VAT', 'Total', 'Currency', 'Status', 'Source', 'Tariff', 'Reason'];
    const cell = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map(c => [c.createdAt, branchCode.get(c.branchId), c.containerNo, c.orderNo, c.movementCode, c.eirNo,
      c.chargeCode, c.chargeName, c.billTo, c.paymentTermCode, c.payerCode, c.payerName, c.quantity, c.unitRate,
      c.amount, c.taxAmount, c.total, c.currencyCode, c.status, c.source,
      c.scheduleNo ? `${c.scheduleNo} v${c.scheduleVersionNo ?? ''}` : '', c.waiveReason ?? c.cancelReason].map(cell).join(','));
    saveBlob(new Blob([[head.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'charges.csv');
  };

  // Money on this page, by currency (a page can in principle mix them).
  const pageTotals = rows.reduce<Record<string, number>>((acc, c) => {
    if (c.status !== 'CANCELLED') acc[c.currencyCode] = (acc[c.currencyCode] ?? 0) + c.total;
    return acc;
  }, {});

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Service Orders</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
            <span className="gecko-count-badge">{list.loading && !list.data ? '…' : `${list.total.toLocaleString()} lines`}</span>
          </div>
          <div className="gecko-page-subtitle">
            Every priced charge line — from the cash window and the gate — with who pays and where it is in its life.
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Icon name="download" size={14} /> Export page
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={list.reload}>
            <Icon name="refreshCcw" size={14} /> Refresh
          </button>
        </div>
      </div>

      {list.error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{list.error.title}</div>
            {list.error.explanation && <div>{list.error.explanation}</div>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="gecko-card" style={{ padding: 14 }}>
        <div className="gecko-row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="gecko-form-group" style={{ flex: '1 1 240px' }}>
            <label className="gecko-form-label">Search</label>
            <input className="gecko-input gecko-input-sm" value={list.search} placeholder="Container, order, EIR, charge or payer code"
                   onChange={e => list.setSearch(e.target.value)} />
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">Depot</label>
            <select className="gecko-input gecko-input-sm" value={branchId} onChange={e => setBranchId(e.target.value)} style={{ minWidth: 150 }}>
              <option value="">All my depots</option>
              {depots.map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
            </select>
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">Status</label>
            <select className="gecko-input gecko-input-sm" value={status} onChange={e => setStatus(e.target.value as '' | ChargeStatus)}>
              <option value="">Any status</option>
              {(Object.keys(CHARGE_STATUS) as ChargeStatus[]).map(s => <option key={s} value={s}>{CHARGE_STATUS[s].label}</option>)}
            </select>
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">Source</label>
            <select className="gecko-input gecko-input-sm" value={source} onChange={e => setSource(e.target.value as '' | ChargeSource)}>
              <option value="">Any source</option>
              {(Object.keys(CHARGE_SOURCE) as ChargeSource[]).map(s => <option key={s} value={s}>{CHARGE_SOURCE[s]}</option>)}
            </select>
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">Created from</label>
            <input type="date" className="gecko-input gecko-input-sm" value={fromDay} onChange={e => setFromDay(e.target.value)} />
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">to</label>
            <input type="date" className="gecko-input gecko-input-sm" value={toDay} onChange={e => setToDay(e.target.value)} />
          </div>
          {filtered && (
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={clear}>
              <Icon name="x" size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {!list.loading && rows.length === 0 && !list.error ? (
        <div className="gecko-card">
          <EmptyState
            icon="invoice"
            title={filtered ? 'No charge line matches' : 'No charges yet'}
            description={filtered
              ? 'Try clearing the search or the filters.'
              : 'Lines appear here when the cash window takes payment or waives a charge, and when the gate raises a credit charge.'}
          />
        </div>
      ) : (
        <div className="gecko-table-wrapper">
          <table className="gecko-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Container / order</th>
                <th>Movement</th>
                <th>Charge</th>
                <th>Payer</th>
                <th className="gecko-num">Amount</th>
                <th className="gecko-num">VAT</th>
                <th className="gecko-num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(c => {
                const st = CHARGE_STATUS[c.status] ?? CHARGE_STATUS.QUOTED;
                const reason = c.waiveReason ?? c.cancelReason;
                return (
                  <tr key={c.chargeId}>
                    <td>
                      {formatDateTime(c.createdAt)}
                      <div className="gecko-cell-meta">{branchCode.get(c.branchId) ?? ''} · {CHARGE_SOURCE[c.source] ?? c.source}</div>
                    </td>
                    <td>
                      {c.containerNo
                        ? <Link href={`/units/unit-inquiry?no=${encodeURIComponent(c.containerNo)}`} className="gecko-mono-strong gecko-link">{formatContainerNo(c.containerNo)}</Link>
                        : <span className="gecko-cell-meta">—</span>}
                      {c.orderNo && <div className="gecko-cell-meta gecko-mono">{c.orderNo}</div>}
                    </td>
                    <td>
                      <span className="gecko-mono">{c.movementCode ?? '—'}</span>
                      {c.eirNo && <div className="gecko-cell-meta gecko-mono">{c.eirNo}</div>}
                      {c.serviceFrom && <div className="gecko-cell-meta">{c.serviceFrom} → {c.serviceTo ?? '…'}</div>}
                    </td>
                    <td>
                      <div className="gecko-mono-strong">{c.chargeCode}</div>
                      <div className="gecko-cell-meta">
                        {c.chargeName ?? ''}{c.quantity !== 1 ? ` · ${c.quantity} × ${money(c.unitRate, c.currencyCode)}` : ''}
                      </div>
                      {c.scheduleNo && <div className="gecko-cell-meta" title="The tariff the price was taken from">{c.scheduleNo} v{c.scheduleVersionNo}</div>}
                    </td>
                    <td>
                      <div className="gecko-cell-primary gecko-truncate" style={{ maxWidth: 220 }}>{payerLabel(c.payerCode, c.payerName)}</div>
                      <div className="gecko-cell-meta">
                        {c.payerName && c.payerCode ? <span className="gecko-mono">{c.payerCode} · </span> : null}
                        {c.billTo.toLowerCase()} · {c.paymentTermCode.toLowerCase()}
                      </div>
                    </td>
                    <td className="gecko-num gecko-mono">{money(c.amount, c.currencyCode)}</td>
                    <td className="gecko-num gecko-mono">{money(c.taxAmount, c.currencyCode)}</td>
                    <td className="gecko-num gecko-mono" style={{ fontWeight: 700 }}>{money(c.total, c.currencyCode)}</td>
                    <td>
                      <span className={`gecko-badge ${st.badge}`} title={st.hint}>{st.label}</span>
                      {c.creditNoteRequired && <div className="gecko-cell-meta" style={{ color: 'var(--gecko-error-700)' }}>credit note needed</div>}
                      {reason && <div className="gecko-cell-meta gecko-truncate" style={{ maxWidth: 180 }} title={reason}>{reason}</div>}
                      {c.couponRef && <div className="gecko-cell-meta gecko-mono">{c.couponRef}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={7} className="gecko-cell-meta">This page, cancelled lines left out</td>
                  <td className="gecko-num gecko-mono" style={{ fontWeight: 700 }}>
                    {Object.entries(pageTotals).map(([cur, v]) => <div key={cur}>{money(v, cur)}</div>)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
          {list.footer}
        </div>
      )}
    </div>
  );
}
