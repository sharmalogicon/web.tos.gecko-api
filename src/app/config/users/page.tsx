"use client";
import React, { useState, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';

// ── Role definitions ───────────────────────────────────────────────────────────

type RoleName =
  | 'Super Admin'
  | 'Terminal Manager'
  | 'Gate Supervisor'
  | 'Gate Operator'
  | 'Billing Clerk'
  | 'Yard Planner'
  | 'Viewer';

const ROLES: Record<RoleName, { bg: string; color: string; abbr: string }> = {
  'Super Admin':       { bg: 'var(--gecko-error-600)',   color: '#fff',                          abbr: 'Super'    },
  'Terminal Manager':  { bg: 'var(--gecko-primary-700)', color: '#fff',                          abbr: 'T.Mgr'    },
  'Gate Supervisor':   { bg: 'var(--gecko-primary-500)', color: '#fff',                          abbr: 'G.Sup'    },
  'Gate Operator':     { bg: '#3b82f6',                  color: '#fff',                          abbr: 'G.Oper'   },
  'Billing Clerk':     { bg: 'var(--gecko-success-600)', color: '#fff',                          abbr: 'Billing'  },
  'Yard Planner':      { bg: 'var(--gecko-warning-600)', color: '#fff',                          abbr: 'Planner'  },
  'Viewer':            { bg: 'var(--gecko-gray-500)',    color: '#fff',                          abbr: 'Viewer'   },
};

const ROLE_NAMES = Object.keys(ROLES) as RoleName[];

// ── Status definitions ─────────────────────────────────────────────────────────

type UserStatus = 'Active' | 'Inactive' | 'Suspended';

const STATUS_CFG: Record<UserStatus, { dot: string; text: string }> = {
  Active:    { dot: 'var(--gecko-success-500)', text: 'var(--gecko-success-700)' },
  Inactive:  { dot: 'var(--gecko-gray-400)',    text: 'var(--gecko-text-secondary)' },
  Suspended: { dot: 'var(--gecko-error-500)',   text: 'var(--gecko-error-700)' },
};

// ── Sample users ───────────────────────────────────────────────────────────────

interface User {
  id: number;
  name: string;
  email: string;
  role: RoleName;
  yards: string;
  lastLogin: string;
  status: UserStatus;
}

const USERS: User[] = [
  { id: 1,  name: 'Somchai Krungthep',   email: 's.krungthep@logicon.th',  role: 'Super Admin',      yards: 'All Yards',           lastLogin: '2026-05-03 08:14', status: 'Active'    },
  { id: 2,  name: 'Nattaya Siriporn',    email: 'n.siriporn@logicon.th',   role: 'Terminal Manager', yards: 'All Yards',           lastLogin: '2026-05-04 07:22', status: 'Active'    },
  { id: 3,  name: 'Wichai Boontham',     email: 'w.boontham@logicon.th',   role: 'Gate Supervisor',  yards: 'Import, Export',      lastLogin: '2026-05-04 06:01', status: 'Active'    },
  { id: 4,  name: 'Kanokwan Rattana',    email: 'k.rattana@logicon.th',    role: 'Gate Operator',    yards: 'Import Yard',         lastLogin: '2026-05-03 18:45', status: 'Active'    },
  { id: 5,  name: 'Prasit Duangdao',     email: 'p.duangdao@logicon.th',   role: 'Gate Operator',    yards: 'Export Yard',         lastLogin: '2026-05-04 06:30', status: 'Active'    },
  { id: 6,  name: 'Malee Phakawan',      email: 'm.phakawan@logicon.th',   role: 'Billing Clerk',    yards: 'All Yards',           lastLogin: '2026-05-02 14:12', status: 'Active'    },
  { id: 7,  name: 'Anon Khamkaew',       email: 'a.khamkaew@logicon.th',   role: 'Billing Clerk',    yards: 'All Yards',           lastLogin: '2026-04-29 09:00', status: 'Inactive'  },
  { id: 8,  name: 'Surachat Yodrak',     email: 's.yodrak@logicon.th',     role: 'Yard Planner',     yards: 'Import, Bonded',      lastLogin: '2026-05-04 07:55', status: 'Active'    },
  { id: 9,  name: 'Boriphat Lertchai',   email: 'b.lertchai@logicon.th',   role: 'Yard Planner',     yards: 'Export, Empty',       lastLogin: '2026-05-03 16:20', status: 'Active'    },
  { id: 10, name: 'Chalermchai Sriwan',  email: 'c.sriwan@logicon.th',     role: 'Gate Supervisor',  yards: 'All Yards',           lastLogin: '2026-04-15 11:30', status: 'Suspended' },
  { id: 11, name: 'James Thornton',      email: 'j.thornton@logicon.th',   role: 'Viewer',           yards: 'All Yards',           lastLogin: '2026-05-01 10:00', status: 'Active'    },
  { id: 12, name: 'Priya Nair',          email: 'p.nair@logicon.th',       role: 'Terminal Manager', yards: 'All Yards',           lastLogin: '2026-05-04 08:05', status: 'Active'    },
];

// ── Permission matrix ──────────────────────────────────────────────────────────

const PERMISSION_MODULES = [
  'Gate — EIR-In',
  'Gate — EIR-Out',
  'Gate — Appointments',
  'Yard — Plan & Moves',
  'CFS — Stuffing/Stripping',
  'Billing — View',
  'Billing — Create/Edit',
  'Billing — Approve',
  'Master Data — View',
  'Master Data — Edit',
  'Reports — View',
  'Reports — Export',
  'Configuration — View',
  'Configuration — Edit',
  'Users — Manage',
];

type PermMatrix = Record<RoleName, boolean[]>;

// true = allowed for [Super, T.Mgr, G.Sup, G.Oper, Billing, Planner, Viewer]
const PERMISSIONS: PermMatrix = {
  'Super Admin':      [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
  'Terminal Manager': [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  false, false],
  'Gate Supervisor':  [true,  true,  true,  false, false, false, false, false, true,  false, true,  false, true,  false, false],
  'Gate Operator':    [true,  true,  false, false, false, false, false, false, true,  false, false, false, false, false, false],
  'Billing Clerk':    [false, false, false, false, false, true,  true,  false, true,  false, true,  true,  false, false, false],
  'Yard Planner':     [false, false, false, true,  false, false, false, false, true,  false, true,  false, false, false, false],
  'Viewer':           [false, false, false, false, false, true,  false, false, true,  false, true,  false, true,  false, false],
};

// ── Avatar helper ──────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, accent }: {
  label: string; value: string | number; sub?: string; icon: string; accent: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 160, padding: '16px 20px',
      background: 'var(--gecko-bg-surface)',
      border: '1px solid var(--gecko-border)',
      borderTop: `3px solid ${accent}`,
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)' }}>
          {label}
        </div>
        <span style={{ color: accent, opacity: 0.8 }}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: 'var(--gecko-text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function RoleBadge({ role }: { role: RoleName }) {
  const cfg = ROLES[role];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.color,
      letterSpacing: '0.01em',
    }}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: cfg.text }}>{status}</span>
    </span>
  );
}

function Avatar({ name, role }: { name: string; role: RoleName }) {
  const cfg = ROLES[role];
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: cfg.bg, color: cfg.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 800, flexShrink: 0,
      letterSpacing: '0.02em',
    }}>
      {getInitials(name)}
    </div>
  );
}

// ── New User Panel ─────────────────────────────────────────────────────────────

const YARD_OPTIONS = ['Import Yard', 'Export Yard', 'Bonded Yard', 'Empty Depot'];

interface NewUserForm {
  fullName: string;
  email: string;
  role: RoleName | '';
  yards: string[];
  password: string;
  mustChange: boolean;
}

const EMPTY_FORM: NewUserForm = {
  fullName: '', email: '', role: '', yards: [], password: '', mustChange: true,
};

function NewUserPanel({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (form: NewUserForm) => void;
}) {
  const [form, setForm] = useState<NewUserForm>({ ...EMPTY_FORM });
  const [showPw, setShowPw] = useState(false);

  const toggleYard = (yard: string) => {
    setForm(f => ({
      ...f,
      yards: f.yards.includes(yard) ? f.yards.filter(y => y !== yard) : [...f.yards, yard],
    }));
  };

  const valid = form.fullName.trim() && form.email.trim() && form.role && form.password.length >= 6;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 99,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 100,
        width: 380,
        background: 'var(--gecko-bg-surface)',
        borderLeft: '1px solid var(--gecko-border)',
        boxShadow: '-6px 0 32px rgba(0,0,0,0.16)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--gecko-border)',
          background: 'var(--gecko-primary-600)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="user" size={16} /> New User
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
              Add a system account and assign a role
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6,
              color: '#fff', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center',
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
          {/* Full Name */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)' }}>
              Full Name
            </span>
            <input
              type="text"
              value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              placeholder="e.g. Somchai Krungthep"
              className="gecko-input"
              style={{ fontSize: 13 }}
            />
          </label>

          {/* Email */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)' }}>
              Email Address
            </span>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-secondary)' }}>
                <Icon name="mail" size={14} />
              </span>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="user@logicon.th"
                className="gecko-input"
                style={{ fontSize: 13, paddingLeft: 32 }}
              />
            </div>
          </label>

          {/* Role */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)' }}>
              Role
            </span>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as RoleName }))}
              className="gecko-input"
              style={{ fontSize: 13 }}
            >
              <option value="">— Select a role —</option>
              {ROLE_NAMES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          {/* Assigned Yards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)' }}>
              Assigned Yards
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {YARD_OPTIONS.map(yard => (
                <label key={yard} style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '8px 12px', borderRadius: 7,
                  background: form.yards.includes(yard) ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-subtle)',
                  border: `1px solid ${form.yards.includes(yard) ? 'var(--gecko-primary-200)' : 'var(--gecko-border)'}`,
                  transition: 'all 0.12s',
                }}>
                  <input
                    type="checkbox"
                    checked={form.yards.includes(yard)}
                    onChange={() => toggleYard(yard)}
                    style={{ accentColor: 'var(--gecko-primary-600)', width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: form.yards.includes(yard) ? 600 : 400, color: 'var(--gecko-text-primary)' }}>
                    {yard}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Temporary Password */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)' }}>
              Temporary Password
            </span>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-secondary)' }}>
                <Icon name="lock" size={14} />
              </span>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min. 6 characters"
                className="gecko-input"
                style={{ fontSize: 13, paddingLeft: 32, paddingRight: 38 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--gecko-text-secondary)', padding: 0, display: 'flex',
                }}
              >
                <Icon name={showPw ? 'eyeOff' : 'eye'} size={15} />
              </button>
            </div>
          </label>

          {/* Must change on first login */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '10px 12px', borderRadius: 7,
            background: form.mustChange ? 'var(--gecko-warning-50)' : 'var(--gecko-bg-subtle)',
            border: `1px solid ${form.mustChange ? 'var(--gecko-warning-200)' : 'var(--gecko-border)'}`,
          }}>
            <input
              type="checkbox"
              checked={form.mustChange}
              onChange={e => setForm(f => ({ ...f, mustChange: e.target.checked }))}
              style={{ accentColor: 'var(--gecko-warning-600)', width: 15, height: 15 }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
                Must change on first login
              </div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 1 }}>
                User will be prompted to set a new password
              </div>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--gecko-border)',
          background: 'var(--gecko-bg-subtle)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          flexShrink: 0,
        }}>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={!valid}
            onClick={() => valid && onSave(form)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'not-allowed',
            }}
          >
            <Icon name="save" size={14} /> Create User
          </button>
        </div>
      </div>
    </>
  );
}

// ── Permission Matrix Tab ──────────────────────────────────────────────────────

function PermissionsTab() {
  const columns: RoleName[] = [
    'Super Admin', 'Terminal Manager', 'Gate Supervisor',
    'Gate Operator', 'Billing Clerk', 'Yard Planner', 'Viewer',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
            Module Access Matrix
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
            Cross-reference each role against available system modules. Read-only — edit via role configuration.
          </div>
        </div>
        <button
          className="gecko-btn gecko-btn-primary gecko-btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 7 }}
        >
          <Icon name="plus" size={14} /> Add Custom Role
        </button>
      </div>

      <div style={{
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--gecko-border)' }}>
                <th style={{
                  padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--gecko-text-secondary)', background: 'var(--gecko-bg-subtle)',
                  minWidth: 200, position: 'sticky', left: 0, zIndex: 2,
                  borderRight: '1px solid var(--gecko-border)',
                }}>
                  Module / Permission
                </th>
                {columns.map(role => {
                  const cfg = ROLES[role];
                  return (
                    <th key={role} style={{
                      padding: '10px 8px', textAlign: 'center',
                      background: cfg.bg, color: cfg.color,
                      fontSize: 11, fontWeight: 700,
                      borderRight: '1px solid rgba(255,255,255,0.15)',
                      minWidth: 80,
                    }}>
                      {cfg.abbr}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MODULES.map((mod, mi) => {
                const isSection = mod.startsWith('Gate —') && mi === 0;
                const isNewSection = mi === 0 || mod.split(' — ')[0] !== PERMISSION_MODULES[mi - 1]?.split(' — ')[0];
                const sectionLabel = mod.split(' — ')[0];
                const prevSection = PERMISSION_MODULES[mi - 1]?.split(' — ')[0];

                return (
                  <React.Fragment key={mod}>
                    {isNewSection && (
                      <tr>
                        <td
                          colSpan={columns.length + 1}
                          style={{
                            padding: '8px 16px 4px',
                            fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: 'var(--gecko-text-secondary)',
                            background: 'var(--gecko-bg-subtle)',
                            borderTop: mi > 0 ? '1px solid var(--gecko-border)' : 'none',
                            borderBottom: '1px solid var(--gecko-border)',
                          }}
                        >
                          {sectionLabel}
                        </td>
                      </tr>
                    )}
                    <tr style={{
                      borderBottom: '1px solid var(--gecko-bg-subtle)',
                      background: mi % 2 === 0 ? '#fff' : 'var(--gecko-bg-subtle)',
                    }}>
                      <td style={{
                        padding: '10px 16px', fontSize: 13,
                        color: 'var(--gecko-text-primary)', fontWeight: 500,
                        position: 'sticky', left: 0, zIndex: 1,
                        background: mi % 2 === 0 ? '#fff' : 'var(--gecko-bg-subtle)',
                        borderRight: '1px solid var(--gecko-border)',
                      }}>
                        {mod.split(' — ')[1] ?? mod}
                      </td>
                      {columns.map(role => {
                        const allowed = PERMISSIONS[role][mi];
                        return (
                          <td key={role} style={{
                            textAlign: 'center', padding: '10px 8px',
                            borderRight: '1px solid var(--gecko-border)',
                          }}>
                            {allowed ? (
                              <span style={{ color: 'var(--gecko-success-600)', display: 'flex', justifyContent: 'center' }}>
                                <Icon name="checkCircle" size={16} />
                              </span>
                            ) : (
                              <span style={{ color: 'var(--gecko-text-disabled)', display: 'flex', justifyContent: 'center', fontSize: 16, lineHeight: 1 }}>
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--gecko-border)',
          display: 'flex', alignItems: 'center', gap: 20, fontSize: 12, color: 'var(--gecko-text-secondary)',
          background: 'var(--gecko-bg-subtle)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="checkCircle" size={13} style={{ color: 'var(--gecko-success-600)' }} />
            Permission granted
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, lineHeight: 1, color: 'var(--gecko-text-disabled)' }}>—</span>
            Not permitted
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
            {columns.length} roles · {PERMISSION_MODULES.length} modules
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function UsersRolesPage() {
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [users, setUsers] = useState<User[]>(USERS);
  const [savedMsg, setSavedMsg] = useState('');

  // KPI values
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'Active').length;
  const rolesCount = ROLE_NAMES.length;
  const lastAdded = users[users.length - 1]?.name ?? '—';

  // Filtered users
  const filtered = useMemo(() => {
    return users.filter(u => {
      if (search) {
        const q = search.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleNewUser = (form: NewUserForm) => {
    const newUser: User = {
      id: users.length + 1,
      name: form.fullName,
      email: form.email,
      role: form.role as RoleName,
      yards: form.yards.length === 4 ? 'All Yards' : form.yards.join(', ') || '—',
      lastLogin: '—',
      status: 'Active',
    };
    setUsers(prev => [...prev, newUser]);
    setPanelOpen(false);
    setSavedMsg(`User "${form.fullName}" created`);
    setTimeout(() => setSavedMsg(''), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gecko-space-4)' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--gecko-text-primary)' }}>
              Users &amp; Roles
            </h1>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 4,
              background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)',
              border: '1px solid var(--gecko-primary-200)',
            }}>
              Super Admin
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>
            Manage system users, assign roles, and control module-level access
          </div>
        </div>
        {savedMsg && (
          <span style={{
            fontSize: 12, color: 'var(--gecko-success-700)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 6,
            background: 'var(--gecko-success-50)', border: '1px solid var(--gecko-success-200)',
          }}>
            <Icon name="checkCircle" size={14} /> {savedMsg}
          </span>
        )}
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard
          label="Total Users"
          value={totalUsers}
          sub={`Across all roles`}
          icon="users"
          accent="var(--gecko-primary-500)"
        />
        <KpiCard
          label="Active Users"
          value={activeUsers}
          sub={`${Math.round(activeUsers / totalUsers * 100)}% of total`}
          icon="checkCircle"
          accent="var(--gecko-success-600)"
        />
        <KpiCard
          label="Roles Defined"
          value={rolesCount}
          sub="Built-in role library"
          icon="shieldCheck"
          accent="var(--gecko-warning-500)"
        />
        <KpiCard
          label="Last User Added"
          value="Priya Nair"
          sub="2026-05-04"
          icon="user"
          accent="var(--gecko-info-500, #3b82f6)"
        />
      </div>

      {/* ── Tab Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        borderBottom: '2px solid var(--gecko-border)',
        paddingBottom: 0,
      }}>
        {([
          { key: 'users', label: 'Users', icon: 'users' },
          { key: 'roles', label: 'Roles & Permissions', icon: 'shieldCheck' },
        ] as { key: 'users' | 'roles'; label: string; icon: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 18px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'var(--gecko-primary-600)' : 'var(--gecko-text-secondary)',
              borderBottom: tab === t.key ? '2px solid var(--gecko-primary-600)' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.12s',
              fontFamily: 'inherit',
            }}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
            {t.key === 'users' && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                background: tab === 'users' ? 'var(--gecko-primary-100)' : 'var(--gecko-bg-subtle)',
                color: tab === 'users' ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
              }}>
                {totalUsers}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--gecko-text-secondary)', pointerEvents: 'none',
              }}>
                <Icon name="search" size={15} />
              </span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="gecko-input gecko-input-sm"
                style={{ paddingLeft: 34, width: '100%' }}
              />
            </div>

            {/* Role filter */}
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="gecko-input gecko-input-sm"
              style={{ minWidth: 170 }}
            >
              <option value="">All Roles</option>
              {ROLE_NAMES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="gecko-input gecko-input-sm"
              style={{ minWidth: 140 }}
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>

            {(search || roleFilter || statusFilter) && (
              <button
                className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--gecko-text-secondary)' }}
              >
                <Icon name="x" size={13} /> Clear
              </button>
            )}

            <div style={{ flex: 1 }} />

            {/* New User */}
            <button
              className="gecko-btn gecko-btn-primary gecko-btn-sm"
              onClick={() => setPanelOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <Icon name="plus" size={15} /> New User
            </button>
          </div>

          {/* Result count */}
          {(search || roleFilter || statusFilter) && (
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
              Showing {filtered.length} of {totalUsers} users
            </div>
          )}

          {/* Data Table */}
          <div style={{
            background: 'var(--gecko-bg-surface)',
            border: '1px solid var(--gecko-border)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--gecko-bg-subtle)', borderBottom: '1px solid var(--gecko-border)' }}>
                  {['User', 'Role', 'Assigned Yards', 'Last Login', 'Status', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '10px 14px', textAlign: i === 5 ? 'right' : 'left',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--gecko-text-secondary)',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--gecko-text-secondary)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <Icon name="users" size={28} style={{ opacity: 0.3 }} />
                        <div style={{ fontSize: 14, fontWeight: 600 }}>No users match your filters</div>
                        <div style={{ fontSize: 12 }}>Try adjusting the search or filters</div>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((user, idx) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: '1px solid var(--gecko-bg-subtle)',
                      background: idx % 2 === 0 ? '#fff' : 'var(--gecko-bg-subtle)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--gecko-primary-50)')}
                    onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : 'var(--gecko-bg-subtle)')}
                  >
                    {/* Avatar + Name + Email */}
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={user.name} role={user.role} />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{user.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Icon name="mail" size={11} />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={{ padding: '11px 14px' }}>
                      <RoleBadge role={user.role} />
                    </td>

                    {/* Yards */}
                    <td style={{ padding: '11px 14px', color: 'var(--gecko-text-secondary)', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Icon name="globe" size={13} />
                        {user.yards}
                      </div>
                    </td>

                    {/* Last Login */}
                    <td style={{ padding: '11px 14px', color: 'var(--gecko-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {user.lastLogin === '—' ? (
                        <span style={{ color: 'var(--gecko-text-disabled)' }}>Never</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Icon name="clock" size={13} />
                          {user.lastLogin}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '11px 14px' }}>
                      <StatusBadge status={user.status} />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        <button
                          style={{
                            background: 'none', border: '1px solid var(--gecko-border)',
                            borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                            color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center',
                            transition: 'all 0.1s',
                          }}
                          title="Edit user"
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gecko-primary-400)';
                            (e.currentTarget as HTMLButtonElement).style.color = 'var(--gecko-primary-600)';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gecko-border)';
                            (e.currentTarget as HTMLButtonElement).style.color = 'var(--gecko-text-secondary)';
                          }}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          style={{
                            background: 'none', border: '1px solid var(--gecko-border)',
                            borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                            color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center',
                            transition: 'all 0.1s',
                          }}
                          title="More actions"
                        >
                          <Icon name="moreH" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Table footer */}
            <div style={{
              padding: '10px 16px', borderTop: '1px solid var(--gecko-border)',
              background: 'var(--gecko-bg-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              flexWrap: 'wrap', fontSize: 12, color: 'var(--gecko-text-secondary)',
            }}>
              <span>
                {filtered.length} user{filtered.length !== 1 ? 's' : ''} shown
                {(search || roleFilter || statusFilter) && ` · filtered from ${totalUsers}`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gecko-success-500)', display: 'inline-block' }} />
                  {activeUsers} active
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gecko-gray-400)', display: 'inline-block' }} />
                  {users.filter(u => u.status === 'Inactive').length} inactive
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gecko-error-500)', display: 'inline-block' }} />
                  {users.filter(u => u.status === 'Suspended').length} suspended
                </span>
              </div>
            </div>
          </div>

          {/* Info banner */}
          <div style={{
            padding: '11px 16px', borderRadius: 8,
            background: 'var(--gecko-primary-50)', border: '1px solid var(--gecko-primary-100)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <Icon name="info" size={15} style={{ color: 'var(--gecko-primary-600)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: 'var(--gecko-primary-800)', lineHeight: 1.6 }}>
              <strong>Laem Chabang Terminal — Logicon TOS.</strong> Role assignments control gate lane access, billing authority, and yard plan visibility.
              Suspended accounts cannot log in but audit history is preserved. Use the <em>Roles &amp; Permissions</em> tab to review module-level access before assigning roles.
            </div>
          </div>
        </div>
      )}

      {tab === 'roles' && <PermissionsTab />}

      {/* ── New User Slide-in Panel ── */}
      {panelOpen && (
        <NewUserPanel
          onClose={() => setPanelOpen(false)}
          onSave={handleNewUser}
        />
      )}
    </div>
  );
}
