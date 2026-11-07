"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { useServerList } from '@/lib/api/use-server-list';
import { useFacility } from '@/lib/api/facility';
import {
  USERS_PATH, roleLabel, statusLabel, statusTone, useAdminRights, useRoles,
  type UserSummary,
} from '@/lib/api/admin-users';
import { UserDrawer } from './_components/UserDrawer';
import { InviteUserDialog } from './_components/InviteUserDialog';
import { ResetPasswordDialog } from './_components/ResetPasswordDialog';

/**
 * WHO MAY SIGN IN TO THIS TENANT.
 *
 * Every row here is a real account read from `GET /api/users`. Until 7 Nov
 * 2026 this screen showed twelve invented people with invented roles, which is
 * worse than showing nothing: an administrator who believes it has no idea who
 * can actually open the gate.
 *
 * The screen is behind `admin.user.manage`, which is a right the API itself
 * enforces — a user without it is answered 403 by `/api/users`, so the page
 * says so plainly rather than painting an empty table.
 */
export default function UsersPage() {
  const rights = useAdminRights();
  if (!rights.users) return <NotYours />;
  return <Users />;
}

/** The API refuses the read; saying why beats an empty table. */
function NotYours() {
  return (
    <div className="gecko-stack gecko-stack-lg">
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <h1 className="gecko-page-title">Users &amp; Roles</h1>
          <p className="gecko-page-subtitle">Who may sign in, and what they may do</p>
        </div>
      </div>
      <EmptyState
        icon="lock"
        title="This is not yours to open"
        description="Managing users needs the “Invite, edit and remove users” right. Ask a tenant administrator for it."
      />
    </div>
  );
}

const STATUS_FILTERS = [
  { value: '', label: 'Any status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISABLED', label: 'Disabled' },
];

function Users() {
  const facility = useFacility();
  const { roles } = useRoles();
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<UserSummary | null>(null);
  const [resetting, setResetting] = useState<UserSummary | null>(null);
  const [inviting, setInviting] = useState(false);

  const list = useServerList<UserSummary>(USERS_PATH, { status }, 'users');
  const rows = list.rows ?? [];

  const where = facility.branch?.displayName ?? 'this tenant';
  const active = rows.filter(u => statusTone(u.status) === 'success').length;
  const locked = rows.filter(u => u.isLocked).length;

  return (
    <div className="gecko-stack gecko-stack-lg">
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <h1 className="gecko-page-title">Users &amp; Roles</h1>
          <p className="gecko-page-subtitle">Who may sign in at {where}, and what they may do</p>
        </div>
        <div className="gecko-row gecko-page-header-actions">
          <Link href="/config/roles" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            <Icon name="shieldCheck" size={14} /> Roles &amp; rights
          </Link>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setInviting(true)}>
            <Icon name="plus" size={14} /> Invite user
          </button>
        </div>
      </div>

      {/* The counts describe THE PAGE ON SCREEN, not the tenant — the read is
          paged, so a tenant-wide "12 active" would be a number this screen
          cannot stand behind. The total comes from the API's own count. */}
      <div className="gecko-yard-kpis">
        <Kpi label="Users" value={list.total || rows.length} sub={`${rows.length} on this page`} icon="users" tone="primary" />
        <Kpi label="Active here" value={active} sub="can sign in" icon="checkCircle" tone="success" />
        <Kpi label="Locked out" value={locked} sub={locked ? 'need unlocking' : 'nobody is locked'} icon="lock"
          tone={locked ? 'warning' : 'neutral'} />
        <Kpi label="Roles" value={roles.length} sub="defined for this tenant" icon="shieldCheck" tone="info" />
      </div>

      <ErrorBanner error={list.error} heading="The users could not be read" />

      <div className="gecko-table-card gecko-table-card-menus">
        <div className="gecko-table-toolbar">
          <Icon name="search" size={13} />
          <input className="gecko-input gecko-input-sm gecko-admin-search" value={list.search}
            onChange={e => list.setSearch(e.target.value)}
            placeholder="Search by name, user name or e-mail…" />
          <select className="gecko-select gecko-input-sm" value={status} onChange={e => setStatus(e.target.value)}
            aria-label="Status">
            {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {(list.search || status) && (
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"
              onClick={() => { list.setSearch(''); setStatus(''); }}>
              <Icon name="x" size={13} /> Clear
            </button>
          )}
          <div className="gecko-table-toolbar-spacer" />
        </div>
        <div className="gecko-table-clip">
          <table className="gecko-table gecko-table-compact">
            <thead>
              <tr>
                <th>Name</th>
                <th>User name</th>
                <th>E-mail</th>
                <th>Roles</th>
                <th className="gecko-num-tabular">Depots</th>
                <th>Last login</th>
                <th>Status</th>
                <th aria-label="Actions"> </th>
              </tr>
            </thead>
            <tbody>
              {list.loading && !list.rows ? (
                <TableSkeleton rows={6} columns={8} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState icon="users" title="Nobody matches"
                      description={list.search || status
                        ? 'Try a different search, or clear the filters.'
                        : 'This tenant has no users yet.'} />
                  </td>
                </tr>
              ) : rows.map(u => (
                <tr key={u.userId} className="gecko-row-clickable" onClick={() => setOpen(u)}>
                  <td>
                    <div className="gecko-cell-primary">{u.fullName || '—'}</div>
                    {u.jobTitle && <div className="gecko-cell-meta">{u.jobTitle}</div>}
                  </td>
                  <td className="gecko-text-mono">{u.userName || <span className="gecko-cell-meta">—</span>}</td>
                  <td className="gecko-cell-meta">{u.email}</td>
                  <td>
                    {u.roles.length === 0
                      ? <span className="gecko-cell-meta">No role</span>
                      : (
                        <div className="gecko-row gecko-row-wrap gecko-role-chips">
                          {u.roles.map(code => (
                            <span key={code} className="gecko-pill gecko-pill-info">{roleLabel(code, roles)}</span>
                          ))}
                        </div>
                      )}
                  </td>
                  <td className="gecko-num-tabular">{u.branchCount}</td>
                  <td className="gecko-cell-meta">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td>
                    <span className={`gecko-pill gecko-pill-${statusTone(u.status)}`}>{statusLabel(u.status)}</span>
                    {u.isLocked && <span className="gecko-pill gecko-pill-warning gecko-locked-chip">Locked</span>}
                  </td>
                  <td>
                    {/* The row opens the drawer; these must not, or the dialog
                        opens behind it. */}
                    <div className="gecko-row gecko-row-right" onClick={e => e.stopPropagation()}>
                      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
                        title="Reset password" onClick={() => setResetting(u)}>
                        <Icon name="key" size={14} />
                      </button>
                      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
                        title="Edit user" onClick={() => setOpen(u)}>
                        <Icon name="edit" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.footer}
      </div>

      <div className="gecko-banner gecko-banner-info">
        <Icon name="info" size={15} className="gecko-banner-icon" />
        <div>
          <strong>A role is what a person may do; a depot is where they may do it.</strong> A role given with no
          depot applies everywhere. Removing a user keeps the work they already did — their name stays on it.
        </div>
      </div>

      {open && (
        <UserDrawer user={open} roles={roles} onClose={() => setOpen(null)} onChanged={list.reload} />
      )}
      {resetting && (
        <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      )}
      {inviting && (
        <InviteUserDialog roles={roles} onClose={() => setInviting(false)} onInvited={list.reload} />
      )}
    </div>
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
