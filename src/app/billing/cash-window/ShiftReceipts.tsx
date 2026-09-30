"use client";
import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { apiGet } from '@/lib/api/client';
import { ProblemAlert, problemOf, type Problem } from './ProblemAlert';
import { formatBaht, type Receipt, type Shift, type ShiftReceipt } from '@/lib/api/window';
import { VoidReceiptModal } from '../_components/VoidReceiptModal';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/**
 * "Receipts this shift" — GET /window/shifts/{id}/receipts, the cashier's own
 * drawer only. Reprint re-reads the receipt (GET /window/receipts/{id}) and
 * shows it in the ordinary receipt view, where Print and Download PDF live.
 *
 * Collapsed by default: at ~140 receipts a day the list is for the driver who
 * comes back, not for every sale. It re-reads whenever the drawer's count moves.
 */
export function ShiftReceipts({ shift, onReprint, mayVoid = false, onVoided }: {
  shift: Shift; onReprint: (receipt: Receipt) => void; mayVoid?: boolean; onVoided?: (receipt: Receipt) => void;
}) {
  const [open, setOpen] = useState(false);
  const [voiding, setVoiding] = useState<ShiftReceipt | null>(null);
  const [rows, setRows] = useState<ShiftReceipt[] | null>(null);
  const [error, setError] = useState<Problem | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiGet<ShiftReceipt[]>(`/api/revenue/window/shifts/${shift.shiftId}/receipts`)
      .then(r => { if (!cancelled) { setRows(r); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) setError(problemOf(e, 'The receipts of this drawer could not be read.')); });
    return () => { cancelled = true; };
  }, [open, shift.shiftId, shift.receipts]);

  async function reprint(receiptId: string) {
    setOpening(receiptId); setError(null);
    try {
      onReprint(await apiGet<Receipt>(`/api/revenue/window/receipts/${receiptId}`));
    } catch (e) {
      setError(problemOf(e, 'The receipt could not be opened.'));
    } finally {
      setOpening(null);
    }
  }

  const right: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

  return (
    <div className="gecko-card no-print" style={{ padding: '10px 16px' }}>
      <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} /> Receipts this shift ({shift.receipts})
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {error && <ProblemAlert problem={error} style={{ marginBottom: 8 }} />}
          {rows === null && !error && <div className="gecko-text-muted">Loading…</div>}
          {rows !== null && rows.length === 0 && <div className="gecko-text-muted">No receipts issued from this drawer yet.</div>}
          {rows !== null && rows.length > 0 && (
            <table className="gecko-table gecko-table-compact" style={{ width: '100%' }}>
              <thead>
                <tr><th>Receipt</th><th>Time</th><th>Order</th><th>Payer</th><th style={right}>Total</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.receiptId}>
                    <td style={{ fontFamily: 'var(--gecko-font-mono, monospace)', fontWeight: 600 }}>{r.receiptNo}</td>
                    <td>{time(r.receiptAt)}</td>
                    <td>{r.orderNo ?? '—'}</td>
                    <td>{r.payerName}</td>
                    <td style={right}>{formatBaht(r.total)}</td>
                    <td>
                      <span className={`gecko-badge gecko-badge-xs ${r.status === 'ISSUED' ? 'gecko-badge-success' : 'gecko-badge-error'}`}>{r.status}</span>
                    </td>
                    <td style={right}>
                      <button type="button" className="gecko-btn gecko-btn-sm gecko-btn-outline" disabled={opening !== null}
                        onClick={() => void reprint(r.receiptId)}>
                        <Icon name="printer" size={14} /> {opening === r.receiptId ? 'Opening…' : 'Reprint'}
                      </button>
                      {mayVoid && r.status === 'ISSUED' && (
                        <button type="button" className="gecko-btn gecko-btn-sm gecko-btn-ghost" style={{ marginLeft: 4 }}
                          onClick={() => setVoiding(r)} title="Void this receipt — before the box has moved">
                          <Icon name="x" size={14} /> Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {voiding && (
        <VoidReceiptModal receipt={voiding} onClose={() => setVoiding(null)}
          onVoided={v => {
            setVoiding(null);
            setRows(rs => rs?.map(x => (x.receiptId === v.receiptId ? { ...x, status: v.status } : x)) ?? rs);
            onVoided?.(v);
          }} />
      )}
    </div>
  );
}
