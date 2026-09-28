"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { ProblemAlert, problemOf, type Problem } from './ProblemAlert';
import { useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import {
  CHANNEL_LABEL, PAYMENT_CHANNELS, WINDOW_PERMISSIONS, formatBaht, isPayable, partyName, toSatang,
  type CreateReceiptRequest, type PartyLookup, type PaymentChannel, type QuoteLine, type Receipt, type Shift,
  type WaiveRequest, type WindowBooking, type WindowBox,
} from '@/lib/api/window';
import { DrawerBar } from './DrawerBar';
import { ShiftReceipts } from './ShiftReceipts';
import { ReceiptView, usePrintReceipt } from './ReceiptView';

/**
 * THE CASH WINDOW — live against /api/revenue/window.
 *
 * A driver arrives with an order number. The cashier types it, sees what each
 * box's next movement costs (lift + storage to "paid until" + 7% VAT), takes the
 * money and hands over the receipt, which is what releases the box at the gate.
 * KORAKIT does ~140 of these a day, so the path is: number, Enter, one button.
 *
 * The screen never prices anything: every baht shown came from the quote, and
 * the receipt is posted with expectedTotal = the total shown, so a tariff that
 * moved between the quote and the button is a 409, not a silent overcharge.
 */

interface Branch { branchId: string; branchCode: string; displayName: string; isActive: boolean }

interface PaymentRow {
  channel: PaymentChannel;
  amount: string;
  tendered: string;
  referenceNo: string;
  bankName: string;
}

const CASH_ROW: PaymentRow = { channel: 'CASH', amount: '', tendered: '', referenceNo: '', bankName: '' };

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const shortDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—');

export default function CashWindowPage() {
  const { user, status, branchesFor, canAt } = useSession();
  const toast = useToast();
  const printReceipt = usePrintReceipt();

  // ── depot ──
  const { data: branchRows } = useApiList<Branch>(status === 'authenticated' ? '/api/branches?pageSize=100' : null);
  const myBranches = useMemo(() => branchesFor(WINDOW_PERMISSIONS.collect), [branchesFor]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const activeBranch = branchId ?? myBranches[0] ?? null;
  const branchLabel = useCallback((id: string | null) => {
    const b = branchRows?.find(x => x.branchId === id);
    return b ? `${b.branchCode} · ${b.displayName}` : (id ? id.slice(0, 8) : '—');
  }, [branchRows]);
  const depotName = branchRows?.find(x => x.branchId === activeBranch)?.displayName ?? 'Depot';

  // ── drawer ──
  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftNonce, setShiftNonce] = useState(0);
  const [shiftReadFor, setShiftReadFor] = useState<string | null>(null);
  const shiftLoading = shiftReadFor !== `${activeBranch}:${shiftNonce}`;
  const loadShift = useCallback(() => setShiftNonce(n => n + 1), []);
  useEffect(() => {
    if (!activeBranch || status !== 'authenticated') return;
    let cancelled = false;
    const key = `${activeBranch}:${shiftNonce}`;
    apiGet<Shift>(`/api/revenue/window/shifts/current?branchId=${activeBranch}`)
      .then(s => { if (!cancelled) setShift(s); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setShift(null);
        // 404 is the ordinary "no open drawer"; anything else is worth saying.
        if (!(err instanceof ApiError && err.status === 404))
          toast.toast({ variant: 'danger', title: err instanceof ApiError ? err.title : 'Drawer', message: err instanceof ApiError ? (err.explanation ?? '') : 'Could not read the drawer.' });
      })
      .finally(() => { if (!cancelled) setShiftReadFor(key); });
    return () => { cancelled = true; };
  }, [activeBranch, status, shiftNonce, toast]);

  // ── the quote ──
  const [orderNo, setOrderNo] = useState('');
  // '' = "the depot's today", which only the server knows (branch time zone, not this browser's clock).
  const [paidUntil, setPaidUntil] = useState('');
  const [booking, setBooking] = useState<WindowBooking | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<Problem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── payment ──
  const [payments, setPayments] = useState<PaymentRow[]>([CASH_ROW]);
  const [payerName, setPayerName] = useState('');
  const [payerTaxId, setPayerTaxId] = useState('');
  const [payerBranchNo, setPayerBranchNo] = useState('');
  const [payerAddress, setPayerAddress] = useState('');
  const [fullInvoice, setFullInvoice] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<Problem | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [waiving, setWaiving] = useState<{ box: WindowBox; line: QuoteLine } | null>(null);

  const orderInput = useRef<HTMLInputElement>(null);
  const tenderedInput = useRef<HTMLInputElement>(null);

  const quote = useCallback(async (order: string, until: string, keepSelection: boolean) => {
    const no = order.trim().toUpperCase();
    if (!no) return;
    setQuoting(true); setQuoteError(null); setPayError(null);
    try {
      const answer = await apiGet<WindowBooking>(
        `/api/revenue/window/bookings?orderNo=${encodeURIComponent(no)}${until ? `&paidUntil=${until}` : ''}`);
      setBooking(answer);
      setOrderNo(answer.orderNo);
      setPaidUntil(answer.paidUntil ?? (until && until >= answer.today ? until : answer.today));
      const payable = answer.boxes.filter(isPayable).map(b => b.bookingContainerId);
      setSelected(prev => {
        if (!keepSelection) return new Set(payable);
        const kept = payable.filter(id => prev.has(id));
        return new Set(kept.length ? kept : payable);
      });
      if (!keepSelection) {
        setCustomerName(null);
        if (answer.customerCode) {
          apiGet<PartyLookup>(`/api/master/parties/${encodeURIComponent(answer.customerCode)}`)
            .then(p => setCustomerName(partyName(p)))
            .catch(() => setCustomerName(null));
        }
        window.setTimeout(() => tenderedInput.current?.focus(), 0);
      }
    } catch (err) {
      if (!keepSelection) setBooking(null);
      setQuoteError(problemOf(err, 'The window could not be reached.'));
    } finally {
      setQuoting(false);
    }
  }, []);

  function nextDriver() {
    setBooking(null); setReceipt(null); setOrderNo(''); setQuoteError(null); setPayError(null);
    setPayments([CASH_ROW]); setPayerName(''); setPayerTaxId(''); setPayerBranchNo(''); setPayerAddress('');
    setFullInvoice(false); setPaidUntil(''); setSelected(new Set()); setCustomerName(null);
    window.setTimeout(() => orderInput.current?.focus(), 0);
  }

  // ── totals for what is selected — straight from the quote ──
  const chosen = useMemo(() => (booking?.boxes ?? []).filter(b => selected.has(b.bookingContainerId) && isPayable(b)), [booking, selected]);
  const subtotal = toSatang(chosen.flatMap(b => b.due).reduce((s, l) => s + l.amount, 0));
  const vat = toSatang(chosen.flatMap(b => b.due).reduce((s, l) => s + l.taxAmount, 0));
  const total = toSatang(chosen.reduce((s, b) => s + b.total, 0));

  // A single payment row is always the whole amount; a split is typed.
  const rows: PaymentRow[] = payments.length === 1 ? [{ ...payments[0], amount: total.toFixed(2) }] : payments;
  const paid = toSatang(rows.reduce((s, r) => s + (num(r.amount) || 0), 0));
  const cashRow = rows.find(r => r.channel === 'CASH');
  const change = cashRow && !Number.isNaN(num(cashRow.tendered)) ? toSatang(num(cashRow.tendered) - (num(cashRow.amount) || 0)) : 0;

  const payProblem = (() => {
    if (!chosen.length) return 'Pick at least one box to pay for.';
    if (total <= 0) return 'Nothing to pay.';
    if (paid !== total) return `Payments add up to ${formatBaht(paid)}; the receipt is ${formatBaht(total)}.`;
    for (const r of rows) {
      if (!(num(r.amount) > 0)) return 'Every payment must be more than zero.';
      if (r.channel !== 'CASH' && !r.referenceNo.trim()) return `${CHANNEL_LABEL[r.channel]} needs its reference (slip, cheque or approval number).`;
      if (r.channel === 'CASH' && r.tendered.trim() && num(r.tendered) < num(r.amount)) return 'Cash handed over is less than the amount.';
    }
    if (rows.filter(r => r.channel === 'CASH').length > 1) return 'Use one cash line.';
    return null;
  })();

  const mayCollect = canAt(WINDOW_PERMISSIONS.collect, booking?.branchId ?? activeBranch);
  const mayWaive = canAt(WINDOW_PERMISSIONS.waive, booking?.branchId ?? activeBranch);
  const wrongDepot = !!booking && !!activeBranch && booking.branchId !== activeBranch;

  async function takePayment(e?: React.FormEvent) {
    e?.preventDefault();
    if (!booking || payProblem || paying || !shift || wrongDepot) return;
    setPaying(true); setPayError(null);
    try {
      const body: CreateReceiptRequest = {
        bookingId: booking.bookingId,
        bookingContainerIds: chosen.map(b => b.bookingContainerId),
        paidUntil: booking.paidUntil ?? (paidUntil || null), // the day the shown quote was made to
        payer: fullInvoice && (payerName.trim() || payerTaxId.trim())
          ? { name: payerName.trim() || null, taxId: payerTaxId.trim() || null, branchNo: payerBranchNo.trim() || null, address: payerAddress.trim() || null }
          : null,
        payments: rows.map(r => ({
          channel: r.channel,
          amount: toSatang(num(r.amount)),
          tenderedAmount: r.channel === 'CASH' && r.tendered.trim() ? toSatang(num(r.tendered)) : null,
          referenceNo: r.channel !== 'CASH' ? r.referenceNo.trim() : null,
          bankName: r.channel !== 'CASH' && r.bankName.trim() ? r.bankName.trim() : null,
        })),
        expectedTotal: total,
      };
      const issued = await apiSend<Receipt>('POST', '/api/revenue/window/receipts', body);
      setReceipt(issued);
      toast.toast({ variant: 'success', title: issued.receiptNo, message: `${formatBaht(issued.total)} received` });
      loadShift();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      // The server's own title is the heading ("The price changed.", "Your drawer is not open at this branch.").
      setPayError(problemOf(err, 'Payment not taken — the receipt could not be issued.'));
      // The price moved, or someone else paid: show the new truth, never the stale one.
      if (status === 409) void quote(booking.orderNo, paidUntil, true);
    } finally {
      setPaying(false);
    }
  }

  function setRow(i: number, patch: Partial<PaymentRow>) {
    setPayments(ps => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  function splitPayment() {
    setPayments(ps => {
      const first = { ...ps[0], amount: ps.length === 1 ? total.toFixed(2) : ps[0].amount };
      return [first, ...ps.slice(1), { ...CASH_ROW, channel: 'TRANSFER', amount: '0.00' }];
    });
  }

  // ── render ──────────────────────────────────────────────────────────────

  if (status === 'offline' || status === 'anonymous') {
    return (
      <div className="gecko-alert gecko-alert-warning" style={{ maxWidth: 720, margin: '40px auto' }}>
        <Icon name="alertCircle" size={18} />
        <div>{status === 'offline' ? 'The Gecko API is not reachable. The cash window only works live.' : 'Sign in to use the cash window.'}</div>
      </div>
    );
  }

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 60 }}>
      <div className="gecko-page-actions no-print">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Cash window</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            Order number, Enter, take the money. The receipt is the tax invoice and releases the box at the gate.
          </div>
        </div>
        <div className="gecko-toolbar">
          {myBranches.length > 1 ? (
            <select className="gecko-input" value={activeBranch ?? ''} onChange={e => { setBranchId(e.target.value); nextDriver(); }}>
              {myBranches.map(id => <option key={id} value={id}>{branchLabel(id)}</option>)}
            </select>
          ) : activeBranch ? (
            <span className="gecko-badge gecko-badge-gray"><Icon name="mapPin" size={14} /> {branchLabel(activeBranch)}</span>
          ) : null}
        </div>
      </div>

      {status === 'authenticated' && !activeBranch && (
        <div className="gecko-alert gecko-alert-warning no-print">
          <Icon name="alertCircle" size={18} />
          <div>You do not hold <code>{WINDOW_PERMISSIONS.collect}</code> at any depot, so there is no window to work at.</div>
        </div>
      )}

      <DrawerBar branchId={activeBranch} shift={shift} loading={shiftLoading || status === 'loading'} onChanged={s => { setShift(s); if (!s) loadShift(); }} />
      {shift && <ShiftReceipts shift={shift} onReprint={r => { setReceipt(r); window.scrollTo({ top: 0 }); }} />}

      {receipt ? (
        <ReceiptView receipt={receipt} depot={depotName} onPrint={printReceipt} onNext={nextDriver} />
      ) : (
        <>
          {/* ── the number ─────────────────────────────────────────── */}
          <form className="gecko-card no-print" style={{ padding: 20 }}
            onSubmit={e => { e.preventDefault(); void quote(orderNo, paidUntil, false); }}>
            <div className="gecko-row" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="gecko-form-group" style={{ flex: '1 1 320px', minWidth: 240 }}>
                <label className="gecko-form-label" htmlFor="orderNo">Order number</label>
                <input
                  id="orderNo" ref={orderInput} className="gecko-input" autoFocus autoComplete="off"
                  style={{ fontSize: 22, letterSpacing: '0.06em', fontFamily: 'var(--gecko-font-mono, monospace)', textTransform: 'uppercase' }}
                  value={orderNo} placeholder="Booking / order no."
                  onChange={e => { setOrderNo(e.target.value); if (booking) { setBooking(null); setPayError(null); } }}
                />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-form-label" htmlFor="paidUntil">Storage paid until</label>
                <input id="paidUntil" type="date" className="gecko-input" min={booking?.today} value={paidUntil}
                  title={booking ? `Depot date today: ${shortDate(booking.today)}` : 'Defaults to the depot\'s today'}
                  onChange={e => {
                    const v = booking && e.target.value && e.target.value < booking.today ? booking.today : e.target.value;
                    setPaidUntil(v);
                    if (booking && v) void quote(booking.orderNo, v, true);
                  }} />
              </div>
              <button type="submit" className="gecko-btn gecko-btn-primary" disabled={quoting || !orderNo.trim() || !activeBranch}>
                <Icon name="search" size={16} /> {quoting ? 'Quoting…' : 'Load'}
              </button>
              {booking && <button type="button" className="gecko-btn gecko-btn-outline" onClick={nextDriver}>Clear</button>}
            </div>
            {quoteError && <ProblemAlert problem={quoteError} style={{ marginTop: 12 }} />}
          </form>

          {booking && (
            <>
              {/* ── the booking ─────────────────────────────────────── */}
              <div className="gecko-card no-print" style={{ padding: 20 }}>
                <div className="gecko-row" style={{ gap: 28, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <Field label="Order" value={<span style={{ fontFamily: 'var(--gecko-font-mono, monospace)', fontWeight: 700 }}>{booking.orderNo}</span>} />
                  <Field label="Customer" value={customerName ? <>{customerName} <span className="gecko-text-muted">({booking.customerCode})</span></> : booking.customerCode ?? '—'} />
                  <Field label="Type" value={booking.orderTypeCode} />
                  {booking.lineCode && <Field label="Line" value={booking.lineCode} />}
                  {booking.agentCode && <Field label="Agent" value={booking.agentCode} />}
                  <Field label="Status" value={<span className={`gecko-badge ${booking.status === 'OPEN' ? 'gecko-badge-success' : 'gecko-badge-gray'}`}>{booking.status}</span>} />
                  {booking.paidUntil && <Field label="Quoted to" value={shortDate(booking.paidUntil)} />}
                </div>
                {wrongDepot && (
                  <div className="gecko-alert gecko-alert-warning" style={{ marginTop: 12 }}>
                    <Icon name="alertCircle" size={18} />
                    <div>
                      This order belongs to {branchLabel(booking.branchId)}, not the depot your drawer is at.
                      {myBranches.includes(booking.branchId) && (
                        <button type="button" className="gecko-btn gecko-btn-sm gecko-btn-outline" style={{ marginLeft: 10 }}
                          onClick={() => setBranchId(booking.branchId)}>Switch depot</button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── the boxes ───────────────────────────────────────── */}
              <div className="gecko-stack gecko-stack-md no-print">
                {booking.boxes.map(box => (
                  <BoxCard key={box.bookingContainerId} box={box}
                    selected={selected.has(box.bookingContainerId)}
                    onToggle={() => setSelected(s => {
                      const n = new Set(s);
                      if (n.has(box.bookingContainerId)) n.delete(box.bookingContainerId); else n.add(box.bookingContainerId);
                      return n;
                    })}
                    mayWaive={mayWaive}
                    onWaive={line => setWaiving({ box, line })} />
                ))}
                {booking.boxes.length === 0 && <div className="gecko-card" style={{ padding: 20 }}>No boxes on this order.</div>}
              </div>

              {/* ── the money ───────────────────────────────────────── */}
              <form className="gecko-card no-print" style={{ padding: 20 }} onSubmit={takePayment}>
                <div className="gecko-row" style={{ gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '2 1 460px' }} className="gecko-stack gecko-stack-md">
                    {rows.map((r, i) => (
                      <div key={i} className="gecko-row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="gecko-form-group">
                          <label className="gecko-form-label">Paid by</label>
                          <div className="gecko-row" style={{ gap: 0 }}>
                            {PAYMENT_CHANNELS.map(c => (
                              <button key={c} type="button"
                                className={`gecko-btn gecko-btn-sm ${r.channel === c ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
                                style={{ borderRadius: 0, minWidth: 72 }}
                                onClick={() => setRow(i, { channel: c, tendered: c === 'CASH' ? r.tendered : '' })}>
                                {CHANNEL_LABEL[c]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="gecko-form-group">
                          <label className="gecko-form-label">Amount (฿)</label>
                          <input className="gecko-input" type="number" step="0.01" min={0} inputMode="decimal" style={{ width: 130, textAlign: 'right' }}
                            value={r.amount} readOnly={rows.length === 1}
                            onChange={e => setRow(i, { amount: e.target.value })} />
                        </div>
                        {r.channel === 'CASH' ? (
                          <div className="gecko-form-group">
                            <label className="gecko-form-label" htmlFor={`tendered-${i}`}>Cash handed over (฿)</label>
                            <input id={`tendered-${i}`} ref={i === 0 ? tenderedInput : undefined} className="gecko-input" type="number" step="0.01" min={0}
                              inputMode="decimal" style={{ width: 150, textAlign: 'right', fontSize: 18 }}
                              value={r.tendered} placeholder={r.amount} onChange={e => setRow(i, { tendered: e.target.value })} />
                          </div>
                        ) : (
                          <>
                            <div className="gecko-form-group">
                              <label className="gecko-form-label">Reference *</label>
                              <input className="gecko-input" style={{ width: 170 }} value={r.referenceNo}
                                placeholder={r.channel === 'CHEQUE' ? 'Cheque no.' : r.channel === 'CARD' ? 'Approval code' : 'Slip / ref no.'}
                                onChange={e => setRow(i, { referenceNo: e.target.value })} />
                            </div>
                            {(r.channel === 'TRANSFER' || r.channel === 'CHEQUE') && (
                              <div className="gecko-form-group">
                                <label className="gecko-form-label">Bank</label>
                                <input className="gecko-input" style={{ width: 130 }} value={r.bankName} onChange={e => setRow(i, { bankName: e.target.value })} />
                              </div>
                            )}
                          </>
                        )}
                        {rows.length > 1 && (
                          <button type="button" className="gecko-btn gecko-btn-sm gecko-btn-outline" title="Remove"
                            onClick={() => setPayments(ps => ps.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
                        )}
                      </div>
                    ))}
                    <div className="gecko-row" style={{ gap: 16, alignItems: 'center' }}>
                      <button type="button" className="gecko-btn gecko-btn-sm gecko-btn-outline" onClick={splitPayment}>
                        <Icon name="plus" size={14} /> Split payment
                      </button>
                      <label className="gecko-row" style={{ gap: 6, alignItems: 'center', fontSize: 13 }}>
                        <input type="checkbox" checked={fullInvoice} onChange={e => setFullInvoice(e.target.checked)} />
                        Full tax invoice (payer name / tax ID)
                      </label>
                    </div>
                    {fullInvoice && (
                      <div className="gecko-row" style={{ gap: 10, flexWrap: 'wrap' }}>
                        <input className="gecko-input" style={{ flex: '2 1 220px' }} placeholder={customerName ?? 'Payer name'} value={payerName} onChange={e => setPayerName(e.target.value)} />
                        <input className="gecko-input" style={{ flex: '1 1 150px' }} placeholder="Tax ID (13 digits)" inputMode="numeric" maxLength={13} value={payerTaxId} onChange={e => setPayerTaxId(e.target.value)} />
                        <input className="gecko-input" style={{ flex: '0 1 110px' }} placeholder="Branch no." value={payerBranchNo} onChange={e => setPayerBranchNo(e.target.value)} />
                        <input className="gecko-input" style={{ flex: '3 1 100%' }} placeholder="Address" value={payerAddress} onChange={e => setPayerAddress(e.target.value)} />
                      </div>
                    )}
                  </div>

                  <div style={{ flex: '1 1 260px', minWidth: 240 }}>
                    <Line label={`Subtotal (${chosen.length} box${chosen.length === 1 ? '' : 'es'})`} value={formatBaht(subtotal)} />
                    <Line label="VAT 7%" value={formatBaht(vat)} />
                    <div className="gecko-row" style={{ justifyContent: 'space-between', alignItems: 'baseline', borderTop: '2px solid var(--gecko-border, #ddd)', marginTop: 6, paddingTop: 6 }}>
                      <strong>Total</strong>
                      <span style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatBaht(total)}</span>
                    </div>
                    {change > 0 && (
                      <div className="gecko-row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                        <span>Change</span>
                        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--gecko-warning-700, #b45309)' }}>{formatBaht(change)}</span>
                      </div>
                    )}
                    <button type="submit" className="gecko-btn gecko-btn-primary" style={{ width: '100%', marginTop: 14, fontSize: 18, padding: '12px 0' }}
                      disabled={!!payProblem || paying || !shift || !mayCollect || wrongDepot || quoting}>
                      <Icon name="check" size={18} /> {paying ? 'Issuing receipt…' : `Take ${formatBaht(total)}`}
                    </button>
                    <div className="gecko-text-muted" style={{ fontSize: 12, marginTop: 6, minHeight: 16 }}>
                      {!shift ? 'Open the drawer first.' : !mayCollect ? `You need ${WINDOW_PERMISSIONS.collect} at this depot.` : payProblem ?? ''}
                    </div>
                  </div>
                </div>
                {payError && <ProblemAlert problem={payError} style={{ marginTop: 14 }} />}
              </form>
            </>
          )}
        </>
      )}

      {waiving && booking && (
        <WaiveDialog box={waiving.box} line={waiving.line} paidUntil={booking.paidUntil ?? (paidUntil || null)}
          onClose={() => setWaiving(null)}
          onDone={() => { setWaiving(null); void quote(booking.orderNo, paidUntil, true); }} />
      )}

      {!user && status === 'loading' && <div className="gecko-text-muted no-print">Signing in…</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="gecko-text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 15 }}>{value}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="gecko-row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
      <span className="gecko-text-muted">{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function BoxCard({ box, selected, onToggle, mayWaive, onWaive }: {
  box: WindowBox; selected: boolean; onToggle: () => void; mayWaive: boolean; onWaive: (line: QuoteLine) => void;
}) {
  const payable = isPayable(box);
  const right: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  return (
    <div className="gecko-card" style={{ padding: 16, opacity: payable ? 1 : 0.75, outline: payable && selected ? '2px solid var(--gecko-primary-500, #2563eb)' : undefined }}>
      <div className="gecko-row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="checkbox" checked={payable && selected} disabled={!payable} onChange={onToggle}
          aria-label={`Pay for ${box.containerNo ?? 'box'}`} style={{ width: 18, height: 18 }} />
        <span style={{ fontFamily: 'var(--gecko-font-mono, monospace)', fontSize: 18, fontWeight: 700 }}>{box.containerNo ?? 'No box yet'}</span>
        {box.equipmentTypeCode && <span className="gecko-badge gecko-badge-gray">{box.equipmentTypeCode}</span>}
        {box.nextMovementCode && <span className="gecko-badge gecko-badge-info">Next: {box.nextMovementCode}{box.direction ? ` (${box.direction})` : ''}</span>}
        {box.stayDays != null && <span className="gecko-text-muted" style={{ fontSize: 13 }}>
          {box.stayDays} day{box.stayDays === 1 ? '' : 's'} in yard{box.inAt ? ` · in ${new Date(box.inAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : ''}
        </span>}
        <span style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 700 }}>{payable ? formatBaht(box.total) : ''}</span>
      </div>

      {!payable && box.note && <div className="gecko-text-muted" style={{ marginTop: 8, fontSize: 13 }}>{box.note}</div>}

      {box.due.length > 0 && (
        <table className="gecko-table gecko-table-compact" style={{ width: '100%', marginTop: 10 }}>
          <thead>
            <tr>
              <th>Kind</th><th>Charge</th><th>Service</th><th style={right}>Qty</th><th style={right}>Net</th><th style={right}>VAT</th><th style={right}>Total</th>
              {mayWaive && <th />}
            </tr>
          </thead>
          <tbody>
            {box.due.map((l, i) => (
              <tr key={`${l.chargeCode}-${l.billTo}-${i}`}>
                <td><span className="gecko-badge gecko-badge-xs gecko-badge-gray">{l.kind}</span></td>
                <td>{l.chargeName} <span className="gecko-text-muted" style={{ fontSize: 12 }}>{l.chargeCode}</span></td>
                <td style={{ fontSize: 13 }}>{l.serviceFrom || l.serviceTo ? `${shortDate(l.serviceFrom)} – ${shortDate(l.serviceTo)}` : '—'}</td>
                <td style={right}>{l.quantity}</td>
                <td style={right}>{formatBaht(l.amount)}</td>
                <td style={right}>{formatBaht(l.taxAmount)}</td>
                <td style={{ ...right, fontWeight: 600 }}>{formatBaht(l.total)}</td>
                {mayWaive && (
                  <td style={right}>
                    <button type="button" className="gecko-btn gecko-btn-sm gecko-btn-outline" onClick={() => onWaive(l)}>Waive</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {box.settled.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 13 }} className="gecko-row gecko-text-muted">
          <span style={{ marginRight: 8 }}>Already settled:</span>
          {box.settled.map(s => (
            <span key={s.chargeId} className={`gecko-badge gecko-badge-xs ${s.status === 'WAIVED' ? 'gecko-badge-warning' : 'gecko-badge-success'}`} style={{ marginRight: 6 }}
              title={s.waiveReason ?? undefined}>
              {s.chargeCode} {s.status} {formatBaht(s.total)}{s.serviceTo ? ` to ${shortDate(s.serviceTo)}` : ''}{s.couponRef ? ` · ${s.couponRef}` : ''}
            </span>
          ))}
        </div>
      )}

      {!payable && box.tried.length > 0 && (
        <details style={{ marginTop: 6, fontSize: 12 }}>
          <summary className="gecko-text-muted">Why nothing is due ({box.tried.length} tariff checks)</summary>
          {box.tried.map((t, i) => (
            <div key={i}>{t.chargeCode} · {t.billTo} · {t.outcome}{t.amount != null ? ` · ${formatBaht(t.amount)}` : ''}</div>
          ))}
        </details>
      )}
    </div>
  );
}

function WaiveDialog({ box, line, paidUntil, onClose, onDone }: {
  box: WindowBox; line: QuoteLine; paidUntil: string | null; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Problem | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const body: WaiveRequest = {
        bookingContainerId: box.bookingContainerId, chargeCode: line.chargeCode, billTo: line.billTo,
        paidUntil, reason: reason.trim(),
      };
      await apiSend('POST', '/api/revenue/window/waive', body);
      toast.toast({ variant: 'success', title: 'Waived', message: `${line.chargeCode} on ${box.containerNo ?? 'box'}` });
      onDone();
    } catch (err) {
      setError(problemOf(err, 'The charge could not be waived.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="sm" title="Waive charge"
      subtitle={`${line.chargeName} · ${box.containerNo ?? ''} · ${formatBaht(line.total)}`}
      footer={<>
        <button className="gecko-btn gecko-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="gecko-btn gecko-btn-primary" onClick={submit} disabled={busy || reason.trim().length < 3}>{busy ? 'Waiving…' : 'Waive'}</button>
      </>}>
      <div className="gecko-form-group">
        <label className="gecko-form-label" htmlFor="waiveReason">Reason (kept on the charge)</label>
        <textarea id="waiveReason" className="gecko-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} autoFocus />
      </div>
      {error && <ProblemAlert problem={error} style={{ marginTop: 10 }} />}
    </Modal>
  );
}
