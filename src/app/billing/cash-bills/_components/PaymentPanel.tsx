"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { amount } from '@/lib/api/charges';
import { CHANNEL_LABEL, PAYMENT_CHANNELS, type PaymentChannel } from '@/lib/api/window';
import {
  needsReference, PAYMENT_TOLERANCE, WITHHOLDING_RATES,
  type CashBillPayment, type CashBillTotals, type WithholdingRate,
} from '@/lib/api/cash-bills';

/**
 * HOW THE MONEY ARRIVED, and what the bill comes to.
 *
 * The desktop keeps these side by side for one reason: the payments have to add
 * up to the nett, and a clerk splitting a bill between cash and a transfer is
 * reading both columns at once. So the shortfall is stated in money here rather
 * than discovered on Save.
 *
 * Withholding tax is the customer's own tax on the service, deducted from what
 * they hand over and remitted by them. It is a percentage of the amount BEFORE
 * VAT — 1% or 3% depending on the service — so it reduces the nett without
 * touching the invoice total.
 */

export function PaymentPanel({ totals, rate, payments, currency, disabled, onRate, onPayments }: {
  totals: CashBillTotals;
  rate: WithholdingRate;
  payments: CashBillPayment[];
  currency: string;
  disabled?: boolean;
  onRate: (r: WithholdingRate) => void;
  onPayments: (p: CashBillPayment[]) => void;
}) {
  const m = (v: number) => amount(v, currency);
  const taken = payments.reduce((n, p) => n + (p.amount || 0), 0);
  const gap = Math.round((taken - totals.nett) * 100) / 100;

  const patch = (i: number, p: Partial<CashBillPayment>) =>
    onPayments(payments.map((row, at) => (at === i ? { ...row, ...p } : row)));

  const add = () => onPayments([
    ...payments,
    // A second line is for what the first did not cover, so it opens on the
    // shortfall rather than on zero.
    { channel: 'TRANSFER', amount: gap < 0 ? Math.abs(gap) : 0, tenderedAmount: null, referenceNo: null, bankName: null },
  ]);

  return (
    <div className="gecko-bill-foot">
      <section className="gecko-card gecko-card-padded gecko-stack-sm">
        <div className="gecko-row gecko-row-between gecko-row-baseline">
          <div className="gecko-stat-label">Payment</div>
          {!disabled && payments.length < 4 && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={add}>
              <Icon name="plus" size={13} /> Split the payment
            </button>
          )}
        </div>

        {payments.map((p, i) => (
          <div key={i} className="gecko-cashbill-payment">
            <div className="gecko-cashbill-payment-row">
              <div className="gecko-form-group">
                <label className="gecko-form-label" htmlFor={`channel-${i}`}>Paid by</label>
                <select id={`channel-${i}`} className="gecko-select" disabled={disabled}
                  value={p.channel}
                  onChange={e => {
                    const channel = e.target.value as PaymentChannel;
                    // Moving to cash drops a bank reference that no longer
                    // applies; moving off cash drops the tendered amount,
                    // because only cash gives change.
                    patch(i, needsReference(channel)
                      ? { channel, tenderedAmount: null }
                      : { channel, referenceNo: null, bankName: null });
                  }}>
                  {PAYMENT_CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-form-label" htmlFor={`amount-${i}`}>Amount</label>
                <input id={`amount-${i}`} className="gecko-input gecko-text-mono gecko-input-money"
                  type="number" min={0} step="0.01" inputMode="decimal" disabled={disabled}
                  value={p.amount === 0 ? '' : p.amount}
                  onChange={e => patch(i, { amount: Number(e.target.value) || 0 })} />
              </div>
              {p.channel === 'CASH' ? (
                <div className="gecko-form-group">
                  <label className="gecko-form-label" htmlFor={`tendered-${i}`} title="What the driver handed over">
                    Tendered
                  </label>
                  <input id={`tendered-${i}`} className="gecko-input gecko-text-mono gecko-input-money"
                    type="number" min={0} step="0.01" inputMode="decimal" disabled={disabled}
                    placeholder={p.amount ? String(p.amount) : ''}
                    value={p.tenderedAmount ?? ''}
                    onChange={e => patch(i, { tenderedAmount: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
              ) : (
                <>
                  <div className="gecko-form-group">
                    <label className="gecko-form-label gecko-form-label-required" htmlFor={`ref-${i}`}>Reference</label>
                    <input id={`ref-${i}`} className="gecko-input gecko-text-mono" maxLength={60} disabled={disabled}
                      value={p.referenceNo ?? ''} onChange={e => patch(i, { referenceNo: e.target.value || null })} />
                  </div>
                  <div className="gecko-form-group">
                    <label className="gecko-form-label" htmlFor={`bank-${i}`}>Bank</label>
                    <input id={`bank-${i}`} className="gecko-input" maxLength={60} disabled={disabled}
                      value={p.bankName ?? ''} onChange={e => patch(i, { bankName: e.target.value || null })} />
                  </div>
                </>
              )}
              {payments.length > 1 && !disabled && (
                <button className="gecko-icon-btn-ghost gecko-cashbill-payment-drop" aria-label="Remove this payment"
                  onClick={() => onPayments(payments.filter((_, at) => at !== i))}>
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
            {p.channel === 'CASH' && p.tenderedAmount !== null && p.tenderedAmount > p.amount && (
              <div className="gecko-cell-meta">Change {m(p.tenderedAmount - p.amount)}</div>
            )}
          </div>
        ))}

        {/* Stated as money, not as "invalid": the clerk needs the number to
            type, and on a split bill that number is the whole point. */}
        {Math.abs(gap) > PAYMENT_TOLERANCE && (
          <div className={`gecko-cashbill-balance ${gap < 0 ? 'gecko-cashbill-short' : 'gecko-cashbill-over'}`}>
            <Icon name="alertCircle" size={14} />
            {gap < 0
              ? <span>{m(Math.abs(gap))} still to take — the payments must come to the nett amount.</span>
              : <span>{m(gap)} more than the bill. Put the excess in Tendered, not in Amount.</span>}
          </div>
        )}
      </section>

      <section className="gecko-card gecko-card-padded">
        <div className="gecko-stat-label gecko-mb-2">Payment details</div>
        <Total label="Selling amount" value={m(totals.selling)} />
        <Total label="Tax amount" value={m(totals.tax)} />
        <Total label="Total amount" value={m(totals.total)} rule strong />

        <div className="gecko-cashbill-wht">
          <span className="gecko-form-label">W/H tax</span>
          <div className="gecko-toolbar">
            {WITHHOLDING_RATES.map(r => (
              <button key={r} disabled={disabled}
                className={`gecko-btn gecko-btn-sm ${r === rate ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
                onClick={() => onRate(r)}>
                {r === 0 ? 'None' : `${r}%`}
              </button>
            ))}
          </div>
        </div>
        {rate > 0 && <Total label={`Withheld (${rate}% of the selling amount)`} value={`− ${m(totals.withholding)}`} />}

        <Total label="Nett amount" value={m(totals.nett)} big />
      </section>
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
