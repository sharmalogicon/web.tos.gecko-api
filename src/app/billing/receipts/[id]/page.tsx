"use client";

/**
 * CUSTOMER CASH BILL — one receipt, laid out as Vector lays it out.
 *
 * In Thailand the receipt IS the tax invoice, so this is the document a cash
 * customer is handed and the one they query weeks later. The desktop reads in
 * three blocks and so does this: who it is made out to, what was charged, and
 * how it was paid.
 *
 * It is NOT the cash window. The window is where money is taken; this is the
 * record of a receipt already issued — reachable from the Booking Statement's
 * receipts list, from a charge line, and by its own URL.
 *
 * Bound to GET /api/revenue/window/receipts/{id}. Print hands over the API's
 * own PDF rather than printing the screen: that PDF is the legal document.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/problem';
import { amount } from '@/lib/api/charges';
import { formatContainerNo } from '@/lib/api/tos';
import {
  canChangePayer, canDivide, channelLabel, downloadReceiptPdf, receiptPath, voidReceipt, type Receipt,
} from '@/lib/api/receipts';
import { SplitReceiptModal } from '../../_components/SplitReceiptModal';

export default function CashBillPage() {
  const params = useParams<{ id: string }>();
  const id = (() => { try { return decodeURIComponent(params.id); } catch { return params.id; } })();

  const { data, error, loading, reload } = useApi<Receipt>(id ? receiptPath(id) : null);
  const { user } = useSession();
  const { toast } = useToast();
  const [voiding, setVoiding] = useState(false);
  const [splitting, setSplitting] = useState(false);

  const mayVoid = (user?.permissions ?? []).includes('revenue.receipt.void');
  // Changing who a receipt is made out to re-points a tax document, so it is
  // the same right as voiding one.
  const maySplit = mayVoid;
  const r = data;
  const voided = r?.status === 'VOIDED';
  const m = (v: number) => amount(v, r?.currencyCode ?? 'THB');

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 48 }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
            {r?.orderNo
              ? <Link href={`/billing/statement?orderNo=${encodeURIComponent(r.orderNo)}`} className="gecko-breadcrumb-item">{r.orderNo}</Link>
              : <Link href="/billing/statement" className="gecko-breadcrumb-item">Booking Statement</Link>}
            <span className="gecko-breadcrumb-sep" />
            <span className="gecko-breadcrumb-current gecko-mono">{r?.receiptNo ?? id}</span>
          </nav>
          <div className="gecko-row gecko-row-baseline gecko-stack-md gecko-mt-1">
            <h1 className="gecko-page-title">Customer Cash Bill</h1>
            {r && (
              <span className={`gecko-badge ${voided ? 'gecko-badge-gray' : 'gecko-badge-success'}`}>
                {voided ? 'Voided' : 'Issued'}
              </span>
            )}
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            The receipt is the tax invoice. This is the record of one already issued.
          </div>
        </div>
        <div className="gecko-toolbar gecko-no-print">
          {r && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
              onClick={() => void downloadReceiptPdf(r.receiptId, r.receiptNo)}>
              <Icon name="print" size={14} /> Receipt PDF
            </button>
          )}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload} disabled={!r}>
            <Icon name="refreshCcw" size={14} /> Refresh
          </button>
          {/* Any issued receipt can be made out to somebody else; only a gate
              receipt of today can have its lines shared out, so the label says
              which of the two is on offer. */}
          {r && maySplit && canChangePayer(r) && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setSplitting(true)}
              title={canDivide(r)
                ? 'Share the charges between payers, or change who the whole receipt is made out to'
                : 'Change who this receipt is made out to — it keeps its number'}>
              <Icon name="transferH" size={14} />
              {canDivide(r) ? 'Split / change payer' : 'Change payer'}
            </button>
          )}
          {r && mayVoid && !voided && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setVoiding(true)}>
              <Icon name="fileX" size={14} /> Void
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <strong>{error.status === 404 ? 'No such receipt' : error.title}</strong>
            <div>{error.status === 404
              ? 'It may belong to another branch, or the link is stale.'
              : error.explanation ?? error.message}</div>
          </div>
        </div>
      )}

      {loading && !r && <div className="gecko-card gecko-card-padded gecko-cell-meta">Loading the receipt…</div>}
      {!loading && !r && !error && (
        <div className="gecko-card"><EmptyState icon="invoice" title="Nothing to show" description="This receipt could not be read." /></div>
      )}

      {r && (
        <>
          {voided && (
            <div role="status" className="gecko-alert gecko-alert-warning">
              <Icon name="alertCircle" size={16} />
              <span>
                This receipt was voided{r.voidedAt ? ` on ${r.voidedAt.slice(0, 10)}` : ''}
                {r.voidReason ? ` — ${r.voidReason}` : ''}.
                {r.replacedByReceiptNo && <> It was replaced by <strong>{r.replacedByReceiptNo}</strong>.</>}
                {/* A split names several replacements, each its own document. */}
                {(r.splitIntoReceiptNos?.length ?? 0) > 0 && (
                  <span className="gecko-split-trail">
                    It was split into
                    {r.splitIntoReceiptNos!.map(no => (
                      <Link key={no} className="gecko-link gecko-mono" href={`/billing/receipts/by-no/${encodeURIComponent(no)}`}>{no}</Link>
                    ))}
                  </span>
                )}
              </span>
            </div>
          )}

          {r.splitFromReceiptNo && (
            <div role="status" className="gecko-alert gecko-alert-info">
              <Icon name="transferH" size={16} />
              <span>
                This is one part of <strong className="gecko-mono">{r.splitFromReceiptNo}</strong>, a gate
                receipt that was split between its payers. No money moved — only who it is made out to.
              </span>
            </div>
          )}

          {/* ── General information ─────────────────────────────────────── */}
          <section className="gecko-card gecko-card-padded gecko-stack-sm">
            <div className="gecko-stat-label">General information</div>
            <div className="gecko-bill-head">
              <div className="gecko-bill-party">
                <div className="gecko-kv-label">Customer</div>
                <div className="gecko-bill-party-name">{r.payerName ?? 'Walk-in (cash)'}</div>
                {r.payerAddress && <div className="gecko-cell-meta gecko-bill-address">{r.payerAddress}</div>}
                <div className="gecko-cell-meta">
                  {r.payerTaxId && <>Tax ID <span className="gecko-mono">{r.payerTaxId}</span></>}
                  {r.payerBranchNo && <> · Branch <span className="gecko-mono">{r.payerBranchNo}</span></>}
                </div>
              </div>
              <div className="gecko-kv-grid gecko-bill-meta">
                <Kv label="Cash receipt no" value={r.receiptNo} mono />
                <Kv label="Receipt date" value={r.receiptAt.slice(0, 10)} />
                <Kv label="Booking / order" value={r.orderNo ?? '—'} mono
                  href={r.orderNo ? `/billing/statement?orderNo=${encodeURIComponent(r.orderNo)}` : undefined} />
                <Kv label="Depot" value={r.branchCode ?? '—'} />
              </div>
            </div>
          </section>

          {/* ── Charges ─────────────────────────────────────────────────── */}
          <section className="gecko-table-card">
            <div className="gecko-table-toolbar">
              <Icon name="invoice" size={13} />
              <span>Charge details · <strong>{r.lines.length}</strong></span>
              <span className="gecko-table-toolbar-spacer" />
              <span>Total <strong className="gecko-mono">{m(r.total)}</strong></span>
            </div>
            <table className="gecko-table gecko-table-compact gecko-table-fixed">
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>#</th>
                  <th style={{ width: '13%' }}>Charge</th>
                  <th>Description</th>
                  <th style={{ width: '14%' }}>Container</th>
                  <th style={{ width: '10%' }}>Movement</th>
                  <th className="gecko-num" style={{ width: '7%' }}>Qty</th>
                  <th className="gecko-num" style={{ width: '11%' }}>Sell rate</th>
                  <th className="gecko-num" style={{ width: '10%' }}>Tax</th>
                  <th className="gecko-num" style={{ width: '12%' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {r.lines.length === 0 && (
                  <tr><td colSpan={9} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 16 }}>
                    This receipt carries no charge lines.
                  </td></tr>
                )}
                {r.lines.map(l => (
                  <tr key={l.lineNo}>
                    <td className="gecko-cell-meta">{l.lineNo}</td>
                    <td className="gecko-mono-strong">{l.chargeCode}</td>
                    <td>
                      <span className="gecko-cell-tight">{l.description ?? '—'}</span>
                      {l.serviceFrom && (
                        <span className="gecko-cell-meta">{l.serviceFrom} → {l.serviceTo ?? '…'}</span>
                      )}
                    </td>
                    <td className="gecko-mono">{l.containerNo ? formatContainerNo(l.containerNo) : '—'}</td>
                    <td className="gecko-mono gecko-cell-meta">{l.movementCode ?? '—'}</td>
                    <td className="gecko-num gecko-mono">
                      {l.quantity}
                      {l.billingUnitCode && <span className="gecko-cell-meta"> {l.billingUnitCode.toLowerCase()}</span>}
                    </td>
                    <td className="gecko-num gecko-mono">{m(l.unitRate)}</td>
                    <td className="gecko-num gecko-mono">{m(l.taxAmount)}</td>
                    <td className="gecko-num gecko-mono" style={{ fontWeight: 700 }}>{m(l.amount + l.taxAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="gecko-bill-foot">
            {/* ── How it was paid ───────────────────────────────────────── */}
            <section className="gecko-card gecko-card-padded gecko-stack-sm">
              <div className="gecko-stat-label">Payment</div>
              {r.payments.length === 0 && <div className="gecko-cell-meta">No payment recorded.</div>}
              {r.payments.map((p, i) => (
                <div key={`${p.channel}-${i}`} className="gecko-bill-payment">
                  <div className="gecko-row gecko-row-between">
                    <span><strong>{channelLabel(p.channel)}</strong></span>
                    <span className="gecko-mono">{m(p.amount)}</span>
                  </div>
                  {(p.bankName || p.referenceNo) && (
                    <div className="gecko-cell-meta">
                      {p.bankName}{p.bankName && p.referenceNo ? ' · ' : ''}
                      {p.referenceNo && <span className="gecko-mono">{p.referenceNo}</span>}
                    </div>
                  )}
                  {p.tendered !== null && p.tendered > p.amount && (
                    <div className="gecko-cell-meta">
                      tendered {m(p.tendered)} · change {m(p.change ?? p.tendered - p.amount)}
                    </div>
                  )}
                </div>
              ))}

              {r.coupons.length > 0 && (
                <>
                  <div className="gecko-stat-label gecko-mt-3">Coupons</div>
                  {r.coupons.map(c => (
                    <div key={c.couponRef} className="gecko-row gecko-row-between gecko-cell-meta">
                      <span className="gecko-mono">{c.couponRef}</span>
                      <span>
                        {c.containerNo ? formatContainerNo(c.containerNo) : '—'}
                        {c.movementCode ? ` · ${c.movementCode}` : ''}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </section>

            {/* ── What it comes to ──────────────────────────────────────── */}
            <section className="gecko-card gecko-card-padded">
              <div className="gecko-stat-label gecko-mb-2">Payment details</div>
              <Total label="Selling amount" value={m(r.subtotal)} />
              <Total label="Tax amount" value={m(r.tax)} />
              <Total label="Total amount" value={m(r.total)} rule strong />
              {r.withholdingTaxAmount > 0 && (
                <Total
                  label={`W/H tax${r.withholdingTaxRate ? ` (${r.withholdingTaxRate}%)` : ''}`}
                  value={`− ${m(r.withholdingTaxAmount)}`} />
              )}
              <Total label="Nett amount" value={m(r.nettAmount)} big />
              {r.change > 0 && <Total label="Change given" value={m(r.change)} />}
            </section>
          </div>
        </>
      )}

      {r && splitting && (
        <SplitReceiptModal receiptId={r.receiptId}
          onClose={() => setSplitting(false)}
          onDone={made => {
            setSplitting(false);
            // One part is a change of payer IN PLACE — same id, same number —
            // so this page is simply re-read. Several parts keep the original
            // as the first and add new numbers; nothing is voided either way.
            if (made.length === 1) {
              toast({
                variant: 'success',
                title: 'Payer changed',
                message: `${made[0].receiptNo} is now made out to ${made[0].payerName ?? 'the new payer'}.`,
              });
            } else {
              const [first, ...rest] = made;
              toast({
                variant: 'success',
                title: `Split into ${made.length} receipts`,
                message: `${first.receiptNo} kept the first part; new: ${rest.map(x => x.receiptNo).join(' · ')}.`,
              });
            }
            reload();
          }} />
      )}

      {r && voiding && (
        <VoidDialog
          receiptNo={r.receiptNo}
          total={m(r.total)}
          onClose={() => setVoiding(false)}
          onDone={() => {
            setVoiding(false);
            toast({ variant: 'success', title: 'Receipt voided', message: r.receiptNo });
            reload();
          }}
          receiptId={r.receiptId}
        />
      )}
    </div>
  );
}

function Kv({ label, value, mono, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  return (
    <div className="gecko-kv-row">
      <div className="gecko-kv-label">{label}</div>
      <div className={`gecko-kv-value${mono ? ' gecko-mono' : ''}`}>
        {href ? <Link href={href} className="gecko-link">{value}</Link> : value}
      </div>
    </div>
  );
}

function Total({ label, value, rule, strong, big }: {
  label: string; value: string; rule?: boolean; strong?: boolean; big?: boolean;
}) {
  return (
    <div className={`gecko-invoice-total-row${rule ? ' gecko-invoice-total-rule' : ''}${big ? ' gecko-invoice-total-big' : ''}`}>
      <span>{label}</span>
      <span className={`gecko-mono${strong ? ' gecko-mono-strong' : ''}`}>{value}</span>
    </div>
  );
}

/**
 * Voiding a receipt is not undoing a mistake quietly: the number stays, the
 * reason stays, and the replacement points back at it. So the reason is
 * required and the dialog says what survives.
 */
function VoidDialog({ receiptId, receiptNo, total, onClose, onDone }: {
  receiptId: string; receiptNo: string; total: string; onClose: () => void; onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ title: string; detail: string } | null>(null);
  const ready = reason.trim().length >= 3 && !busy;

  async function go() {
    if (!ready) return;
    setBusy(true);
    setProblem(null);
    try {
      await voidReceipt(receiptId, reason.trim());
      onDone();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'The receipt could not be voided.');
      setProblem({ title: err.title || 'Could not void it', detail: err.explanation ?? err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="sm" closeOnBackdrop={false}
      title={`Void ${receiptNo}?`}
      subtitle={`${total} was taken on it.`}
      footer={
        <>
          <span className="gecko-modal-footer-note gecko-flex-1">{ready ? '' : 'Say why it is being voided.'}</span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-danger gecko-btn-sm" disabled={!ready} onClick={go}>
            <Icon name="fileX" size={13} /> {busy ? 'Voiding…' : 'Void it'}
          </button>
        </>
      }>
      <div className="gecko-stack">
        {problem && (
          <div role="alert" className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={18} />
            <div><strong>{problem.title}</strong><div>{problem.detail}</div></div>
          </div>
        )}
        <div className="gecko-alert gecko-alert-warning">
          <Icon name="alertCircle" size={16} />
          <span>
            The receipt stays on record as voided, with this reason and your name. Its charges go
            back to unpaid; take the money again at the cash window to issue a replacement.
          </span>
        </div>
        <div className="gecko-form-group">
          <label className="gecko-form-label gecko-form-label-required" htmlFor="voidReason">Reason</label>
          <textarea id="voidReason" className="gecko-input gecko-textarea" rows={3} maxLength={300} autoFocus
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Wrong customer — reissued on the correct one" />
        </div>
      </div>
    </Modal>
  );
}
