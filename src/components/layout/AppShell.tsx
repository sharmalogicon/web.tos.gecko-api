"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { ToastProvider } from '../ui/Toast';

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
    const detail = decodeURIComponent(remainder.split('/').filter(Boolean).pop() || '');
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
      { id: 'appointments', label: 'Gate Appointments', path: '/gate/appointments' },
      { id: 'eir-in', label: 'EIR-In', path: '/gate/eir-in' },
      { id: 'eir-in-v2', label: 'EIR-In V2 (HUD)', path: '/gate/eir-in-v2' },
      { id: 'eir-out', label: 'EIR-Out', path: '/gate/eir-out' },
      { id: 'yard-view', label: 'Yard Plan', path: '/gate/yard-view' },
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
      { id: 'rate-cards', label: 'Rate Cards', path: '/tariff/rate-cards' },
      { id: 'free-time', label: 'Free Time & D&D Rules', path: '/tariff/free-time' },
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
      { id: 'locations', label: 'Facility & Yard Locations', path: '/masters/locations' },
      { id: 'countries', label: 'Countries', path: '/masters/countries' },
      { id: 'ports', label: 'Ports & Locations (UN/LOCODE)', path: '/masters/ports' },
      { id: 'commodities', label: 'Commodity / HS Codes', path: '/masters/commodities' },
      { id: 'holds', label: 'Holds & Remarks', path: '/masters/holds' },
      { id: 'lookups', label: 'Reference Codes', path: '/masters/lookups' },
    ]
  },
];

function Sidebar({ collapsed, onToggle }: { collapsed: boolean, onToggle: () => void }) {
  const pathname = usePathname();
  
  // Determine active module based on URL path
  const activeModule = pathname ? pathname.split('/')[1] : 'dashboard';
  
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set([activeModule]));

  useEffect(() => {
    if (activeModule) {
      setOpenGroups(prev => new Set([...prev, activeModule]));
    }
  }, [activeModule]);

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
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span className="gecko-logo-text" style={{ fontSize: 15 }}>GECKO</span>
            <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', fontWeight: 500, letterSpacing: '0.1em' }}>TOS · ICD + CFS</span>
          </div>
        )}
      </div>

      <nav className="gecko-sidebar-nav" role="navigation" aria-label="Main navigation" style={{ overflowY: 'auto' }}>
        {NAV.map((mod) => {
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
                    <span style={{ flex: 1, textAlign: 'left' }}>{mod.label}</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
            <div className="gecko-avatar gecko-avatar-accent">SK</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Somchai K.</div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Terminal Supervisor · LCB</div>
            </div>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" title="Sign out" style={{ color: 'var(--gecko-text-secondary)' }}>
              <Icon name="logOut" size={15} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="gecko-avatar gecko-avatar-accent">SK</div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Header({ collapsed, onToggleSidebar, pageTitle = "Dashboard", breadcrumbs = ["Workspace", "Overview"] }: any) {
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <nav className="gecko-breadcrumb" aria-label="Breadcrumb" style={{ fontSize: 11 }}>
          {breadcrumbs.map((b: string, i: number) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="gecko-breadcrumb-sep" />}
              {i === breadcrumbs.length - 1
                ? <span className="gecko-breadcrumb-current" style={{ fontSize: 11 }}>{b}</span>
                : <span className="gecko-breadcrumb-item" style={{ fontSize: 11 }}>{b}</span>
              }
            </React.Fragment>
          ))}
        </nav>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{pageTitle}</div>
      </div>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 420, marginLeft: 32, position: 'relative' }}>
        <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
        <input className="gecko-input gecko-input-sm" placeholder="Search unit, booking, EDO, invoice…" style={{ paddingLeft: 36, paddingRight: 56, height: 34 }} />
        <kbd className="gecko-kbd" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>⌘K</kbd>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Tenant → Facility → Yard switcher */}
        <button style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px 5px 8px', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          <div style={{ width: 26, height: 26, borderRadius: 5, background: 'var(--gecko-primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>GK</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1.15 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', fontWeight: 500 }}>GECKO</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
                <span>Laem Chabang ICD</span>
                <span style={{ color: 'var(--gecko-text-disabled)', fontWeight: 400 }}>/</span>
                <span style={{ color: 'var(--gecko-text-secondary)', fontWeight: 500 }}>Import Yard</span>
              </div>
            </div>
          </div>
          <Icon name="chevronDown" size={12} style={{ color: 'var(--gecko-text-secondary)', marginLeft: 4 }} />
        </button>

        {/* Locale */}
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ height: 34, fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)', padding: '0 8px' }} title="Language">
          <Icon name="globe" size={14} /> EN
        </button>

        <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" title="Notifications" style={{ position: 'relative' }}>
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

  // Auth-shaped pages render bare — no sidebar, no header, no breadcrumbs.
  // Currently /login; future /forgot, /reset, /onboarding will follow the same pattern.
  if (pathname?.startsWith('/login')) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
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
    </ToastProvider>
  );
}
