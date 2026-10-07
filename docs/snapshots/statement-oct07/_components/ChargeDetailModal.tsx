"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/problem';
import { amount, payerLabel, type StatementRow } from '@/lib/api/charges';
import {
  DISCOUNT_LABEL, repriceCharge, sellingRate, setChargeLock, waiveCharge, WAIVE_REASON_LABEL,
  WAIVE_REASONS, type DiscountType, type WaiveReasonCode,
} from '@/lib/api/statement-writes';
import { apiProblem } from './problem';

/**
 * ONE charge, as Vector's Charge Details panel edits it.
 *
 * The price is NOT a number the clerk retypes. It is the tariff's ORIGINAL RATE
 * and a DISCOUNT — an amount or a percent — and the selling rate falls out of
 * the two. That is the difference between a statement that can answer "what did
 * we give away this month" and one where the answer is buried in free text.
 *
 * Three things happen here, and only on a QUOTED line: reprice it, waive it, or
 * lock it so Regenerate leaves it alone. The caller never opens this on a line
 * that has been paid, invoiced or cancelled.
 */
export function ChargeDetailModal({ row, onClose, onDone }: {
  row: StatementRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const c = row?.charge;
  const [tab, setTab] = useState<'price' | 'waive'>('price');

  // Seeded from the charge. A line the API has not yet given a price model to
  // falls back to its unit rate as the original — which is exactly what it is.
  const [originalRate, setOriginalRate] = useState(String(c?.originalRate ?? c?.unitRate ?? 0));
  const [discountType, setDiscountType] = useState<DiscountType>(c?.discountType ?? 'NONE');
  const [discountRate, setDiscountRate] = useState(String(c?.discountRate ?? 0));
  const [reason, setReason] = useState('');
  const [reasonCode, setReasonCode] = useState<WaiveReasonCode>('GOODWILL');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  if (!row || !c) return null;

  const base = Number(originalRate);
  const disc = Number(discountRate);
  const qty = c.quantity || 1;
  const selling = sellingRate(base, discountType, disc);
  const vatRate = c.amount > 0 ? c.taxAmount / c.amount : 0;
  const nextAmount = selling * qty;

  const baseOk = originalRate.trim() !== '' && Number.isFinite(base) && base >= 0;
  const discOk = discountType === 'NONE'
    || (discountRate.trim() !== '' && Number.isFinite(disc) && disc >= 0 && (discountType !== 'PCT' || disc <= 100));
  const changed = baseOk && (selling !== (c.unitRate ?? 0) || discountType !== (c.discountType ?? 'NONE'));
  const reasonOk = reason.trim().length >= 3;

  const canPrice = baseOk && discOk && changed && reasonOk;
  const canWaive = reasonOk;

  async function run(what: string, work: () => Promise<unknown>, done: string) {
    setBusy(what);
    setError(null);
    try {
      await work();
      onDone(done);
      onClose();
    } catch (e) {
      setError(apiProblem(e, what));
    } finally {
      setBusy(null);
    }
  }

  const save = () => c && run('price',
    () => repriceCharge(c.chargeId, {
      rowVersion: c.rowVersion, originalRate: base, discountType, discountRate: discountType === 'NONE' ? 0 : disc,
      reason: reason.trim(),
    }),
    `${c.chargeCode} repriced to ${amount(selling, c.currencyCode)}`);

  const waive = () => c && run('waive',
    () => waiveCharge(c.chargeId, { rowVersion: c.rowVersion, reasonCode, reason: reason.trim() }),
    `${c.chargeCode} waived`);

  const lock = () => c && run('lock',
    () => setChargeLock(c.chargeId, !c.isLocked, c.rowVersion),
    c.isLocked ? `${c.chargeCode} unlocked` : `${c.chargeCode} locked — Regenerate will leave it alone`);

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      closeOnBackdrop={false}
      title={`${c.chargeCode} — ${c.chargeName ?? 'charge'}`}
      subtitle={`${row.containerNo ?? 'box not yet named'}${r2(row.equipmentTypeCode)} · ${c.movementCode ?? 'no movement'} · ${payerLabel(c.payerCode, c.payerName)}`}
      footer={
        <>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" disabled={busy !== null} onClick={lock}>
            <Icon name="shieldCheck" size={13} /> {c.isLocked ? 'Unlock the rate' : 'Lock the rate'}
          </button>
          <span className="gecko-modal-footer-note gecko-flex-1">
            {!reasonOk ? 'A reason is kept on the charge.'
              : tab === 'price' && !changed ? 'Change the rate or the discount.'
                : !discOk ? 'The discount must be a positive number, and a percent cannot exceed 100.' : ''}
          </span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy !== null}>Cancel</button>
          {tab === 'price'
            ? (
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!canPrice || busy !== null} onClick={save}>
                <Icon name="check" size={13} /> {busy === 'price' ? 'Saving…' : 'Save the price'}
              </button>
            )
            : (
              <button className="gecko-btn gecko-btn-warning gecko-btn-sm" disabled={!canWaive || busy !== null} onClick={waive}>
                <Icon name="fileX" size={13} /> {busy === 'waive' ? 'Waiving…' : 'Waive this charge'}
              </button>
            )}
        </>
      }
    >
      <div className="gecko-stack">
        {error && (
          <div role="alert" className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={18} />
            <div><strong>{error.title}</strong><div>{error.detail}</div></div>
          </div>
        )}

        {c.isLocked && (
          <div className="gecko-alert gecko-alert-info">
            <Icon name="shieldCheck" size={16} />
            <span>This rate is locked. Regenerate will re-price every other line on the booking and leave this one as it is.</span>
          </div>
        )}

        <div className="gecko-kv-grid">
          <Kv label="Quantity" value={`${qty} ${(c.billingUnitCode ?? '').toLowerCase()}`.trim()} />
          <Kv label="Rate now" value={amount(c.unitRate, c.currencyCode)} />
          <Kv label="Amount" value={amount(c.amount, c.currencyCode)} />
          <Kv label="Priced by" value={c.scheduleNo ? `${c.scheduleNo}${c.scheduleVersionNo ? ` v${c.scheduleVersionNo}` : ''}` : 'no tariff'} />
        </div>

        <div className="gecko-row gecko-stack-xs">
          <button className={`gecko-btn gecko-btn-sm ${tab === 'price' ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
            onClick={() => setTab('price')}>Price it</button>
          <button className={`gecko-btn gecko-btn-sm ${tab === 'waive' ? 'gecko-btn-warning' : 'gecko-btn-outline'}`}
            onClick={() => setTab('waive')}>Waive it</button>
        </div>

        {tab === 'price' ? (
          <>
            <div className="gecko-grid-3">
              <Field label="Original rate" required>
                <input className="gecko-input" type="number" min={0} step="0.01" value={originalRate}
                  onChange={e => setOriginalRate(e.target.value)} />
              </Field>
              <Field label="Discount type">
                <select className="gecko-input" value={discountType}
                  onChange={e => setDiscountType(e.target.value as DiscountType)}>
                  {(['NONE', 'AMT', 'PCT'] as const).map(t => <option key={t} value={t}>{DISCOUNT_LABEL[t]}</option>)}
                </select>
              </Field>
              <Field label={discountType === 'PCT' ? 'Discount %' : 'Discount amount'}>
                <input className="gecko-input" type="number" min={0} step="0.01" disabled={discountType === 'NONE'}
                  max={discountType === 'PCT' ? 100 : undefined}
                  value={discountType === 'NONE' ? '' : discountRate} onChange={e => setDiscountRate(e.target.value)} />
              </Field>
            </div>

            {/* The arithmetic, spelled out. A clerk who cannot see how the
                selling rate was reached will not trust it on a dispute. */}
            <div className="gecko-price-working">
              <Row label="Original rate" value={amount(baseOk ? base : 0, c.currencyCode)} />
              {discountType !== 'NONE' && (
                <Row label={discountType === 'PCT' ? `Less ${disc || 0}%` : 'Less discount'}
                  value={`− ${amount(baseOk ? base - selling : 0, c.currencyCode)}`} />
              )}
              <Row label="Selling rate" value={amount(selling, c.currencyCode)} strong />
              <Row label={`× ${qty}`} value={amount(nextAmount, c.currencyCode)} />
              <Row label="VAT" value={amount(nextAmount * vatRate, c.currencyCode)} />
              <Row label="Total" value={amount(nextAmount * (1 + vatRate), c.currencyCode)} strong />
            </div>
          </>
        ) : (
          <>
            <div className="gecko-alert gecko-alert-warning">
              <Icon name="alertCircle" size={16} />
              <span>The whole {amount(c.total, c.currencyCode)} is forgiven. The line stays on the statement, marked waived.</span>
            </div>
            <Field label="Reason code" required>
              <select className="gecko-input" value={reasonCode} onChange={e => setReasonCode(e.target.value as WaiveReasonCode)}>
                {WAIVE_REASONS.map(r => <option key={r} value={r}>{WAIVE_REASON_LABEL[r]}</option>)}
              </select>
            </Field>
          </>
        )}

        <Field label={tab === 'waive' ? 'Note' : 'Reason for the price'} required>
          <textarea className="gecko-input gecko-textarea" rows={3} maxLength={500} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={tab === 'waive' ? 'Box arrived damaged; agreed with the customer' : 'Contract rate for CP INTERTRADE, confirmed by Khun A'} />
          <div className="gecko-helper-text">Kept on the charge with your name and the time.</div>
        </Field>
      </div>
    </Modal>
  );
}

const r2 = (v: string | null) => (v ? ` ${v}` : '');

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="gecko-cell-meta">{label}</div>
      <div className="gecko-mono" style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="gecko-form-group">
      <label className={`gecko-form-label${required ? ' gecko-form-label-required' : ''}`}>{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`gecko-price-working-row${strong ? ' gecko-price-working-row-strong' : ''}`}>
      <span>{label}</span>
      <span className="gecko-mono">{value}</span>
    </div>
  );
}

export { ApiError };
