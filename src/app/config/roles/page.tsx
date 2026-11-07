"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/FormGrid';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { ApiError } from '@/lib/api/problem';
import {
  createRole, roleCodeIssue, useAdminRights, usePermissions, useRoles,
  groupPermissions, type RoleSummary,
} from '@/lib/api/admin-users';

/**
 * THE ROLES THIS TENANT HAS, AND HOW MANY PEOPLE HOLD EACH.
 *
 * Read from `GET /api/roles`. Gecko's own roles come back `isSystem` and may
 * be renamed and nothing else — their rights are what the application is built
 * on, so letting an administrator take `tos.gate.view` off GATE_CLERK would
 * break the gate for everyone holding it, with no way back from this screen.
 * A tenant that needs a different set makes its own role instead.
 */
export default function RolesPage() {
  const rights = useAdminRights();
  if (!rights.roles) {
    return (
      <div className="gecko-stack gecko-stack-lg">
        <div className="gecko-page-header">
          <div className="gecko-page-header-left">
            <h1 className="gecko-page-title">Roles &amp; rights</h1>
            <p className="gecko-page-subtitle">What each kind of person may do</p>
          </div>
        </div>
        <EmptyState icon="lock" title="This is not yours to open"
          description="Editing roles needs the “Create and assign roles” right. Ask a tenant administrator for it." />
      </div>
    );
  }
  return <Roles />;
}

function Roles() {
  const { roles, loading, reload } = useRoles();
  const [creating, setCreating] = useState(false);
  const system = roles.filter(r => r.isSystem).length;
  const custom = roles.length - system;
  const held = roles.reduce((n, r) => n + r.userCount, 0);

  return (
    <div className="gecko-stack gecko-stack-lg">
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <h1 className="gecko-page-title">Roles &amp; rights</h1>
          <p className="gecko-page-subtitle">What each kind of person may do</p>
        </div>
        <div className="gecko-row gecko-page-header-actions">
          <Link href="/config/users" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            <Icon name="users" size={14} /> Users
          </Link>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setCreating(true)}>
            <Icon name="plus" size={14} /> New role
          </button>
        </div>
      </div>

      <div className="gecko-yard-kpis">
        <Kpi label="Roles" value={roles.length} sub={`${system} built in, ${custom} your own`} icon="shieldCheck" tone="primary" />
        <Kpi label="Grants" value={held} sub="role-to-person assignments" icon="users" tone="info" />
        <Kpi label="Your own" value={custom} sub={custom ? 'editable here' : 'none yet'} icon="edit"
          tone={custom ? 'success' : 'neutral'} />
      </div>

      <div className="gecko-table-card">
        <div className="gecko-table-clip">
          <table className="gecko-table gecko-table-compact">
            <thead>
              <tr>
                <th>Role</th>
                <th>Code</th>
                <th>Description</th>
                <th className="gecko-num-tabular">Rights</th>
                <th className="gecko-num-tabular">People</th>
                <th>Kind</th>
              </tr>
            </thead>
            <tbody>
              {loading && roles.length === 0 ? (
                <TableSkeleton rows={5} columns={6} />
              ) : roles.length === 0 ? (
                <tr><td colSpan={6}>
                  <EmptyState icon="shieldCheck" title="No roles" description="This tenant has no roles defined." />
                </td></tr>
              ) : roles.map(r => (
                <tr key={r.roleId}>
                  <td>
                    <Link href={rolePathUi(r)} className="gecko-link gecko-cell-primary">{r.displayName}</Link>
                    {!r.isActive && <span className="gecko-pill gecko-pill-neutral gecko-locked-chip">Inactive</span>}
                  </td>
                  <td className="gecko-text-mono">{r.roleCode}</td>
                  <td className="gecko-cell-meta">{r.description || '—'}</td>
                  <td className="gecko-num-tabular">{r.permissionCount}</td>
                  <td className="gecko-num-tabular">{r.userCount}</td>
                  <td>
                    {r.isTenantAdmin
                      ? <span className="gecko-pill gecko-pill-warning">Tenant admin</span>
                      : r.isSystem
                        ? <span className="gecko-pill gecko-pill-neutral">Built in</span>
                        : <span className="gecko-pill gecko-pill-success">Your own</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="gecko-banner gecko-banner-info">
        <Icon name="info" size={15} className="gecko-banner-icon" />
        <div>
          <strong>Built-in roles can be renamed, but their rights are fixed.</strong> Their rights are what Gecko&rsquo;s screens
          are built on. To give a different set, make your own role and assign that instead.
        </div>
      </div>

      {creating && <NewRole onClose={() => setCreating(false)} onMade={reload} />}
    </div>
  );
}

const rolePathUi = (r: RoleSummary) => `/config/roles/${encodeURIComponent(r.roleId)}`;

/** A new role is a code, a name, and the rights it carries. */
function NewRole({ onClose, onMade }: { onClose: () => void; onMade: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { permissions, loading } = usePermissions();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  const codeProblem = code ? roleCodeIssue(code) : null;
  const ready = !codeProblem && !!code.trim() && !!name.trim() && picked.length > 0;
  const groups = groupPermissions(permissions);

  const toggle = (permissionCode: string) =>
    setPicked(p => p.includes(permissionCode) ? p.filter(x => x !== permissionCode) : [...p, permissionCode]);

  const toggleGroup = (codes: string[]) =>
    setPicked(p => codes.every(c => p.includes(c))
      ? p.filter(x => !codes.includes(x))
      : [...new Set([...p, ...codes])]);

  const make = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const made = await createRole({
        roleCode: code.trim().toUpperCase(),
        displayName: name.trim(),
        permissions: picked,
        description: description.trim() || null,
      });
      toast({ variant: 'success', title: 'Role created', message: made.displayName });
      onMade();
      onClose();
      router.push(`/config/roles/${encodeURIComponent(made.roleId)}`);
    } catch (e) {
      setFailure(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={busy ? () => {} : onClose} size="lg" title="New role"
      subtitle="A name people will recognise, and the rights it carries."
      footer={
        <>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!ready || busy} onClick={() => void make()}>
            {busy
              ? <><span className="gecko-spinner gecko-spinner-sm gecko-spinner-white" /> Creating…</>
              : <><Icon name="check" size={13} /> Create role</>}
          </button>
        </>
      }>
      <div className="gecko-stack gecko-stack-md">
        <ErrorBanner error={failure} />

        <div className="gecko-grid-2">
          <Field label="Name" required error={failure?.forField('displayName')}>
            <input className="gecko-input gecko-input-sm" value={name} maxLength={100} autoFocus
              placeholder="Gate supervisor" disabled={busy} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="Code" required error={codeProblem ?? failure?.forField('roleCode')}
            helper="Capitals, digits and underscore — this is what the API records.">
            <input className="gecko-input gecko-input-sm gecko-text-mono" value={code} disabled={busy}
              placeholder="GATE_SUPERVISOR"
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))} />
          </Field>
        </div>

        <Field label="Description" helper="What this role is for — one line, read by whoever assigns it.">
          <input className="gecko-input gecko-input-sm" value={description} maxLength={400} disabled={busy}
            onChange={e => setDescription(e.target.value)} />
        </Field>

        <div className="gecko-row gecko-row-between">
          <div className="gecko-eyebrow">Rights</div>
          <div className="gecko-cell-meta">{picked.length} of {permissions.length} chosen</div>
        </div>

        {loading && permissions.length === 0
          ? <div className="gecko-cell-meta">Reading the rights…</div>
          : (
            <div className="gecko-stack gecko-stack-sm gecko-rights-scroll">
              {groups.map(g => {
                const codes = g.permissions.map(p => p.permissionCode);
                const all = codes.every(c => picked.includes(c));
                return (
                  <section key={g.moduleCode} className="gecko-rights-group">
                    <div className="gecko-row gecko-rights-group-head">
                      <span className="gecko-eyebrow gecko-flex-1">{g.name}</span>
                      <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                        disabled={busy} onClick={() => toggleGroup(codes)}>
                        {all ? 'None' : 'All'}
                      </button>
                    </div>
                    <div className="gecko-check-list">
                      {g.permissions.map(p => (
                        <label key={p.permissionCode}
                          className={`gecko-check-row${picked.includes(p.permissionCode) ? ' gecko-check-row-on' : ''}`}
                          title={p.description ?? undefined}>
                          <input type="checkbox" checked={picked.includes(p.permissionCode)} disabled={busy}
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
      </div>
    </Modal>
  );
}

function Kpi({ label, value, sub, icon, tone }: {
  label: string; value: number; sub: string; icon: string;
  tone: 'primary' | 'success' | 'warning' | 'info' | 'neutral';
}) {
  return (
    <div className="gecko-kpi-tile gecko-kpi-tile-stacked">
      <div className="gecko-eyebrow gecko-kpi-tile-head">{label}</div>
      <div className="gecko-kpi-tile-main">
        <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${tone}`}><Icon name={icon} size={16} /></div>
        <div className="gecko-kpi-tile-value">{value}</div>
      </div>
      <div className="gecko-cell-sub gecko-kpi-tile-foot">{sub}</div>
    </div>
  );
}
