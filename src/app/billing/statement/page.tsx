"use client";

/**
 * BOOKING STATEMENT — live, read-only (INVOICING_PROPOSAL part D), from
 * GET /api/revenue/charges/statement?orderNo= (revenue.charge.view).
 *
 * One booking: each box with every priced line and where it is in its life
 * (paid, earned, waived, unbilled, invoiced, cancelled), and the receipts that paid
 * them — a voided receipt beside the one that replaced it. It replaces Vector's
 * BookingStatement mock: nothing here edits a price (a discount is a tariff or a
 * waiver, never an edit to a line), and "send to invoice" waits for credit invoicing.
 */

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi } from '@/lib/api/use-api';
import { saveBlob } from '@/lib/api/client';
import { formatContainerNo, formatDateTime } from '@/lib/api/tos';
import { money } from '@/lib/api/revenue';
import { toCsv } from '@/lib/api/reports';
import {
  CHARGE_SOURCE, CHARGE_STATUS, payerLabel, statementPath,
  type BookingStatement, type StatementTotals,
} from '@/lib/api/charges';

export default function BookingStatementPage() {
  return (
    <Suspense fallback={<div className="gecko-cell-meta" style={{ padding: 24 }}>Loading…</div>}>
      <Statement />
    </Suspense>
  );
}

function Statement() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const orderNo = (params.get('orderNo') ?? '').trim().toUpperCase();
  const [typed, setTyped] = useState(orderNo);

  const statement = useApi<BookingStatement>(orderNo ? statementPath(orderNo) : null);
  const s = orderNo ? statement.data : null;
  const cur = s?.receipts[0]?.currencyCode ?? s?.boxes.flatMap(b => b.lines)[0]?.charge.currencyCode ?? 'THB';
  const m = (v: number) => money(v, cur);

  const open = (e: React.FormEvent) => {
    e.preventDefault();
    const no = typed.trim().toUpperCase();
    router.replace(no ? `${pathname}?orderNo=${encodeURIComponent(no)}` : pathname);
  };

  const exportCsv = () => {
    if (!s) return;
    const rows = s.boxes.flatMap(b => b.lines.map(l => [
      b.containerNo ?? '', l.charge.movementCode, l.charge.chargeCode, l.charge.chargeName, l.charge.billTo, l.charge.paymentTermCode,
      l.charge.payerCode, l.charge.quantity, l.charge.unitRate, l.charge.amount, l.charge.taxAmount, l.charge.total,
      l.charge.status, l.receiptNo, l.charge.waiveReason ?? l.charge.cancelReason, l.charge.createdAt,
    ]));
    saveBlob(toCsv(['Container', 'Movement', 'Charge', 'Name', 'Bill to', 'Term', 'Payer', 'Qty', 'Unit rate', 'Amount', 'VAT', 'Total',
      'Status', 'Receipt', 'Reason', 'Created'], rows), `statement-${s.orderNo}.csv`);
  };

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Booking Statement</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            Everything charged on one booking, box by box, and the receipts that paid it.
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportCsv} disabled={!s}>
            <Icon name="download" size={14} /> Export
          </button>
          {orderNo && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={statement.reload}>
              <Icon name="refreshCcw" size={14} /> Refresh
            </button>
          )}
        </div>
      </div>

      <form className="gecko-card" style={{ padding: 14 }} onSubmit={open}>
        <div className="gecko-row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="gecko-form-group" style={{ flex: '1 1 320px' }}>
            <label className="gecko-form-label" htmlFor="orderNo">Order number</label>
            <input id="orderNo" className="gecko-input" autoFocus autoComplete="off" value={typed}
                   style={{ fontFamily: 'var(--gecko-font-mono, monospace)', textTransform: 'uppercase' }}
                   placeholder="Booking / order no." onChange={e => setTyped(e.target.value)} />
          </div>
          <button type="submit" className="gecko-btn gecko-btn-primary" disabled={!typed.trim()}>
            <Icon name="search" size={16} /> Open
          </button>
        </div>
      </form>

      {orderNo && statement.error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{statement.error.title}</div>
            {statement.error.explanation && <div>{statement.error.explanation}</div>}
          </div>
        </div>
      )}

      {!orderNo && (
        <div className="gecko-card">
          <EmptyState icon="fileText" title="Open a booking"
            description="Type an order number to see every line charged on it and the receipts that paid them." />
        </div>
      )}

      {s && (
        <>
          {/* The booking */}
          <div className="gecko-card" style={{ padding: 16 }}>
            <div className="gecko-row gecko-row-between gecko-row-wrap" style={{ gap: 12 }}>
              <div>
                <div className="gecko-mono-strong" style={{ fontSize: 18 }}>{s.orderNo}</div>
                <div className="gecko-cell-meta">
                  {s.orderTypeCode} · {s.bookingStatus.toLowerCase()} · {payerLabel(s.customerCode, s.customerName)}
                  {s.customerName && s.customerCode ? <span className="gecko-mono"> ({s.customerCode})</span> : null}
                </div>
              </div>
              <Totals totals={s.totals} m={m} />
            </div>
          </div>

          {/* Boxes */}
          {s.boxes.length === 0 && (
            <div className="gecko-card"><EmptyState icon="box" title="No boxes on this booking yet" description="Boxes appear as they are assigned." /></div>
          )}
          {s.boxes.map(b => (
            <section key={b.bookingContainerId ?? 'none'} className="gecko-table-card">
              <div className="gecko-row gecko-row-between gecko-row-wrap" style={{ padding: '10px 12px', gap: 8 }}>
                <div className="gecko-row" style={{ gap: 8 }}>
                  {b.containerNo
                    ? <Link href={`/units/unit-inquiry?no=${encodeURIComponent(b.containerNo)}`} className="gecko-mono-strong gecko-link">{formatContainerNo(b.containerNo)}</Link>
                    : <span className="gecko-mono-strong">{b.bookingContainerId ? 'Box not yet named' : 'Lines without a box'}</span>}
                  {b.equipmentTypeCode && <span className="gecko-cell-meta gecko-mono">{b.equipmentTypeCode}</span>}
                  {b.endReason && <span className="gecko-badge gecko-badge-gray">left the booking: {b.endReason.toLowerCase()}</span>}
                </div>
                <Totals totals={b.totals} m={m} compact />
              </div>
              <table className="gecko-table gecko-table-compact">
                <thead>
                  <tr>
                    <th>Movement</th><th>Charge</th><th>Payer</th>
                    <th className="gecko-num">Amount</th><th className="gecko-num">VAT</th><th className="gecko-num">Total</th>
                    <th>Status</th><th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {b.lines.length === 0 && (
                    <tr><td colSpan={8} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 12 }}>Nothing charged on this box yet.</td></tr>
                  )}
                  {b.lines.map(({ charge: c, receiptNo }) => {
                    const st = CHARGE_STATUS[c.status] ?? CHARGE_STATUS.QUOTED;
                    const reason = c.waiveReason ?? c.cancelReason;
                    return (
                      <tr key={c.chargeId} style={c.status === 'CANCELLED' ? { opacity: 0.6 } : undefined}>
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
                          <div className="gecko-cell-meta">{CHARGE_SOURCE[c.source] ?? c.source} · {formatDateTime(c.createdAt)}</div>
                        </td>
                        <td>
                          <div className="gecko-truncate" style={{ maxWidth: 200 }}>{payerLabel(c.payerCode, c.payerName)}</div>
                          <div className="gecko-cell-meta">{c.billTo.toLowerCase()} · {c.paymentTermCode.toLowerCase()}</div>
                        </td>
                        <td className="gecko-num gecko-mono">{money(c.amount, c.currencyCode)}</td>
                        <td className="gecko-num gecko-mono">{money(c.taxAmount, c.currencyCode)}</td>
                        <td className="gecko-num gecko-mono" style={{ fontWeight: 700 }}>{money(c.total, c.currencyCode)}</td>
                        <td>
                          <span className={`gecko-badge ${st.badge}`} title={st.hint}>{st.label}</span>
                          {reason && <div className="gecko-cell-meta gecko-truncate" style={{ maxWidth: 200 }} title={reason}>{reason}</div>}
                        </td>
                        <td className="gecko-mono">{receiptNo ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}

          {/* Receipts */}
          <section className="gecko-table-card">
            <div style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13 }}>Receipts · {s.receipts.length}</div>
            <table className="gecko-table gecko-table-compact">
              <thead>
                <tr><th>Receipt</th><th>Time</th><th>Payer</th><th className="gecko-num">Before VAT</th><th className="gecko-num">VAT</th><th className="gecko-num">Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {s.receipts.length === 0 && (
                  <tr><td colSpan={7} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 12 }}>No receipt has been issued on this booking.</td></tr>
                )}
                {s.receipts.map(r => (
                  <tr key={r.receiptId} style={r.status === 'VOIDED' ? { opacity: 0.6 } : undefined}>
                    <td className="gecko-mono-strong">{r.receiptNo}</td>
                    <td>{formatDateTime(r.receiptAt)}</td>
                    <td className="gecko-truncate" style={{ maxWidth: 220 }}>{r.payerName}</td>
                    <td className="gecko-num gecko-mono">{money(r.subtotal, r.currencyCode)}</td>
                    <td className="gecko-num gecko-mono">{money(r.tax, r.currencyCode)}</td>
                    <td className="gecko-num gecko-mono" style={{ fontWeight: 700 }}>{money(r.total, r.currencyCode)}</td>
                    <td>
                      <span className={`gecko-badge ${r.status === 'VOIDED' ? 'gecko-badge-gray' : 'gecko-badge-success'}`}>{r.status === 'VOIDED' ? 'Voided' : 'Issued'}</span>
                      {r.voidReason && <div className="gecko-cell-meta">{r.voidReason}</div>}
                      {r.replacedByReceiptNo && <div className="gecko-cell-meta">replaced by <span className="gecko-mono">{r.replacedByReceiptNo}</span></div>}
                      {r.replacesReceiptNo && <div className="gecko-cell-meta">replaces <span className="gecko-mono">{r.replacesReceiptNo}</span></div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="gecko-row gecko-row-wrap" style={{ gap: 8 }}>
            <Link href="/billing/cash-window" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="arrowRight" size={13} /> Cash window</Link>
            <Link href="/billing/service-orders" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="clipboardList" size={13} /> Service orders</Link>
          </div>
        </>
      )}
    </div>
  );
}

function Totals({ totals, m, compact = false }: { totals: StatementTotals; m: (v: number) => string; compact?: boolean }) {
  const parts = [
    ['Paid', totals.paid, 'var(--gecko-success-700)'],
    ['Waived', totals.waived, 'var(--gecko-text-secondary)'],
    ['Unbilled', totals.unbilled, 'var(--gecko-warning-700)'],
    ['Invoiced', totals.invoiced, 'var(--gecko-primary-700)'],
    ['Cancelled', totals.cancelled, 'var(--gecko-text-disabled)'],
  ] as const;
  const shown = parts.filter(([label, v]) => v !== 0 || (!compact && label === 'Paid'));
  return (
    <div className="gecko-row gecko-row-wrap" style={{ gap: compact ? 12 : 20 }}>
      {shown.map(([label, v, color]) => (
        <div key={label} style={{ textAlign: 'right' }}>
          <div className="gecko-cell-meta">{label}</div>
          <div className="gecko-mono" style={{ fontWeight: 700, fontSize: compact ? 13 : 18, color }}>{m(v)}</div>
        </div>
      ))}
    </div>
  );
}
