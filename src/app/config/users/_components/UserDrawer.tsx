"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Field } from '@/components/ui/FormGrid';
import { useToast } from '@/components/ui/Toast';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api/problem';
import { useApi } from '@/lib/api/use-api';
import { useBranches } from '@/lib/api/org';
import { useSession } from '@/lib/auth/session';
import {
  addRole, deleteUser, removeRole, saveBranches, saveProfile, saveUserName,
  setUserActive, statusLabel, statusTone, unlockUser, userPath,
  type RoleSummary, type UserDetail, type UserSummary,
} from '@/lib/api/admin-users';

/**
 * ONE ACCOUNT, OPEN FOR EDITING.
 *
 * The API splits this account into five separate writes — the profile, the
 * sign-in name, the depots, each role grant, and the enable/disable/unlock
 * switch — and each one answers with the whole user. So the drawer holds the
 * server's answer as its truth and replaces it after every save, rather than
 * patching a local copy and hoping the two agree.
 *
 * Each section saves on its own, for the same reason the API split them: a
 * supervisor fixing a typo in a phone number should not also be re-sending
 * that person's roles.
 */
export function UserDrawer({ user, roles, onClose, onChanged }: {
  user: UserSummary;
  roles: RoleSummary[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { user: me } = useSession();
  const { branches } = useBranches();
  const detail = useApi<UserDetail>(userPath(user.userId));
  const [live, setLive] = useState<UserDetail | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The server's answer is the truth; the form fields below are drafts of it.
  const shown = live ?? detail.data;
  const isSelf = me?.userId === user.userId;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [userName, setUserName] = useState('');

  /**
   * FILL THE DRAFTS WHEN A NEW VERSION OF THE ACCOUNT ARRIVES — on open, and
   * after each save, since every write answers with the whole user.
   *
   * Adjusted during render rather than in an effect. An effect would paint the
   * empty boxes once before filling them, and typing into a field that is
   * about to be overwritten a frame later loses the keystroke. `updatedAt`
   * moves on every write, so it is what tells one version from the next.
   * https://react.dev/learn/you-might-not-need-an-effect
   */
  const stamp = shown ? `${shown.userId}|${shown.updatedAt}` : null;
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  if (shown && stamp !== filledFrom) {
    setFilledFrom(stamp);
    setFullName(shown.fullName ?? '');
    setPhone(shown.phone ?? '');
    setJobTitle(shown.jobTitle ?? '');
    setUserName(shown.userName ?? '');
  }

  /** Every write goes through here: one busy flag, one refusal, one refresh. */
  const run = async (what: string, call: () => Promise<UserDetail | void>, said: string) => {
    setBusy(what);
    setFailure(null);
    try {
      const answer = await call();
      if (answer) setLive(answer);
      toast({ variant: 'success', title: said, message: shown?.fullName ?? user.fullName });
      onChanged();
    } catch (e) {
      setFailure(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setBusy(null);
    }
  };

  const removeDone = async () => {
    setConfirmDelete(false);
    setBusy('delete');
    setFailure(null);
    try {
      await deleteUser(user.userId);
      toast({ variant: 'success', title: 'User removed', message: user.fullName || user.email });
      onChanged();
      onClose();
    } catch (e) {
      setFailure(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setBusy(null);
    }
  };

  const toggleBranch = (branchId: string) => {
    if (!shown) return;
    const held = shown.branches.map(b => b.branchId);
    const next = held.includes(branchId) ? held.filter(b => b !== branchId) : [...held, branchId];
    void run('branches', () => saveBranches(user.userId, next), 'Depots saved');
  };

  const profileDirty = !!shown && (
    fullName !== (shown.fullName ?? '')
    || phone !== (shown.phone ?? '')
    || jobTitle !== (shown.jobTitle ?? '')
  );
  const nameDirty = !!shown && userName !== (shown.userName ?? '');

  return (
    <>
      <div className="gecko-drawer-scrim" onClick={onClose} />
      <aside className="gecko-drawer gecko-drawer-lg" role="dialog" aria-modal="true" aria-label="User">
        <div className="gecko-drawer-header">
          <div className="gecko-flex-1">
            <div className="gecko-drawer-title">{user.fullName || user.email}</div>
            <div className="gecko-drawer-subtitle">{user.email}</div>
          </div>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="gecko-drawer-body gecko-stack gecko-stack-lg">
          <ErrorBanner error={failure} />

          {detail.loading && !shown && <div className="gecko-cell-meta">Reading the account…</div>}
          <ErrorBanner error={detail.error} heading="This account could not be read" />

          {shown && (
            <>
              {/* ── What the account is doing ── */}
              <div className="gecko-row gecko-row-wrap gecko-admin-state">
                <span className={`gecko-pill gecko-pill-${statusTone(shown.status)}`}>{statusLabel(shown.status)}</span>
                {shown.lockedUntil && <span className="gecko-pill gecko-pill-warning">Locked</span>}
                <span className="gecko-cell-meta">
                  {shown.lastLoginAt ? `Last signed in ${new Date(shown.lastLoginAt).toLocaleString()}` : 'Never signed in'}
                </span>
              </div>

              {/* ── Who they are ── */}
              <section className="gecko-stack gecko-stack-sm">
                <div className="gecko-eyebrow">Profile</div>
                <Field label="Full name" required error={failure?.forField('fullName')}>
                  <input className="gecko-input gecko-input-sm" value={fullName} maxLength={200}
                    onChange={e => setFullName(e.target.value)} />
                </Field>
                <div className="gecko-grid-2">
                  <Field label="Phone">
                    <input className="gecko-input gecko-input-sm" value={phone} maxLength={30}
                      onChange={e => setPhone(e.target.value)} />
                  </Field>
                  <Field label="Job title">
                    <input className="gecko-input gecko-input-sm" value={jobTitle} maxLength={100}
                      onChange={e => setJobTitle(e.target.value)} />
                  </Field>
                </div>
                <div className="gecko-row gecko-row-right">
                  <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
                    disabled={!profileDirty || !fullName.trim() || busy === 'profile'}
                    onClick={() => void run('profile', () => saveProfile(user.userId, {
                      fullName: fullName.trim(),
                      phone: phone.trim() || null,
                      jobTitle: jobTitle.trim() || null,
                      defaultBranchId: shown.defaultBranchId,
                      locale: shown.locale,
                      timezone: shown.timezone,
                    }), 'Profile saved')}>
                    {busy === 'profile' ? 'Saving…' : 'Save profile'}
                  </button>
                </div>
              </section>

              {/* ── What they type at the lane ── */}
              <section className="gecko-stack gecko-stack-sm">
                <div className="gecko-eyebrow">Sign-in user name</div>
                <Field label="User name"
                  error={failure?.forField('userName')}
                  helper="What this person types instead of their e-mail. Leave it empty to remove it.">
                  <input className="gecko-input gecko-input-sm gecko-text-mono" value={userName} maxLength={64}
                    onChange={e => setUserName(e.target.value)} />
                </Field>
                <div className="gecko-row gecko-row-right">
                  <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
                    disabled={!nameDirty || busy === 'userName'}
                    onClick={() => void run('userName', () => saveUserName(user.userId, userName), 'User name saved')}>
                    {busy === 'userName' ? 'Saving…' : 'Save user name'}
                  </button>
                </div>
              </section>

              {/* ── Where they work ── */}
              <section className="gecko-stack gecko-stack-sm">
                <div className="gecko-eyebrow">Depots</div>
                {branches.length === 0 ? (
                  <div className="gecko-cell-meta">No depots to assign.</div>
                ) : (
                  <div className="gecko-check-list">
                    {branches.map(b => {
                      const on = shown.branches.some(x => x.branchId === b.branchId);
                      return (
                        <label key={b.branchId} className={`gecko-check-row${on ? ' gecko-check-row-on' : ''}`}>
                          <input type="checkbox" checked={on} disabled={busy === 'branches'}
                            onChange={() => toggleBranch(b.branchId)} />
                          <span className="gecko-check-label">{b.displayName}</span>
                          <span className="gecko-cell-meta gecko-text-mono">{b.branchCode}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── What they may do ── */}
              <section className="gecko-stack gecko-stack-sm">
                <div className="gecko-eyebrow">Roles</div>
                {shown.roles.length === 0 ? (
                  <div className="gecko-cell-meta">No role yet — this account can sign in and see nothing.</div>
                ) : (
                  <div className="gecko-stack gecko-stack-xs">
                    {shown.roles.map(g => (
                      <div key={g.userRoleId} className="gecko-row gecko-grant-row">
                        <span className="gecko-pill gecko-pill-info">
                          {roles.find(r => r.roleId === g.roleId)?.displayName ?? g.roleCode}
                        </span>
                        <span className="gecko-cell-meta gecko-flex-1">
                          {g.branchCode ? `at ${g.branchCode}` : 'at every depot'}
                        </span>
                        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
                          title="Take this role away" disabled={busy === 'role'}
                          onClick={() => void run('role', () => removeRole(user.userId, g.userRoleId), 'Role removed')}>
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <AddRole roles={roles} branches={branches.map(b => ({ id: b.branchId, label: b.displayName }))}
                  busy={busy === 'role'}
                  onAdd={(roleId, branchId) => void run('role', () => addRole(user.userId, roleId, branchId), 'Role added')} />
              </section>
            </>
          )}
        </div>

        <div className="gecko-drawer-footer">
          {shown && (
            <>
              {shown.lockedUntil && (
                <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={busy === 'unlock'}
                  onClick={() => void run('unlock', () => unlockUser(user.userId), 'Account unlocked')}>
                  <Icon name="lock" size={13} /> Unlock
                </button>
              )}
              {/* Disabling yourself locks you out of the screen you are standing
                  on, and the API refuses it anyway — so the button never offers it. */}
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
                disabled={isSelf || busy === 'active'}
                title={isSelf ? 'You cannot disable your own account.' : undefined}
                onClick={() => void run('active',
                  () => setUserActive(user.userId, statusTone(shown.status) !== 'success'),
                  statusTone(shown.status) === 'success' ? 'Account disabled' : 'Account enabled')}>
                {statusTone(shown.status) === 'success' ? 'Disable' : 'Enable'}
              </button>
              <button className="gecko-btn gecko-btn-danger gecko-btn-sm"
                disabled={isSelf || busy === 'delete'}
                title={isSelf ? 'You cannot remove your own account.' : undefined}
                onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size={13} /> Remove
              </button>
            </>
          )}
          <div className="gecko-flex-1" />
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={onClose}>Close</button>
        </div>
      </aside>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void removeDone()}
        variant="danger"
        title="Remove this user?"
        message={`${user.fullName || user.email} will no longer be able to sign in.`}
        confirmLabel="Remove user"
        consequences={[
          'Their roles and depot assignments are given up.',
          'What they already did keeps their name on it — the history is not touched.',
        ]}
      />
    </>
  );
}

/** Give a role, at one depot or at all of them. */
function AddRole({ roles, branches, busy, onAdd }: {
  roles: RoleSummary[];
  branches: { id: string; label: string }[];
  busy: boolean;
  onAdd: (roleId: string, branchId: string | null) => void;
}) {
  const [roleId, setRoleId] = useState('');
  const [branchId, setBranchId] = useState('');

  return (
    <div className="gecko-row gecko-add-role">
      <select className="gecko-select gecko-input-sm gecko-flex-1" value={roleId} disabled={busy}
        onChange={e => setRoleId(e.target.value)} aria-label="Role to add">
        <option value="">— add a role —</option>
        {roles.filter(r => r.isActive).map(r => (
          <option key={r.roleId} value={r.roleId}>{r.displayName}</option>
        ))}
      </select>
      <select className="gecko-select gecko-input-sm" value={branchId} disabled={busy}
        onChange={e => setBranchId(e.target.value)} aria-label="Depot for this role">
        <option value="">Every depot</option>
        {branches.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
      <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={!roleId || busy}
        onClick={() => { onAdd(roleId, branchId || null); setRoleId(''); setBranchId(''); }}>
        <Icon name="plus" size={13} /> Add
      </button>
    </div>
  );
}
