"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

// ── Types ──────────────────────────────────────────────────────────────────────

type RoleType = 'System' | 'Custom';
type RoleStatus = 'Active' | 'Inactive';

interface AvatarDef {
  initials: string;
  bg: string;
}

interface RoleRow {
  id: string;
  name: string;
  color: string;
  type: RoleType;
  description: string;
  users: AvatarDef[];
  granted: number;
  total: number;
  status: RoleStatus;
}

// ── Seed data ──────────────────────────────────────────────────────────────────

const INITIAL_ROLES: RoleRow[] = [
  {
    id: 'super-admin',
    name: 'Super Admin',
    color: '#DC2626',
    type: 'System',
    description: 'Full unrestricted access to all modules and configuration',
    users: [{ initials: 'SK', bg: '#DC2626' }],
    granted: 84,
    total: 84,
    status: 'Active',
  },
  {
    id: 'terminal-manager',
    name: 'Terminal Manager',
    color: '#1D4ED8',
    type: 'System',
    description: 'Full operational access; billing approval; no system configuration edit',
    users: [
      { initials: 'NP', bg: '#1D4ED8' },
      { initials: 'WB', bg: '#1D4ED8' },
      { initials: 'JT', bg: '#1D4ED8' },
    ],
    granted: 68,
    total: 84,
    status: 'Active',
  },
  {
    id: 'gate-supervisor',
    name: 'Gate Supervisor',
    color: '#0369A1',
    type: 'System',
    description: 'Full gate operations; yard view; billing read-only',
    users: [
      { initials: 'KC', bg: '#0369A1' },
      { initials: 'CS', bg: '#0369A1' },
    ],
    granted: 45,
    total: 84,
    status: 'Active',
  },
  {
    id: 'gate-operator',
    name: 'Gate Operator',
    color: '#0284C7',
    type: 'Custom',
    description: 'Gate-In/Out create & print; no delete; no billing',
    users: [
      { initials: 'KR', bg: '#0284C7' },
      { initials: 'PD', bg: '#0284C7' },
      { initials: 'AN', bg: '#0284C7' },
      { initials: 'SB', bg: '#0284C7' },
    ],
    granted: 28,
    total: 84,
    status: 'Active',
  },
  {
    id: 'billing-clerk',
    name: 'Billing Clerk',
    color: '#16A34A',
    type: 'Custom',
    description: 'Full billing & invoicing; reports export; no gate or yard write',
    users: [
      { initials: 'MP', bg: '#16A34A' },
      { initials: 'MK', bg: '#16A34A' },
    ],
    granted: 36,
    total: 84,
    status: 'Active',
  },
  {
    id: 'yard-planner',
    name: 'Yard Planner',
    color: '#D97706',
    type: 'Custom',
    description: 'Full yard plan & moves; unit inquiry; no billing or gate write',
    users: [
      { initials: 'SY', bg: '#D97706' },
      { initials: 'BL', bg: '#D97706' },
    ],
    granted: 32,
    total: 84,
    status: 'Active',
  },
  {
    id: 'viewer',
    name: 'Viewer',
    color: '#6B7280',
    type: 'System',
    description: 'Read-only access to all modules; no create, edit, delete, or approve',
    users: [{ initials: 'JT', bg: '#6B7280' }],
    granted: 22,
    total: 84,
    status: 'Active',
  },
];

// ── Helper: permission bar color ───────────────────────────────────────────────

function permColor(pct: number): string {
  if (pct > 90) return '#DC2626';
  if (pct >= 70) return '#D97706';
  return '#16A34A';
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  accent: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      padding: '14px 18px',
      background: 'var(--gecko-bg-surface)',
      border: '1px solid var(--gecko-border)',
      borderTop: `3px solid ${accent}`,
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon name={icon} size={13} style={{ color: accent }} />
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--gecko-text-secondary)',
        }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: 'var(--gecko-text-primary)' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 5 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Avatar stack ───────────────────────────────────────────────────────────────

function AvatarStack({ avatars }: { avatars: AvatarDef[] }) {
  const visible = avatars.slice(0, 3);
  const extra = avatars.length - visible.length;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((av, i) => (
        <div
          key={i}
          title={av.initials}
          style={{
            width: 26, height: 26, borderRadius: '50%',
            background: av.bg, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800,
            border: '2px solid var(--gecko-bg-surface)',
            marginLeft: i === 0 ? 0 : -7,
            zIndex: visible.length - i,
            flexShrink: 0,
            letterSpacing: '0.02em',
          }}
        >
          {av.initials}
        </div>
      ))}
      {extra > 0 && (
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: 'var(--gecko-bg-subtle)',
          border: '2px solid var(--gecko-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, color: 'var(--gecko-text-secondary)',
          marginLeft: -7,
          flexShrink: 0,
        }}>
          +{extra}
        </div>
      )}
    </div>
  );
}

// ── Permission Bar ─────────────────────────────────────────────────────────────

function PermBar({ granted, total }: { granted: number; total: number }) {
  const pct = Math.round((granted / total) * 100);
  const color = permColor(pct);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>
        {granted} / {total}
      </span>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 200,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 18px', borderRadius: 10,
      background: 'var(--gecko-text-primary)', color: '#fff',
      fontSize: 13, fontWeight: 500,
      boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <Icon name="copy" size={15} style={{ opacity: 0.75 }} />
      {message}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>(INITIAL_ROLES);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'System' | 'Custom'>('All');
  const [toast, setToast] = useState('');

  // ── Derived totals ──────────────────────────────────────────────────────────
  const totalRoles = roles.length;
  const systemRoles = roles.filter(r => r.type === 'System').length;
  const customRoles = roles.filter(r => r.type === 'Custom').length;
  // "Viewer" has 1 user; treat roles with 0 users as unassigned users indicator (spec says 1)
  const unassignedUsers = 1;

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return roles.filter(r => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
      }
      if (typeFilter !== 'All' && r.type !== typeFilter) return false;
      return true;
    });
  }, [roles, search, typeFilter]);

  // ── Clone handler ────────────────────────────────────────────────────────────
  function handleClone(role: RoleRow) {
    const cloned: RoleRow = {
      ...role,
      id: `copy-${role.id}-${Date.now()}`,
      name: `Copy of ${role.name}`,
      type: 'Custom',
      users: [],
    };
    setRoles(prev => [cloned, ...prev]);
    setToast('Role cloned — edit the copy at the top of the list');
    setTimeout(() => setToast(''), 3500);
  }

  // ── Delete handler (custom only) ────────────────────────────────────────────
  function handleDelete(id: string) {
    setRoles(prev => prev.filter(r => r.id !== id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gecko-space-4)' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{
              fontSize: 22, fontWeight: 700, margin: 0,
              letterSpacing: '-0.02em', color: 'var(--gecko-text-primary)',
            }}>
              Roles &amp; Rights
            </h1>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 4,
              background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)',
              border: '1px solid var(--gecko-primary-200)',
            }}>
              Config
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>
            Define permission sets — assign roles to users on the{' '}
            <Link
              href="/config/users"
              style={{ color: 'var(--gecko-primary-600)', textDecoration: 'none', fontWeight: 600 }}
            >
              Users &amp; Roles
            </Link>{' '}
            page
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard
          label="Total Roles"
          value={totalRoles}
          sub="Across the system"
          icon="shieldCheck"
          accent="var(--gecko-primary-500)"
        />
        <KpiCard
          label="System Roles"
          value={systemRoles}
          sub="Cannot be deleted or renamed"
          icon="lock"
          accent="#DC2626"
        />
        <KpiCard
          label="Custom Roles"
          value={customRoles}
          sub="User-defined permission sets"
          icon="settings"
          accent="#16A34A"
        />
        <KpiCard
          label="Unassigned Users"
          value={unassignedUsers}
          sub="No role currently assigned"
          icon="alertCircle"
          accent="#D97706"
        />
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--gecko-text-secondary)', pointerEvents: 'none',
          }}>
            <Icon name="search" size={14} />
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search roles…"
            className="gecko-input gecko-input-sm"
            style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Type filter pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['All', 'System', 'Custom'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                padding: '5px 14px', borderRadius: 20,
                border: '1px solid',
                borderColor: typeFilter === t ? 'var(--gecko-primary-500)' : 'var(--gecko-border)',
                background: typeFilter === t ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
                color: typeFilter === t ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.12s',
                fontFamily: 'inherit',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* New Role */}
        <Link href="/config/roles/new" style={{ textDecoration: 'none' }}>
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <Icon name="plus" size={14} /> New Role
          </button>
        </Link>
      </div>

      {/* ── Data Table ── */}
      <div style={{
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--gecko-bg-subtle)', borderBottom: '2px solid var(--gecko-border)' }}>
                {['Role', 'Description', 'Users', 'Permissions', 'Status', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      textAlign: i === 5 ? 'right' : 'left',
                      fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: 'var(--gecko-text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '52px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--gecko-text-secondary)' }}>
                      <Icon name="shieldCheck" size={32} style={{ opacity: 0.25 }} />
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
                        No roles match your search
                      </div>
                      <div style={{ fontSize: 12 }}>
                        Try a different name or clear the filter
                      </div>
                      <button
                        className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                        onClick={() => { setSearch(''); setTypeFilter('All'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}
                      >
                        <Icon name="x" size={13} /> Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((role, idx) => {
                  const isSystem = role.type === 'System';
                  const pct = Math.round((role.granted / role.total) * 100);

                  return (
                    <tr
                      key={role.id}
                      style={{
                        borderBottom: '1px solid var(--gecko-bg-subtle)',
                        background: idx % 2 === 0 ? 'var(--gecko-bg-surface)' : 'var(--gecko-bg-subtle)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--gecko-bg-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'var(--gecko-bg-surface)' : 'var(--gecko-bg-subtle)')}
                    >

                      {/* ── Role column ── */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {/* color chip */}
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: role.color, flexShrink: 0,
                            boxShadow: `0 0 0 2px ${role.color}33`,
                          }} />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
                                {role.name}
                              </span>
                              {isSystem && (
                                <span style={{ color: 'var(--gecko-text-disabled)', display: 'flex', alignItems: 'center' }} title="System role — cannot be deleted or renamed">
                                  <Icon name="lock" size={11} />
                                </span>
                              )}
                            </div>
                            <div style={{ marginTop: 3 }}>
                              <span className="gecko-badge" style={{
                                display: 'inline-flex', alignItems: 'center',
                                fontSize: 10, fontWeight: 700,
                                padding: '1px 7px', borderRadius: 4,
                                background: isSystem ? 'var(--gecko-primary-50)' : 'var(--gecko-success-50)',
                                color: isSystem ? 'var(--gecko-primary-700)' : 'var(--gecko-success-700)',
                                border: `1px solid ${isSystem ? 'var(--gecko-primary-200)' : 'var(--gecko-success-200)'}`,
                                letterSpacing: '0.03em',
                              }}>
                                {role.type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ── Description ── */}
                      <td style={{
                        padding: '12px 14px',
                        fontSize: 12, color: 'var(--gecko-text-secondary)',
                        maxWidth: 260,
                      }}>
                        {role.description}
                      </td>

                      {/* ── Users ── */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* count badge */}
                          <span style={{
                            minWidth: 22, height: 22,
                            borderRadius: 11, padding: '0 6px',
                            background: 'var(--gecko-bg-subtle)',
                            border: '1px solid var(--gecko-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-primary)',
                          }}>
                            {role.users.length}
                          </span>
                          <AvatarStack avatars={role.users} />
                        </div>
                      </td>

                      {/* ── Permissions ── */}
                      <td style={{ padding: '12px 14px', minWidth: 180 }}>
                        <PermBar granted={role.granted} total={role.total} />
                        <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
                          {pct}% of all permissions
                        </div>
                      </td>

                      {/* ── Status ── */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 700,
                          padding: '3px 9px', borderRadius: 20,
                          background: role.status === 'Active' ? 'var(--gecko-success-50)' : 'var(--gecko-bg-subtle)',
                          color: role.status === 'Active' ? 'var(--gecko-success-700)' : 'var(--gecko-text-secondary)',
                          border: `1px solid ${role.status === 'Active' ? 'var(--gecko-success-200)' : 'var(--gecko-border)'}`,
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: role.status === 'Active' ? 'var(--gecko-success-500)' : 'var(--gecko-text-disabled)',
                            flexShrink: 0,
                          }} />
                          {role.status}
                        </span>
                      </td>

                      {/* ── Actions ── */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>

                          {/* Edit */}
                          <Link href={`/config/roles/${role.id}`} style={{ textDecoration: 'none' }}>
                            <button
                              title="Edit role"
                              style={{
                                background: 'none',
                                border: '1px solid var(--gecko-border)',
                                borderRadius: 6, padding: '5px 10px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                                fontSize: 12, fontWeight: 600,
                                color: 'var(--gecko-text-secondary)',
                                transition: 'all 0.1s',
                                fontFamily: 'inherit',
                              }}
                              onMouseEnter={e => {
                                const btn = e.currentTarget as HTMLButtonElement;
                                btn.style.borderColor = 'var(--gecko-primary-400)';
                                btn.style.color = 'var(--gecko-primary-600)';
                              }}
                              onMouseLeave={e => {
                                const btn = e.currentTarget as HTMLButtonElement;
                                btn.style.borderColor = 'var(--gecko-border)';
                                btn.style.color = 'var(--gecko-text-secondary)';
                              }}
                            >
                              <Icon name="edit" size={13} />
                              Edit
                            </button>
                          </Link>

                          {/* Clone */}
                          <button
                            title="Clone role"
                            onClick={() => handleClone(role)}
                            style={{
                              background: 'none',
                              border: '1px solid var(--gecko-border)',
                              borderRadius: 6, padding: '5px 7px',
                              cursor: 'pointer', display: 'flex', alignItems: 'center',
                              color: 'var(--gecko-text-secondary)',
                              transition: 'all 0.1s',
                            }}
                            onMouseEnter={e => {
                              const btn = e.currentTarget as HTMLButtonElement;
                              btn.style.borderColor = 'var(--gecko-primary-400)';
                              btn.style.color = 'var(--gecko-primary-600)';
                            }}
                            onMouseLeave={e => {
                              const btn = e.currentTarget as HTMLButtonElement;
                              btn.style.borderColor = 'var(--gecko-border)';
                              btn.style.color = 'var(--gecko-text-secondary)';
                            }}
                          >
                            <Icon name="copy" size={14} />
                          </button>

                          {/* Delete — disabled for system roles */}
                          <button
                            title={isSystem ? 'System roles cannot be deleted' : 'Delete role'}
                            onClick={() => !isSystem && handleDelete(role.id)}
                            disabled={isSystem}
                            style={{
                              background: 'none',
                              border: '1px solid var(--gecko-border)',
                              borderRadius: 6, padding: '5px 7px',
                              display: 'flex', alignItems: 'center',
                              color: isSystem ? 'var(--gecko-text-disabled)' : 'var(--gecko-error-500)',
                              opacity: isSystem ? 0.4 : 1,
                              cursor: isSystem ? 'not-allowed' : 'pointer',
                              transition: 'all 0.1s',
                            }}
                            onMouseEnter={e => {
                              if (!isSystem) {
                                const btn = e.currentTarget as HTMLButtonElement;
                                btn.style.borderColor = 'var(--gecko-error-400)';
                                btn.style.background = 'var(--gecko-error-50)';
                              }
                            }}
                            onMouseLeave={e => {
                              if (!isSystem) {
                                const btn = e.currentTarget as HTMLButtonElement;
                                btn.style.borderColor = 'var(--gecko-border)';
                                btn.style.background = 'none';
                              }
                            }}
                          >
                            <Icon name="trash" size={14} />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--gecko-border)',
          background: 'var(--gecko-bg-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
          fontSize: 12, color: 'var(--gecko-text-secondary)',
        }}>
          <span>
            {filtered.length} role{filtered.length !== 1 ? 's' : ''} shown
            {(search || typeFilter !== 'All') && ` · filtered from ${roles.length}`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="lock" size={12} style={{ color: 'var(--gecko-text-disabled)' }} />
              {systemRoles} system
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="settings" size={12} style={{ color: 'var(--gecko-success-500)' }} />
              {roles.filter(r => r.type === 'Custom').length} custom
            </span>
          </div>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div style={{
        padding: '11px 16px', borderRadius: 8,
        background: 'var(--gecko-primary-50)', border: '1px solid var(--gecko-primary-100)',
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <Icon name="info" size={15} style={{ color: 'var(--gecko-primary-600)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--gecko-primary-800)', lineHeight: 1.6 }}>
          <strong>System roles</strong> are built-in presets that cannot be renamed or deleted.{' '}
          <strong>Custom roles</strong> are fully editable. Use <strong>Clone</strong> to duplicate any role as a starting point.
          Permissions are enforced at the module level — to review the full access matrix visit the{' '}
          <Link href="/config/users" style={{ color: 'var(--gecko-primary-700)', fontWeight: 600 }}>
            Users &amp; Roles
          </Link>{' '}
          page.
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && <Toast message={toast} />}

    </div>
  );
}
