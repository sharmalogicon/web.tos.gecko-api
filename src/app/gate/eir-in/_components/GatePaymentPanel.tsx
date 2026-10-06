"use client";
import React from 'react';
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
  const pending = moves.filter(m => !m.result);
  const drops = moves.filter(m => m.trip === 'DROP_OFF_CONT').length;
  const picks = moves.filter(m => m.trip === 'PICK_UP_CONT').length;
  const lines = pending.flatMap(m => m.due.map(d => ({ ...d, box: m.containerNo })));
  const later = pending.flatMap(m => m.billedLater.map(d => ({ ...d, box: m.containerNo })));
  const laterTotal = later.reduce((n, l) => n + l.total, 0);
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

      {!saved && (
        <button className="gecko-btn gecko-btn-primary" disabled={!canSave || saving} onClick={onSave}>
          <Icon name="check" size={14} />
          {saving ? 'Saving…'
            : cashTotal > 0 ? `Save and take ${money(wht ? nett : cashTotal, currency)}`
            : later.length > 0 ? 'Save — nothing to collect'
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
