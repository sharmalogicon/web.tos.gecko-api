"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { SendToInvoiceModal, type InvoiceCandidate } from '../statement/_components/StatementModals';
import { Icon } from '@/components/ui/Icon';
import { DateField } from '@/components/ui/DateField';
import { apiDownload, apiGet, saveBlob } from '@/lib/api/client';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useServerList } from '@/lib/api/use-server-list';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { useMovements } from '@/lib/api/lookups';
import { useOrderTypeVocabulary } from '@/lib/api/order-types';
import { formatDate } from '@/lib/format';
import { CHARGE_PERMISSIONS, unbilledPath, type Unbilled } from '@/lib/api/charges';
import {
  PROGRESS_LABELS, UNBILLED_ORDERS_PATH, UNBILLED_PROGRESS, blankUnbilledQuery, money,
  selectionTotals, unbilledExportPath, unbilledLinesPath, unbilledParams,
  type UnbilledLine, type UnbilledOrder, type UnbilledOrdersPage, type UnbilledProgress,
  type UnbilledQuery,
} from '@/lib/api/unbilled-orders';

/**
 * UNBILLED ORDERS — Vector's billing worklist, on §22.
 *
 * Two grids and the relationship between them is the screen: the top lists
 * ORDERS worked and not invoiced; clicking one — or ticking several — shows the
 * CHARGE LINES they would put on an invoice. Ticking is a separate column from
 * clicking, because reading an order and choosing it are different acts, and a
 * clerk reads several before deciding.
 *
 * The lines read is per order (it answers 400 without `OrderNo`), so several
 * ticked orders mean several reads, concatenated.
 */

interface PartyRow { partyCode: string; nameEn: string }
interface OrderTypeRow { orderTypeCode: string; descriptionEn: string; bookingTypeCode?: string | null; isActive?: boolean }

export default function UnbilledOrdersPage_() {
  const router = useRouter();
  const [invoicing, setInvoicing] = useState(false);
  const toast = useToast();
  const { can } = useSession();
  const { branch } = useFacility();
  const branchId = branch?.branchId ?? '';
  const mayView = can(CHARGE_PERMISSIONS.view);

  const [form, setForm] = useState<UnbilledQuery>(blankUnbilledQuery);
  const [applied, setApplied] = useState<UnbilledQuery>(blankUnbilledQuery);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [openOrder, setOpenOrder] = useState<string | null>(null);

  const set = (p: Partial<UnbilledQuery>) => setForm(f => ({ ...f, ...p }));

  const orders = useServerList<UnbilledOrder>(
    UNBILLED_ORDERS_PATH, unbilledParams(applied, branchId), 'orders', !!branchId && mayView);
  const page = orders.data as unknown as UnbilledOrdersPage | null;
  const rows = useMemo(() => orders.rows ?? [], [orders.rows]);

  // The payer summary keeps its place: a different question, worth a glance.
  const summary = useApi<Unbilled>(branchId && mayView ? unbilledPath(branchId) : null);

  const { data: agentRows } = useApiList<PartyRow>('/api/master/parties?role=SHIPPING_LINE&pageSize=200');
  const { data: forwarderRows } = useApiList<PartyRow>('/api/master/parties?role=FORWARDER&pageSize=200');
  const { data: customerRows } = useApiList<PartyRow>('/api/master/parties?role=CUSTOMER&pageSize=200');
  const { data: orderTypeRows } = useApiList<OrderTypeRow>('/api/master/order-types?pageSize=200');
  const { movements } = useMovements();
  const vocabulary = useOrderTypeVocabulary();

  const bookingTypes = vocabulary.data?.bookingTypes ?? [];
  // Vector rebinds the order types to the chosen booking type (`BindOrderType`,
  // line 119) — a clerk filtering EXPORT should not be offered import types.
  const orderTypes = (orderTypeRows ?? []).filter(o =>
    o.isActive !== false && (!form.bookingTypeCode || o.bookingTypeCode === form.bookingTypeCode));

  // ── the lines of whatever is being looked at ──────────────────────────────
  const shown = useMemo(
    () => (picked.size > 0 ? [...picked] : openOrder ? [openOrder] : []),
    [picked, openOrder]);
  /**
   * One piece of state carrying WHAT it was read for, so "still loading" is
   * derived rather than flagged. Flipping a busy bit from inside the effect is
   * a setState during render in disguise, and the compiler refuses it.
   */
  const [loaded, setLoaded] = useState<{ key: string; lines: UnbilledLine[]; error: string | null }>(
    { key: '', lines: [], error: null });
  /** Bumped after an invoice is raised: those lines are INVOICED and must go. */
  const [linesNonce, setLinesNonce] = useState(0);
  const readKey = `${shown.join(',')}|${JSON.stringify(applied)}|${linesNonce}`;
  const shownKey = shown.join(',');

  // Nothing selected is handled at render, not by clearing state here: a
  // setState run straight from an effect makes React render twice for nothing,
  // and the compiler rightly refuses it.
  useEffect(() => {
    if (!branchId || shownKey === '') return;
    let cancelled = false;
    Promise.all(shownKey.split(',')
      .map(o => apiGet<UnbilledLine[]>(unbilledLinesPath(applied, branchId, o))))
      .then(all => { if (!cancelled) setLoaded({ key: readKey, lines: all.flat(), error: null }); })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoaded({
          key: readKey, lines: [],
          error: e instanceof Error ? e.message : 'The charge lines could not be read.',
        });
      });
    return () => { cancelled = true; };
    // The CONTENT of the selection and the filters decide the read.
  }, [readKey, shownKey, branchId, applied]);

  // Stale rows from a previous selection must never show under a new one.
  const fresh = loaded.key === readKey;
  const linesBusy = shownKey !== '' && !fresh;
  const linesError = fresh ? loaded.error : null;
  const visibleLines = fresh ? loaded.lines : [];

  const totals = useMemo(() => selectionTotals(rows, picked), [rows, picked]);

  const search = () => { setApplied(form); setPicked(new Set()); setOpenOrder(null); };
  const reset = () => {
    const blank = blankUnbilledQuery();
    setForm(blank); setApplied(blank); setPicked(new Set()); setOpenOrder(null);
  };

  /**
   * The CASH lines of whatever is shown, and the customer they are owed by.
   *
   * A cash bill is one receipt made out to one customer, so lines from a second
   * payer cannot ride along: the button bills the first payer's lines and says
   * how many it left behind. The charges go in the URL by id, which is what the
   * cash-bill screen ticks.
   */
  const cashBill = useMemo(() => {
    const cash = visibleLines.filter(l => l.paymentTermCode === 'CASH');
    const payers = [...new Set(cash.map(l => l.payerCode).filter((v): v is string => Boolean(v)))];
    const payer = payers[0] ?? '';
    const mine = payer ? cash.filter(l => l.payerCode === payer) : [];
    return { payer, lines: mine, left: cash.length - mine.length, payers: payers.length };
  }, [visibleLines]);

  /**
   * The CREDIT lines of whatever is shown, for `/invoices/send`.
   *
   * One invoice is one payer, one branch, one currency — the API refuses a
   * mixed send outright — so the modal narrows to the first payer and says how
   * many it left behind, the same way the Booking Statement does.
   */
  const creditLines = useMemo<InvoiceCandidate[]>(
    () => visibleLines.filter(l => l.paymentTermCode === 'CREDIT').map(l => ({
      chargeId: l.chargeId,
      paymentTermCode: l.paymentTermCode,
      total: l.total,
      payerCode: l.payerCode,
      payerName: l.payerName,
      chargeCode: l.chargeCode,
      containerNo: l.containerNo,
      currencyCode: l.currencyCode,
    })),
    [visibleLines]);

  const toggle = (orderNo: string) => setPicked(cur => {
    const next = new Set(cur);
    if (next.has(orderNo)) next.delete(orderNo); else next.add(orderNo);
    return next;
  });

  const [exporting, setExporting] = useState(false);
  const exportXlsx = useCallback(async () => {
    setExporting(true);
    try {
      const file = await apiDownload(unbilledExportPath(applied, branchId));
      saveBlob(file.blob, file.filename ?? `unbilled-orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { /* the toast-free path: the button simply stops spinning */ }
    finally { setExporting(false); }
  }, [applied, branchId]);

  if (!mayView) {
    return <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
      You do not have permission to view charges.
    </div>;
  }

  const sailingWins = !!(form.vesselCode.trim() || form.voyage.trim()) && !!(form.from || form.to);

  return (
    <div className="gecko-stack gecko-stack-xl gecko-unbilled-page">
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Unbilled Orders</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
            <span className="gecko-count-badge">{page ? `${orders.total} orders` : '…'}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">{branch?.displayName}</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportXlsx}
            disabled={!branchId || exporting}>
            <Icon name="print" size={13} /> {exporting ? 'Preparing…' : 'Print'}
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={orders.reload}>
            <Icon name="refresh" size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── outstanding, by payer ───────────────────────────────────────── */}
      {summary.data && summary.data.lines > 0 && (
        <div className="gecko-card gecko-card-padded gecko-unbilled-summary">
          <div className="gecko-unbilled-summary-total">
            <div className="gecko-stat-label">Outstanding</div>
            <div className="gecko-unbilled-total">{money(summary.data.total)}</div>
            <div className="gecko-cell-meta">{summary.data.lines} lines</div>
          </div>
          <div className="gecko-unbilled-payers">
            {summary.data.payers.slice(0, 6).map(p => (
              <div key={`${p.billTo}-${p.payerCode}`} className="gecko-unbilled-payer">
                <div className="gecko-unbilled-payer-name">{p.payerName ?? p.payerCode ?? p.billTo}</div>
                <div className="gecko-text-mono">{money(p.total, p.currencyCode)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── the filters ─────────────────────────────────────────────────── */}
      <div className="gecko-card gecko-card-padded gecko-stack">
        <div className="gecko-unbilled-filters">
          <Field label="Agent">
            <Party value={form.agentCode} rows={agentRows} onChange={v => set({ agentCode: v })} />
          </Field>
          <Field label="Forwarder">
            <Party value={form.forwarderCode} rows={forwarderRows} onChange={v => set({ forwarderCode: v })} />
          </Field>
          <Field label="Billing customer">
            <Party value={form.customerCode} rows={customerRows} onChange={v => set({ customerCode: v })} />
          </Field>
          <Field label="Booking - B/L no.">
            <input className="gecko-input" value={form.carrierRef}
              onChange={e => set({ carrierRef: e.target.value.toUpperCase() })} />
          </Field>

          <Field label="Booking type">
            <select className="gecko-input" value={form.bookingTypeCode}
              onChange={e => set({ bookingTypeCode: e.target.value, orderTypeCode: '' })}>
              <option value="">All</option>
              {bookingTypes.map(b => <option key={b.code} value={b.code}>{b.name || b.code}</option>)}
            </select>
          </Field>
          <Field label="Order type">
            <select className="gecko-input" value={form.orderTypeCode}
              onChange={e => set({ orderTypeCode: e.target.value })}>
              <option value="">All</option>
              {orderTypes.map(o => (
                <option key={o.orderTypeCode} value={o.orderTypeCode}>{o.orderTypeCode}</option>
              ))}
            </select>
          </Field>
          <Field label="Movement">
            <select className="gecko-input" value={form.movementCode}
              onChange={e => set({ movementCode: e.target.value })}>
              <option value="">All</option>
              {movements.map(m => <option key={m.movementCode} value={m.movementCode}>{m.movementCode}</option>)}
            </select>
          </Field>
          <Field label="Payment term">
            <select className="gecko-input" value={form.paymentTermCode}
              onChange={e => set({ paymentTermCode: e.target.value })}>
              <option value="">All</option>
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit</option>
            </select>
          </Field>

          <Field label="Vessel">
            <input className="gecko-input gecko-text-mono" value={form.vesselCode}
              onChange={e => set({ vesselCode: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Voyage">
            <input className="gecko-input gecko-text-mono" value={form.voyage}
              onChange={e => set({ voyage: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Charge code">
            <input className="gecko-input gecko-text-mono" value={form.chargeCode}
              onChange={e => set({ chargeCode: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Filter by">
            <select className="gecko-input" value={form.progress}
              onChange={e => set({ progress: e.target.value as UnbilledProgress })}>
              {UNBILLED_PROGRESS.map(p => <option key={p} value={p}>{PROGRESS_LABELS[p]}</option>)}
            </select>
          </Field>

          <Field label="From">
            <DateField value={form.from} max={form.to || undefined} aria-label="From date"
              onChange={v => set({ from: v })} />
          </Field>
          <Field label="To">
            <DateField value={form.to} min={form.from || undefined} aria-label="To date"
              onChange={v => set({ to: v })} />
          </Field>
        </div>

        {sailingWins && (
          <div className="gecko-cell-meta">
            The sailing is the period — the dates are not sent while a vessel or voyage is named.
          </div>
        )}

        <div className="gecko-row gecko-row-end gecko-gap-2">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reset}>Reset</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!branchId} onClick={search}>
            <Icon name="filter" size={13} /> Search
          </button>
        </div>
      </div>

      {orders.error && (
        <div className="gecko-alert gecko-alert-error">{orders.error.message}</div>
      )}

      {/* ── the orders ──────────────────────────────────────────────────── */}
      <div className="gecko-card">
        <div className="gecko-row gecko-row-between gecko-unbilled-head">
          <div className="gecko-card-title">Orders</div>
          <div className="gecko-row gecko-gap-2">
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" disabled={rows.length === 0}
              onClick={() => setPicked(new Set(rows.map(o => o.orderNo)))}>Select all</button>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" disabled={picked.size === 0}
              onClick={() => setPicked(new Set())}>Unselect all</button>
          </div>
        </div>

        {orders.loading ? (
          <div className="gecko-dash-placeholder">Looking…</div>
        ) : rows.length === 0 ? (
          <div className="gecko-dash-placeholder">
            <div>Nothing unbilled. Credit lines appear here once their box has moved through the gate.</div>
            {applied.paymentTermCode === 'CASH' && (
              <div className="gecko-cell-meta gecko-mt-1">
                Cash is collected before the barrier, so a cash filter is normally empty.
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="gecko-table-wrap">
              <table className="gecko-table">
                <thead>
                  <tr>
                    <th className="gecko-unbilled-tick">Select</th>
                    <th>Order no.</th>
                    <th>Booking - B/L no.</th>
                    <th>Sub-B/L</th>
                    <th>Booking date</th>
                    <th>Booking type</th>
                    <th>Order type</th>
                    <th>Agent</th>
                    <th>Customer</th>
                    <th>Vessel</th>
                    <th>Voyage</th>
                    <th>Wharf</th>
                    <th>Payment term</th>
                    <th>Billed to</th>
                    <th className="gecko-num">Boxes</th>
                    <th className="gecko-num">Lines</th>
                    <th className="gecko-num">Amount</th>
                    <th className="gecko-num">VAT</th>
                    <th className="gecko-num">Total</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(o => (
                    <tr key={o.orderNo}
                      className={`gecko-row-clickable${openOrder === o.orderNo ? ' gecko-row-open' : ''}`}
                      onClick={() => setOpenOrder(o.orderNo)}>
                      <td className="gecko-unbilled-tick" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="gecko-checkbox" checked={picked.has(o.orderNo)}
                          aria-label={`Select ${o.orderNo}`} onChange={() => toggle(o.orderNo)} />
                      </td>
                      <td>
                        <Link href={`/bookings/${o.bookingId}`} className="gecko-link gecko-text-mono"
                          onClick={e => e.stopPropagation()}>{o.orderNo}</Link>
                      </td>
                      <td className="gecko-text-mono">{o.carrierRef ?? '—'}</td>
                      <td className="gecko-text-mono">{o.subBlNo ?? '—'}</td>
                      <td>{formatDate(o.bookedAt)}</td>
                      <td>{o.bookingTypeCode}</td>
                      <td>{o.orderTypeCode}</td>
                      <td className="gecko-text-mono">{o.agentCode ?? '—'}</td>
                      <td>{o.customerName ?? o.customerCode ?? '—'}</td>
                      <td className="gecko-text-mono">{o.vesselCode ?? '—'}</td>
                      <td className="gecko-text-mono">{o.voyage ?? '—'}</td>
                      <td>{o.terminalCode ?? '—'}</td>
                      <td>{o.paymentTerms?.join(' · ') || '—'}</td>
                      <td>{o.billTo?.join(' · ') || '—'}</td>
                      <td className="gecko-num">{o.boxes}</td>
                      <td className="gecko-num">{o.lines}</td>
                      <td className="gecko-num gecko-text-mono">{o.amount.toFixed(2)}</td>
                      <td className="gecko-num gecko-text-mono">{o.tax.toFixed(2)}</td>
                      <td className="gecko-num gecko-text-mono">{money(o.total, o.currencyCode)}</td>
                      <td>
                        <span className="gecko-cell-meta">{o.stepsDone}/{o.stepsTotal}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {page && (
                  <tfoot>
                    {/* These come back beside totalCount, so they cover every
                        matching order — not only the rows on this page. */}
                    <tr className="gecko-unbilled-foot">
                      <td colSpan={15}>
                        All {orders.total} matching order{orders.total === 1 ? '' : 's'}
                      </td>
                      <td className="gecko-num">{page.lines}</td>
                      <td className="gecko-num gecko-text-mono">{page.amount.toFixed(2)}</td>
                      <td className="gecko-num gecko-text-mono">{page.tax.toFixed(2)}</td>
                      <td className="gecko-num gecko-text-mono">{money(page.total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {orders.footer}
          </>
        )}
      </div>

      {/* ── the charge lines ────────────────────────────────────────────── */}
      <div className="gecko-card">
        <div className="gecko-unbilled-head">
          <div className="gecko-card-title">
            Charge lines
            {shown.length === 1 ? <span className="gecko-text-mono"> · {shown[0]}</span> : null}
            {shown.length > 1 ? <span className="gecko-cell-meta"> · {shown.length} orders</span> : null}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="gecko-dash-placeholder">
            Click an order to see what it would put on an invoice, or tick several.
          </div>
        ) : linesBusy ? (
          <div className="gecko-dash-placeholder">Looking…</div>
        ) : linesError ? (
          <div className="gecko-alert gecko-alert-error">{linesError}</div>
        ) : visibleLines.length === 0 ? (
          <div className="gecko-dash-placeholder">Nothing invoiceable on this order.</div>
        ) : (
          <div className="gecko-table-wrap">
            <table className="gecko-table">
              <thead>
                <tr>
                  <th>Container no.</th>
                  <th>Size - type</th>
                  <th>Charge code</th>
                  <th>Description</th>
                  <th>Payment term</th>
                  <th>Billed to</th>
                  <th>Movement</th>
                  <th>EIR</th>
                  <th>Date</th>
                  <th className="gecko-num">Qty</th>
                  <th className="gecko-num">Rate</th>
                  <th className="gecko-num">Amount</th>
                  <th className="gecko-num">VAT</th>
                  <th className="gecko-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map(l => (
                  <tr key={l.chargeId}>
                    <td className="gecko-text-mono">{l.containerNo ?? '—'}</td>
                    <td>{l.equipmentTypeCode ?? '—'}</td>
                    <td className="gecko-text-mono">
                      {l.chargeCode}
                      {l.isTripCharge && <span className="gecko-trip-badge">per truck</span>}
                    </td>
                    <td>{l.chargeName ?? '—'}</td>
                    <td>{l.paymentTermCode}</td>
                    <td>{l.payerName ?? l.payerCode ?? l.billTo}</td>
                    <td>{l.movementCode ?? '—'}</td>
                    <td className="gecko-text-mono">{l.eirNo ?? '—'}</td>
                    <td>{formatDate(l.pricedForDate)}</td>
                    <td className="gecko-num">{l.quantity}</td>
                    <td className="gecko-num gecko-text-mono">{l.unitRate?.toFixed(2) ?? '—'}</td>
                    <td className="gecko-num gecko-text-mono">{l.amount.toFixed(2)}</td>
                    <td className="gecko-num gecko-text-mono">{l.taxAmount.toFixed(2)}</td>
                    <td className="gecko-num gecko-text-mono">{money(l.total, l.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── what the ticked orders would become ─────────────────────────── */}
      <div className="gecko-card gecko-card-padded gecko-unbilled-actions">
        <div className="gecko-row gecko-gap-4 gecko-flex-wrap">
          <Fact label="Orders" value={String(totals.orders)} />
          <Fact label="Boxes" value={String(totals.boxes)} />
          <Fact label="Lines" value={String(totals.lines)} />
          <Fact label="Amount" value={totals.amount.toFixed(2)} />
          <Fact label="VAT" value={totals.tax.toFixed(2)} />
          <Fact label="Total" value={money(totals.total, totals.currencyCode)} strong />
        </div>
        <div className="gecko-row gecko-gap-2 gecko-flex-wrap">
          {/* Cash does not go to an invoice at all (API owner, 2026-10-08):
              POST /invoices/send is credit only, and a receipt is final, so
              "Existing cash invoice" was removed rather than left disabled.
              This is the whole cash side now, and it works end to end. */}
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={cashBill.lines.length === 0}
            title={cashBill.lines.length === 0
              ? 'Tick an order with open CASH charges.'
              : cashBill.payers > 1
                ? `One customer per receipt — ${cashBill.left} line(s) of another payer are left behind.`
                : `${cashBill.lines.length} cash line(s) of ${cashBill.payer}`}
            onClick={() => router.push(`/billing/cash-bills?${new URLSearchParams({
              customerCode: cashBill.payer,
              charges: cashBill.lines.map(l => l.chargeId).join(','),
            }).toString()}`)}>
            <Icon name="print" size={13} /> New cash invoice
          </button>
          {/* CREDIT, now real. `POST /api/revenue/invoices/send` has issued credit
              invoices since 2026-10-07; this page simply never called it and kept
              a disabled placeholder saying it was not built.

              "Existing credit invoice" is GONE rather than disabled: the API
              refuses an invoiceNo outright — InvoiceEndpoints.cs:51, "… is
              issued and final." An invoice is raised once and never appended
              to, exactly as a receipt is. */}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
            disabled={creditLines.length === 0}
            title={creditLines.length === 0
              ? 'Tick an order with open CREDIT charges.'
              : `${creditLines.length} credit line(s) on the shown orders`}
            onClick={() => setInvoicing(true)}>
            <Icon name="send" size={13} /> New credit invoice
          </button>
        </div>
      </div>

      {invoicing && (
        <SendToInvoiceModal
          kind="new" term="CREDIT" selected={creditLines}
          currency={creditLines[0]?.currencyCode ?? 'THB'}
          onClose={() => setInvoicing(false)}
          onDone={message => {
            setInvoicing(false);
            toast.toast({ variant: 'success', title: 'Credit invoice issued', message });
            // The lines are INVOICED now, so the worklist they came from has to
            // be re-read or it still offers them.
            setLinesNonce(n => n + 1);
          }} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gecko-form-group">
      <label className="gecko-form-label">{label}</label>
      {children}
    </div>
  );
}

function Party({ value, rows, onChange }: {
  value: string; rows: PartyRow[] | null; onChange: (v: string) => void;
}) {
  return (
    <select className="gecko-input" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">All</option>
      {(rows ?? []).map(p => (
        <option key={p.partyCode} value={p.partyCode}>{p.partyCode} - {p.nameEn}</option>
      ))}
    </select>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="gecko-stat-label">{label}</div>
      <div className={`gecko-text-mono${strong ? ' gecko-unbilled-total' : ''}`}>{value}</div>
    </div>
  );
}
