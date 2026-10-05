"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { useApi } from '@/lib/api/use-api';
import { visitQuotePath, type VisitQuote } from '@/lib/api/window';
import { MODE_LABELS, rowIssues, type MoveDraft } from './visit-moves';

/**
 * The visit, as it stands.
 *
 * THE MONEY IS READ, NEVER COMPUTED HERE. `GET /window/quote-visit` answers
 * what the visit actually cost once its boxes are gated — cash taken at the
 * window against credit going on an account. A 404 is a legitimate answer
 * ("nothing is charged on this visit"), not a failure, and it is also what you
 * get for a second or two while the gate event catches up.
 *
 * It is NOT a pre-payment quote. Cash is paid at the window BEFORE the barrier,
 * when no visit exists yet — that is a different endpoint on a different
 * screen. Showing a total here before anything is recorded would invite a clerk
 * to collect against a number nothing stands behind.
 *
 * The June design also carried a TEU capacity bar ("0 / 2 TEU, 2 available").
 * Nothing models a truck's capacity — not the API, not the schema — so the bar
 * could only ever have counted to a limit this screen made up. It is gone.
 */
export function VisitSummaryRail({ moves, truckVisitId, visitNo }: {
  moves: MoveDraft[];
  truckVisitId: string | null;
  visitNo: string | null;
}) {
  const recorded = moves.filter(m => m.recorded);
  const drops = recorded.filter(m => m.trip === 'DROP_OFF_CONT').length;
  const picks = recorded.filter(m => m.trip === 'PICK_UP_CONT').length;
  const pending = moves.filter(m => !m.recorded);
  const blocking = pending.reduce((n, m) => n + (rowIssues(m).length > 0 ? 1 : 0), 0);

  const mode = drops && picks ? 'PICKUP_DROPOFF' : drops ? 'DROPOFF' : picks ? 'PICKUP' : 'NONE';

  // Only ask once a box is through: before that there is nothing to price.
  const quote = useApi<VisitQuote>(truckVisitId && recorded.length > 0 ? visitQuotePath(truckVisitId) : null);
  const money = quote.data;
  const nothingCharged = !!quote.error && quote.error.status === 404;

  return (
    <aside className="gecko-card gecko-card-padded gecko-stack gecko-visit-rail">
      <div className="gecko-row gecko-row-between gecko-row-start">
        <div>
          <div className="gecko-card-title">Visit summary</div>
          <div className="gecko-card-subtitle">
            {visitNo ? <>Open · <span className="gecko-text-mono">{visitNo}</span></> : 'Not started'}
          </div>
        </div>
        <span className="gecko-visit-mode-chip">{MODE_LABELS[mode]}</span>
      </div>

      <div className="gecko-visit-counts">
        <Count label="Drop-offs" value={drops} tone="in" />
        <Count label="Pick-ups" value={picks} tone="out" />
      </div>

      <div className="gecko-visit-block">
        <div className="gecko-eyebrow">Charges</div>
        {!truckVisitId || recorded.length === 0 ? (
          <div className="gecko-cell-meta">Nothing recorded yet.</div>
        ) : quote.loading ? (
          <div className="gecko-cell-meta">Reading…</div>
        ) : nothingCharged ? (
          <div className="gecko-cell-meta">Nothing is charged on this visit.</div>
        ) : quote.error ? (
          <div className="gecko-field-error">{quote.error.message}</div>
        ) : money ? (
          <div className="gecko-stack-sm">
            {money.boxes.map(box => (
              <div key={box.gateTransactionId ?? box.containerNo} className="gecko-visit-charge-box">
                <div className="gecko-row gecko-row-between">
                  <span className="gecko-text-mono gecko-visit-charge-box-no">{box.containerNo}</span>
                  <span className="gecko-cell-meta">{box.movementCode}</span>
                </div>
                {box.lines.map((l, i) => (
                  <div key={`${l.chargeCode}-${i}`} className="gecko-visit-charge-line">
                    <span className="gecko-flex-1 gecko-min-w-0">
                      {l.description || l.chargeCode}
                      <span className="gecko-cell-meta"> · {l.paymentTerm}</span>
                    </span>
                    <span className="gecko-text-mono">{fmt(l.sellingAmount, money.currencyCode)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="gecko-visit-total-block">
              <Total label="Paid at the window" money={money.paidNow} currency={money.currencyCode} />
              <Total label="Billed later" money={money.billedLater} currency={money.currencyCode} muted />
            </div>
          </div>
        ) : null}
      </div>

      <div className="gecko-visit-block">
        <div className="gecko-eyebrow">Still to do</div>
        {pending.length === 0 ? (
          <div className="gecko-visit-ok">
            <Icon name="check" size={13} /> Every box on this truck is recorded.
          </div>
        ) : blocking === 0 ? (
          <div className="gecko-visit-ok">
            <Icon name="check" size={13} /> {pending.length} box{pending.length === 1 ? '' : 'es'} ready to record.
          </div>
        ) : (
          <div className="gecko-visit-warn">
            <Icon name="alertCircle" size={13} /> {blocking} box{blocking === 1 ? '' : 'es'} still need filling in.
          </div>
        )}
      </div>
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

function Total({ label, money, currency, muted }: {
  label: string; money: { amount: number; vat: number; total: number } | null; currency: string | null; muted?: boolean;
}) {
  if (!money) return null;
  return (
    <div className={`gecko-visit-total${muted ? ' gecko-visit-total-muted' : ''}`}>
      <div className="gecko-row gecko-row-between">
        <span>{label}</span>
        <span className="gecko-text-mono gecko-visit-total-value">{fmt(money.total, currency)}</span>
      </div>
      <div className="gecko-cell-meta">
        {fmt(money.amount, currency)} + VAT {fmt(money.vat, currency)}
      </div>
    </div>
  );
}

const fmt = (n: number | null | undefined, currency: string | null) =>
  n == null ? '—' : `${currency ?? 'THB'} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
