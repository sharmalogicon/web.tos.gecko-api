"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';

const TARIFF_PLANS = [
  { id: 'TP-2026-PUB', name: 'Public Tariff 2026 (Standard)', type: 'Public', customer: 'All Standard Customers', effective: 'Jan 01, 2026', expiry: 'Dec 31, 2026', status: 'Active' },
  { id: 'TP-2026-C01', name: 'Thai Union Group Contract 2026', type: 'Contract', customer: 'Thai Union Group PCL', effective: 'Jan 01, 2026', expiry: 'Dec 31, 2026', status: 'Active' },
  { id: 'TP-2026-C02', name: 'PTT Global VIP Volume Agreement', type: 'Contract', customer: 'PTT Global Chemical', effective: 'Mar 01, 2026', expiry: 'Feb 28, 2027', status: 'Active' },
  { id: 'TP-2025-PUB', name: 'Public Tariff 2025', type: 'Public', customer: 'All Standard Customers', effective: 'Jan 01, 2025', expiry: 'Dec 31, 2025', status: 'Expired' },
  { id: 'TP-2026-C03', name: 'CP Foods Short-Term Deal', type: 'Spot', customer: 'CP Foods Co., Ltd.', effective: 'May 01, 2026', expiry: 'Jul 31, 2026', status: 'Draft' },
];

const PLAN_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search plan name, customer...' },
  { type: 'select', key: 'type', label: 'Type', options: [{ label: 'All', value: '' }, { label: 'Public', value: 'public' }, { label: 'Contract', value: 'contract' }, { label: 'Spot', value: 'spot' }] },
  { type: 'select', key: 'status', label: 'Status', options: [{ label: 'All', value: '' }, { label: 'Active', value: 'active' }, { label: 'Draft', value: 'draft' }, { label: 'Expired', value: 'expired' }] },
];

const PLAN_SORT_OPTIONS: SortOption[] = [
  { label: 'Effective date (newest)', value: 'effective_desc' },
  { label: 'Expiry date (soonest)', value: 'expiry_asc' },
  { label: 'Plan name A → Z', value: 'name' },
  { label: 'Type', value: 'type' },
];

function StatusBadge({ status }: { status: string }) {
  if (status === 'Draft') return <span style={{ background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Draft</span>;
  if (status === 'Active') return <span style={{ background: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Active</span>;
  if (status === 'Expired') return <span style={{ background: 'var(--gecko-error-100)', color: 'var(--gecko-error-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Expired</span>;
  return null;
}

export default function TariffPlansPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', type: '', status: 'active' });
  const [sortBy, setSortBy] = useState('');

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Tariff Schedules</h1>
            <span className="gecko-count-badge">5 schedules</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>High-level pricing agreements containing rate cards and free-time logic.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="download" size={16} /> Export</button>
          <FilterPopover
            fields={PLAN_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', type: '', status: 'active' })}
            sortOptions={PLAN_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={16} /> New Tariff Schedule</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Schedule ID</th>
              <th>Schedule Name</th>
              <th>Type</th>
              <th>Assigned To</th>
              <th>Effective Date</th>
              <th>Expiry Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {TARIFF_PLANS.map((plan) => (
              <tr key={plan.id}>
                <td className="gecko-text-mono" style={{ fontWeight: 700, color: 'var(--gecko-primary-600)' }}>
                  <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>{plan.id}</a>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{plan.name}</td>
                <td>
                  {plan.type === 'Public' && <span style={{ color: 'var(--gecko-info-600)', fontWeight: 600 }}><Icon name="globe" size={14} style={{ marginBottom: -2, marginRight: 4 }} /> {plan.type}</span>}
                  {plan.type === 'Contract' && <span style={{ color: 'var(--gecko-primary-600)', fontWeight: 600 }}><Icon name="fileText" size={14} style={{ marginBottom: -2, marginRight: 4 }} /> {plan.type}</span>}
                  {plan.type === 'Spot' && <span style={{ color: 'var(--gecko-warning-600)', fontWeight: 600 }}><Icon name="clock" size={14} style={{ marginBottom: -2, marginRight: 4 }} /> {plan.type}</span>}
                </td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{plan.customer}</td>
                <td className="gecko-text-mono" style={{ color: 'var(--gecko-text-primary)' }}>{plan.effective}</td>
                <td className="gecko-text-mono" style={{ color: plan.status === 'Expired' ? 'var(--gecko-error-600)' : 'var(--gecko-text-primary)' }}>{plan.expiry}</td>
                <td>
                  <StatusBadge status={plan.status} />
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
