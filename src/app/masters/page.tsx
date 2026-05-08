"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { PageToolbar } from '@/components/ui/OpsPrimitives';
import { ExportButton } from '@/components/ui/ExportButton';
import { useToast } from '@/components/ui/Toast';

function EntityCard({ entity }: { entity: any }) {
  return (
    <Link href={`/masters/${entity.id}`} style={{
      padding: 18, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
      background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10,
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'border-color 120ms, box-shadow 120ms',
      textDecoration: 'none', color: 'inherit',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={entity.icon} size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{entity.label}</div>
          <div style={{ fontSize: 10.5, color: 'var(--gecko-text-disabled)', marginTop: 1, fontFamily: 'var(--gecko-font-mono)' }}>Updated {entity.updated}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', letterSpacing: '-0.02em', lineHeight: 1 }}>{entity.count.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>records</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', lineHeight: 1.5 }}>{entity.desc}</div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px dashed var(--gecko-border)' }}>
        {entity.stats.map(([label, n]: [string, number]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 4, fontSize: 11 }}>
            <span style={{ fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{n}</span>
            <span style={{ color: 'var(--gecko-text-secondary)', textTransform: 'capitalize' }}>{label.replace('-', ' ')}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

export default function MastersHubPage() {
  const { toast } = useToast();
  const entities = [
    { id: 'customers',       icon: 'user',       label: 'Customers',                    count: 284,  desc: 'Bill-to · consignee · shipper · agent. One entity, many roles.',                              updated: '2h ago',    stats: [['active', 268], ['on-hold', 4], ['prospect', 12]] },
    { id: 'lines',           icon: 'anchor',     label: 'Shipping Lines',               count: 42,   desc: 'Line operators / carriers. Drives EDO linkage and line tariff.',                              updated: 'Yesterday', stats: [['with-tariff', 38], ['edi-linked', 34]] },
    { id: 'vessels',         icon: 'ship',       label: 'Vessels & Voyages',            count: 126,  desc: 'Vessel catalog + active voyages. Links to bookings and EDO.',                                 updated: '10m ago',   stats: [['in-port', 3], ['next-7d', 14], ['archived', 89]] },
    { id: 'container-types', icon: 'box',        label: 'ISO Container Types',          count: 58,   desc: 'ISO 6346 code catalog. Feeds rate matrix and EIR.',                                           updated: 'Mar 12',    stats: [['dry', 34], ['reefer', 8], ['special', 16]] },
    { id: 'charge-codes',    icon: 'tag',        label: 'Charge Codes',                 count: 96,   desc: 'Billable services. The atomic unit of every tariff and invoice.',                             updated: '4d ago',    stats: [['gate', 12], ['yard', 18], ['cfs', 24], ['vas', 42]] },
    { id: 'locations',       icon: 'layers',     label: 'Facility & Yard Locations',    count: 1842, desc: 'Facility → Yard → Block → Row → Slot. 6-level spatial hierarchy.',                           updated: 'Apr 20',    stats: [['facilities', 3], ['blocks', 24], ['slots', 1815]] },
    { id: 'countries',       icon: 'globe',      label: 'Countries',                    count: 249,  desc: 'ISO 3166-1 country catalog. Reference for ports, customers, customs, and trade compliance.',  updated: 'Jan 01',    stats: [['asia-pacific', 38], ['europe', 44], ['americas', 57]] },
    { id: 'ports',           icon: 'anchor',     label: 'Ports & Locations (UN/LOCODE)', count: 112, desc: 'UN/LOCODE global place catalog. References POL, POD, and transshipment on every BL.',        updated: '1d ago',    stats: [['seaports', 84], ['icd', 18], ['cfs-depot', 10]] },
    { id: 'commodities',     icon: 'layers',     label: 'Commodity / HS Codes',         count: 1241, desc: 'WCO Harmonized System catalog. Used on BL, customs declaration, and DG/reefer verification.', updated: 'Jan 01',    stats: [['chapters', 97], ['headings', 1144], ['dg-flagged', 48]] },
    { id: 'holds',           icon: 'shieldCheck',label: 'Holds & Remarks',              count: 24,   desc: 'Named hold catalog. Applied to containers to block gate-out, load, or all movement.',         updated: '1w ago',    stats: [['customs', 4], ['line', 3], ['critical', 6]] },
    { id: 'lookups',         icon: 'database',   label: 'Reference Codes',              count: 420,  desc: 'Global reference codelist — SMDG, ISO, IICL, EDIFACT. Drives every dropdown.',               updated: '2d ago',    stats: [['categories', 22], ['system', 186], ['user', 234]] },
  ];

  const recent = [
    { who: 'J. Pattana',    what: 'Updated tariff binding',  entity: 'Customer · Thai Union Group',      time: '14:28', tone: 'primary' },
    { who: 'System · EDI',  what: 'Imported new vessel',      entity: 'Vessel · MSC LISBON (IMO 9345612)', time: '13:55', tone: 'info' },
    { who: 'S. Chen',       what: 'Added charge code',        entity: 'Charge · DG-HNDL-45',               time: '11:02', tone: 'success' },
    { who: 'K. Phumin',     what: 'Deactivated consignee',    entity: 'Customer · Bangchak Corp.',         time: 'Yesterday', tone: 'warning' },
    { who: 'A. Suwat',      what: 'Restructured yard block',  entity: 'Location · Block C · Rows 1-12',    time: '2 days ago', tone: 'primary' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageToolbar
        title="Master Data"
        subtitle="Central catalog for every reference entity used across Gate, Yard, CFS, Billing, and Tariff"
        badges={[{ label: '11 catalogs', kind: 'gray' }, { label: 'Single source of truth', kind: 'info' }]}
        actions={
          <>
            <ExportButton label="Export All" resource="All master data" iconSize={13} />
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'EDI sync queued', message: 'Master data will refresh from EDI partners.' })}><Icon name="refresh" size={13} />Sync from EDI</button>
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={13} />New Record</button>
          </>
        }
      />

      {/* Cross-entity search */}
      <div style={{ padding: 14, background: 'linear-gradient(to right, var(--gecko-primary-50), var(--gecko-bg-surface) 60%)', border: '1px solid var(--gecko-border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--gecko-primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="search" size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-primary-700)' }}>Unified search across master data</div>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>Find any customer, line, vessel, charge code, container type or yard slot by name, code, IMO, scac, or ISO designation.</div>
        </div>
        <div style={{ position: 'relative', width: 420 }}>
          <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)' }} />
          <input className="gecko-input gecko-input-sm" placeholder="Search all masters… e.g. MSC, 0107537000084, 40HC, Block B-04" style={{ paddingLeft: 32, paddingRight: 40, fontFamily: 'inherit' }} />
          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, padding: '2px 5px', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 3, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)' }}>⌘K</span>
        </div>
      </div>

      {/* Main grid: entities (2/3) + recent (1/3) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Catalogs</span>
            <span style={{ fontWeight: 500, letterSpacing: 'normal', textTransform: 'none', fontSize: 11 }}>{entities.reduce((s, e) => s + e.count, 0).toLocaleString()} records total</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {entities.map(e => <EntityCard key={e.id} entity={e} />)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Recent Changes</div>
          <div className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
            {recent.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: 12, borderBottom: i === recent.length - 1 ? 'none' : '1px solid var(--gecko-border)', alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `var(--gecko-${r.tone}-50)`, color: `var(--gecko-${r.tone}-700)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>
                  {r.who.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--gecko-text-primary)' }}>
                    <span style={{ fontWeight: 600 }}>{r.who}</span> {r.what}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.entity}</div>
                  <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginTop: 2, fontFamily: 'var(--gecko-font-mono)' }}>{r.time}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: '10px 12px', background: 'var(--gecko-bg-subtle)', textAlign: 'center' }}>
              <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ fontSize: 11 }} onClick={() => toast({ variant: 'info', title: 'Audit log', message: 'Full audit log view coming soon.' })}>View full audit log <Icon name="arrowRight" size={11} /></button>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: 'plus',     label: 'New customer onboarding',    sub: 'Guided 5-step wizard' },
                { icon: 'download', label: 'Bulk import vessels',         sub: 'Excel or EDI COPARN' },
                { icon: 'refresh',  label: 'Re-sync ISO catalog',          sub: 'Pulls from BIC registry' },
                { icon: 'invoice',  label: 'Clone charge codes',           sub: 'Copy from facility to facility' },
              ].map(q => (
                <button key={q.label} className="gecko-card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--gecko-border)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={q.icon} size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{q.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--gecko-text-secondary)', marginTop: 1 }}>{q.sub}</div>
                  </div>
                  <Icon name="arrowRight" size={12} style={{ color: 'var(--gecko-text-disabled)' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
