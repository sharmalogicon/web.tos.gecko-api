"use client";
import React from 'react';
import { amount, settledGroup, type StatementRow } from '@/lib/api/charges';

/**
 * The booking's money, split the way it is actually collected.
 *
 * Vector's cost sheet carries three boxes — billable, paid, unpaid — and that
 * is one number short of useful here, because cash and credit are settled by
 * different people on different days: cash at the window before the truck
 * leaves, credit on an invoice weeks later. A single "unpaid ฿3,100" tells a
 * clerk nothing about whether anybody should be chasing it today.
 *
 * So: cash and credit, each with what is still to come and what has come in.
 * These total the WHOLE booking and ignore the table's filter — a filter hides
 * rows, it does not change what the booking is worth.
 */
export function MoneyCards({ rows, currency }: { rows: StatementRow[]; currency: string }) {
  const sum = (f: (r: StatementRow) => boolean) =>
    rows.filter(f).reduce((n, r) => n + r.charge.total, 0);

  const live = (r: StatementRow) => r.charge.status !== 'CANCELLED' && r.charge.status !== 'WAIVED';
  const isCash = (r: StatementRow) => r.charge.paymentTermCode === 'CASH';
  const isCredit = (r: StatementRow) => r.charge.paymentTermCode === 'CREDIT';
  const paid = (r: StatementRow) => settledGroup(r.charge) === 'PAID';

  const cashTotal = sum(r => live(r) && isCash(r));
  const cashPaid = sum(r => live(r) && isCash(r) && paid(r));
  const creditTotal = sum(r => live(r) && isCredit(r));
  const creditPaid = sum(r => live(r) && isCredit(r) && paid(r));
  const waived = sum(r => r.charge.status === 'WAIVED');
  const noRate = rows.filter(r => r.charge.status === 'QUOTED' && r.charge.amount === 0 && !r.charge.scheduleNo).length;

  const m = (v: number) => amount(v, currency);
  const left = (total: number, got: number) =>
    total - got <= 0 ? (total > 0 ? 'settled in full' : 'nothing charged') : `${m(total - got)} still to collect`;

  return (
    <div className="gecko-money-cards">
      <Card tone="cash" label="Total cash" value={m(cashTotal)} note={left(cashTotal, cashPaid)} />
      <Card tone="cash" label="Cash paid" value={m(cashPaid)} note="taken at the window" />
      <Card tone="credit" label="Total credit" value={m(creditTotal)} note={left(creditTotal, creditPaid)} />
      <Card tone="credit" label="Credit paid" value={m(creditPaid)} note="invoiced and settled" />
      {waived > 0 && <Card tone="muted" label="Waived" value={m(waived)} note="forgiven, with a reason" />}
      {noRate > 0 && (
        <Card tone="alert" label="No rate" value={String(noRate)}
          note={`${noRate === 1 ? 'line has' : 'lines have'} no tariff — the gate will refuse them`} />
      )}
    </div>
  );
}

function Card({ tone, label, value, note }: {
  tone: 'cash' | 'credit' | 'muted' | 'alert'; label: string; value: string; note: string;
}) {
  return (
    <div className={`gecko-money-card gecko-money-card-${tone}`}>
      <div className="gecko-money-card-label">{label}</div>
      <div className="gecko-money-card-value">{value}</div>
      <div className="gecko-money-card-note">{note}</div>
    </div>
  );
}
