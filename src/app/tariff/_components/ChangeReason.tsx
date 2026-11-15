"use client";
import React, { useCallback, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/lib/api/problem';
import { formatDate } from '@/lib/format';
import type { Schedule } from '@/lib/api/revenue';

/**
 * WHY AN APPROVED TARIFF IS CHANGED IN PLACE (owner 2026-11-14, AUDIT_TRAIL_PLAN A4).
 *
 * An APPROVED tariff that starts today or later (isEditable) may still be
 * edited, but every save of it — header, rates, free time, an upload into it —
 * must say why, 5–500 characters, and the API keeps that in the tariff's audit
 * trail. A DRAFT or PENDING tariff, and a TRUCKING quotation, need none: no
 * dialog, and nothing sent.
 */

export const REASON_MIN = 5;
export const REASON_MAX = 500;

export const needsChangeReason = (s: Pick<Schedule, 'status' | 'isEditable' | 'moduleCode'> | null | undefined): boolean =>
  !!s && s.status === 'APPROVED' && s.isEditable && s.moduleCode !== 'TRUCKING';

/** The clerk closed the dialog: nothing was sent, and nothing needs saying. */
export class ReasonCancelled extends Error {
  constructor() { super('Cancelled'); this.name = 'ReasonCancelled'; }
}
export const isReasonCancelled = (e: unknown): e is ReasonCancelled => e instanceof ReasonCancelled;

interface Asking {
  effectiveFrom: string;
  error: string | null;
  draft: string;
  resolve: (reason: string | null) => void;
}

export function useChangeReason() {
  const [asking, setAsking] = useState<Asking | null>(null);
  // The last reason given on this screen, offered again on the next save of
  // the same change rather than typed twice.
  const last = useRef('');

  const ask = useCallback((effectiveFrom: string, error: string | null, draft: string) =>
    new Promise<string | null>(resolve => setAsking({ effectiveFrom, error, draft, resolve })), []);

  /**
   * The reason for one save, or null when this tariff needs none. Throws
   * ReasonCancelled when the clerk closes the dialog.
   */
  const reasonFor = useCallback(async (s: Schedule | null | undefined, error: string | null = null): Promise<string | null> => {
    if (!s || !needsChangeReason(s)) return null;
    const reason = await ask(s.effectiveFrom, error, last.current);
    if (reason === null) throw new ReasonCancelled();
    last.current = reason;
    return reason;
  }, [ask]);

  /**
   * Run one save with its reason. If the API refuses the reason itself
   * (errors.reason), the dialog opens again with the server's words under the
   * field; any other refusal goes back to the caller as it came.
   */
  const withReason = useCallback(async <T,>(s: Schedule | null | undefined, send: (reason: string | null) => Promise<T>): Promise<T> => {
    let error: string | null = null;
    for (;;) {
      const reason = await reasonFor(s, error);
      try {
        return await send(reason);
      } catch (e) {
        const refused = reason !== null && e instanceof ApiError ? e.forField('reason') : null;
        if (!refused) throw e;
        error = refused;
      }
    }
  }, [reasonFor]);

  const close = (reason: string | null) => {
    asking?.resolve(reason);
    setAsking(null);
  };

  const dialog = asking && (
    <ChangeReasonDialog key={`${asking.error ?? ''}`} effectiveFrom={asking.effectiveFrom} error={asking.error}
      initial={asking.draft} onCancel={() => close(null)} onSave={text => close(text)} />
  );

  return { reasonFor, withReason, dialog };
}

function ChangeReasonDialog({ effectiveFrom, error, initial, onCancel, onSave }: {
  effectiveFrom: string;
  error: string | null;
  initial: string;
  onCancel: () => void;
  onSave: (reason: string) => void;
}) {
  const [text, setText] = useState(initial);
  const trimmed = text.trim();
  const ok = trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX;

  return (
    <Modal isOpen onClose={onCancel} size="md" closeOnBackdrop={false}
      title="Change an approved tariff"
      footer={
        <>
          <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel}>Cancel</button>
          <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!ok} onClick={() => onSave(trimmed)}>
            <Icon name="save" size={14} /> Save
          </button>
        </>
      }>
      <div className="gecko-form-group">
        <label className="gecko-form-label gecko-form-label-required" htmlFor="tariffChangeReason">
          This tariff is approved and already in force from {formatDate(effectiveFrom)}. Why is it changed in place?
        </label>
        <textarea id="tariffChangeReason" className={`gecko-textarea${error ? ' gecko-input-error' : ''}`} rows={3}
          autoFocus required aria-required="true" aria-invalid={error ? true : undefined}
          maxLength={REASON_MAX} value={text} onChange={e => setText(e.target.value)}
          placeholder="Kept in the tariff's audit log" />
        {error
          ? <div className="gecko-field-error">{error}</div>
          : <div className="gecko-helper-text">At least {REASON_MIN} characters. It is kept in the tariff&apos;s audit log.</div>}
      </div>
    </Modal>
  );
}
