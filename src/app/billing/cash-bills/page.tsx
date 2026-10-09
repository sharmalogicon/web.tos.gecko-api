"use client";

/**
 * CUSTOMER CASH BILL — Vector's `CustomerCashBill`, bound.
 *
 * Pick a customer, tick the open cash charges standing against them, say how
 * the money arrived, and the API issues one receipt. In Thailand that receipt
 * IS the tax invoice, which is why a cash customer is billed here and not
 * through `/api/revenue/invoices/send` — that endpoint refuses CASH by design.
 *
 * Three blocks, as the desktop has them and as the receipt reads:
 *   1  who it is made out to          the party, and the payer that gets printed
 *   2  what is being billed           the open lines, across any number of bookings
 *   3  how it was paid                channels, W/H tax, and what it comes to
 *
 * There is NO manual line entry, exactly as in the desktop: a charge that is on
 * no statement is added on the booking statement first, then billed here. And a
 * saved bill is never edited — to change one it is voided and billed again,
 * which puts its lines back on this screen as open.
 *
 * Reached from the menu, and from the Booking Statement / Unbilled Orders with
 * `?customerCode=&orderNo=&charges=` — that customer, those lines ticked.
 */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { useFacility } from '@/lib/api/facility';
import { ApiError } from '@/lib/api/problem';
import { newIdempotencyKey } from '@/lib/api/client';
import { amount } from '@/lib/api/charges';
import { formatContainerNo } from '@/lib/api/tos';
import { getParty } from '@/lib/api/parties';
import { receiptByNo } from '@/lib/api/cash-bills';
import {
  CASH_BILL_PERMISSION, cashBillLinesPath, cashBillTotals, createCashBill,
  needsReference, PAYMENT_TOLERANCE,
  type CashBillLine, type CashBillPayment, type WithholdingRate,
} from '@/lib/api/cash-bills';
import { CustomerPicker, defaultAddress, payerFrom, type PickedCustomer } from '../_components/PartyPicker';
import { PaymentPanel } from './_components/PaymentPanel';

export default function CustomerCashBillPage() {
  return (
    <Suspense fallback={<div className="gecko-cell-meta gecko-page-loading">Loading…</div>}>
      <CashBill />
    </Suspense>
  );
}

const ONE_CASH_PAYMENT: CashBillPayment[] =
  [{ channel: 'CASH', amount: 0, tenderedAmount: null, referenceNo: null, bankName: null }];

function CashBill() {
  const router = useRouter();
  const params = useSearchParams();
  const fromCustomer = (params.get('customerCode') ?? '').trim();
  const fromOrder = (params.get('orderNo') ?? '').trim().toUpperCase();
  const chargesParam = params.get('charges') ?? '';

  // The ids arrive as one comma-separated string, so the list is memoised on
  // that string: a fresh array every render would re-derive the ticks forever.
  const fromCharges = useMemo(
    () => chargesParam.split(',').map(x => x.trim()).filter(Boolean),
    [chargesParam]);

  const { toast } = useToast();
  const { user } = useSession();
  const { branch } = useFacility();
  const branchId = branch?.branchId ?? '';
  const mayCollect = (user?.permissions ?? []).includes(CASH_BILL_PERMISSION);

  const [picked, setPicked] = useState<PickedCustomer | null>(null);
  const [orderFilter, setOrderFilter] = useState(fromOrder);
  const [remarks, setRemarks] = useState('');
  const [rate, setRate] = useState<WithholdingRate>(0);
  const [payments, setPayments] = useState<CashBillPayment[]>(ONE_CASH_PAYMENT);
  /** True once the clerk has touched the payment block; before that it follows the nett. */
  const [authored, setAuthored] = useState(false);
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [lookupNo, setLookupNo] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  /**
   * One key per bill, not per attempt. A 409 ("those lines moved") did not
   * spend it, so correcting the ticks and pressing Save again is the same
   * action — and a double-click cannot issue two receipts.
   */
  const [key, setKey] = useState(newIdempotencyKey);

  const customerCode = picked?.party.partyCode ?? '';

  // Arriving from the statement or the unbilled worklist: the customer comes in
  // the URL, so the screen reads it instead of making the clerk search for
  // somebody they have already chosen.
  useEffect(() => {
    if (!fromCustomer || picked) return;
    let alive = true;
    void getParty(fromCustomer)
      .then(p => { if (alive) setPicked({ party: p, payer: payerFrom(p, defaultAddress(p)) }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [fromCustomer, picked]);

  const path = customerCode && branchId
    ? cashBillLinesPath(branchId, customerCode, orderFilter || undefined)
    : null;
  const { data, error, loading, reload } = useApi<CashBillLine[]>(path);
  const lines = useMemo(() => data ?? [], [data]);

  /**
   * WHAT IS TICKED IS DERIVED, not set when the lines land.
   *
   * `ticked` is null until the clerk touches a box, and null means the default:
   * everything open, which is what "bill all of it" needs and how the desktop
   * opens — or exactly the `charges=` of the URL, so "Send to cash bill" bills
   * what was selected on the statement and nothing more.
   *
   * Deriving it rather than writing it in an effect is what keeps the ticks
   * honest across a customer change or a refresh: there is no moment where a
   * previous customer's ids are still in state.
   */
  const on = useMemo(() => {
    if (ticked) return ticked;
    const wanted = new Set(fromCharges);
    return new Set(wanted.size > 0
      ? lines.filter(l => wanted.has(l.chargeId)).map(l => l.chargeId)
      : lines.map(l => l.chargeId));
  }, [ticked, lines, fromCharges]);

  const selected = useMemo(() => lines.filter(l => on.has(l.chargeId)), [lines, on]);
  const currency = lines[0]?.currencyCode ?? 'THB';
  const totals = useMemo(() => cashBillTotals(selected, rate), [selected, rate]);
  const m = (v: number) => amount(v, currency);

  /**
   * A single untouched cash line FOLLOWS the nett, derived the same way.
   *
   * A bill settled in cash is the overwhelming case, and making the clerk
   * retype a total they can already see is pure friction. The moment they type
   * an amount, change a channel or split the bill, `authored` is set and the
   * figures are theirs — the shortfall banner, not this, keeps them honest.
   */
  const shown = useMemo(
    () => (authored ? payments : [{ ...payments[0], amount: totals.nett }]),
    [authored, payments, totals.nett]);

  const authorPayments = (p: CashBillPayment[]) => { setAuthored(true); setPayments(p); };

  const toggle = (id: string) => {
    const next = new Set(on);
    if (next.has(id)) next.delete(id); else next.add(id);
    setTicked(next);
  };
  const allOn = lines.length > 0 && lines.every(l => on.has(l.chargeId));

  const payer = picked?.payer ?? null;
  const missingRef = shown.some(p => needsReference(p.channel) && !p.referenceNo?.trim());
  const balanced = Math.abs(shown.reduce((n, p) => n + (p.amount || 0), 0) - totals.nett) <= PAYMENT_TOLERANCE;
  const ready = Boolean(
    mayCollect && branchId && customerCode && payer?.name.trim()
    && selected.length > 0 && totals.nett > 0 && balanced && !missingRef && !saving,
  );

  const why = !mayCollect ? 'Taking money needs the cash-collect permission.'
    : !customerCode ? 'Choose the customer.'
    : selected.length === 0 ? 'Tick the charges to bill.'
    : !payer?.name.trim() ? 'The receipt needs a name to be made out to.'
    : totals.nett <= 0 ? 'There is nothing to collect.'
    : missingRef ? 'A transfer, cheque or card needs its reference.'
    : !balanced ? 'The payments must come to the nett amount.'
    : '';

  const save = async () => {
    if (!ready || !payer) return;
    setSaving(true);
    setProblem(null);
    try {
      const receipt = await createCashBill({
        branchId,
        customerCode,
        chargeIds: selected.map(l => l.chargeId),
        payer: { ...payer, name: payer.name.trim() },
        remarks: remarks.trim() || null,
        withholdingTaxRate: rate,
        payments: shown.map(p => ({
          ...p,
          referenceNo: p.referenceNo?.trim() || null,
          bankName: p.bankName?.trim() || null,
        })),
        // What the clerk was looking at. If the lines have moved since, the API
        // refuses rather than billing a different number than the one agreed.
        expectedTotal: totals.total,
      }, key);
      toast({ variant: 'success', title: 'Cash bill issued', message: receipt.receiptNo });
      router.push(`/billing/receipts/${encodeURIComponent(receipt.receiptId)}`);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'The cash bill could not be saved.');
      setProblem(err);
      // 409 means the lines are not what this screen showed — somebody else
      // billed or waived one. Re-reading them is the only honest next step, and
      // the key survives, because nothing was issued.
      if (err.status === 409) reload();
    } finally {
      setSaving(false);
    }
  };

  const findReceipt = async () => {
    const no = lookupNo.trim();
    if (!no) return;
    setLookingUp(true);
    try {
      const r = await receiptByNo(no);
      router.push(`/billing/receipts/${encodeURIComponent(r.receiptId)}`);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      toast({
        variant: 'danger',
        title: err?.status === 404 ? 'No such receipt' : 'Could not open it',
        message: err?.status === 404 ? `Nothing is numbered ${no} in this depot.` : err?.explanation ?? 'Try again.',
      });
    } finally {
      setLookingUp(false);
    }
  };

  const reset = () => {
    setPicked(null);
    setTicked(null);
    setRemarks('');
    setRate(0);
    setPayments(ONE_CASH_PAYMENT);
    setAuthored(false);
    setProblem(null);
    setOrderFilter('');
    // A new bill is a new action, so it takes a new key: replaying the old one
    // with a different body answers 422.
    setKey(newIdempotencyKey());
    router.replace('/billing/cash-bills');
  };

  return (
    <div className="gecko-stack gecko-stack-xl gecko-cashbill-page">

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
            <Link href="/billing/statement" className="gecko-breadcrumb-item">Billing</Link>
            <span className="gecko-breadcrumb-sep" />
            <span className="gecko-breadcrumb-current">Customer Cash Bill</span>
          </nav>
          <h1 className="gecko-page-title gecko-mt-1">Customer Cash Bill</h1>
          <div className="gecko-page-subtitle gecko-mt-1">
            Collect the open cash charges of one customer on a single receipt — the receipt is the tax invoice.
          </div>
        </div>
        <div className="gecko-toolbar">
          <div className="gecko-cashbill-lookup">
            <input className="gecko-input gecko-input-sm gecko-text-mono" aria-label="Search receipt no"
              placeholder="Cash bill no…" value={lookupNo} disabled={lookingUp}
              onChange={e => setLookupNo(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') void findReceipt(); }} />
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={!lookupNo.trim() || lookingUp}
              onClick={() => void findReceipt()}>
              <Icon name="search" size={13} /> {lookingUp ? 'Opening…' : 'Open'}
            </button>
          </div>
          {picked && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reset} disabled={saving}>
              <Icon name="plus" size={13} /> New bill
            </button>
          )}
        </div>
      </div>

      {!mayCollect && (
        <div role="status" className="gecko-alert gecko-alert-warning">
          <Icon name="lock" size={16} />
          <span>
            You can read this screen but not issue a bill — taking money needs the cash-collect
            permission. Ask an accounts user to raise it.
          </span>
        </div>
      )}

      {problem && (
        <div role="alert" className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <strong>{problem.status === 409 ? 'Those lines have moved' : problem.title || 'The bill was not saved'}</strong>
            <div>{problem.status === 409
              ? 'Somebody billed or changed one of these charges while this screen was open. The list has been re-read — check the ticks and the total, then save again.'
              : problem.explanation ?? problem.message}</div>
          </div>
        </div>
      )}

      {/* ── 1 · Who it is made out to ─────────────────────────────────────── */}
      <section className="gecko-card gecko-card-padded gecko-stack-md">
        <div className="gecko-stat-label">General information</div>
        <div className="gecko-bill-head">
          <CustomerPicker picked={picked} disabled={saving}
            onPick={c => { setPicked(c); setTicked(null); }}
            onPayerChange={p => setPicked(c => (c ? { ...c, payer: p } : c))} />

          <div className="gecko-stack gecko-stack-sm">
            <div className="gecko-grid-2">
              <ReadOnly label="Cash bill no" value="issued on save" />
              <ReadOnly label="Date" value={new Date().toISOString().slice(0, 10)} mono />
            </div>
            <div className="gecko-form-group">
              <label className="gecko-form-label" htmlFor="orderFilter">
                One booking only <span className="gecko-cell-meta">(optional)</span>
              </label>
              <input id="orderFilter" className="gecko-input gecko-text-mono" disabled={saving || !picked}
                placeholder="Every open booking of this customer"
                value={orderFilter} onChange={e => setOrderFilter(e.target.value.toUpperCase())} />
            </div>
            <div className="gecko-form-group">
              <label className="gecko-form-label" htmlFor="remarks">Remarks</label>
              <textarea id="remarks" className="gecko-input gecko-textarea" rows={2} maxLength={500} disabled={saving}
                placeholder="Printed on the receipt"
                value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2 · What is being billed ──────────────────────────────────────── */}
      <section className="gecko-table-card">
        <div className="gecko-table-toolbar">
          <Icon name="invoice" size={13} />
          <span>
            Charge details · <strong>{selected.length}</strong> of {lines.length} ticked
          </span>
          <span className="gecko-table-toolbar-spacer" />
          <span>Ticked total <strong className="gecko-mono">{m(totals.total)}</strong></span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload} disabled={!path || loading}>
            <Icon name="refreshCcw" size={13} /> Refresh
          </button>
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
                <th className="gecko-select-col">
                  <input type="checkbox" aria-label="Tick every line" disabled={lines.length === 0 || saving}
                    checked={allOn}
                    onChange={() => setTicked(allOn ? new Set() : new Set(lines.map(l => l.chargeId)))} />
                </th>
                <th style={{ width: '13%' }}>Booking</th>
                <th style={{ width: '13%' }}>Container</th>
                <th style={{ width: '7%' }}>Type</th>
                <th>Charge</th>
                <th style={{ width: '9%' }}>Movement</th>
                <th className="gecko-num" style={{ width: '5%' }}>Qty</th>
                <th className="gecko-num" style={{ width: '9%' }}>Rate</th>
                <th className="gecko-num" style={{ width: '9%' }}>Amount</th>
                <th className="gecko-num" style={{ width: '8%' }}>Tax</th>
                <th className="gecko-num" style={{ width: '10%' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {loading && <TableSkeleton columns={11} />}
              {!loading && !picked && (
                <tr>
                  <td colSpan={11} className="gecko-cell-bleed">
                    <EmptyState icon="user" title="Choose the customer"
                      description="Their open cash charges — across every booking — are listed here to tick." />
                  </td>
                </tr>
              )}
              {!loading && picked && lines.length === 0 && !error && (
                <tr>
                  <td colSpan={11} className="gecko-cell-bleed">
                    <EmptyState icon="checkCircle" title="Nothing open to bill"
                      description={orderFilter
                        ? `${orderFilter} has no open, priced cash charge for this customer. Clear the booking to look across all of them.`
                        : 'Every cash charge of this customer is already on a receipt. A charge that is on no statement is added on the booking statement first.'} />
                  </td>
                </tr>
              )}
              {!loading && lines.map(l => {
                const isOn = on.has(l.chargeId);
                return (
                  <tr key={l.chargeId} className={isOn ? 'gecko-row-ticked' : undefined}>
                    <td className="gecko-select-col">
                      <input type="checkbox" checked={isOn} disabled={saving}
                        aria-label={`Bill ${l.chargeCode} on ${l.containerNo ?? l.orderNo}`}
                        onChange={() => toggle(l.chargeId)} />
                    </td>
                    <td>
                      <Link href={`/billing/statement?orderNo=${encodeURIComponent(l.orderNo)}`}
                        className="gecko-mono-strong gecko-link gecko-cell-tight">{l.orderNo}</Link>
                    </td>
                    <td className="gecko-mono">{l.containerNo ? formatContainerNo(l.containerNo) : '—'}</td>
                    <td className="gecko-mono gecko-cell-meta">{l.equipmentTypeCode ?? '—'}</td>
                    <td>
                      <span className="gecko-cell-tight">{l.chargeName ?? l.chargeCode}</span>
                      <span className="gecko-cell-meta gecko-mono">
                        {l.chargeCode}
                        {l.source && l.source !== 'MANUAL' ? '' : l.source === 'MANUAL' ? ' · by hand' : ''}
                      </span>
                    </td>
                    <td className="gecko-mono gecko-cell-meta">{l.movementCode ?? '—'}</td>
                    <td className="gecko-num gecko-mono">{l.quantity}</td>
                    <td className="gecko-num gecko-mono">{l.unitRate === null ? '—' : m(l.unitRate)}</td>
                    <td className="gecko-num gecko-mono">{m(l.amount)}</td>
                    <td className="gecko-num gecko-mono gecko-cell-meta">{m(l.taxAmount)}</td>
                    <td className="gecko-num gecko-mono gecko-mono-strong">{m(l.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 3 · How it was paid ───────────────────────────────────────────── */}
      <PaymentPanel totals={totals} rate={rate} payments={shown} currency={currency}
        disabled={saving || !mayCollect}
        onRate={setRate} onPayments={authorPayments} />

      <div className="gecko-cashbill-save">
        <span className="gecko-cell-meta gecko-flex-1">
          {why || <>Issuing <strong className="gecko-mono">{m(totals.nett)}</strong> against {selected.length} charge{selected.length === 1 ? '' : 's'}. A saved bill is never edited — to change it, void it and bill again.</>}
        </span>
        <button className="gecko-btn gecko-btn-primary" disabled={!ready} onClick={() => void save()}>
          <Icon name="print" size={14} /> {saving ? 'Issuing…' : `Save and print ${m(totals.nett)}`}
        </button>
      </div>
    </div>
  );
}

/** A field the API fills, shown in its place so the form reads like the receipt. */
function ReadOnly({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="gecko-form-group">
      <span className="gecko-form-label">{label}</span>
      <div className={`gecko-readonly-field${mono ? ' gecko-mono' : ''}`}>{value}</div>
    </div>
  );
}
