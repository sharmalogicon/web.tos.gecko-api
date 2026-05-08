"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ExportButton } from '@/components/ui/ExportButton';

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  // Mock data for C-00142
  const id = params.id || 'C-00142';
  
  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Header breadcrumb & actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
          <Link href="/masters/customers" className="gecko-breadcrumb-item">Master Data › Customers</Link>
          <span className="gecko-breadcrumb-sep" />
          <span className="gecko-breadcrumb-current">{id} - Thai Union Group</span>
        </nav>
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Top right facility switcher usually goes here, omitted for this specific view block */}
        </div>
      </div>

      {/* Title & Key Actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>{id} - Thai Union Group PCL</h1>
            <span style={{ background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Key</span>
            <span style={{ background: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Active</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 8 }}>
            Customer since Jan 14, 2018 · TH · thaiunion.com
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <ExportButton resource="Customer" iconSize={16} />
          <button className="gecko-btn gecko-btn-outline"><Icon name="edit" size={16} /> Edit</button>
          <button className="gecko-btn gecko-btn-primary"><Icon name="plus" size={16} /> New Invoice</button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--gecko-border)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: 'var(--gecko-bg-surface)', padding: '20px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Customer Since</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 800 }}>8y 3m</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', marginTop: 4 }}>Jan 14, 2018</div>
        </div>
        <div style={{ background: 'var(--gecko-bg-surface)', padding: '20px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>YTD Revenue</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 800 }}>฿ 48.2M</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-success-600)', fontWeight: 600, marginTop: 4 }}>+12% YoY</div>
        </div>
        <div style={{ background: 'var(--gecko-bg-surface)', padding: '20px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>YTD Moves</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 800 }}>14,820</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', marginTop: 4 }}>containers handled</div>
        </div>
        <div style={{ background: 'var(--gecko-bg-surface)', padding: '20px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Credit Used</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 800 }}>43%</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', marginTop: 4 }}>฿2.14M of ฿5.0M</div>
        </div>
      </div>

      {/* Main content grid */}
      <div style={{ display: 'flex', gap: 32 }}>
        
        {/* Left Column (Forms & Settings) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--gecko-border)', paddingBottom: 16 }}>
            <button style={{ background: 'none', border: 'none', color: 'var(--gecko-primary-600)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Icon name="user" size={16} /> Profile</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--gecko-text-secondary)', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Icon name="fileText" size={16} /> Tax & Billing</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--gecko-text-secondary)', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Icon name="mail" size={16} /> Contacts</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--gecko-text-secondary)', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Icon name="tag" size={16} /> Tariff Binding</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--gecko-text-secondary)', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Icon name="activity" size={16} /> Activity</button>
          </div>

          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Identity</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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

          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>Roles</h3>
            <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginBottom: 16 }}>This customer can act as any of the following across transactions</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { role: 'Bill-to',    desc: 'Invoices addressed to this party',        enabled: true  },
                { role: 'Consignee',  desc: 'Named on BL as cargo recipient',          enabled: true  },
                { role: 'Shipper',    desc: 'Named on BL as cargo sender',             enabled: true  },
                { role: 'Agent',      desc: 'Acts on behalf of a line or carrier',     enabled: false },
              ].map(({ role, desc, enabled }) => (
                <label key={role} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: enabled ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-subtle)',
                  border: `1px solid ${enabled ? 'var(--gecko-primary-200)' : 'var(--gecko-border)'}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
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
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 20px 0' }}>Quick Facts</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { icon: 'user',     color: 'var(--gecko-primary-500)',  bg: 'var(--gecko-primary-50)',  label: 'PRIMARY CONTACT',  value: 'Somchai Laoharawee',     sub: 'Operations Manager · +66 81 234 5678' },
                { icon: 'anchor',   color: 'var(--gecko-success-600)',  bg: 'var(--gecko-success-50)',  label: 'PREFERRED GATE',   value: 'Laem Chabang · Gate 1',  sub: null },
                { icon: 'layers',   color: 'var(--gecko-info-600)',     bg: 'var(--gecko-info-50)',     label: 'PREFERRED YARD',   value: 'Block B · Rows 4–7',     sub: 'DG segregation compliant' },
                { icon: 'truck',    color: 'var(--gecko-warning-600)',  bg: 'var(--gecko-warning-50)',  label: 'DEFAULT TRUCKER',  value: 'Laem Chabang Trans.',     sub: 'Contracted · SLA 95%' },
                { icon: 'activity', color: 'var(--gecko-accent-600)',   bg: 'var(--gecko-accent-50)',   label: 'EDI PARTNER',      value: 'Yes — Active',            sub: 'COPARN + CODECO enabled' },
              ].map((fact, i, arr) => (
                <div key={fact.label} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--gecko-border)' : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: fact.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={fact.icon} size={16} style={{ color: fact.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-secondary)', marginBottom: 3 }}>{fact.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)', lineHeight: 1.3 }}>{fact.value}</div>
                    {fact.sub && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{fact.sub}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, padding: 12, background: 'var(--gecko-info-50)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
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
