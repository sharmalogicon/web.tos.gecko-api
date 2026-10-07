"use client";

/**
 * ONE INVOICE — the June 2026 document, bound to
 * GET /api/revenue/invoices/{invoiceId} (live 2026-10-07).
 *
 * The June page was a printable A4 canvas over four hardcoded lines. The canvas
 * is kept, because it is what a customer is sent; the four lines are now the
 * invoice's own, and the depot's own name and tax ID come from the branch
 * rather than being typed into the markup.
 *
 * Gone because the API does not have them and inventing them on a tax document
 * is the worst place to invent anything: the due date (there is a payment term,
 * not a date), "Send via email", and the PDF button — the API has no PDF
 * endpoint yet, so Print is the honest way out and the page is laid out for it.
 *
 * Its LINE shape is unsettled: the published schema is the subscription billing
 * line, not the charge line that was agreed. Reported 2026-10-07; this page
 * reads either (see lineView in lib/api/invoices.ts) and shows a column only
 * when the data actually carries it.
 */

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarcodeDisplay } from '@/components/ui/BarcodeDisplay';
import { useApi } from '@/lib/api/use-api';
import { useFacility } from '@/lib/api/facility';
import { amount } from '@/lib/api/charges';
import { INVOICE_STATUS, invoicePath, lineView, type InvoiceDetail } from '@/lib/api/invoices';

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = (() => {
    try { return decodeURIComponent(params.id); } catch { return params.id; }
  })();

  const { branch, company } = useFacility();
  const { data, error, loading } = useApi<InvoiceDetail>(invoiceId ? invoicePath(invoiceId) : null);
  const inv = data?.invoice;
  const lines = (data?.lines ?? []).map(lineView);

  // Only draw a column the data actually fills. An empty "Container" column on
  // a tax document reads as "no container", which is not the same as "the API
  // did not send one".
  const hasUnit = lines.some(l => l.containerNo || l.movementCode || l.orderNo);
  const hasTax = lines.some(l => l.taxAmount !== null);

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 940, margin: '0 auto', paddingBottom: 60 }}>

      <div className="gecko-row gecko-row-between">
        <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
          <Link href="/billing/invoices" className="gecko-breadcrumb-item">Invoices</Link>
          <span className="gecko-breadcrumb-sep" />
          <span className="gecko-breadcrumb-current gecko-mono">{inv?.invoiceNo ?? invoiceId}</span>
        </nav>
        <div className="gecko-row gecko-stack-md gecko-no-print">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => window.print()} disabled={!inv}>
            <Icon name="printer" size={15} /> Print
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <strong>{error.status === 404 ? 'No such invoice' : error.title}</strong>
            <div>{error.status === 404
              ? 'It may have been raised in another branch, or the link is stale.'
              : error.explanation ?? error.message}</div>
          </div>
        </div>
      )}

      {loading && !data && <div className="gecko-card gecko-card-padded gecko-cell-meta">Loading the invoice…</div>}

      {!loading && !inv && !error && (
        <div className="gecko-card">
          <EmptyState icon="invoice" title="Nothing to show" description="This invoice could not be read." />
        </div>
      )}

      {inv && (
        <div className="gecko-invoice-sheet">

          <div className="gecko-row gecko-row-start gecko-row-between">
            <div>
              <h1 className="gecko-invoice-title">TAX INVOICE</h1>
              <div className="gecko-mono gecko-invoice-no">{inv.invoiceNo}</div>
              <div className="gecko-mt-3">
                <span className={`gecko-badge ${INVOICE_STATUS[inv.status]?.badge ?? 'gecko-badge-gray'}`}>
                  {INVOICE_STATUS[inv.status]?.label ?? inv.status}
                </span>
                <span className="gecko-badge gecko-badge-gray gecko-ml-2">{inv.paymentTermCode}</span>
              </div>
            </div>

            {/* Who is issuing it. The depot's own name and tax ID come from
                the branch's company — on a tax document, typed-in markup is the
                one thing that must never be wrong. */}
            <div className="gecko-invoice-from">
              <div className="gecko-invoice-from-name">{company?.nameEn ?? branch?.displayName ?? 'GECKO'}</div>
              {company?.nameLocal && <div>{company.nameLocal}</div>}
              {branch && <div>{branch.displayName}</div>}
              {company?.taxId && <div>Tax ID: <span className="gecko-mono">{company.taxId}</span></div>}
            </div>

            <div className="gecko-stack gecko-stack-sm gecko-invoice-barcode">
              <BarcodeDisplay value={inv.invoiceNo} variant="qr" qrSize={88} showValue={false} />
              <div className="gecko-eyebrow gecko-invoice-barcode-note">Scan to verify</div>
            </div>
          </div>

          <div className="gecko-invoice-parties">
            <div className="gecko-flex-1">
              <div className="gecko-eyebrow gecko-mb-2">Bill to</div>
              <div className="gecko-invoice-payer">{inv.payerName ?? inv.payerCode ?? '—'}</div>
              <div className="gecko-cell-meta">
                {inv.payerCode && <>Code <span className="gecko-mono">{inv.payerCode}</span> · </>}
                {inv.billTo.toLowerCase()}
              </div>
            </div>

            <div className="gecko-kv-grid gecko-invoice-meta">
              <div className="gecko-kv-label">Issued</div>
              <div className="gecko-kv-value">{inv.issuedAt.slice(0, 10)}</div>
              <div className="gecko-kv-label">Terms</div>
              <div className="gecko-kv-value">{inv.paymentTermCode}</div>
              <div className="gecko-kv-label">Currency</div>
              <div className="gecko-kv-value">{inv.currencyCode}</div>
              <div className="gecko-kv-label">Lines</div>
              <div className="gecko-kv-value">{inv.lines}</div>
            </div>
          </div>

          <table className="gecko-table gecko-invoice-lines">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Description</th>
                {hasUnit && <th style={{ width: 150 }}>Unit</th>}
                <th className="gecko-num" style={{ width: 70 }}>Qty</th>
                <th className="gecko-num" style={{ width: 110 }}>Rate</th>
                {hasTax && <th className="gecko-num" style={{ width: 100 }}>VAT</th>}
                <th className="gecko-num" style={{ width: 120 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr><td colSpan={7} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 20 }}>
                  This invoice carries no lines.
                </td></tr>
              )}
              {lines.map(l => (
                <tr key={l.key}>
                  <td className="gecko-cell-meta">{l.no}</td>
                  <td>
                    <div className="gecko-cell-primary">
                      {l.code && <span className="gecko-mono-strong">{l.code} </span>}{l.text}
                    </div>
                    {l.orderNo && <div className="gecko-cell-meta gecko-mono">{l.orderNo}</div>}
                  </td>
                  {hasUnit && (
                    <td className="gecko-mono gecko-cell-meta">
                      {l.containerNo ?? '—'}
                      {l.movementCode && <div>{l.movementCode}</div>}
                    </td>
                  )}
                  <td className="gecko-num gecko-mono">{l.quantity}</td>
                  <td className="gecko-num gecko-mono">{amount(l.unitRate, inv.currencyCode)}</td>
                  {hasTax && <td className="gecko-num gecko-mono">{amount(l.taxAmount ?? 0, inv.currencyCode)}</td>}
                  <td className="gecko-num gecko-mono" style={{ fontWeight: 600 }}>{amount(l.amount, inv.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="gecko-row gecko-row-right">
            <div className="gecko-invoice-totals">
              <Total label="Subtotal" value={amount(inv.amount, inv.currencyCode)} />
              <Total label="VAT" value={amount(inv.tax, inv.currencyCode)} rule />
              <Total label="Total due" value={amount(inv.total, inv.currencyCode)} big />
            </div>
          </div>

          {inv.remarks && (
            <div className="gecko-invoice-remarks">
              <div className="gecko-eyebrow gecko-mb-1">Remarks</div>
              {inv.remarks}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Total({ label, value, rule, big }: { label: string; value: string; rule?: boolean; big?: boolean }) {
  return (
    <div className={`gecko-invoice-total-row${rule ? ' gecko-invoice-total-rule' : ''}${big ? ' gecko-invoice-total-big' : ''}`}>
      <span>{label}</span>
      <span className="gecko-mono">{value}</span>
    </div>
  );
}
