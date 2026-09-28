"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { apiSend } from '@/lib/api/client';
import { ProblemAlert, problemOf, type Problem } from './ProblemAlert';
import {
  CHANNEL_LABEL, PAYMENT_CHANNELS, formatBaht, toSatang,
  type CloseShiftRequest, type OpenShiftRequest, type Shift,
} from '@/lib/api/window';

/**
 * The drawer: a cashier cannot take money without an open one (the API answers
 * 409 "Your drawer is not open at this branch"), so the bar sits above
 * everything else and is the first thing a new shift sees.
 */
export function DrawerBar({
  branchId, shift, loading, onChanged,
}: {
  branchId: string | null;
  shift: Shift | null;
  loading: boolean;
  onChanged: (shift: Shift | null) => void;
}) {
  const [float, setFloat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Problem | null>(null);
  const [closing, setClosing] = useState(false);

  async function open(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    const openingFloat = toSatang(Number(float || 0));
    if (Number.isNaN(openingFloat) || openingFloat < 0) { setError({ title: 'The float must be zero or more.', detail: null }); return; }
    setBusy(true); setError(null);
    try {
      const body: OpenShiftRequest = { branchId, openingFloat, currencyCode: 'THB' };
      onChanged(await apiSend<Shift>('POST', '/api/revenue/window/shifts', body));
      setFloat('');
    } catch (err) {
      setError(problemOf(err, 'The drawer could not be opened.'));
    } finally {
      setBusy(false);
    }
  }

  const expectedCash = shift?.expected.find(x => x.channel === 'CASH')?.amount ?? shift?.openingFloat ?? 0;
  const takenOther = (shift?.expected ?? []).filter(x => x.channel !== 'CASH').reduce((s, x) => s + x.amount, 0);

  return (
    <div className="gecko-card no-print" style={{ padding: '12px 16px' }}>
      {loading && !shift ? (
        <div className="gecko-text-muted">Checking your drawer…</div>
      ) : !shift ? (
        <form onSubmit={open} className="gecko-row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div className="gecko-row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="gecko-status-dot gecko-status-dot-warning" />
              <strong>Drawer closed</strong>
            </div>
            <div className="gecko-text-muted" style={{ fontSize: 13 }}>Count the float into the drawer and open it to start taking payment.</div>
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label" htmlFor="openingFloat">Opening float (฿)</label>
            <input id="openingFloat" className="gecko-input" type="number" min={0} step="0.01" inputMode="decimal"
              value={float} onChange={e => setFloat(e.target.value)} placeholder="0.00" style={{ width: 140 }} />
          </div>
          <button type="submit" className="gecko-btn gecko-btn-primary" disabled={busy || !branchId}>
            <Icon name="lock" size={16} /> {busy ? 'Opening…' : 'Open drawer'}
          </button>
          {error && <ProblemAlert problem={error} style={{ flexBasis: '100%' }} />}
        </form>
      ) : (
        <div className="gecko-row" style={{ gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="gecko-row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="gecko-status-dot gecko-status-dot-active" />
            <strong>Drawer open</strong>
            <span className="gecko-text-muted" style={{ fontSize: 13 }}>
              since {new Date(shift.openedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <Figure label="Float" value={formatBaht(shift.openingFloat)} />
          <Figure label="Cash expected in drawer" value={formatBaht(expectedCash)} strong />
          {takenOther > 0 && <Figure label="Non-cash taken" value={formatBaht(toSatang(takenOther))} />}
          <Figure label="Receipts" value={String(shift.receipts)} />
          <div style={{ marginLeft: 'auto' }}>
            <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setClosing(true)}>
              <Icon name="clipboardList" size={16} /> Close drawer
            </button>
          </div>
        </div>
      )}

      {shift && closing && (
        <CloseDrawerDialog shift={shift} onClose={() => setClosing(false)} onClosed={() => { setClosing(false); onChanged(null); }} />
      )}
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="gecko-text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: strong ? 18 : 15, fontWeight: strong ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

/**
 * Close = the cashier's count per channel. The API returns expected vs counted
 * and the variance; the dialog shows that answer before letting go, because a
 * variance is the one number a supervisor asks about tomorrow.
 */
function CloseDrawerDialog({ shift, onClose, onClosed }: { shift: Shift; onClose: () => void; onClosed: () => void }) {
  const expectedOf = (c: string) => shift.expected.find(x => x.channel === c)?.amount ?? 0;
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Problem | null>(null);
  const [result, setResult] = useState<Shift | null>(null);

  const counted = (c: string) => toSatang(Number(counts[c] || 0));
  const allCounted = PAYMENT_CHANNELS.every(c => (counts[c] ?? '') !== '' || expectedOf(c) === 0);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const body: CloseShiftRequest = {
        counts: PAYMENT_CHANNELS.map(channel => ({ channel, countedAmount: counted(channel) })),
        note: note.trim() || null,
      };
      setResult(await apiSend<Shift>('POST', `/api/revenue/window/shifts/${shift.shiftId}/close`, body));
    } catch (err) {
      setError(problemOf(err, 'The drawer could not be closed.'));
    } finally {
      setBusy(false);
    }
  }

  const rows = result
    ? result.counts
    : PAYMENT_CHANNELS.map(c => ({ channel: c, expected: expectedOf(c), counted: counted(c), variance: toSatang(counted(c) - expectedOf(c)) }));
  const totalVariance = toSatang(rows.reduce((s, r) => s + r.variance, 0));

  return (
    <Modal
      isOpen
      onClose={result ? onClosed : onClose}
      title={result ? 'Drawer closed' : 'Close drawer'}
      subtitle={result ? `${result.receipts} receipts this shift` : 'Count each channel. Cash includes the opening float.'}
      size="md"
      closeOnBackdrop={false}
      footer={result ? (
        <button className="gecko-btn gecko-btn-primary" onClick={onClosed}>Done</button>
      ) : (
        <>
          <button className="gecko-btn gecko-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary" onClick={submit} disabled={busy || !allCounted}>
            {busy ? 'Closing…' : 'Close drawer'}
          </button>
        </>
      )}
    >
      <table className="gecko-table gecko-table-compact" style={{ width: '100%' }}>
        <thead>
          <tr><th>Channel</th><th className="right">Expected</th><th className="right">Counted</th><th className="right">Variance</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.channel}>
              <td>{CHANNEL_LABEL[r.channel as keyof typeof CHANNEL_LABEL] ?? r.channel}</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatBaht(r.expected)}</td>
              <td style={{ textAlign: 'right' }}>
                {result ? formatBaht(r.counted) : (
                  <input className="gecko-input" type="number" min={0} step="0.01" inputMode="decimal"
                    style={{ width: 130, textAlign: 'right' }} placeholder="0.00"
                    value={counts[r.channel] ?? ''} onChange={e => setCounts(c => ({ ...c, [r.channel]: e.target.value }))} />
                )}
              </td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.variance === 0 ? undefined : 'var(--gecko-error-600, #b91c1c)' }}>
                {r.variance > 0 ? '+' : ''}{formatBaht(r.variance)}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={3}><strong>Total variance</strong></td>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>{totalVariance > 0 ? '+' : ''}{formatBaht(totalVariance)}</td>
          </tr>
        </tbody>
      </table>
      {!result && (
        <div className="gecko-form-group" style={{ marginTop: 12 }}>
          <label className="gecko-form-label" htmlFor="closeNote">Note {totalVariance !== 0 && '(explain the variance)'}</label>
          <input id="closeNote" className="gecko-input" value={note} onChange={e => setNote(e.target.value)} />
        </div>
      )}
      {error && <ProblemAlert problem={error} style={{ marginTop: 12 }} />}
    </Modal>
  );
}
