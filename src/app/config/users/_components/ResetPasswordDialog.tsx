"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/FormGrid';
import { useToast } from '@/components/ui/Toast';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ApiError } from '@/lib/api/problem';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/api/client';
import { resetPassword, type UserSummary } from '@/lib/api/admin-users';

/**
 * GIVING SOMEBODY A NEW PASSWORD.
 *
 * Not the same thing as changing your own (that is ChangePasswordDialog, which
 * proves who is asking with the access token). This is an administrator acting
 * on an account that is not theirs, which is why it is a separate dialog with
 * a separate right behind it.
 *
 * It exists because a depot is not an office. A gate clerk locked out at 03:00
 * with a truck at the barrier cannot wait for a reset e-mail, and plenty of
 * booth staff have no work e-mail to send one to. The supervisor needs to be
 * able to hand them a password across the desk — so there are two ways:
 *
 *   TYPE ONE        the admin knows what they want it to be.
 *   MAKE ONE FOR ME the API invents it and tells us ONCE. It is shown with a
 *                   Copy button and is gone when the dialog closes — this
 *                   screen never stores it and no read can fetch it back.
 *
 * Either way the API signs that person out everywhere and clears any lockout,
 * and they sign in with the new password without being asked to change it —
 * Gecko has no first-login change screen to send them to.
 */
export function ResetPasswordDialog({ user, onClose }: {
  user: Pick<UserSummary, 'userId' | 'fullName' | 'email'>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'type' | 'generate'>('type');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  /** Set once, by the generate branch. Never read back from anywhere. */
  const [made, setMade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const who = user.fullName || user.email;
  const tooShort = next.length > 0 && next.length < PASSWORD_MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = mode === 'generate' || (next.length >= PASSWORD_MIN_LENGTH && next === confirm);

  const run = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const answer = await resetPassword(
        user.userId,
        mode === 'type' ? { newPassword: next, confirmPassword: confirm } : undefined,
      );
      if (mode === 'generate') {
        // No password in the answer means the API changed it but will not say
        // to what — which leaves nothing to hand over, so say exactly that
        // rather than show an empty box.
        setMade(answer?.password ?? null);
        setBusy(false);
        if (!answer?.password) {
          toast({
            variant: 'warning',
            title: 'Password changed',
            message: `The API did not return the new password for ${who}. Set one yourself instead.`,
          });
        }
        return;
      }
      toast({ variant: 'success', title: 'Password changed', message: `${who} can sign in with it now.` });
      onClose();
    } catch (e) {
      setFailure(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setBusy(false);
    }
  };

  const copy = () => {
    if (!made) return;
    void navigator.clipboard?.writeText(made).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const eye = (
    <button type="button" className="gecko-pw-eye" tabIndex={-1}
      title={show ? 'Hide' : 'Show'} onClick={() => setShow(v => !v)}>
      <Icon name={show ? 'eyeOff' : 'eye'} size={12} />
    </button>
  );

  // ── The password, shown the one time it exists ──
  if (made) {
    return (
      <Modal isOpen onClose={onClose} size="sm" title="New password"
        subtitle={`Give this to ${who}.`}
        footer={<button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={onClose}>Done</button>}>
        <div className="gecko-stack gecko-stack-md">
          <div className="gecko-pw-reveal">
            <code className="gecko-pw-reveal-value">{made}</code>
            <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={copy}>
              <Icon name={copied ? 'check' : 'copy'} size={13} /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="gecko-banner gecko-banner-warning">
            <Icon name="alertTriangle" size={15} className="gecko-banner-icon" />
            <div>
              <strong>It will not be shown again.</strong> Nothing stores it and no screen can fetch it
              back — if it is lost, reset the password again.
            </div>
          </div>
          <div className="gecko-cell-meta">
            {who} is signed out everywhere and any lockout is cleared. They sign in with this password
            as it is; they will not be asked to change it.
          </div>
        </div>
      </Modal>
    );
  }

  // ── Choosing how ──
  return (
    <Modal isOpen onClose={busy ? () => {} : onClose} size="sm" title="Reset password"
      subtitle={who}
      footer={
        <>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!ready || busy} onClick={() => void run()}>
            {busy
              ? <><span className="gecko-spinner gecko-spinner-sm gecko-spinner-white" /> Resetting…</>
              : <><Icon name="key" size={13} /> Reset password</>}
          </button>
        </>
      }>
      <div className="gecko-stack gecko-stack-md">
        {/* A 403 and a 409 here are both sentences an admin can act on — the
            server's own words, which name the tenant-admin rule or point at
            the portal / driver page where that login is reset instead. */}
        <ErrorBanner error={failure} detail={failure?.status === 400 ? false : undefined} />

        <div className="gecko-choice-row">
          <button type="button" disabled={busy}
            className={`gecko-choice${mode === 'type' ? ' gecko-choice-on' : ''}`}
            onClick={() => setMode('type')}>
            <Icon name="edit" size={14} />
            <span className="gecko-choice-label">Type a new password</span>
            <span className="gecko-choice-note">You decide what it is.</span>
          </button>
          <button type="button" disabled={busy}
            className={`gecko-choice${mode === 'generate' ? ' gecko-choice-on' : ''}`}
            onClick={() => setMode('generate')}>
            <Icon name="refresh" size={14} />
            <span className="gecko-choice-label">Make one for me</span>
            <span className="gecko-choice-note">Shown once, then gone.</span>
          </button>
        </div>

        {mode === 'type' ? (
          <>
            <Field label="New password" required
              error={tooShort ? `At least ${PASSWORD_MIN_LENGTH} characters.` : failure?.forField('newPassword')}
              helper={!tooShort ? `${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.` : undefined}>
              <div className="gecko-pw-wrap">
                <input className="gecko-input" type={show ? 'text' : 'password'} value={next} autoFocus
                  maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" disabled={busy}
                  onChange={e => setNext(e.target.value)} />
                {eye}
              </div>
            </Field>

            <Field label="Confirm new password" required
              error={mismatch ? 'The two do not match.' : failure?.forField('confirmPassword')}>
              <div className="gecko-pw-wrap">
                <input className="gecko-input" type={show ? 'text' : 'password'} value={confirm}
                  maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" disabled={busy}
                  onChange={e => setConfirm(e.target.value)} />
                {eye}
              </div>
            </Field>
          </>
        ) : (
          <div className="gecko-cell-meta">
            The API invents a password and returns it once. Copy it before closing this dialog —
            there is no way to read it again.
          </div>
        )}

        <div className="gecko-cell-meta">
          {who} is signed out everywhere and any lockout is cleared. They sign in with the new password
          as it is; Gecko does not ask them to change it.
        </div>
      </div>
    </Modal>
  );
}
