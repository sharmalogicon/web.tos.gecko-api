"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useSession } from '@/lib/auth/session';
import { isPathAvailable } from '@/lib/edition';

/**
 * The masters hub: links only (decision C). No counts, no "recent changes",
 * no quick actions — the mock invented all of them. A tile shows when its
 * page is served in this edition AND the user may read it, so nobody is sent
 * to a page that answers 403.
 */

interface Tile {
  href: string;
  label: string;
  icon: string;
  desc: string;
  /** Any of these lets the user read the page; empty = every signed-in user. */
  view: string[];
}

const GROUPS: { title: string; tiles: Tile[] }[] = [
  {
    title: 'Parties',
    tiles: [
      { href: '/masters/customers', label: 'Customers', icon: 'user', desc: 'Every party — customers, lines, hauliers — with tax id, branch and contacts.', view: ['mdm.party.view'] },
      { href: '/masters/lines', label: 'Shipping Lines', icon: 'anchor', desc: 'Line operators and the agents that act for them: SCAC, SMDG, EDI.', view: ['mdm.party.view'] },
      { href: '/masters/seal-series', label: 'Seal Series', icon: 'lock', desc: 'The seal numbers each line has handed a depot.', view: ['mdm.party.view'] },
    ],
  },
  {
    title: 'Logistics',
    tiles: [
      { href: '/masters/vessels', label: 'Vessels', icon: 'ship', desc: 'Vessels by code, IMO, call sign and operator — and their schedule.', view: ['mdm.logistics.view'] },
      { href: '/masters/ports', label: 'Ports', icon: 'anchor', desc: 'Ports of loading, discharge and destination, by UN/LOCODE.', view: ['mdm.logistics.view'] },
      { href: '/masters/locations', label: 'Locations', icon: 'mapPin', desc: 'Factories, warehouses, estates and port terminals boxes go to.', view: ['mdm.logistics.view'] },
      { href: '/masters/commodities', label: 'Commodities', icon: 'packageOpen', desc: 'Cargo by HS code, with its DG class and reefer range.', view: ['mdm.logistics.view'] },
    ],
  },
  {
    title: 'Equipment',
    tiles: [
      { href: '/masters/container-types', label: 'Container Types', icon: 'box', desc: 'The tenant\'s equipment types and the ISO 6346 codes that resolve to them.', view: ['mdm.equipment.view'] },
      { href: '/masters/holds', label: 'Holds', icon: 'lock', desc: 'The kinds of hold a box can carry — what each stops, and who may lift it.', view: ['mdm.equipment.view'] },
    ],
  },
  {
    title: 'Commercial',
    tiles: [
      { href: '/masters/charge-codes', label: 'Charge Codes', icon: 'tag', desc: 'What is billed, to whom and on which terms.', view: ['mdm.commercial.view'] },
      { href: '/masters/order-types', label: 'Order Types', icon: 'clipboardList', desc: 'Booking types: their movements, gate rules and charges.', view: ['mdm.commercial.view'] },
    ],
  },
  {
    title: 'Reference',
    tiles: [
      { href: '/masters/lookups', label: 'Lookups', icon: 'database', desc: 'Grades, conditions, movements, service types, tax codes, code lists and mappings.', view: ['mdm.equipment.view', 'mdm.commercial.view', 'mdm.config.view'] },
      { href: '/masters/countries', label: 'Countries', icon: 'globe', desc: 'ISO 3166 — shared by every tenant, read-only.', view: [] },
    ],
  },
  {
    title: 'Organisation',
    tiles: [
      { href: '/masters/yards', label: 'Yards', icon: 'layers', desc: 'A depot\'s yards: what they hold and their TEU capacity.', view: [] },
      { href: '/masters/public-holidays', label: 'Public Holidays', icon: 'calendar', desc: 'Days the depots close or run half a day.', view: ['mdm.org.view'] },
      { href: '/config/system-params', label: 'System Parameters', icon: 'settings', desc: 'Tenant and depot settings, and how documents are numbered.', view: ['mdm.config.view'] },
    ],
  },
];

export default function MastersHubPage() {
  const { can } = useSession();
  const visible = GROUPS
    .map(g => ({ ...g, tiles: g.tiles.filter(t => isPathAvailable(t.href) && (t.view.length === 0 || t.view.some(p => can(p)))) }))
    .filter(g => g.tiles.length > 0);

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Master Data</h1>
          <div className="gecko-page-subtitle gecko-mt-1">The reference data the gate, the yard and billing work from.</div>
        </div>
      </div>

      {visible.length === 0 && (
        <div className="gecko-alert gecko-alert-info gecko-row" style={{ gap: 10 }}>
          <Icon name="info" size={16} /><span>Your role has no master data to show. Ask an administrator if you need access.</span>
        </div>
      )}

      {visible.map(g => (
        <section key={g.title} className="gecko-stack gecko-stack-md" aria-label={g.title}>
          <div className="gecko-eyebrow">{g.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {g.tiles.map(t => (
              <Link key={t.href} href={t.href} className="gecko-card gecko-row gecko-row-start" style={{ gap: 12, textDecoration: 'none', color: 'inherit' }}>
                <div className="gecko-mini-icon gecko-mini-icon-lg gecko-mini-icon-primary"><Icon name={t.icon} size={18} /></div>
                <div className="gecko-flex-1">
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</div>
                  <div className="gecko-cell-meta" style={{ marginTop: 2, lineHeight: 1.45 }}>{t.desc}</div>
                </div>
                <Icon name="chevronRight" size={14} style={{ color: 'var(--gecko-text-disabled)', marginTop: 3 }} />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
