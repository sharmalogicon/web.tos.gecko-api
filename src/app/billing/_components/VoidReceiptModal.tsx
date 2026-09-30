"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/problem';
import { formatBaht, voidReceipt, type Receipt } from '@/lib/api/window';

/**
 * Void a wrong receipt — POST /api/revenue/window/receipts/{id}/void
 * (revenue.receipt.void). The receipt keeps its number and prints VOID, its
 * charges are cancelled and its gate coupons withdrawn; the customer then pays
 * again on a new receipt that names this one. The API refuses once the box has
 * moved on it (409), and says why.
 */
export function VoidReceiptModal({ receipt, onClose, onVoided }: {
  receipt: { receiptId: string; receiptNo: string; total: number; payerName?: string | null };
  onClose: () => void;
  onVoided: (voided: Receipt) => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFailure(null);
    try {
      onVoided(await voidReceipt(receipt.receiptId, reason.trim()));
    } catch (err) {
      setFailure(err instanceof ApiError ? err : new ApiError(0, 'The receipt could not be voided.'));
    } finally {
      setSaving(false);
    }
  }

  const fieldError = failure?.forField('reason');

  return (
    <Modal isOpen onClose={onClose} title={`Void ${receipt.receiptNo}`}
           subtitle={`${formatBaht(receipt.total)}${receipt.payerName ? ` · ${receipt.payerName}` : ''}`}>
      <form onSubmit={submit} className="gecko-stack">
        <div className="gecko-alert gecko-alert-warning">
          <Icon name="alertCircle" size={18} />
          <div>
            The receipt keeps its number and prints VOID. Its gate release is withdrawn, and the money comes out of the
            drawer&apos;s expected cash. To charge the customer correctly, take the payment again — the new receipt
            will say it replaces this one.
          </div>
        </div>
        <div className="gecko-form-group">
          <label className="gecko-form-label" htmlFor="voidReason">What was wrong</label>
          <input id="voidReason" className="gecko-input" autoFocus maxLength={300} value={reason}
                 placeholder="e.g. keyed the wrong customer" onChange={e => setReason(e.target.value)} />
          {fieldError && <div className="gecko-field-error">{fieldError}</div>}
        </div>
        {failure && !fieldError && (
          <div className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={18} />
            <div>
              <div style={{ fontWeight: 600 }}>{failure.title}</div>
              {failure.explanation && <div>{failure.explanation}</div>}
            </div>
          </div>
        )}
        <div className="gecko-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="gecko-btn gecko-btn-outline" onClick={onClose}>Keep it</button>
          <button type="submit" className="gecko-btn gecko-btn-danger" disabled={saving || reason.trim().length < 5}>
            <Icon name="x" size={14} /> {saving ? 'Voiding…' : 'Void receipt'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
