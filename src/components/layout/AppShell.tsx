"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth/session';
import { Icon } from '../ui/Icon';
import { ToastProvider } from '../ui/Toast';
import { AskGeckoProvider, AskGeckoTrigger } from '../ai/AskGeckoWidget';
import { autoSeedIfEmpty, seedDemoData } from '@/lib/demo-seed';
import { IS_PILOT, PILOT_PATHS } from '@/lib/edition';

// Page-title / breadcrumb derivation from the NAV tree. Single source of truth:
// browser tab title and in-app header both come from here. Future pages added
// to NAV inherit titles automatically.
function titleCaseSegment(s: string) {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function useNavMatch(pathname: string | null) {
  return useMemo(() => {
    const path = pathname ?? '/';
    const segments = path.split('/').filter(Boolean);

    // Root
    if (segments.length === 0) {
      return { pageTitle: 'Workspace', breadcrumbs: ['Workspace'] };
    }

    const mod = NAV.find(m => m.id === segments[0]);
    if (!mod) {
      // Route not in NAV (e.g. /404, /unauth). Title-case the first segment.
      const label = titleCaseSegment(segments[0]);
      return { pageTitle: label, breadcrumbs: [label] };
    }

    // Longest-prefix-matching child (same algorithm the sidebar uses for highlighting).
    const matches = (mod.children ?? []).filter(c =>
      path === c.path || path.startsWith(c.path + '/')
    );
    const child = matches.length
      ? matches.reduce((longest, c) => c.path.length > longest.path.length ? c : longest)
      : null;

    if (!child) {
      return { pageTitle: mod.label, breadcrumbs: [mod.label] };
    }

    // Exact child match (list page or static child).
    if (path === child.path) {
      return { pageTitle: child.label, breadcrumbs: [mod.label, child.label] };
    }

    // Deeper path: detail page under the child. Surface the trailing segment
    // (booking number, IMO, invoice id) so the tab title and breadcrumb stay distinct.
    const remainder = path.slice(child.path.length).replace(/^\/+/, '');
    const raw = decodeURIComponent(remainder.split('/').filter(Boolean).pop() || '');
    // A surrogate GUID (tariff schedule, booking) means nothing to an operator — say "Detail".
    const detail = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw) ? 'Detail' : raw;
    return {
      pageTitle: detail || child.label,
      breadcrumbs: [mod.label, child.label, detail].filter(Boolean),
    };
  }, [pathname]);
}

const NAV = [
  { id: 'dashboard', icon: 'home', label: 'Dashboard',
    children: [
      { id: 'overview',       label: 'Overview',               path: '/dashboard/overview' },
      { id: 'yard-glance',    label: 'Yard at a Glance',       path: '/dashboard/yard-glance' },
      { id: 'gate-traffic',   label: 'Gate & Traffic',         path: '/dashboard/gate-traffic' },
      { id: 'voyage-dash',    label: 'Voyage & Vessel',        path: '/dashboard/voyage' },
      // HIDDEN 2026-05-13 — dwell-time as a standalone page is being retired.
      // Operational dwell still lives in /dashboard/yard-glance + /units/unit-inquiry.
      // Money side moves to laden/empty storage under Billing in Phase 2/3.
      // Page file kept on disk for reference; will be deleted or folded during Phase 2.
      // See docs/modules/tos.md (api.gecko-api repo) for the storage model.
      // { id: 'dwell-time',     label: 'Container Dwell Time',   path: '/dashboard/dwell-time' },
      { id: 'accounts-dash',  label: 'Accounts & Revenue',     path: '/dashboard/accounts' },
      { id: 'billing-health', label: 'Billing Health',         path: '/dashboard/billing-health' },
      { id: 'edi-dash',       label: 'EDI & Partners',         path: '/dashboard/edi' },
      { id: 'cfs-ops',        label: 'CFS Operations',         path: '/dashboard/cfs-ops' },
      { id: 'special-cargo',  label: 'Reefer & Special Cargo', path: '/dashboard/special-cargo' },
      { id: 'customs-dash',   label: 'Customs & Holds',        path: '/dashboard/customs' },
      { id: 'kpi',            label: 'Productivity & KPI',     path: '/dashboard/kpi' },
    ]
  },
  { id: 'bookings', icon: 'clipboardList', label: 'Bookings',
    children: [
      { id: 'booking-register', label: 'Booking Register', path: '/bookings' },
      { id: 'booking-new',      label: 'New Booking',      path: '/bookings/new' },
    ]
  },
  { id: 'gate', icon: 'truck', label: 'Gate & Yard',
    children: [
      // Live against gecko_tos (Phase 5). The screens below them are still mock.
      { id: 'gate-desk', label: 'Gate Desk (live)', path: '/gate/desk' },
      { id: 'gate-stock', label: 'Yard Stock (live)', path: '/gate/stock' },
      { id: 'appointments', label: 'Gate Appointments', path: '/gate/appointments' },
      { id: 'kiosk', label: 'Gate Kiosk', path: '/gate/kiosk' },
      { id: 'eir-in', label: 'EIR-In', path: '/gate/eir-in' },
      { id: 'eir-in-v2', label: 'EIR-In V2 (HUD)', path: '/gate/eir-in-v2' },
      { id: 'eir-out', label: 'EIR-Out', path: '/gate/eir-out' },
      { id: 'yard-view', label: 'Yard Plan', path: '/gate/yard-view' },
      { id: 'reefer-ops', label: 'Reefer Operations', path: '/gate/reefer-ops' },
      { id: 'container-status', label: 'Container Status Update', path: '/gate/container-status' },
      { id: 'moves-planner', label: 'Moves Planner', path: '/gate/moves-planner' },
    ]
  },
  { id: 'cfs', icon: 'box', label: 'CFS',
    children: [
      { id: 'stuffing', label: 'Stuffing', path: '/cfs/stuffing' },
      { id: 'stripping', label: 'Stripping', path: '/cfs/stripping' },
      { id: 'lcl-cargo', label: 'LCL Cargo Register', path: '/cfs/lcl-cargo' },
      { id: 'tally', label: 'Cargo Tally', path: '/cfs/tally' },
    ]
  },
  { id: 'units', icon: 'layers', label: 'Units & Equipment',
    children: [
      { id: 'unit-inquiry', label: 'Unit Inquiry', path: '/units/unit-inquiry' },
      { id: 'equipment-pool', label: 'Equipment Pool', path: '/units/equipment-pool' },
      { id: 'edi-inquiry', label: 'EDI Event Inquiry', path: '/units/edi-inquiry' },
    ]
  },
  { id: 'billing', icon: 'invoice', label: 'Billing & Invoicing',
    children: [
      { id: 'cash-window',    label: 'Cash Window',    path: '/billing/cash-window'    },
      { id: 'service-orders', label: 'Service Orders', path: '/billing/service-orders' },
      { id: 'billing-statement', label: 'Billing Statement', path: '/billing/statement' },
      { id: 'invoices',       label: 'Invoices',       path: '/billing/invoices'       },
      { id: 'credit-notes', label: 'Credit Notes', path: '/billing/credit-notes' },
      { id: 'unbilled', label: 'Unbilled Services', path: '/billing/unbilled' },
    ]
  },
  { id: 'tariff', icon: 'tag', label: 'Tariff Management',
    children: [
      { id: 'plans', label: 'Tariff Schedules', path: '/tariff/plans' },
      // Rate Cards and Free Time pages folded into Tariff Schedule editor tabs.
      // NAV entries hidden; routes preserved for deep-links and future admin views.
      // { id: 'rate-cards', label: 'Rate Cards', path: '/tariff/rate-cards' },
      // { id: 'free-time', label: 'Free Time & D&D Rules', path: '/tariff/free-time' },
    ]
  },
  { id: 'reports', icon: 'fileText', label: 'Reports',
    children: [
      { id: 'reports-operational', label: 'Operational Reports', path: '/reports/operational' },
      { id: 'reports-accounts',    label: 'Accounts Reports',    path: '/reports/accounts' },
      { id: 'reports-schedule',    label: 'Auto-Schedule Reports', path: '/reports/schedule' },
    ]
  },
  { id: 'config', icon: 'settings', label: 'Configuration',
    children: [
      { id: 'gate-slots',     label: 'Gate Slot Capacity',   path: '/config/gate-slots' },
      { id: 'gate-hours',     label: 'Operating Hours',      path: '/config/gate-hours' },
      { id: 'yard-zones',     label: 'Yard Zones & Blocks',  path: '/config/yard-zones' },
      { id: 'roles',          label: 'Roles & Rights',       path: '/config/roles' },
      { id: 'users',          label: 'Users & Roles',        path: '/config/users' },
      { id: 'edi-partners',   label: 'EDI Partners',         path: '/config/edi-partners' },
      { id: 'auto-gate',      label: 'Auto-Gate (OCR)',      path: '/config/auto-gate' },
      { id: 'integrations',   label: 'Notifications',        path: '/config/integrations' },
      { id: 'approval-wf',    label: 'Approval Workflows',   path: '/config/approval-workflows' },
      { id: 'system-params',  label: 'System Parameters',    path: '/config/system-params' },
    ]
  },
  { id: 'masters', icon: 'database', label: 'Master Data',
    children: [
      { id: 'masters-hub', label: 'Masters Overview', path: '/masters' },
      { id: 'customers', label: 'Customers', path: '/masters/customers' },
      { id: 'lines', label: 'Shipping Lines', path: '/masters/lines' },
      { id: 'vessels', label: 'Vessels & Voyages', path: '/masters/vessels' },
      { id: 'vessel-schedule', label: 'Vessel Call Schedule', path: '/masters/vessels/schedule' },
      { id: 'container-types', label: 'ISO Container Types', path: '/masters/container-types' },
      { id: 'order-types', label: 'Work Order Types', path: '/masters/order-types' },
      { id: 'charge-codes', label: 'Charge Codes', path: '/masters/charge-codes' },
      { id: 'seal-series', label: 'Seal Series', path: '/masters/seal-series' },
      // HIDDEN 2026-05-13 — facility & yard hierarchy is now owned by the
      // visual editor at Configuration → Yard Zones & Blocks, which covers
      // both the registry and the spatial layout. Page file kept on disk.
      // { id: 'locations', label: 'Facility & Yard Locations', path: '/masters/locations' },
      { id: 'countries', label: 'Countries', path: '/masters/countries' },
      { id: 'ports', label: 'Ports & Locations (UN/LOCODE)', path: '/masters/ports' },
      { id: 'commodities', label: 'Commodity / HS Codes', path: '/masters/commodities' },
      { id: 'holds', label: 'Holds & Remarks', path: '/masters/holds' },
      { id: 'lookups', label: 'Reference Codes', path: '/masters/lookups' },
    ]
  },
];

// Pilot edition: only the API-bound screens (src/lib/edition.ts). Modules left empty drop out.
// Full edition: NAV unchanged.
const isPilotEntry = (path: string) => PILOT_PATHS.some(p => path === p || path.startsWith(p + '/'));
const VISIBLE_NAV = IS_PILOT
  ? NAV.map(m => ({ ...m, children: m.children.filter(c => isPilotEntry(c.path)) }))
       .filter(m => m.children.length > 0)
  : NAV;

function Sidebar({ collapsed, onToggle }: { collapsed: boolean, onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, signOut } = useSession();
  // The token carries no display name, so the card shows what it does carry: the role and the depots.
  const who = status === 'authenticated' && user
    ? { name: (user.roles[0] ?? user.userType ?? 'Signed in').replace(/_/g, ' '),
        role: `${user.roles.length > 1 ? `+${user.roles.length - 1} role(s) · ` : ''}${user.branches.length} depot(s)`,
        initials: (user.roles[0] ?? 'U').slice(0, 2).toUpperCase() }
    : { name: 'Not signed in', role: 'Demo screens only', initials: '—' };
  const doSignOut = async () => { try { await signOut(); } finally { router.push('/login'); } };
  
  // Determine active module based on URL path
  const activeModule = pathname ? pathname.split('/')[1] : 'dashboard';
  
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set([activeModule]));

  // Open the group of the module we just navigated into (adjust state during render,
  // not in an effect — https://react.dev/learn/you-might-not-need-an-effect).
  const [seenModule, setSeenModule] = useState(activeModule);
  if (activeModule !== seenModule) {
    setSeenModule(activeModule);
    if (activeModule) setOpenGroups(prev => new Set([...prev, activeModule]));
  }

  const toggleGroup = (id: string) => {
    const next = new Set(openGroups);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpenGroups(next);
  };

  return (
    <aside className={`gecko-sidebar ${collapsed ? 'gecko-sidebar-collapsed' : ''}`} style={{ position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 40 }}>
      <div className="gecko-sidebar-brand">
        <div className="gecko-logo" style={{ background: 'var(--gecko-primary-600)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l3-9 4 18 3-9h4"/>
          </svg>
        </div>
        {!collapsed && (
          <div className="gecko-brand-wordmark">
            <span className="gecko-logo-text">GECKO</span>
            <span className="gecko-brand-wordmark-line">TOS · ICD + CFS</span>
          </div>
        )}
      </div>

      <nav className="gecko-sidebar-nav" role="navigation" aria-label="Main navigation" style={{ overflowY: 'auto' }}>
        {VISIBLE_NAV.map((mod) => {
          const isActiveMod = activeModule === mod.id;
          const isOpen = openGroups.has(mod.id);
          return (
            <div key={mod.id}>
              <button
                className={`gecko-nav-item${isActiveMod ? ' gecko-nav-item-active' : ''}`}
                aria-expanded={mod.children ? isOpen : undefined}
                aria-controls={mod.children ? `nav-group-${mod.id}` : undefined}
                onClick={() => { if (!collapsed) toggleGroup(mod.id); }}
                title={collapsed ? mod.label : ''}
              >
                <Icon name={mod.icon} size={18} />
                {!collapsed && (
                  <>
                    <span className="gecko-flex-1 gecko-nav-item-label">{mod.label}</span>
                    {mod.children && (
                      <Icon name="chevronDown" size={14} className="gecko-nav-chevron" />
                    )}
                  </>
                )}
              </button>
              {!collapsed && isOpen && mod.children && (() => {
                // Find the child whose path is the longest match for the current pathname.
                // Without this, nested paths (e.g. /masters/vessels and /masters/vessels/schedule)
                // would both highlight when on /masters/vessels/schedule.
                const matches = mod.children.filter(c =>
                  pathname === c.path || pathname?.startsWith(c.path + '/')
                );
                const activeChildId = matches.length > 0
                  ? matches.reduce((longest, c) => c.path.length > longest.path.length ? c : longest).id
                  : null;
                return (
                  <div id={`nav-group-${mod.id}`} className="gecko-nav-children">
                    {mod.children.map((child) => {
                      const active = child.id === activeChildId;
                      return (
                        <Link
                          key={child.id}
                          href={child.path}
                          className={`gecko-nav-child${active ? ' gecko-nav-child-active' : ''}`}
                          aria-current={active ? 'page' : undefined}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </nav>

      <div className="gecko-sidebar-footer">
        {!collapsed ? (
          <>
            {/* Demo / reset row — subtle, only visible expanded. Not in the pilot edition. */}
            {!IS_PILOT && <button
              onClick={() => {
                const r = seedDemoData();
                if (r.seeded) {
                  // Soft-reload data-driven pages by triggering a route refresh-equivalent.
                  // For the demo we just nudge with a discrete confirmation.
                  if (typeof window !== 'undefined') {
                    const banner = document.createElement('div');
                    banner.textContent = '✓ Demo data reseeded — yard + sample data restored';
                    banner.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;font-family:system-ui;z-index:9999;box-shadow:0 8px 20px rgba(0,0,0,0.2);';
                    document.body.appendChild(banner);
                    setTimeout(() => banner.remove(), 2400);
                  }
                }
              }}
              title="Re-seed yard layout and sample data for demo purposes"
              className="gecko-sidebar-demo-btn"
            >
              <Icon name="refresh" size={11} />
              Demo · reset data
            </button>}
            <div className="gecko-sidebar-user-row">
              <div className="gecko-avatar gecko-avatar-accent">{who.initials}</div>
              <div className="gecko-flex-1 gecko-min-w-0">
                <div className="gecko-sidebar-user-name">{who.name}</div>
                <div className="gecko-sidebar-user-role">{who.role}</div>
              </div>
              <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm gecko-text-secondary-btn" title="Sign out" onClick={doSignOut}>
                <Icon name="logOut" size={15} />
              </button>
            </div>
          </>
        ) : (
          <div className="gecko-row" style={{ justifyContent: 'center' }}>
            <div className="gecko-avatar gecko-avatar-accent">{who.initials}</div>
          </div>
        )}
      </div>
    </aside>
  );
}

type HeaderProps = { collapsed: boolean; onToggleSidebar: () => void; pageTitle?: string; breadcrumbs?: string[] };

function Header({ onToggleSidebar, pageTitle = "Dashboard", breadcrumbs = ["Workspace", "Overview"] }: HeaderProps) {
  const [theme, setTheme] = useState('light');

  const onToggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <header className="gecko-header" role="banner" style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--gecko-bg-surface)' }}>
      <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" onClick={onToggleSidebar} title="Toggle sidebar">
        <Icon name="menu" size={18} />
      </button>

      <div className="gecko-header-title-block">
        <nav className="gecko-breadcrumb gecko-header-breadcrumb" aria-label="Breadcrumb">
          {breadcrumbs.map((b: string, i: number) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="gecko-breadcrumb-sep" />}
              {i === breadcrumbs.length - 1
                ? <span className="gecko-breadcrumb-current">{b}</span>
                : <span className="gecko-breadcrumb-item">{b}</span>
              }
            </React.Fragment>
          ))}
        </nav>
        <div className="gecko-header-page-title">{pageTitle}</div>
      </div>

      {/* Search */}
      <div className="gecko-header-search">
        <Icon name="search" size={16} className="gecko-header-search-icon" />
        <input className="gecko-input gecko-input-sm gecko-header-search-input" placeholder="Search unit, booking, EDO, invoice…" />
        <kbd className="gecko-kbd gecko-header-search-kbd">⌘K</kbd>
      </div>

      <div className="gecko-ml-auto gecko-row" style={{ gap: 6 }}>
        <AskGeckoTrigger />

        {/* Tenant → Facility → Yard switcher */}
        <button className="gecko-facility-switcher">
          <div className="gecko-facility-switcher-mark">GK</div>
          <div className="gecko-facility-switcher-text">
            <span className="gecko-facility-switcher-eyebrow">GECKO</span>
            <div className="gecko-facility-switcher-line">
              <span>Laem Chabang ICD</span>
              <span className="gecko-facility-switcher-sep">/</span>
              <span className="gecko-facility-switcher-sub">Import Yard</span>
            </div>
          </div>
          <Icon name="chevronDown" size={12} className="gecko-text-secondary-icon" />
        </button>

        {/* Locale */}
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-header-locale-btn" title="Language">
          <Icon name="globe" size={14} /> EN
        </button>

        <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm gecko-header-notif-btn" title="Notifications">
          <Icon name="bell" size={17} />
          <span className="gecko-notification-dot" />
        </button>
        <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" title="Help">
          <Icon name="help" size={17} />
        </button>
        <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" onClick={onToggleTheme} title="Toggle theme">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
        </button>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { pageTitle, breadcrumbs } = useNavMatch(pathname);

  // Drive the browser tab title from the same source as the in-app header.
  // The metadata.title.template in app/layout.tsx appends " · Gecko TOS" for
  // server-rendered HTML; this useEffect keeps client-side navigation in sync.
  useEffect(() => {
    if (typeof document !== 'undefined' && pageTitle) {
      document.title = `${pageTitle} · Gecko TOS`;
    }
  }, [pageTitle]);

  // Demo safety net — seed yard layout + sample data on first load if missing.
  // Fresh browser / wiped storage shouldn't sink the demo.
  useEffect(() => { autoSeedIfEmpty(); }, []);

  // Auth-shaped pages render bare — no sidebar, no header, no breadcrumbs.
  // Currently /login; future /forgot, /reset, /onboarding follow the same pattern.
  // Gate kiosk is also chromeless: it runs full-screen on a gatehouse display.
  if (pathname?.startsWith('/login') || pathname?.startsWith('/gate/kiosk')) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <AskGeckoProvider>
        <div className="gecko-app" style={{ position: 'relative', minHeight: '100vh', background: 'var(--gecko-bg-subtle)' }}>
          <Sidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed(c => !c)}
          />
          <div className={`gecko-main ${collapsed ? 'gecko-main-collapsed' : ''}`} style={{
            marginLeft: collapsed ? 'var(--gecko-sidebar-width-collapsed)' : 'var(--gecko-sidebar-width)',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Header
              collapsed={collapsed}
              onToggleSidebar={() => setCollapsed(c => !c)}
              pageTitle={pageTitle}
              breadcrumbs={breadcrumbs}
            />
            <main className="gecko-content" style={{ flex: 1, padding: 'var(--gecko-space-6)', overflowX: 'auto' }}>
              {children}
            </main>
          </div>
        </div>
      </AskGeckoProvider>
    </ToastProvider>
  );
}
