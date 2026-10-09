"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth/session';
import { companyLabel } from '@/lib/api/org';
import { FacilityProvider, useFacility } from '@/lib/api/facility';
import { Icon } from '../ui/Icon';
import { ToastProvider } from '../ui/Toast';
import { AskGeckoProvider } from '../ai/AskGeckoWidget';
import { isPathAvailable } from '@/lib/edition';

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

/**
 * Dashboards taken out of the menu on 2026-09-29.
 *
 * Every one of them renders fixture numbers, and none has an aggregate endpoint
 * behind it (ui-page-inventory group B: the KPI/accounts/billing dashboards all
 * need new API work). A menu full of convincing invented figures is worse than a
 * short menu, so only Overview and Gate & Traffic stay.
 *
 * The page files and routes are untouched — type a URL and you still get them,
 * which is what we want while reviewing. Move an entry back into NAV the day its
 * endpoint exists, and into LIVE_PATHS once it is actually live.
 *
 * Note this is NOT a permissions decision: see the comment on VISIBLE_NAV.
 *
 *   yard-glance    Yard at a Glance        /dashboard/yard-glance
 *   voyage-dash    Voyage & Vessel         /dashboard/voyage
 *   dwell-time     Container Dwell Time    /dashboard/dwell-time    (already retired 2026-05-13)
 *   accounts-dash  Accounts & Revenue      /dashboard/accounts
 *   billing-health Billing Health          /dashboard/billing-health
 *   edi-dash       EDI & Partners          /dashboard/edi
 *   cfs-ops        CFS Operations          /dashboard/cfs-ops
 *   special-cargo  Reefer & Special Cargo  /dashboard/special-cargo
 *   customs-dash   Customs & Holds         /dashboard/customs
 *   kpi            Productivity & KPI      /dashboard/kpi
 */

/**
 * HIDDEN FROM THE MENU 2026-10-03, at his request. The pages and routes are
 * untouched — each still answers on its URL — they are simply not offered while
 * the menu is narrowed to what KORAKIT actually works in. Put a line back to
 * bring one back.
 *
 *   Gate & Yard    Gate Appointments  /gate/appointments
 *                  Gate Kiosk         /gate/kiosk
 *                  Yard Plan          /gate/yard-view
 *                  Reefer Operations  /gate/reefer-ops
 *                  Moves Planner      /gate/moves-planner
 *   CFS            whole group — stuffing, stripping, LCL cargo, tally
 *   Units & Equip. whole group — unit inquiry, equipment pool, EDI inquiry
 *   Billing        invoices, credit notes — both still fixture data, and the
 *                  API has no invoice endpoint. The other four came back on
 *                  the menu 2026-10-05.
 *   Configuration  Gate Slot Capacity /config/gate-slots
 *                  Operating Hours    /config/gate-hours
 *                  EDI Partners       /config/edi-partners
 *                  Auto-Gate (OCR)    /config/auto-gate
 *                  Notifications      /config/integrations
 *                  Approval Workflows /config/approval-workflows
 */
const NAV = [
  { id: 'dashboard', icon: 'home', label: 'Dashboard',
    // Only the two dashboards we intend to make real (his call, 2026-09-29).
    // Both are bound now — the server counts every figure on them — so both are
    // in LIVE_PATHS. The other ten are in HIDDEN_DASHBOARDS below.
    children: [
      { id: 'overview',       label: 'Overview',               path: '/dashboard/overview' },
      { id: 'gate-traffic',   label: 'Gate & Traffic',         path: '/dashboard/gate-traffic' },
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
      // Gate Desk is out of the menu (2026-10-01): KORAKIT has no barrier, so a
      // preflight-then-admit screen models a gate they do not operate. Recording
      // a gate-in now lives on EIR-In below. The route still resolves for anyone
      // who has it bookmarked, and nothing about it was deleted.
      { id: 'gate-stock', label: 'Yard Stock (live)', path: '/gate/stock' },
      // Yard Stock knows only what is INSIDE. The inquiry knows every box that
      // has ever been through, which is what a clerk needs when asked where one
      // went (API 2026-10-08, GET /api/tos/containers).
      { id: 'container-inquiry', label: 'Container Inquiry', path: '/units/container-inquiry' },
      { id: 'eir-in', label: 'Gate In (EIR)', path: '/gate/eir-in' },
      { id: 'eir-out', label: 'Gate Out (EIR)', path: '/gate/eir-out' },
      { id: 'eir-in-register', label: 'EIR-In Register', path: '/gate/eir-in-register' },
      { id: 'eir-out-register', label: 'EIR-Out Register', path: '/gate/eir-out-register' },
      { id: 'container-status', label: 'Container Status Update', path: '/gate/container-status' },
    ]
  },
  { id: 'billing', icon: 'invoice', label: 'Billing',
    // Back on the menu 2026-10-05 (owner), and INVOICES joined them 2026-10-07
    // when the API gained GET /api/revenue/invoices, /{id} and
    // POST /invoices/send. They read in the order the money moves: the cash
    // window takes it, the charge register and the statement say what was
    // charged, Unbilled is what is waiting, and Invoices is what was sent.
    //
    // /billing/credit-notes stays OFF, and off LIVE_PATHS: still a fixture
    // array, and there is no credit-note endpoint of any kind. Add it the day
    // one exists.
    children: [
      // Cash Window and Charge Register are OFF the menu (owner, 2026-10-07).
      // Both still serve — the statement links to the cash window — they are
      // just not how a clerk starts. Restore these two lines to bring them back.
      { id: 'statement',       label: 'Booking Statement', path: '/billing/statement' },
      { id: 'unbilled',        label: 'Unbilled Charges', path: '/billing/unbilled' },
      // Customer Cash Bill is OFF the menu (owner, 2026-10-08) and still LIVE:
      // a clerk arrives at it from Cash Receipts ("New cash bill"), from the
      // Booking Statement and from Unbilled Charges ("New cash invoice"), which
      // is where they already are when they decide to raise one. Restore this
      // line to bring it back.
      // { id: 'cash-bills',   label: 'Customer Cash Bill', path: '/billing/cash-bills' },
      // The register of what was taken, wherever it was taken: gate, window or
      // cash bill. Every receipt link in Gecko lands under this path.
      { id: 'receipts',        label: 'Cash Receipts',    path: '/billing/receipts' },
      { id: 'invoices',        label: 'Invoices',         path: '/billing/invoices' },
    ]
  },
  { id: 'tariff', icon: 'tag', label: 'Tariffs',
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
      { id: 'yard-zones',     label: 'Yard Zones & Blocks',  path: '/config/yard-zones' },
      { id: 'roles',          label: 'Roles & Rights',       path: '/config/roles' },
      { id: 'users',          label: 'Users & Roles',        path: '/config/users' },
      { id: 'system-params',  label: 'System Parameters',    path: '/config/system-params' },
    ]
  },
  // HIDDEN 2026-10-04 (owner). The June screens are still SERVED at
  // /compare/june — the booking rebuild was taken from them and they remain the
  // reference for the gate pages — they are just off the menu now that the
  // booking redesign is done. Restore this entry to bring the group back;
  // delete it and src/app/compare/ when the gate screens are settled too.

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
      { id: 'haulier-charge-terms', label: 'Haulier Charge Terms', path: '/masters/haulier-charge-terms' },
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

// Only the screens Gecko serves (src/lib/edition.ts). Modules left empty drop out.
// Full edition: NAV unchanged.
//
// WHY THE MENU IS NOT FILTERED BY PERMISSION. The obvious idea is to hang a
// required permission off each entry and let roles hide the rest. It does not
// work here, for two reasons:
//
//   1. The platform defines 57 permissions and not one of them is about a
//      dashboard — the closest is tos.report.view. Gating a screen on a
//      permission invented for the menu would be a lie about what the API
//      enforces.
//   2. The people looking at these screens are TENANT_OWNER (admin@korakit.com)
//      and hold nearly every permission, so a permission filter would hide
//      nothing from exactly the person we are trying to keep out of mock data.
//
// What decides whether a screen ships is whether the API can back it — not who
// is signed in. Permission-gating belongs on the ACTIONS inside a page
// (can()/canAt() already do that: the cash window hides waive behind
// revenue.charge.waive), not on the navigation.
//
// The menu asks exactly what the route guard asks, so a link is never shown for
// a page that would then refuse to load.
// The menu asks the SAME question the route guard asks. It used to test
// LIVE_PATHS alone, which ignored BLOCKED_PATHS — so a screen that was listed
// as live but blocked underneath (the June Gate In, the two mock reports) kept
// its menu entry and answered "Not available in this edition" when clicked.
// One function, one answer: a link is shown only if the path is actually served.
const VISIBLE_NAV = NAV
  .map(m => ({ ...m, children: m.children.filter(c => isPathAvailable(c.path)) }))
  .filter(m => m.children.length > 0);

function Sidebar({ collapsed, onToggle }: { collapsed: boolean, onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, signOut } = useSession();
  const { company } = useFacility();
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
            {/* The operator's own name, from the company the selected depot trades
                as. Falls back to the product name while it loads, and for a branch
                the API has no company for. */}
            <span className="gecko-logo-text" title={companyLabel(company) ?? undefined}>{companyLabel(company) ?? 'GECKO'}</span>
            <span className="gecko-brand-wordmark-line">TOS</span>
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
            {/* The "Demo · reset data" button lived here. It called seedDemoData(),
                which overwrites the yard layout and sample data, and was hidden
                only by the old pilot flag. With one edition there is nowhere
                safe to show it: KORAKIT is live, and reseeding a live depot is
                not an undoable mistake. Removed 2026-10-05. */}
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

/**
 * Depot → company → yard, as the header shows it.
 *
 * The depot row only appears for a tenant with more than one — KORAKIT has a
 * single depot, and a picker with one entry is furniture. The yard list may
 * legitimately be empty (a depot that has never had yards defined), which says
 * so rather than showing an empty picker.
 */
function FacilitySwitcher() {
  const { branches, branch, selectBranch, company, yards, yard, selectYard, loading } = useFacility();
  const [open, setOpen] = useState(false);

  const label = companyLabel(company);
  const mark = (label ?? branch?.branchCode ?? '—').trim().slice(0, 2).toUpperCase();

  if (!branch) {
    return (
      <button className="gecko-facility-switcher" disabled>
        <div className="gecko-facility-switcher-mark">—</div>
        <div className="gecko-facility-switcher-text">
          <div className="gecko-facility-switcher-line">
            <span>{loading ? 'Loading…' : 'No depot assigned'}</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="gecko-dropdown">
      <button
        className="gecko-facility-switcher"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`${branch.branchCode} — ${branch.displayName}`}
      >
        <div className="gecko-facility-switcher-mark">{mark}</div>
        <div className="gecko-facility-switcher-text">
          {label && <span className="gecko-facility-switcher-eyebrow">{label}</span>}
          <div className="gecko-facility-switcher-line">
            <span>{branch.displayName}</span>
            {yard && <>
              <span className="gecko-facility-switcher-sep">/</span>
              <span className="gecko-facility-switcher-sub">{yard.nameEn}</span>
            </>}
          </div>
        </div>
        <Icon name="chevronDown" size={12} className="gecko-text-secondary-icon" />
      </button>

      {open && <>
        <div className="gecko-dropdown-backdrop" onClick={() => setOpen(false)} />
        <div className="gecko-dropdown-menu gecko-dropdown-menu-right gecko-facility-menu" role="menu">
          {branches.length > 1 && <>
            <div className="gecko-dropdown-label">Depot</div>
            {branches.map(b => (
              <button
                key={b.branchId}
                className={`gecko-dropdown-item ${b.branchId === branch.branchId ? 'gecko-dropdown-item-active' : ''}`}
                onClick={() => { selectBranch(b.branchId); setOpen(false); }}
              >
                <span className="gecko-facility-menu-code">{b.branchCode}</span>
                <span className="gecko-facility-menu-name">{b.displayName}</span>
              </button>
            ))}
            <div className="gecko-dropdown-divider" />
          </>}

          <div className="gecko-dropdown-label">Yard</div>
          {yards.length === 0
            ? <div className="gecko-dropdown-item gecko-dropdown-item-disabled">
                {loading ? 'Loading…' : 'No yards defined for this depot'}
              </div>
            : <>
                <button
                  className={`gecko-dropdown-item ${yard === null ? 'gecko-dropdown-item-active' : ''}`}
                  onClick={() => { selectYard(null); setOpen(false); }}
                >
                  <span className="gecko-facility-menu-name">All yards</span>
                </button>
                {yards.map(y => (
                  <button
                    key={y.yardId}
                    className={`gecko-dropdown-item ${y.yardId === yard?.yardId ? 'gecko-dropdown-item-active' : ''}`}
                    onClick={() => { selectYard(y.yardId); setOpen(false); }}
                  >
                    <span className="gecko-facility-menu-code">{y.yardCode}</span>
                    <span className="gecko-facility-menu-name">{y.nameEn}</span>
                    <span className="gecko-facility-menu-meta">{y.yardType}</span>
                  </button>
                ))}
              </>}
        </div>
      </>}
    </div>
  );
}

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

      {/* Global search and Ask Gecko are hidden until they are backed by the API
          (there is no search endpoint yet, and Ask Gecko answers from mock data). */}

      <div className="gecko-ml-auto gecko-row" style={{ gap: 6 }}>
        <FacilitySwitcher />

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
  // autoSeedIfEmpty() ran here. It wrote a fabricated yard layout into every
  // user's localStorage on first load, for /config/yard-zones and
  // /dashboard/yard-glance to read. Neither is served, so it did nothing today
  // — and the day one of them is unblocked it would have shown KORAKIT an
  // invented yard as if it were their own. Removed 2026-10-05.

  // Auth-shaped pages render bare — no sidebar, no header, no breadcrumbs.
  // Currently /login; future /forgot, /reset, /onboarding follow the same pattern.
  // Gate kiosk is also chromeless: it runs full-screen on a gatehouse display.
  if (pathname?.startsWith('/login') || pathname?.startsWith('/gate/kiosk')) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <AskGeckoProvider>
       <FacilityProvider>
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
       </FacilityProvider>
      </AskGeckoProvider>
    </ToastProvider>
  );
}
