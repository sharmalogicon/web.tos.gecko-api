"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { TRUCK_LIMIT_NOTE } from '@/lib/api/gate-trips';
import type { MoveDraft } from './visit-moves';

/**
 * What the truck owes, and the one button that commits it.
 *
 * The money is taken HERE, at Gate In, for both drop-offs and pick-ups — a
 * pick-up is paid for when it is announced, not when it is released, which is
 * why Gate Out takes none (§25).
 *
 * The lines are the quote's, never this screen's arithmetic: a charge the UI
 * worked out itself is a number nobody can reconcile against a receipt. The one
 * sum done here is withholding, and only to show the clerk what the customer
 * will hand over — the server is told `withholdingTax: true` and decides.
 */
export function GatePaymentPanel({
  moves, visitNo, modeLabel, cashTotal, cashTax, withholdingTax, nett,
  wht, onWht, payerName, onPayerName, saving, canSave, saved, onSave,
}: {
  moves: MoveDraft[];
  visitNo: string | null;
  modeLabel: string;
  cashTotal: number;
  cashTax: number;
  withholdingTax: number;
  nett: number;
  wht: boolean;
  onWht: (on: boolean) => void;
  payerName: string;
  onPayerName: (v: string) => void;
  saving: boolean;
  canSave: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  // Shut by default: they are not money, and the clerk opens them only to
  // check what the depot did for free.
  const [showUnpriced, setShowUnpriced] = useState(false);
  const pending = moves.filter(m => !m.result);
  const drops = moves.filter(m => m.trip === 'DROP_OFF_CONT').length;
  const picks = moves.filter(m => m.trip === 'PICK_UP_CONT').length;
  const lines = pending.flatMap(m => m.due.map(d => ({ ...d, box: m.containerNo })));
  const later = pending.flatMap(m => m.billedLater.map(d => ({ ...d, box: m.containerNo })));
  const laterTotal = later.reduce((n, l) => n + l.total, 0);
  /**
   * Charges no tariff prices.
   *
   * The API stopped refusing a Save over these on 2026-10-07 (desktop parity):
   * an unpriced CASH charge is simply NOT charged, and the receipt carries the
   * priced lines. So they are listed under the money — a clerk has to know the
   * service happened and was not billed — but they add nothing to the totals
   * and they do not hold the Save.
   */
  const unpriced = pending.flatMap(m => m.noPrice.map(d => ({ ...d, box: m.containerNo })));
  /**
   * Charges already dealt with — prepaid on an earlier receipt, or waived.
   *
   * They owe nothing and are in no total; they are here because a box whose
   * lift was paid last week looks, without them, exactly like a box nobody
   * charged for it. The note is the server's own sentence, receipt number and
   * all, so the clerk can quote it to a driver who argues.
   */
  const settled = pending.flatMap(m => m.settled.map(d => ({ ...d, box: m.containerNo })));
  // A quote that could NOT BE READ is a different thing: that is a failure, not
  // a price, and it still blocks the Save.
  const failed = pending.filter(m => m.quoteError);
  const currency = lines[0]?.currencyCode ?? later[0]?.currencyCode ?? 'THB';

  // Vector offers withholding only over ฿1,000 (§8).
  const mayWithhold = cashTotal > 1000;

  return (
    <aside className="gecko-card gecko-card-padded gecko-stack gecko-visit-rail">
      <div className="gecko-row gecko-row-between gecko-row-start">
        <div>
          <div className="gecko-card-title">This truck</div>
          <div className="gecko-card-subtitle">
            {visitNo ? <span className="gecko-text-mono">{visitNo}</span> : 'Not saved yet'}
          </div>
        </div>
        <span className="gecko-visit-mode-chip">{modeLabel}</span>
      </div>

      <div className="gecko-visit-counts">
        <Count label="Drop-offs" value={drops} tone="in" />
        <Count label="Pick-ups" value={picks} tone="out" />
      </div>
      <div className="gecko-cell-meta">{TRUCK_LIMIT_NOTE}</div>

      <div className="gecko-visit-block">
        <div className="gecko-eyebrow">Payment details</div>
        {lines.length === 0 ? (
          <div className="gecko-cell-meta">
            {later.length > 0
              /* Not "unpriced": every charge has a price and is owed — a
                 haulier on credit terms simply does not pay it at the gate. */
              ? 'Nothing to pay now — it all goes on the account below.'
              /* A box whose charges were all settled earlier is NOT a box
                 nobody priced. Saying "nothing priced yet" there would send the
                 clerk hunting for a tariff that did its job weeks ago. */
              : settled.length > 0
                ? 'Nothing to pay — paid in advance.'
                : 'Nothing priced yet. Record a box to see what it costs.'}
          </div>
        ) : (
          <div className="gecko-stack-sm">
            {lines.map((l, i) => (
              <div key={`${l.chargeCode}-${i}`} className="gecko-visit-charge-line">
                <span className="gecko-flex-1 gecko-min-w-0">
                  {l.chargeName || l.chargeCode}
                  <span className="gecko-cell-meta"> · {l.paymentTermCode ?? 'CASH'}</span>
                </span>
                <span className="gecko-text-mono">{money(l.total, currency)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Already dealt with: listed under what IS owed, muted, with the
            server's own note. A waiver carries no amount — nothing was taken —
            so none is printed, rather than a misleading ฿0.00. */}
        {settled.length > 0 && (
          <div className="gecko-stack-xs gecko-visit-settled">
            {settled.map((l, i) => (
              <div key={`st-${l.chargeCode}-${i}`} className="gecko-visit-charge-line">
                <span className="gecko-flex-1 gecko-min-w-0">
                  {l.chargeName || l.chargeCode}
                  {l.note && <span className="gecko-cell-meta"> · {l.note}</span>}
                </span>
                {l.amount !== null && l.amount > 0 && (
                  <span className="gecko-text-mono gecko-cell-meta">{money(l.amount, currency)}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* FOLDED AWAY (owner, 2026-10-08). These are not money: they add
            nothing to the total and they do not hold the Save, and listing
            three of them under a two-line bill made the panel read as though
            something were wrong. One quiet line says how many, and opens them
            — the service still happened and was still not billed. */}
        {unpriced.length > 0 && (
          <div className="gecko-visit-unpriced">
            <button className="gecko-visit-unpriced-toggle" aria-expanded={showUnpriced}
              onClick={() => setShowUnpriced(v => !v)}>
              <Icon name={showUnpriced ? 'chevronDown' : 'chevronRight'} size={11} />
              {unpriced.length} charge{unpriced.length === 1 ? '' : 's'} not billed — no tariff
            </button>
            {showUnpriced && (
              <div className="gecko-stack-xs gecko-mt-1">
                {unpriced.map((l, i) => (
                  <div key={`np-${l.chargeCode}-${i}`} className="gecko-visit-charge-line">
                    <span className="gecko-flex-1 gecko-min-w-0">
                      {l.chargeName || l.chargeCode}
                      <span className="gecko-cell-meta"> · {l.chargeCode}</span>
                    </span>
                    <span className="gecko-cell-meta">not charged</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* A quote that could not be read is NOT a quote of zero. */}
        {failed.map(m => (
          <div key={`err-${m.key}`} role="alert" className="gecko-alert gecko-alert-error gecko-visit-quote-problem">
            <Icon name="alertCircle" size={14} />
            <span>Could not price {m.containerNo || 'this box'}: {m.quoteError}</span>
          </div>
        ))}

      </div>

      {later.length > 0 && (
        <div className="gecko-visit-block">
          <div className="gecko-eyebrow">Billed later</div>
          <div className="gecko-stack-sm">
            {later.map((l, i) => (
              <div key={`${l.chargeCode}-${i}`} className="gecko-visit-charge-line">
                <span className="gecko-flex-1 gecko-min-w-0">
                  {l.chargeName || l.chargeCode}
                  {l.byHaulierTerm && (
                    <span className="gecko-cell-meta"> · on the haulier&apos;s credit term</span>
                  )}
                </span>
                <span className="gecko-text-mono">{money(l.total, currency)}</span>
              </div>
            ))}
            <div className="gecko-row gecko-row-between gecko-visit-total gecko-visit-total-muted">
              <span>On account</span>
              <span className="gecko-text-mono">{money(laterTotal, currency)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="gecko-visit-block">
        <div className="gecko-eyebrow">Payment summary</div>
        <Sum label="Amount" value={money(cashTotal - cashTax, currency)} />
        <Sum label="VAT" value={money(cashTax, currency)} />
        <Sum label="Total" value={money(cashTotal, currency)} strong />

        {mayWithhold && (
          <label className="gecko-row gecko-gap-1 gecko-wht-row">
            <input type="checkbox" className="gecko-checkbox" checked={wht} disabled={saved}
              onChange={e => onWht(e.target.checked)} />
            <span>Withholding tax 3%</span>
          </label>
        )}
        {wht && mayWithhold && (
          <>
            <Sum label="Withholding" value={`− ${money(withholdingTax, currency)}`} />
            <Sum label="Nett payable" value={money(nett, currency)} strong />
          </>
        )}

        <div className="gecko-form-group gecko-mt-1">
          <label className="gecko-form-label">Receipt made out to</label>
          <input className="gecko-input" value={payerName} disabled={saved}
            placeholder="The first box's customer"
            onChange={e => onPayerName(e.target.value)} />
        </div>
      </div>

      {/* A box whose price could not be read must not be saved: the Save
          carries expectedTotal, and sending one taken from a failed quote is
          how a truck leaves having paid the wrong amount. */}
      {!saved && (
        <button className="gecko-btn gecko-btn-primary"
          disabled={!canSave || saving || failed.length > 0}
          title={failed.length > 0 ? 'Re-check the box that could not be priced, or remove it' : undefined}
          onClick={onSave}>
          {saving ? <span className="gecko-spinner gecko-spinner-sm gecko-spinner-white" /> : <Icon name="check" size={14} />}
          {saving ? 'Saving…'
            : cashTotal > 0 ? `Save and take ${money(wht ? nett : cashTotal, currency)}`
            : later.length > 0 ? 'Save — nothing to collect'
            // Nothing to take because it was taken already. The Save sends no
            // payment at all (page.tsx: `payment: cashTotal > 0 ? … : null`),
            // and the button should say which kind of nothing this is.
            : settled.length > 0 ? 'Save — paid in advance'
            : 'Save gate transactions'}
        </button>
      )}

      {!saved && pending.some(m => m.bookingContainerId && !m.reserved) && (
        <div className="gecko-cell-meta">
          Record each box first — it holds its place and prices it.
        </div>
      )}
    </aside>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: 'in' | 'out' }) {
  return (
    <div className={`gecko-visit-count gecko-visit-count-${tone}`}>
      <div className="gecko-visit-count-value">{value}</div>
      <div className="gecko-visit-count-label">{label}</div>
    </div>
  );
}

function Sum({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`gecko-row gecko-row-between gecko-visit-total${strong ? '' : ' gecko-visit-total-muted'}`}>
      <span>{label}</span>
      <span className="gecko-text-mono">{value}</span>
    </div>
  );
}

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
