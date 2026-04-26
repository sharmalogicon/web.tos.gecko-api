"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';

const CUSTOMERS = [
  { id: 'C-00142', name: 'Thai Union Group PCL', country: 'TH', roles: ['Bill-to', 'Consignee'], tier: 'Key', taxId: '0107537000084', tariff: 'Custom • TU-2026', credit: '฿5.0M', balance: '฿2.14M', status: 'Active' },
  { id: 'C-00211', name: 'Siam Cement Group', country: 'TH', roles: ['Bill-to', 'Shipper'], tier: 'Key', taxId: '0107537000001', tariff: 'Custom • SCG-2026', credit: '฿8.0M', balance: '฿1.92M', status: 'Active' },
  { id: 'C-00308', name: 'PTT Global Chemical', country: 'TH', roles: ['Bill-to', 'Consignee', 'Shipper'], tier: 'Key', taxId: '0107537000128', tariff: 'Custom • PTT-2026', credit: '฿12.0M', balance: '฿3.81M', status: 'Active' },
  { id: 'C-00412', name: 'CP Foods Co., Ltd.', country: 'TH', roles: ['Bill-to', 'Consignee'], tier: 'Standard', taxId: '0107537000222', tariff: 'Standard LCB-2026', credit: '฿2.0M', balance: '฿445k', status: 'Active' },
  { id: 'C-00429', name: 'Saha Pathanapibul PCL', country: 'TH', roles: ['Consignee'], tier: 'Standard', taxId: '0107537000331', tariff: 'Standard LCB-2026', credit: '฿1.0M', balance: '฿124k', status: 'Active' },
  { id: 'C-00501', name: 'Betagro Public Co.', country: 'TH', roles: ['Bill-to', 'Consignee'], tier: 'Standard', taxId: '0107537000415', tariff: 'Standard LCB-2026', credit: '฿2.5M', balance: '—', status: 'Active' },
  { id: 'C-00622', name: 'Bangchak Corporation PCL', country: 'TH', roles: ['Shipper'], tier: 'Standard', taxId: '0107537000517', tariff: 'Standard LCB-2026', credit: '฿0', balance: '—', status: 'On hold' },
  { id: 'C-00714', name: 'Charoen Pokphand Foods PCL', country: 'TH', roles: ['Bill-to', 'Consignee', 'Shipper'], tier: 'Key', taxId: '0107537000644', tariff: 'Custom • CPF-2026', credit: '฿10.0M', balance: '฿4.20M', status: 'Active' },
  { id: 'C-00809', name: 'Indorama Ventures PCL', country: 'TH', roles: ['Shipper'], tier: 'Key', taxId: '0107537000752', tariff: 'Custom • IVL-2026', credit: '฿6.0M', balance: '฿1.04M', status: 'Active' },
];

const CUSTOMER_SORT_OPTIONS: SortOption[] = [
  { label: 'Last activity', value: 'activity' },
  { label: 'Name A → Z', value: 'name' },
  { label: 'Code A → Z', value: 'code' },
  { label: 'Credit (high → low)', value: 'credit' },
  { label: 'Balance (high → low)', value: 'balance' },
];

const CUSTOMER_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search by name, code, tax ID, or SCAC...' },
  { type: 'select', key: 'role', label: 'Role', options: [{ label: 'All', value: '' }, { label: 'Bill-to', value: 'bill-to' }, { label: 'Consignee', value: 'consignee' }, { label: 'Shipper', value: 'shipper' }] },
  { type: 'select', key: 'tier', label: 'Tier', options: [{ label: 'All', value: '' }, { label: 'Key', value: 'key' }, { label: 'Standard', value: 'standard' }] },
  { type: 'select', key: 'tariff', label: 'Tariff', options: [{ label: 'All', value: '' }, { label: 'Custom', value: 'custom' }, { label: 'Standard LCB', value: 'standard' }] },
  { type: 'select', key: 'status', label: 'Status', options: [{ label: 'All', value: '' }, { label: 'Active', value: 'active' }, { label: 'On hold', value: 'on-hold' }] },
  { type: 'select', key: 'country', label: 'Country', options: [{ label: 'All', value: '' }, { label: 'Thailand', value: 'TH' }, { label: 'Other', value: 'other' }] },
];

function RoleBadge({ role }: { role: string }) {
  if (role === 'Bill-to') return <span style={{ background: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{role}</span>;
  if (role === 'Consignee') return <span style={{ background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{role}</span>;
  if (role === 'Shipper') return <span style={{ background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{role}</span>;
  return null;
}

export default function CustomersListPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    query: '', role: '', tier: '', tariff: '', status: 'active', country: 'TH',
  });
  const [sortBy, setSortBy] = useState('activity');

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Customers</h1>
            <span className="gecko-count-badge">11 shown of 284</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Unified party master — bill-to, consignee, shipper, agent, prospect. One record, many roles.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="download" size={16} /> Export</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="upload" size={16} /> Import</button>
          <FilterPopover
            fields={CUSTOMER_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', role: '', tier: '', tariff: '', status: '', country: '' })}
            sortOptions={CUSTOMER_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={16} /> New Customer</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Roles</th>
              <th>Tier</th>
              <th>Tax ID</th>
              <th>Tariff</th>
              <th style={{ textAlign: 'right' }}>Credit</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {CUSTOMERS.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/masters/customers/${c.id}`} className="gecko-text-mono" style={{ fontWeight: 600, color: 'var(--gecko-primary-600)' }}>{c.id}</Link>
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>{c.country}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {c.roles.map(r => <RoleBadge key={r} role={r} />)}
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.tier === 'Key' ? 'var(--gecko-warning-600)' : 'var(--gecko-text-secondary)' }}>{c.tier}</span>
                </td>
                <td className="gecko-text-mono" style={{ color: 'var(--gecko-text-secondary)' }}>{c.taxId}</td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.tariff.includes('Custom') ? 'var(--gecko-primary-400)' : 'var(--gecko-gray-300)', flexShrink: 0 }} />
                    {c.tariff}
                  </div>
                </td>
                <td className="gecko-text-mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{c.credit}</td>
                <td className="gecko-text-mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{c.balance}</td>
                <td>
                  <span className={`gecko-status-dot gecko-status-dot-${c.status === 'Active' ? 'active' : 'warning'}`}>
                    {c.status}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--gecko-text-disabled)', cursor: 'pointer' }}><Icon name="moreHorizontal" size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
