"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ExportButton } from '@/components/ui/ExportButton';

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  // Mock data for C-00142
  const id = params.id || 'C-00142';
  
  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>

      {/* Header breadcrumb & actions */}
      <div className="gecko-row gecko-row-between">
        <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
          <Link href="/masters/customers" className="gecko-breadcrumb-item">Master Data › Customers</Link>
          <span className="gecko-breadcrumb-sep" />
          <span className="gecko-breadcrumb-current">{id} - Thai Union Group</span>
        </nav>
        <div className="gecko-row gecko-stack-lg">
          {/* Top right facility switcher usually goes here, omitted for this specific view block */}
        </div>
      </div>

      {/* Title & Key Actions */}
      <div className="gecko-row gecko-row-between gecko-row-start" style={{ paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <div>
          <div className="gecko-row gecko-stack-lg">
            <h1 className="gecko-page-title-lg">{id} - Thai Union Group PCL</h1>
            <span style={{ background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Key</span>
            <span style={{ background: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Active</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-2">
            Customer since Jan 14, 2018 · TH · thaiunion.com
          </div>
        </div>
        <div className="gecko-row gecko-stack-md">
          <ExportButton resource="Customer" iconSize={16} />
          <Link href={`/masters/customers/${id}/edit`} className="gecko-btn gecko-btn-outline"><Icon name="edit" size={16} /> Edit</Link>
          <Link href="/billing/invoices" className="gecko-btn gecko-btn-primary"><Icon name="plus" size={16} /> New Invoice</Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="gecko-kpi-strip">
        <div className="gecko-kpi-cell">
          <div className="gecko-stat-label">Customer Since</div>
          <div className="gecko-row gecko-row-baseline gecko-stack-xs">
            <span className="gecko-stat-num">8y 3m</span>
          </div>
          <div className="gecko-cell-meta">Jan 14, 2018</div>
        </div>
        <div className="gecko-kpi-cell">
          <div className="gecko-stat-label">YTD Revenue</div>
          <div className="gecko-row gecko-row-baseline gecko-stack-xs">
            <span className="gecko-stat-num">฿ 48.2M</span>
          </div>
          <div className="gecko-cell-meta" style={{ color: 'var(--gecko-success-600)', fontWeight: 600 }}>+12% YoY</div>
        </div>
        <div className="gecko-kpi-cell">
          <div className="gecko-stat-label">YTD Moves</div>
          <div className="gecko-row gecko-row-baseline gecko-stack-xs">
            <span className="gecko-stat-num">14,820</span>
          </div>
          <div className="gecko-cell-meta">containers handled</div>
        </div>
        <div className="gecko-kpi-cell">
          <div className="gecko-stat-label">Credit Used</div>
          <div className="gecko-row gecko-row-baseline gecko-stack-xs">
            <span className="gecko-stat-num">43%</span>
          </div>
          <div className="gecko-cell-meta">฿2.14M of ฿5.0M</div>
        </div>
      </div>

      {/* Main content grid */}
      <div style={{ display: 'flex', gap: 32 }}>

        {/* Left Column (Forms & Settings) */}
        <div className="gecko-stack gecko-stack-xl gecko-flex-1">

          {/* Tabs */}
          <div className="gecko-row" style={{ gap: 24, borderBottom: '1px solid var(--gecko-border)', paddingBottom: 16 }}>
            <button style={{ background: 'none', border: 'none', color: 'var(--gecko-primary-600)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Icon name="user" size={16} /> Profile</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--gecko-text-secondary)', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Icon name="fileText" size={16} /> Tax & Billing</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--gecko-text-secondary)', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Icon name="mail" size={16} /> Contacts</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--gecko-text-secondary)', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Icon name="tag" size={16} /> Tariff Binding</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--gecko-text-secondary)', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Icon name="activity" size={16} /> Activity</button>
          </div>

          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Identity</h3>

          <div className="gecko-grid-2" style={{ gap: 20 }}>
            <div className="gecko-form-group">
              <label className="gecko-label">Customer Code</label>
              <input className="gecko-input" value="C-00142" readOnly style={{ background: 'var(--gecko-gray-50)' }} />
            </div>
            <div className="gecko-form-group">
              <label className="gecko-label gecko-label-required">Legal Name</label>
              <input className="gecko-input" value="Thai Union Group PCL" readOnly />
            </div>
            <div className="gecko-form-group">
              <label className="gecko-label">Short Name</label>
              <input className="gecko-input" value="Thai Union" readOnly />
            </div>
            <div className="gecko-form-group">
              <label className="gecko-label gecko-label-required">Country</label>
              <select className="gecko-input" disabled>
                <option>TH</option>
              </select>
            </div>
            <div className="gecko-form-group">
              <label className="gecko-label">Customer Tier</label>
              <select className="gecko-input" disabled>
                <option>Key</option>
              </select>
            </div>
            <div className="gecko-form-group">
              <label className="gecko-label">Status</label>
              <select className="gecko-input" disabled>
                <option>Active</option>
              </select>
            </div>
            <div className="gecko-form-group">
              <label className="gecko-label">Onboarded</label>
              <input className="gecko-input" value="14-01-2018" readOnly />
            </div>
            <div className="gecko-form-group">
              <label className="gecko-label">Website</label>
              <input className="gecko-input" value="thaiunion.com" readOnly />
            </div>
          </div>

          <div className="gecko-mt-4">
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>Roles</h3>
            <div className="gecko-page-subtitle gecko-mb-4">This customer can act as any of the following across transactions</div>

            <div className="gecko-grid-2" style={{ gap: 10 }}>
              {[
                { role: 'Bill-to',    desc: 'Invoices addressed to this party',        enabled: true  },
                { role: 'Consignee',  desc: 'Named on BL as cargo recipient',          enabled: true  },
                { role: 'Shipper',    desc: 'Named on BL as cargo sender',             enabled: true  },
                { role: 'Agent',      desc: 'Acts on behalf of a line or carrier',     enabled: false },
              ].map(({ role, desc, enabled }) => (
                <label key={role} className="gecko-row gecko-row-between" style={{
                  padding: '12px 14px',
                  background: enabled ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-subtle)',
                  border: `1px solid ${enabled ? 'var(--gecko-primary-200)' : 'var(--gecko-border)'}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  gap: 12,
                }}>
                  <div className="gecko-flex-1">
                    <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? 'var(--gecko-primary-900)' : 'var(--gecko-text-secondary)', marginBottom: 2 }}>{role}</div>
                    <div style={{ fontSize: 11, color: enabled ? 'var(--gecko-primary-600)' : 'var(--gecko-text-disabled)', lineHeight: 1.4 }}>{desc}</div>
                  </div>
                  <input type="checkbox" className="gecko-toggle gecko-toggle-sm" defaultChecked={enabled} aria-label={`Enable ${role} role`} />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (Quick Facts) */}
        <div className="gecko-stack gecko-stack-lg gecko-flex-shrink-0" style={{ width: 320 }}>
          <div className="gecko-card gecko-card-padded">
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 20px 0' }}>Quick Facts</h3>

            <div className="gecko-stack" style={{ gap: 0 }}>
              {[
                { icon: 'user',     color: 'var(--gecko-primary-500)',  bg: 'var(--gecko-primary-50)',  label: 'PRIMARY CONTACT',  value: 'Somchai Laoharawee',     sub: 'Operations Manager · +66 81 234 5678' },
                { icon: 'anchor',   color: 'var(--gecko-success-600)',  bg: 'var(--gecko-success-50)',  label: 'PREFERRED GATE',   value: 'Laem Chabang · Gate 1',  sub: null },
                { icon: 'layers',   color: 'var(--gecko-info-600)',     bg: 'var(--gecko-info-50)',     label: 'PREFERRED YARD',   value: 'Block B · Rows 4–7',     sub: 'DG segregation compliant' },
                { icon: 'truck',    color: 'var(--gecko-warning-600)',  bg: 'var(--gecko-warning-50)',  label: 'DEFAULT TRUCKER',  value: 'Laem Chabang Trans.',     sub: 'Contracted · SLA 95%' },
                { icon: 'activity', color: 'var(--gecko-accent-600)',   bg: 'var(--gecko-accent-50)',   label: 'EDI PARTNER',      value: 'Yes — Active',            sub: 'COPARN + CODECO enabled' },
              ].map((fact, i, arr) => (
                <div key={fact.label} className="gecko-row gecko-row-start gecko-stack-md" style={{
                  padding: '14px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--gecko-border)' : 'none',
                }}>
                  <div className="gecko-mini-icon gecko-mini-icon-lg" style={{ background: fact.bg }}>
                    <Icon name={fact.icon} size={16} style={{ color: fact.color }} />
                  </div>
                  <div className="gecko-flex-1">
                    <div className="gecko-eyebrow gecko-mb-1">{fact.label}</div>
                    <div className="gecko-cell-primary" style={{ fontSize: 13, lineHeight: 1.3 }}>{fact.value}</div>
                    {fact.sub && <div className="gecko-cell-meta">{fact.sub}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="gecko-row gecko-row-start gecko-mt-5" style={{ padding: 12, background: 'var(--gecko-info-50)', borderRadius: 8, gap: 10 }}>
              <Icon name="info" size={16} style={{ color: 'var(--gecko-info-600)', marginTop: 2 }} />
              <div style={{ fontSize: 12, color: 'var(--gecko-info-800)', lineHeight: 1.4 }}>
                Key-tier customers receive priority gate appointments and dedicated CSR support.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
