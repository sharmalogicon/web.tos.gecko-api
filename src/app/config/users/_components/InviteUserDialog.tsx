"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/FormGrid';
import { useToast } from '@/components/ui/Toast';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ApiError } from '@/lib/api/problem';
import { useBranches } from '@/lib/api/org';
import { inviteUser, type RoleSummary } from '@/lib/api/admin-users';

/**
 * GECKO ADDS PEOPLE BY INVITATION.
 *
 * There is no "create user with a password" call: the account is made when the
 * person accepts, which is what keeps the e-mail proven and the password known
 * only to them. So this dialog sends an invitation and nothing else.
 *
 * For booth staff with no work e-mail that is not enough on its own — the way
 * round is to invite them on any address the depot controls, then set the
 * password with Reset password once the account exists, and hand it over. The
 * note at the foot says so, because it is not guessable from the form.
 */
export function InviteUserDialog({ roles, onClose, onInvited }: {
  roles: RoleSummary[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const { toast } = useToast();
  const { branches } = useBranches();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  const ready = email.trim().includes('@') && !!roleId;

  const send = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await inviteUser({
        email: email.trim(),
        roleId,
        fullName: fullName.trim() || null,
        branchId: branchId || null,
      });
      toast({ variant: 'success', title: 'Invitation sent', message: email.trim() });
      onInvited();
      onClose();
    } catch (e) {
      setFailure(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={busy ? () => {} : onClose} size="sm" title="Invite a user"
      subtitle="They set their own password when they accept."
      footer={
        <>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!ready || busy} onClick={() => void send()}>
            {busy
              ? <><span className="gecko-spinner gecko-spinner-sm gecko-spinner-white" /> Sending…</>
              : <><Icon name="send" size={13} /> Send invitation</>}
          </button>
        </>
      }>
      <div className="gecko-stack gecko-stack-md">
        <ErrorBanner error={failure} />

        <Field label="E-mail" required error={failure?.forField('email')}>
          <input className="gecko-input" type="email" value={email} autoFocus autoComplete="off"
            disabled={busy} onChange={e => setEmail(e.target.value)} />
        </Field>

        <Field label="Full name" helper="Optional — they can set it themselves.">
          <input className="gecko-input" value={fullName} maxLength={200} disabled={busy}
            onChange={e => setFullName(e.target.value)} />
        </Field>

        <Field label="Role" required error={failure?.forField('roleId')}>
          <select className="gecko-select" value={roleId} disabled={busy}
            onChange={e => setRoleId(e.target.value)}>
            <option value="">— choose a role —</option>
            {roles.filter(r => r.isActive).map(r => (
              <option key={r.roleId} value={r.roleId}>{r.displayName}</option>
            ))}
          </select>
        </Field>

        <Field label="Depot" helper="Leave as every depot unless this person works at one only.">
          <select className="gecko-select" value={branchId} disabled={busy}
            onChange={e => setBranchId(e.target.value)}>
            <option value="">Every depot</option>
            {branches.map(b => <option key={b.branchId} value={b.branchId}>{b.displayName}</option>)}
          </select>
        </Field>

        <div className="gecko-cell-meta">
          No work e-mail? Invite them on an address the depot controls, then use <strong>Reset password</strong>
          {' '}on the account and hand the password over.
        </div>
      </div>
    </Modal>
  );
}
