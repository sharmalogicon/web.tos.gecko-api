'use client';
import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

// ── Types ──────────────────────────────────────────────────────────────────────

type Perm = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'print';

interface ModuleDef {
  id: string;
  group: string;
  label: string;
  icon: string;
  perms: Perm[];
}

type RolePerms = Record<string, Perm[]>;

// ── Module Definitions ─────────────────────────────────────────────────────────

const ALL_PERMS: Perm[] = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'print'];

const MODULES: ModuleDef[] = [
  // Gate Operations
  { id: 'gate-appt',  group: 'Gate Operations',         label: 'Gate Appointments',      icon: 'calendar',       perms: ['view','create','edit','delete','print'] },
  { id: 'eir-in',     group: 'Gate Operations',         label: 'EIR-In',                 icon: 'clipboardList',  perms: ['view','create','edit','delete','print'] },
  { id: 'eir-out',    group: 'Gate Operations',         label: 'EIR-Out',                icon: 'clipboardList',  perms: ['view','create','edit','delete','print'] },
  // Yard
  { id: 'yard-plan',  group: 'Yard',                   label: 'Yard Plan',               icon: 'layers',         perms: ['view','edit'] },
  { id: 'moves',      group: 'Yard',                   label: 'Moves Planner',           icon: 'arrowRight',     perms: ['view','create','edit','delete'] },
  // CFS
  { id: 'stuffing',   group: 'CFS',                    label: 'CFS Stuffing',            icon: 'box',            perms: ['view','create','edit','delete','print'] },
  { id: 'stripping',  group: 'CFS',                    label: 'CFS Stripping',           icon: 'box',            perms: ['view','create','edit','delete','print'] },
  { id: 'lcl-cargo',  group: 'CFS',                    label: 'LCL Cargo Register',      icon: 'fileText',       perms: ['view','create','edit','delete','export'] },
  // Units & Equipment
  { id: 'unit-inquiry', group: 'Units & Equipment',    label: 'Unit Inquiry',            icon: 'search',         perms: ['view','export'] },
  { id: 'equip-pool', group: 'Units & Equipment',      label: 'Equipment Pool',          icon: 'tool',           perms: ['view','create','edit','delete'] },
  { id: 'dd',         group: 'Units & Equipment',      label: 'Detention & Demurrage',   icon: 'clock',          perms: ['view','edit','approve'] },
  // Billing & Invoicing
  { id: 'svc-orders', group: 'Billing & Invoicing',    label: 'Service Orders',          icon: 'clipboardList',  perms: ['view','create','edit','delete','approve','print'] },
  { id: 'invoices',   group: 'Billing & Invoicing',    label: 'Invoices',                icon: 'invoice',        perms: ['view','create','edit','delete','approve','print','export'] },
  { id: 'credit-notes', group: 'Billing & Invoicing',  label: 'Credit Notes',            icon: 'fileText',       perms: ['view','create','approve','print'] },
  { id: 'statements', group: 'Billing & Invoicing',    label: 'Statements',              icon: 'fileText',       perms: ['view','print','export'] },
  // Tariff Management
  { id: 'tariff',     group: 'Tariff Management',      label: 'Tariff Schedules',        icon: 'tag',            perms: ['view','create','edit','delete'] },
  { id: 'rate-cards', group: 'Tariff Management',      label: 'Rate Cards',              icon: 'percent',        perms: ['view','create','edit','delete'] },
  { id: 'free-time',  group: 'Tariff Management',      label: 'Free Time & D&D Rules',   icon: 'clock',          perms: ['view','create','edit','delete'] },
  // Master Data & Reports
  { id: 'master-data', group: 'Master Data & Reports', label: 'Master Data',             icon: 'database',       perms: ['view','create','edit','delete','export'] },
  { id: 'reports',    group: 'Master Data & Reports',  label: 'Reports',                 icon: 'activity',       perms: ['view','export','print'] },
  // Configuration & Admin
  { id: 'config',     group: 'Configuration & Admin',  label: 'System Configuration',   icon: 'settings',       perms: ['view','edit'] },
  { id: 'users-admin', group: 'Configuration & Admin', label: 'Users & Roles Admin',     icon: 'users',          perms: ['view','create','edit','delete'] },
];

// ── Groups (ordered) ───────────────────────────────────────────────────────────

const GROUPS = Array.from(new Set(MODULES.map(m => m.group)));

// ── Permission column meta ─────────────────────────────────────────────────────

const PERM_META: { perm: Perm; label: string; icon: string }[] = [
  { perm: 'view',    label: 'View',    icon: 'eye' },
  { perm: 'create',  label: 'Create',  icon: 'plus' },
  { perm: 'edit',    label: 'Edit',    icon: 'edit' },
  { perm: 'delete',  label: 'Delete',  icon: 'trash' },
  { perm: 'approve', label: 'Approve', icon: 'checkCircle' },
  { perm: 'export',  label: 'Export',  icon: 'arrowDown' },
  { perm: 'print',   label: 'Print',   icon: 'fileText' },
];

// ── Preset role colors ─────────────────────────────────────────────────────────

const ROLE_COLORS = [
  'var(--gecko-primary-600)',
  'var(--gecko-error-600)',
  'var(--gecko-success-600)',
  'var(--gecko-warning-600)',
  '#7c3aed',
  '#0891b2',
  '#be185d',
  '#374151',
];

// ── Seed permissions ───────────────────────────────────────────────────────────

function seedPerms(roleId: string): RolePerms {
  const allPerms = (modId: string): Perm[] => {
    const mod = MODULES.find(m => m.id === modId);
    return mod ? [...mod.perms] : [];
  };
  const viewOnly = (): RolePerms =>
    Object.fromEntries(MODULES.map(m => [m.id, m.perms.includes('view') ? ['view'] : []]));
  const stdPerms = (modId: string): Perm[] => {
    const mod = MODULES.find(m => m.id === modId);
    if (!mod) return [];
    return mod.perms.filter(p => ['view','create','edit'].includes(p));
  };

  switch (roleId) {
    case 'new':
      return Object.fromEntries(MODULES.map(m => [m.id, []]));

    case 'super-admin':
      return Object.fromEntries(MODULES.map(m => [m.id, [...m.perms]]));

    case 'terminal-manager': {
      const p: RolePerms = {};
      for (const m of MODULES) {
        const g = m.group;
        if (['Gate Operations','Yard','CFS','Units & Equipment'].includes(g)) {
          p[m.id] = [...m.perms];
        } else if (g === 'Billing & Invoicing') {
          p[m.id] = m.perms.filter(x => x === 'view' || x === 'approve');
        } else if (g === 'Tariff Management') {
          p[m.id] = m.perms.includes('view') ? ['view'] : [];
        } else if (g === 'Master Data & Reports') {
          p[m.id] = [...m.perms];
        } else if (m.id === 'config') {
          p[m.id] = ['view'];
        } else {
          p[m.id] = m.perms.includes('view') ? ['view'] : [];
        }
      }
      return p;
    }

    case 'gate-supervisor': {
      const p: RolePerms = {};
      for (const m of MODULES) {
        if (m.group === 'Gate Operations') {
          p[m.id] = [...m.perms];
        } else if (m.group === 'Yard') {
          p[m.id] = m.perms.includes('view') ? ['view'] : [];
        } else if (m.group === 'Units & Equipment') {
          p[m.id] = m.perms.includes('view') ? ['view'] : [];
        } else if (m.group === 'Billing & Invoicing') {
          p[m.id] = m.perms.includes('view') ? ['view'] : [];
        } else {
          p[m.id] = [];
        }
      }
      return p;
    }

    case 'gate-operator': {
      const p: RolePerms = {};
      for (const m of MODULES) {
        if (['gate-appt','eir-in','eir-out'].includes(m.id)) {
          p[m.id] = m.perms.filter(x => ['view','create','edit','print'].includes(x));
        } else {
          p[m.id] = [];
        }
      }
      return p;
    }

    case 'billing-clerk': {
      const p: RolePerms = {};
      for (const m of MODULES) {
        if (m.group === 'Billing & Invoicing' || m.group === 'Master Data & Reports') {
          p[m.id] = [...m.perms];
        } else {
          p[m.id] = m.perms.includes('view') ? ['view'] : [];
        }
      }
      return p;
    }

    case 'yard-planner': {
      const p: RolePerms = {};
      for (const m of MODULES) {
        if (m.group === 'Yard' || m.group === 'Units & Equipment') {
          p[m.id] = [...m.perms];
        } else if (m.group === 'Gate Operations') {
          p[m.id] = m.perms.includes('view') ? ['view'] : [];
        } else {
          p[m.id] = [];
        }
      }
      return p;
    }

    case 'viewer':
      return viewOnly();

    default:
      return Object.fromEntries(MODULES.map(m => [m.id, []]));
  }
}

// ── Role metadata ──────────────────────────────────────────────────────────────

interface RoleMeta {
  name: string;
  description: string;
  isSystem: boolean;
  color: string;
  type: 'System' | 'Custom';
}

const ROLE_META: Record<string, RoleMeta> = {
  'super-admin':      { name: 'Super Admin',       description: 'Full unrestricted access to all modules and configuration.',         isSystem: true,  color: 'var(--gecko-error-600)',   type: 'System' },
  'terminal-manager': { name: 'Terminal Manager',  description: 'Oversees gate, yard, CFS and units. Billing approval authority.',    isSystem: true,  color: 'var(--gecko-primary-700)', type: 'System' },
  'gate-supervisor':  { name: 'Gate Supervisor',   description: 'Full gate operations control. View-only access to units and billing.', isSystem: true, color: 'var(--gecko-primary-500)', type: 'System' },
  'gate-operator':    { name: 'Gate Operator',     description: 'Gate lane data entry — EIR in/out and appointment creation.',        isSystem: false, color: '#3b82f6',                  type: 'Custom' },
  'billing-clerk':    { name: 'Billing Clerk',     description: 'Full billing and invoicing access. View-only on operational modules.', isSystem: false, color: 'var(--gecko-success-600)', type: 'Custom' },
  'yard-planner':     { name: 'Yard Planner',      description: 'Yard plan and equipment management. Gate view only.',                isSystem: false, color: 'var(--gecko-warning-600)', type: 'Custom' },
  'viewer':           { name: 'Viewer',            description: 'Read-only access to all permitted modules. No data modification.',    isSystem: true,  color: 'var(--gecko-gray-500)',    type: 'System' },
  'new':              { name: '',                  description: '',                                                                    isSystem: false, color: 'var(--gecko-primary-600)', type: 'Custom' },
};

// ── Assigned users per role ────────────────────────────────────────────────────

interface AssignedUser {
  initials: string;
  name: string;
  email: string;
  lastLogin: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  color: string;
}

const ASSIGNED_USERS: Record<string, AssignedUser[]> = {
  'super-admin': [
    { initials: 'SK', name: 'Somchai Krungthep',  email: 's.krungthep@logicon.th',  lastLogin: '2026-05-03 08:14', status: 'Active',    color: 'var(--gecko-error-600)' },
  ],
  'terminal-manager': [
    { initials: 'NS', name: 'Nattaya Siriporn',   email: 'n.siriporn@logicon.th',   lastLogin: '2026-05-04 07:22', status: 'Active',    color: 'var(--gecko-primary-700)' },
    { initials: 'WB', name: 'Wichai Boontham',    email: 'w.boontham@logicon.th',   lastLogin: '2026-05-04 06:01', status: 'Active',    color: 'var(--gecko-primary-700)' },
    { initials: 'PN', name: 'Priya Nair',         email: 'p.nair@logicon.th',       lastLogin: '2026-05-04 08:05', status: 'Active',    color: 'var(--gecko-primary-700)' },
  ],
  'gate-supervisor': [
    { initials: 'KR', name: 'Kanokwan Rattana',   email: 'k.rattana@logicon.th',    lastLogin: '2026-05-03 18:45', status: 'Active',    color: 'var(--gecko-primary-500)' },
    { initials: 'CS', name: 'Chalermchai Sriwan', email: 'c.sriwan@logicon.th',     lastLogin: '2026-04-15 11:30', status: 'Suspended', color: 'var(--gecko-primary-500)' },
  ],
  'gate-operator': [
    { initials: 'KR', name: 'Kanit Rattana',      email: 'kanit.r@logicon.th',      lastLogin: '2026-05-04 05:52', status: 'Active',    color: '#3b82f6' },
    { initials: 'PD', name: 'Prasit Duangdao',    email: 'p.duangdao@logicon.th',   lastLogin: '2026-05-04 06:30', status: 'Active',    color: '#3b82f6' },
    { initials: 'AN', name: 'Anon Khamkaew',      email: 'a.khamkaew@logicon.th',   lastLogin: '2026-04-29 09:00', status: 'Inactive',  color: '#3b82f6' },
    { initials: 'SY', name: 'Surachat Yodrak',    email: 's.yodrak.g@logicon.th',   lastLogin: '2026-05-04 07:55', status: 'Active',    color: '#3b82f6' },
  ],
  'billing-clerk': [
    { initials: 'MP', name: 'Malee Phakawan',     email: 'm.phakawan@logicon.th',   lastLogin: '2026-05-02 14:12', status: 'Active',    color: 'var(--gecko-success-600)' },
    { initials: 'AK', name: 'Anon Khamkaew',      email: 'a.khamkaew@logicon.th',   lastLogin: '2026-04-29 09:00', status: 'Inactive',  color: 'var(--gecko-success-600)' },
  ],
  'yard-planner': [
    { initials: 'SY', name: 'Surachat Yodrak',    email: 's.yodrak@logicon.th',     lastLogin: '2026-05-04 07:55', status: 'Active',    color: 'var(--gecko-warning-600)' },
    { initials: 'BL', name: 'Boriphat Lertchai',  email: 'b.lertchai@logicon.th',   lastLogin: '2026-05-03 16:20', status: 'Active',    color: 'var(--gecko-warning-600)' },
  ],
  'viewer': [
    { initials: 'JT', name: 'James Thornton',     email: 'j.thornton@logicon.th',   lastLogin: '2026-05-01 10:00', status: 'Active',    color: 'var(--gecko-gray-500)' },
  ],
  'new': [],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function permSetEqual(a: Perm[], b: Perm[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every(x => sa.has(x));
}

function permsChanged(current: RolePerms, seed: RolePerms): boolean {
  for (const mod of MODULES) {
    if (!permSetEqual(current[mod.id] ?? [], seed[mod.id] ?? [])) return true;
  }
  return false;
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'info' | 'warning' }) {
  const cfg = {
    success: { bg: 'var(--gecko-success-50)', border: 'var(--gecko-success-200)', color: 'var(--gecko-success-700)', icon: 'checkCircle' },
    info:    { bg: 'var(--gecko-primary-50)', border: 'var(--gecko-primary-200)', color: 'var(--gecko-primary-700)', icon: 'info' },
    warning: { bg: 'var(--gecko-warning-50)', border: 'var(--gecko-warning-200)', color: 'var(--gecko-warning-700)', icon: 'warning' },
  }[type];
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 200,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 18px', borderRadius: 10,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, fontSize: 13, fontWeight: 600,
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      animation: 'fadeInUp 0.2s ease',
    }}>
      <Icon name={cfg.icon} size={16} />
      {message}
    </div>
  );
}

// ── Styled Checkbox ────────────────────────────────────────────────────────────

function PermCheckbox({
  checked,
  applicable,
  disabled,
  onToggle,
}: {
  checked: boolean;
  applicable: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  if (!applicable) {
    return (
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--gecko-text-disabled)', fontSize: 13, userSelect: 'none',
      }}>
        —
      </span>
    );
  }
  return (
    <button
      onClick={disabled ? undefined : onToggle}
      title={disabled ? 'System roles cannot be modified' : undefined}
      style={{
        width: 22, height: 22, borderRadius: 5, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--gecko-primary-600)' : 'transparent',
        border: checked ? '2px solid var(--gecko-primary-600)' : '2px solid var(--gecko-border)',
        transition: 'all 0.12s',
        outline: 'none',
        opacity: disabled && !checked ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled && !checked) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gecko-primary-400)';
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--gecko-primary-50)';
        }
      }}
      onMouseLeave={e => {
        if (!disabled && !checked) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gecko-border)';
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }
      }}
    >
      {checked && <Icon name="check" size={12} style={{ color: '#fff', strokeWidth: 3 }} />}
    </button>
  );
}

// ── Quick-set pills for a module row ──────────────────────────────────────────

type QuickSet = 'none' | 'read' | 'std' | 'full';

function getQuickSet(granted: Perm[], modPerms: Perm[]): QuickSet {
  if (granted.length === 0) return 'none';
  if (granted.length === modPerms.length) return 'full';
  const viewOnly = granted.length === 1 && granted[0] === 'view';
  if (viewOnly) return 'read';
  const stdSet = modPerms.filter(p => ['view','create','edit'].includes(p));
  if (stdSet.length > 0 && permSetEqual(granted.filter(p => ['view','create','edit'].includes(p)), stdSet) && granted.every(p => ['view','create','edit'].includes(p))) return 'std';
  return 'none';
}

function QuickSetPills({
  modId,
  modPerms,
  granted,
  disabled,
  onChange,
}: {
  modId: string;
  modPerms: Perm[];
  granted: Perm[];
  disabled: boolean;
  onChange: (modId: string, perms: Perm[]) => void;
}) {
  const current = getQuickSet(granted, modPerms);
  const pills: { key: QuickSet; label: string; title: string }[] = [
    { key: 'none', label: '—',  title: 'None' },
    { key: 'read', label: 'R',  title: 'Read only' },
    { key: 'std',  label: 'S',  title: 'Standard (view + create + edit)' },
    { key: 'full', label: 'F',  title: 'Full access' },
  ];

  const apply = (key: QuickSet) => {
    if (disabled) return;
    let next: Perm[] = [];
    if (key === 'none') next = [];
    else if (key === 'read') next = modPerms.includes('view') ? ['view'] : [];
    else if (key === 'std') next = modPerms.filter(p => ['view','create','edit'].includes(p));
    else if (key === 'full') next = [...modPerms];
    onChange(modId, next);
  };

  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {pills.map(pill => {
        const active = current === pill.key;
        return (
          <button
            key={pill.key}
            onClick={() => apply(pill.key)}
            title={pill.title}
            disabled={disabled}
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              border: '1px solid',
              cursor: disabled ? 'not-allowed' : 'pointer',
              borderColor: active ? 'var(--gecko-primary-600)' : 'var(--gecko-border)',
              background: active ? 'var(--gecko-primary-600)' : 'transparent',
              color: active ? '#fff' : 'var(--gecko-text-secondary)',
              transition: 'all 0.1s',
              outline: 'none',
            }}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Column select-all state ────────────────────────────────────────────────────

type ColState = 'all' | 'partial' | 'none';

function getColState(perm: Perm, perms: RolePerms): ColState {
  const applicable = MODULES.filter(m => m.perms.includes(perm));
  if (applicable.length === 0) return 'none';
  const checked = applicable.filter(m => (perms[m.id] ?? []).includes(perm)).length;
  if (checked === 0) return 'none';
  if (checked === applicable.length) return 'all';
  return 'partial';
}

// ── Permission Matrix ──────────────────────────────────────────────────────────

function PermissionMatrix({
  perms,
  isSystem,
  onToggle,
  onModuleQuickSet,
}: {
  perms: RolePerms;
  isSystem: boolean;
  onToggle: (modId: string, perm: Perm) => void;
  onModuleQuickSet: (modId: string, newPerms: Perm[]) => void;
}) {
  const handleColToggle = useCallback((perm: Perm) => {
    if (isSystem) return;
    const applicable = MODULES.filter(m => m.perms.includes(perm));
    const state = getColState(perm, perms);
    if (state === 'all') {
      // Remove from all
      applicable.forEach(m => onToggle(m.id, perm));
    } else {
      // Add to all that don't have it
      applicable.filter(m => !(perms[m.id] ?? []).includes(perm)).forEach(m => onToggle(m.id, perm));
    }
  }, [isSystem, perms, onToggle]);

  return (
    <div style={{
      background: 'var(--gecko-bg-surface)',
      border: '1px solid var(--gecko-border)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--gecko-border)' }}>
              {/* Module header */}
              <th style={{
                padding: '12px 14px', textAlign: 'left',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                color: 'var(--gecko-text-secondary)', background: 'var(--gecko-bg-subtle)',
                position: 'sticky', left: 0, zIndex: 3,
                minWidth: 220, borderRight: '1px solid var(--gecko-border)',
              }}>
                Module
              </th>
              {/* Quick-set header */}
              <th style={{
                padding: '12px 10px', textAlign: 'center',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                color: 'var(--gecko-text-secondary)', background: 'var(--gecko-bg-subtle)',
                minWidth: 104, borderRight: '1px solid var(--gecko-border)',
              }}>
                Quick Set
              </th>
              {/* Perm columns */}
              {PERM_META.map(({ perm, label, icon }) => {
                const state = getColState(perm, perms);
                const isAll = state === 'all';
                const isPartial = state === 'partial';
                return (
                  <th
                    key={perm}
                    style={{
                      padding: '10px 4px', textAlign: 'center',
                      fontSize: 11, fontWeight: isAll ? 700 : 600,
                      color: isAll ? 'var(--gecko-primary-700)' : isPartial ? 'var(--gecko-text-primary)' : 'var(--gecko-text-secondary)',
                      background: 'var(--gecko-bg-subtle)',
                      minWidth: 72,
                      borderRight: '1px solid var(--gecko-border)',
                      cursor: isSystem ? 'default' : 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => handleColToggle(perm)}
                    title={isSystem ? 'System role — read only' : `Toggle all "${label}"`}
                  >
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}>
                      <Icon
                        name={icon}
                        size={14}
                        style={{ color: isAll ? 'var(--gecko-primary-600)' : isPartial ? 'var(--gecko-text-primary)' : 'var(--gecko-text-secondary)' }}
                      />
                      <span style={{ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(group => {
              const groupModules = MODULES.filter(m => m.group === group);
              const allGranted = groupModules.every(m =>
                m.perms.every(p => (perms[m.id] ?? []).includes(p))
              );
              const anyGranted = groupModules.some(m => (perms[m.id] ?? []).length > 0);

              return (
                <React.Fragment key={group}>
                  {/* Group header row */}
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: '7px 14px',
                        background: 'var(--gecko-bg-subtle)',
                        borderTop: '1px solid var(--gecko-border)',
                        borderBottom: '1px solid var(--gecko-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: 'var(--gecko-text-secondary)',
                        }}>
                          {group}
                        </span>
                        {!isSystem && (
                          <button
                            onClick={() => {
                              if (allGranted) {
                                groupModules.forEach(m => {
                                  m.perms.forEach(p => {
                                    if ((perms[m.id] ?? []).includes(p)) onToggle(m.id, p);
                                  });
                                });
                              } else {
                                groupModules.forEach(m => {
                                  onModuleQuickSet(m.id, [...m.perms]);
                                });
                              }
                            }}
                            style={{
                              fontSize: 10, fontWeight: 600,
                              padding: '2px 8px', borderRadius: 4,
                              border: '1px solid var(--gecko-border)',
                              background: 'transparent',
                              color: allGranted ? 'var(--gecko-error-600)' : 'var(--gecko-primary-600)',
                              cursor: 'pointer', outline: 'none',
                            }}
                          >
                            {allGranted ? 'Revoke All in Group' : 'Grant All in Group'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Module rows */}
                  {groupModules.map((mod, idx) => {
                    const granted = perms[mod.id] ?? [];
                    return (
                      <tr
                        key={mod.id}
                        style={{
                          background: idx % 2 === 0 ? 'var(--gecko-bg-surface)' : 'var(--gecko-bg-subtle)',
                          borderBottom: '1px solid var(--gecko-border)',
                        }}
                      >
                        {/* Module label (sticky) */}
                        <td style={{
                          padding: '9px 14px',
                          position: 'sticky', left: 0, zIndex: 1,
                          background: idx % 2 === 0 ? 'var(--gecko-bg-surface)' : 'var(--gecko-bg-subtle)',
                          borderRight: '1px solid var(--gecko-border)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--gecko-text-secondary)', flexShrink: 0 }}>
                              <Icon name={mod.icon} size={14} />
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>
                              {mod.label}
                            </span>
                          </div>
                        </td>

                        {/* Quick-set pills */}
                        <td style={{
                          padding: '9px 10px', textAlign: 'center',
                          borderRight: '1px solid var(--gecko-border)',
                        }}>
                          <QuickSetPills
                            modId={mod.id}
                            modPerms={mod.perms}
                            granted={granted}
                            disabled={isSystem}
                            onChange={onModuleQuickSet}
                          />
                        </td>

                        {/* Perm checkboxes */}
                        {PERM_META.map(({ perm }) => {
                          const applicable = mod.perms.includes(perm);
                          const checked = granted.includes(perm);
                          return (
                            <td
                              key={perm}
                              style={{
                                padding: '9px 4px', textAlign: 'center',
                                borderRight: '1px solid var(--gecko-border)',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <PermCheckbox
                                  checked={checked}
                                  applicable={applicable}
                                  disabled={isSystem}
                                  onToggle={() => onToggle(mod.id, perm)}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid var(--gecko-border)',
        background: 'var(--gecko-bg-subtle)',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        fontSize: 12, color: 'var(--gecko-text-secondary)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 16, height: 16, borderRadius: 4,
            background: 'var(--gecko-primary-600)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="check" size={10} style={{ color: '#fff', strokeWidth: 3 }} />
          </span>
          Permission granted
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 16, height: 16, borderRadius: 4,
            border: '2px solid var(--gecko-border)',
            display: 'inline-block',
          }} />
          Not granted
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14, lineHeight: 1, color: 'var(--gecko-text-disabled)' }}>—</span>
          Not applicable
        </span>
        {isSystem && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <Icon name="lock" size={13} />
            System role — read only
          </span>
        )}
        {!isSystem && (
          <span style={{ marginLeft: 'auto', color: 'var(--gecko-text-disabled)' }}>
            Click column header to toggle all
          </span>
        )}
      </div>
    </div>
  );
}

// ── Assigned Users Tab ─────────────────────────────────────────────────────────

function AssignedUsersTab({ roleId, roleColor }: { roleId: string; roleColor: string }) {
  const users = ASSIGNED_USERS[roleId] ?? [];

  const statusCfg: Record<string, { dot: string; text: string }> = {
    Active:    { dot: 'var(--gecko-success-500)', text: 'var(--gecko-success-700)' },
    Inactive:  { dot: 'var(--gecko-gray-400)',    text: 'var(--gecko-text-secondary)' },
    Suspended: { dot: 'var(--gecko-error-500)',   text: 'var(--gecko-error-700)' },
  };

  if (users.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 14, padding: '64px 24px', textAlign: 'center',
        background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)',
        borderRadius: 10,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--gecko-bg-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--gecko-text-disabled)',
        }}>
          <Icon name="users" size={26} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gecko-text-primary)', marginBottom: 6 }}>
            No users assigned yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', maxWidth: 320 }}>
            Assign users on the Users &amp; Roles page, then they will appear here.
          </div>
        </div>
        <Link
          href="/config/users"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 7,
            background: 'var(--gecko-primary-600)', color: '#fff',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          <Icon name="arrowRight" size={14} />
          Go to Users &amp; Roles
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--gecko-bg-surface)',
      border: '1px solid var(--gecko-border)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--gecko-border)',
        background: 'var(--gecko-bg-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>
          {users.length} user{users.length !== 1 ? 's' : ''} assigned to this role
        </div>
        <Link
          href="/config/users"
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--gecko-primary-600)',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          Manage in Users &amp; Roles <Icon name="arrowRight" size={12} />
        </Link>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
            {['User', 'Email', 'Last Login', 'Status'].map((h, i) => (
              <th key={i} style={{
                padding: '10px 14px', textAlign: 'left',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u, idx) => {
            const sc = statusCfg[u.status];
            return (
              <tr
                key={idx}
                style={{
                  borderBottom: '1px solid var(--gecko-bg-subtle)',
                  background: idx % 2 === 0 ? 'var(--gecko-bg-surface)' : 'var(--gecko-bg-subtle)',
                }}
              >
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: u.color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, flexShrink: 0, letterSpacing: '0.02em',
                    }}>
                      {u.initials}
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: '11px 14px', color: 'var(--gecko-text-secondary)', fontSize: 12 }}>
                  {u.email}
                </td>
                <td style={{ padding: '11px 14px', color: 'var(--gecko-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="clock" size={13} />
                    {u.lastLogin}
                  </div>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: sc.text }}>{u.status}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const roleId = id as string;

  const meta = ROLE_META[roleId] ?? ROLE_META['new'];
  const isSystem = meta.isSystem;
  const isNew = roleId === 'new';

  // Seeded (baseline) perms
  const seed = useMemo(() => seedPerms(roleId), [roleId]);

  // Mutable state
  const [roleName, setRoleName] = useState(meta.name);
  const [description, setDescription] = useState(meta.description);
  const [color, setColor] = useState(meta.color);
  const [colorIdx, setColorIdx] = useState(ROLE_COLORS.indexOf(meta.color));
  const [perms, setPerms] = useState<RolePerms>(() => seedPerms(roleId));
  const [tab, setTab] = useState<'permissions' | 'users'>('permissions');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const unsavedChanges = useMemo(() => {
    if (isNew) {
      return roleName.trim() !== '' || Object.values(perms).some(p => p.length > 0);
    }
    return permsChanged(perms, seed);
  }, [perms, seed, isNew, roleName]);

  // Toggle a single perm
  const handleToggle = useCallback((modId: string, perm: Perm) => {
    if (isSystem) return;
    setPerms(prev => {
      const cur = prev[modId] ?? [];
      const next = cur.includes(perm) ? cur.filter(p => p !== perm) : [...cur, perm];
      return { ...prev, [modId]: next };
    });
  }, [isSystem]);

  // Module quick-set
  const handleModuleQuickSet = useCallback((modId: string, newPerms: Perm[]) => {
    if (isSystem) return;
    setPerms(prev => ({ ...prev, [modId]: newPerms }));
  }, [isSystem]);

  // Global quick-set
  const handleClearAll = () => {
    if (isSystem) return;
    setPerms(Object.fromEntries(MODULES.map(m => [m.id, []])));
  };
  const handleReadOnly = () => {
    if (isSystem) return;
    setPerms(Object.fromEntries(MODULES.map(m => [m.id, m.perms.includes('view') ? ['view'] : []])));
  };
  const handleStandard = () => {
    if (isSystem) return;
    setPerms(Object.fromEntries(MODULES.map(m => [m.id, m.perms.filter(p => ['view','create','edit'].includes(p))])));
  };
  const handleFullAccess = () => {
    if (isSystem) return;
    setPerms(Object.fromEntries(MODULES.map(m => [m.id, [...m.perms]])));
  };

  const handleSave = () => {
    if (isSystem) {
      showToast('System roles cannot be modified', 'warning');
      return;
    }
    if (isNew && !roleName.trim()) {
      showToast('Please enter a role name', 'warning');
      return;
    }
    showToast(isNew ? `Role "${roleName}" created successfully` : `"${roleName}" saved`, 'success');
  };

  const cycleColor = () => {
    if (isSystem) return;
    const next = (colorIdx + 1) % ROLE_COLORS.length;
    setColorIdx(next);
    setColor(ROLE_COLORS[next]);
  };

  // Count total granted perms
  const totalGranted = useMemo(() =>
    Object.values(perms).reduce((sum, ps) => sum + ps.length, 0),
  [perms]);

  return (
    <>
      {/* Fade-in keyframes injected inline via a style tag alternative using a scoped style string */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gecko-space-4, 20px)', paddingBottom: 48 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Back arrow */}
            <Link
              href="/config/roles"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 8,
                background: 'var(--gecko-bg-surface)',
                border: '1px solid var(--gecko-border)',
                color: 'var(--gecko-text-secondary)',
                textDecoration: 'none', flexShrink: 0,
              }}
              title="Back to Roles"
            >
              <Icon name="arrowLeft" size={16} />
            </Link>

            {/* Color chip */}
            <button
              onClick={cycleColor}
              title={isSystem ? 'System role color' : 'Click to change color'}
              style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: color, border: 'none',
                cursor: isSystem ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
              }}
            >
              <Icon name="shieldCheck" size={16} style={{ color: '#fff' }} />
            </button>

            {/* Role name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isSystem ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--gecko-text-primary)' }}>
                      {roleName || 'New Role'}
                    </h1>
                    <span title="System roles cannot be renamed" style={{ color: 'var(--gecko-text-secondary)' }}>
                      <Icon name="lock" size={15} />
                    </span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={roleName}
                    onChange={e => setRoleName(e.target.value)}
                    placeholder="New Role"
                    className="gecko-input"
                    style={{
                      fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em',
                      padding: '4px 10px', height: 36, minWidth: 200,
                    }}
                  />
                )}

                {/* System/Custom badge */}
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                  padding: '2px 8px', borderRadius: 4,
                  background: meta.type === 'System' ? 'var(--gecko-primary-50)' : 'var(--gecko-success-50)',
                  color: meta.type === 'System' ? 'var(--gecko-primary-700)' : 'var(--gecko-success-700)',
                  border: `1px solid ${meta.type === 'System' ? 'var(--gecko-primary-200)' : 'var(--gecko-success-200)'}`,
                }}>
                  {meta.type}
                </span>

                {/* Unsaved badge */}
                {unsavedChanges && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: 4,
                    background: 'var(--gecko-warning-50)', color: 'var(--gecko-warning-700)',
                    border: '1px solid var(--gecko-warning-200)',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <Icon name="alertCircle" size={11} />
                    Unsaved changes
                  </span>
                )}
              </div>

              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
                <Link href="/config/roles" style={{ color: 'var(--gecko-text-secondary)', textDecoration: 'none' }}>
                  Roles
                </Link>
                <Icon name="chevronRight" size={12} />
                <span style={{ color: 'var(--gecko-text-primary)', fontWeight: 500 }}>
                  {roleName || 'New Role'}
                </span>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
              {totalGranted} permission{totalGranted !== 1 ? 's' : ''} granted
            </span>
            <button
              className="gecko-btn gecko-btn-primary gecko-btn-sm"
              onClick={handleSave}
              title={isSystem ? 'System roles cannot be modified' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                opacity: !unsavedChanges && !isNew ? 0.5 : 1,
              }}
            >
              <Icon name="save" size={14} />
              {isNew ? 'Create Role' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* ── System role notice ── */}
        {isSystem && (
          <div style={{
            padding: '10px 16px', borderRadius: 8,
            background: 'var(--gecko-primary-50)', border: '1px solid var(--gecko-primary-100)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, color: 'var(--gecko-primary-800)',
          }}>
            <Icon name="lock" size={15} style={{ color: 'var(--gecko-primary-600)', flexShrink: 0 }} />
            <span>
              <strong>System role</strong> — permissions are read-only and cannot be modified. Clone this role to create a customisable copy.
            </span>
            <button
              className="gecko-btn gecko-btn-sm"
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              onClick={() => showToast('Role cloned — redirect to new role (demo)', 'info')}
            >
              <Icon name="copy" size={13} />
              Clone Role
            </button>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          borderBottom: '2px solid var(--gecko-border)',
        }}>
          {([
            { key: 'permissions' as const, label: 'Permissions', icon: 'shieldCheck' },
            { key: 'users' as const,       label: 'Assigned Users', icon: 'users' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 13,
                fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? 'var(--gecko-primary-600)' : 'var(--gecko-text-secondary)',
                borderBottom: tab === t.key ? '2px solid var(--gecko-primary-600)' : '2px solid transparent',
                marginBottom: -2, transition: 'all 0.12s',
                fontFamily: 'inherit', outline: 'none',
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
                  {(ASSIGNED_USERS[roleId] ?? []).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {tab === 'permissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Top bar: description + global quick-set */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              {/* Description */}
              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)' }}>
                    Role Description
                  </span>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe the purpose and responsibilities of this role…"
                    disabled={isSystem}
                    className="gecko-input"
                    rows={1}
                    style={{
                      fontSize: 13, resize: 'none', lineHeight: 1.5,
                      opacity: isSystem ? 0.7 : 1,
                      cursor: isSystem ? 'not-allowed' : 'text',
                    }}
                  />
                </label>
              </div>

              {/* Global quick-set */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 22 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>
                  Quick set:
                </span>
                <button
                  className="gecko-btn gecko-btn-sm"
                  onClick={handleClearAll}
                  disabled={isSystem}
                  style={{
                    color: isSystem ? 'var(--gecko-text-disabled)' : 'var(--gecko-error-600)',
                    border: '1px solid var(--gecko-border)',
                    background: 'transparent',
                    cursor: isSystem ? 'not-allowed' : 'pointer',
                  }}
                >
                  Clear All
                </button>
                <button
                  className="gecko-btn gecko-btn-sm"
                  onClick={handleReadOnly}
                  disabled={isSystem}
                  style={{
                    border: '1px solid var(--gecko-border)',
                    background: 'transparent',
                    cursor: isSystem ? 'not-allowed' : 'pointer',
                    opacity: isSystem ? 0.4 : 1,
                  }}
                >
                  Read Only
                </button>
                <button
                  className="gecko-btn gecko-btn-sm"
                  onClick={handleStandard}
                  disabled={isSystem}
                  style={{
                    border: '1px solid var(--gecko-primary-300)',
                    background: 'transparent',
                    color: isSystem ? 'var(--gecko-text-disabled)' : 'var(--gecko-primary-600)',
                    cursor: isSystem ? 'not-allowed' : 'pointer',
                    opacity: isSystem ? 0.4 : 1,
                  }}
                >
                  Standard
                </button>
                <button
                  className="gecko-btn gecko-btn-primary gecko-btn-sm"
                  onClick={handleFullAccess}
                  disabled={isSystem}
                  title={isSystem ? 'System roles cannot be modified' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    opacity: isSystem ? 0.4 : 1,
                    cursor: isSystem ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSystem && <Icon name="lock" size={12} />}
                  Full Access
                </button>
              </div>
            </div>

            {/* Matrix */}
            <PermissionMatrix
              perms={perms}
              isSystem={isSystem}
              onToggle={handleToggle}
              onModuleQuickSet={handleModuleQuickSet}
            />
          </div>
        )}

        {tab === 'users' && (
          <AssignedUsersTab roleId={roleId} roleColor={color} />
        )}
      </div>

      {/* Toast notification */}
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </>
  );
}
