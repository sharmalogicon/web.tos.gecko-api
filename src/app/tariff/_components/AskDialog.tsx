"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { DateField } from '@/components/ui/DateField';

/**
 * Asking the clerk one thing, in Gecko's own voice.
 *
 * These were `window.prompt` and `window.confirm`. Those are the browser's
 * dialogs, not the product's: they carry the host name, they cannot say what
 * the answer is for, they ignore every style the rest of the screen keeps, and
 * a date typed into one is unvalidated text. On a price that a customer has
 * been quoted, "Why is this being unapproved?" deserves better than a grey box
 * from Chrome.
 */

export type AskKind = 'reason' | 'date' | 'confirm';

export interface AskRequest {
  kind: AskKind;
  title: string;
  /** One line under the title: what answering actually does. */
  subtitle?: string;
  label?: string;
  placeholder?: string;
  initial?: string;
  confirmLabel: string;
  /** Destructive answers get the red button. */
  danger?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
}

export function AskDialog({ ask, onClose }: { ask: AskRequest | null; onClose: () => void }) {
  const [value, setValue] = useState(ask?.initial ?? '');
  const [busy, setBusy] = useState(false);

  if (!ask) return null;

  // A reason is the whole point of asking; an empty one is not an answer.
  const ready = ask.kind === 'confirm' || value.trim().length > 0;

  async function go() {
    if (!ready || !ask) return;
    setBusy(true);
    try {
      await ask.onConfirm(value.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      title={ask.title}
      subtitle={ask.subtitle}
      footer={
        <>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={`gecko-btn gecko-btn-sm ${ask.danger ? 'gecko-btn-danger' : 'gecko-btn-primary'}`}
            disabled={!ready || busy}
            onClick={go}>
            <Icon name={ask.danger ? 'trash' : 'check'} size={13} />
            {busy ? 'Working…' : ask.confirmLabel}
          </button>
        </>
      }
    >
      {ask.kind === 'confirm' ? null : (
        <div className="gecko-form-group">
          {ask.label && <label className="gecko-form-label">{ask.label}</label>}
          {ask.kind === 'date' ? (
            <DateField value={value} onChange={setValue} aria-label={ask.label ?? 'Date'} />
          ) : (
            <textarea
              className="gecko-input gecko-textarea"
              rows={3}
              value={value}
              maxLength={300}
              autoFocus
              placeholder={ask.placeholder}
              onChange={e => setValue(e.target.value)} />
          )}
        </div>
      )}
    </Modal>
  );
}
