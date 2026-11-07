"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Field } from '@/components/ui/FormGrid';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api/problem';
import { useApi } from '@/lib/api/use-api';
import {
  deleteRole, groupPermissions, rolePath, saveRole, saveRolePermissions,
  useAdminRights, usePermissions, useRoles,
  type RoleDetail,
} from '@/lib/api/admin-users';

/**
 * ONE ROLE, AND THE RIGHTS IT CARRIES.
 *
 * Until 7 Nov 2026 this screen drew a matrix of modules against seven verbs —
 * view, create, edit, delete, approve, export, print — which no part of the
 * platform has ever used. The real model is a flat list of 99 permission
 * codes (`tos.gate.view`, `revenue.tariff.manage`), grouped by the module they
 * belong to, and a role simply holds some of them. Ticking a box that mapped
 * to nothing was the worst kind of wrong: it looked like the right had been
 * given.
 *
 * A SYSTEM ROLE SHOWS THE SAME LIST, READ ONLY. Gecko's screens are built on
 * what those roles hold, so they can be renamed and nothing more — the
 * checkboxes are disabled rather than hidden, because "GATE_CLERK can see the
 * gate" is exactly what an administrator came here to check.
 */
export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const rights = useAdminRights();
  if (!rights.roles) {
    return (
      <div className="gecko-stack gecko-stack-lg">
        <EmptyState icon="lock" title="This is not yours to open"
          description="Editing roles needs the “Create and assign roles” right." />
      </div>
    );
  }
  return <RoleDetailView roleId={id} />;
}

function RoleDetailView({ roleId }: { roleId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const role = useApi<RoleDetail>(rolePath(roleId));
  const { permissions, loading: loadingPerms } = usePermissions();
  const { reload: reloadRoles } = useRoles();

  const [live, setLive] = useState<RoleDetail | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const shown = live ?? role.data;
  const locked = !!shown?.isSystem;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);

  /**
   * Fill the drafts from whichever version of the role is current — on open,
   * and after each save, since both writes answer with the whole role.
   * Adjusted during render for the reason given in UserDrawer: an effect
   * paints the empty form for a frame first.
   */
  const stamp = shown ? `${shown.roleId}|${shown.updatedAt}` : null;
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  if (shown && stamp !== filledFrom) {
    setFilledFrom(stamp);
    setName(shown.displayName);
    setDescription(shown.description ?? '');
    setActive(shown.isActive);
    setPicked(shown.permissions);
  }

  const run = async (what: string, call: () => Promise<RoleDetail>, said: string) => {
    setBusy(what);
    setFailure(null);
    try {
      setLive(await call());
      toast({ variant: 'success', title: said, message: shown?.displayName ?? '' });
      reloadRoles();
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
      await deleteRole(roleId);
      toast({ variant: 'success', title: 'Role deleted', message: shown?.displayName ?? '' });
      reloadRoles();
      router.push('/config/roles');
    } catch (e) {
      setFailure(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setBusy(null);
    }
  };

  if (role.error) {
    return (
      <div className="gecko-stack gecko-stack-lg">
        <Back />
        <ErrorBanner error={role.error} heading="This role could not be read" />
      </div>
    );
  }
  if (!shown) {
    return (
      <div className="gecko-stack gecko-stack-lg">
        <Back />
        <div className="gecko-cell-meta">Reading the role…</div>
      </div>
    );
  }

  const groups = groupPermissions(permissions);
  const detailsDirty = name !== shown.displayName
    || description !== (shown.description ?? '')
    || active !== shown.isActive;
  const rightsDirty = picked.length !== shown.permissions.length
    || picked.some(p => !shown.permissions.includes(p));

  const toggle = (code: string) =>
    setPicked(p => p.includes(code) ? p.filter(x => x !== code) : [...p, code]);

  const toggleGroup = (codes: string[]) =>
    setPicked(p => codes.every(c => p.includes(c))
      ? p.filter(x => !codes.includes(x))
      : [...new Set([...p, ...codes])]);

  return (
    <div className="gecko-stack gecko-stack-lg">
      <Back />

      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <div className="gecko-row gecko-role-title-row">
            <h1 className="gecko-page-title">{shown.displayName}</h1>
            <span className="gecko-pill gecko-pill-neutral gecko-text-mono">{shown.roleCode}</span>
            {shown.isTenantAdmin && <span className="gecko-pill gecko-pill-warning">Tenant admin</span>}
            {locked && <span className="gecko-pill gecko-pill-neutral">Built in</span>}
            {!shown.isActive && <span className="gecko-pill gecko-pill-danger">Inactive</span>}
          </div>
          <p className="gecko-page-subtitle">
            {shown.description || 'No description.'}
          </p>
        </div>
      </div>

      <ErrorBanner error={failure} />

      {locked && (
        <div className="gecko-banner gecko-banner-info">
          <Icon name="info" size={15} className="gecko-banner-icon" />
          <div>
            <strong>This is one of Gecko&rsquo;s own roles.</strong> Its rights are what the screens are built on,
            so they are shown here but cannot be changed. You may rename it. To give a different set of rights,
            make your own role on the <Link href="/config/roles" className="gecko-link">Roles</Link> page.
          </div>
        </div>
      )}

      {/* ── What it is called ── */}
      <section className="gecko-card gecko-stack gecko-stack-sm gecko-role-card">
        <div className="gecko-eyebrow">Details</div>
        <div className="gecko-grid-2">
          <Field label="Name" required error={failure?.forField('displayName')}>
            <input className="gecko-input gecko-input-sm" value={name} maxLength={100}
              disabled={busy === 'details'} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="Active"
            helper={locked ? 'A built-in role is always available.' : 'An inactive role cannot be given to anybody new.'}>
            <label className={`gecko-check-row${active ? ' gecko-check-row-on' : ''}`}>
              <input type="checkbox" checked={active} disabled={locked || busy === 'details'}
                onChange={e => setActive(e.target.checked)} />
              <span className="gecko-check-label">{active ? 'Available to assign' : 'Not assignable'}</span>
            </label>
          </Field>
        </div>
        <Field label="Description">
          <input className="gecko-input gecko-input-sm" value={description} maxLength={400}
            disabled={busy === 'details'} onChange={e => setDescription(e.target.value)} />
        </Field>
        <div className="gecko-row gecko-row-right">
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={!detailsDirty || !name.trim() || busy === 'details'}
            onClick={() => void run('details', () => saveRole(roleId, {
              displayName: name.trim(),
              isActive: active,
              description: description.trim() || null,
            }), 'Role saved')}>
            {busy === 'details' ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </section>

      {/* ── What it may do ── */}
      <section className="gecko-card gecko-stack gecko-stack-sm gecko-role-card">
        <div className="gecko-row gecko-row-between">
          <div className="gecko-eyebrow gecko-flex-1">Rights</div>
          <div className="gecko-cell-meta">{picked.length} of {permissions.length} given</div>
        </div>

        {loadingPerms && permissions.length === 0 ? (
          <div className="gecko-cell-meta">Reading the rights…</div>
        ) : (
          <div className="gecko-stack gecko-stack-sm">
            {groups.map(g => {
              const codes = g.permissions.map(p => p.permissionCode);
              const on = codes.filter(c => picked.includes(c)).length;
              return (
                <section key={g.moduleCode} className="gecko-rights-group">
                  <div className="gecko-row gecko-rights-group-head">
                    <span className="gecko-eyebrow gecko-flex-1">{g.name}</span>
                    <span className="gecko-cell-meta">{on} of {codes.length}</span>
                    {!locked && (
                      <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                        disabled={busy === 'rights'} onClick={() => toggleGroup(codes)}>
                        {on === codes.length ? 'None' : 'All'}
                      </button>
                    )}
                  </div>
                  <div className="gecko-check-list">
                    {g.permissions.map(p => (
                      <label key={p.permissionCode}
                        className={`gecko-check-row${picked.includes(p.permissionCode) ? ' gecko-check-row-on' : ''}${locked ? ' gecko-check-row-locked' : ''}`}
                        title={p.description ?? (locked ? 'System role' : undefined) ?? undefined}>
                        <input type="checkbox" checked={picked.includes(p.permissionCode)}
                          disabled={locked || busy === 'rights'}
                          onChange={() => toggle(p.permissionCode)} />
                        <span className="gecko-check-label">{p.displayName}</span>
                        <span className="gecko-cell-meta gecko-text-mono">{p.permissionCode}</span>
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {!locked && (
          <div className="gecko-row gecko-row-right">
            {rightsDirty && (
              <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" disabled={busy === 'rights'}
                onClick={() => setPicked(shown.permissions)}>Undo</button>
            )}
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
              disabled={!rightsDirty || busy === 'rights'}
              onClick={() => void run('rights', () => saveRolePermissions(roleId, picked), 'Rights saved')}>
              {busy === 'rights' ? 'Saving…' : 'Save rights'}
            </button>
          </div>
        )}
      </section>

      {/* A role somebody holds cannot be deleted — the API refuses it, and so
          does the button, which says which of the two it is waiting on. */}
      {!locked && (
        <div className="gecko-row gecko-row-right">
          <button className="gecko-btn gecko-btn-danger gecko-btn-sm"
            disabled={busy === 'delete'}
            onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={13} /> Delete role
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void removeDone()}
        variant="danger"
        title="Delete this role?"
        message={`${shown.displayName} will no longer exist.`}
        confirmLabel="Delete role"
        consequences={['A role somebody still holds cannot be deleted — take it off them first.']}
      />
    </div>
  );
}

function Back() {
  return (
    <Link href="/config/roles" className="gecko-link gecko-row gecko-back-link">
      <Icon name="arrowLeft" size={14} /> All roles
    </Link>
  );
}
