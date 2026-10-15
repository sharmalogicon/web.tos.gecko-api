"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/FormGrid';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, changePassword } from '@/lib/api/client';

/**
 * CHANGING YOUR OWN PASSWORD.
 *
 * `POST /auth/password` takes the new password twice and nothing else: the
 * access token is what proves who is asking. There is no email field and no
 * current-password field because the endpoint wants neither.
 *
 * It lived on the LOGIN page until 2026-10-15, posted anonymously to a route
 * that does not exist. Signed in is the only place it can work.
 *
 * The two are matched here because the server never sees the confirmation as a
 * mismatch worth a sentence — it just refuses. Everything else the server
 * refuses is shown in the server's own words.
 */

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  const tooShort = next.length > 0 && next.length < PASSWORD_MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = next.length >= PASSWORD_MIN_LENGTH && next === confirm;

  const save = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await changePassword(next, confirm);
      toast({
        variant: 'success',
        title: 'Password changed',
        message: 'The old one stops working now. You stay signed in here.',
      });
      onClose();
    } catch (e) {
      setFailure(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setBusy(false);
    }
  };

  const eye = (
    <button type="button" className="gecko-pw-eye" tabIndex={-1}
      title={show ? 'Hide' : 'Show'} onClick={() => setShow(v => !v)}>
      <Icon name={show ? 'eyeOff' : 'eye'} size={12} />
    </button>
  );

  return (
    <Modal isOpen onClose={busy ? () => {} : onClose} size="sm" title="Change password"
      subtitle="Your new password, typed twice."
      footer={
        <>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!ready || busy} onClick={() => void save()}>
            {busy
              ? <><span className="gecko-spinner gecko-spinner-sm gecko-spinner-white" /> Changing…</>
              : <><Icon name="check" size={13} /> Change password</>}
          </button>
        </>
      }>
      <div className="gecko-stack gecko-stack-md">
        {failure && (
          <div className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={16} />
            <div>
              <strong>{failure.title}</strong>
              <div>{failure.forField('newPassword') ?? failure.explanation ?? failure.message}</div>
            </div>
          </div>
        )}

        <Field label="New password" required
          error={tooShort ? `At least ${PASSWORD_MIN_LENGTH} characters.` : undefined}
          helper={!tooShort ? `${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.` : undefined}>
          <div className="gecko-pw-wrap">
            <input className="gecko-input" type={show ? 'text' : 'password'} value={next} autoFocus
              maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" disabled={busy}
              onChange={e => setNext(e.target.value)} />
            {eye}
          </div>
        </Field>

        <Field label="Confirm new password" required
          error={mismatch ? 'The two do not match.' : undefined}>
          <div className="gecko-pw-wrap">
            <input className="gecko-input" type={show ? 'text' : 'password'} value={confirm}
              maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" disabled={busy}
              onChange={e => setConfirm(e.target.value)} />
            {eye}
          </div>
        </Field>

        <div className="gecko-cell-meta">
          The old password stops working straight away. This session stays signed in, and any other device
          signed in as this account keeps working until its session ends.
        </div>
      </div>
    </Modal>
  );
}
