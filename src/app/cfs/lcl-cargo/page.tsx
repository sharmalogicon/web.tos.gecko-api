"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { ExportButton } from '@/components/ui/ExportButton';
import { useToast } from '@/components/ui/Toast';

const LCL_CARGO = [
  { id: 'LCL-8842-1', bkg: 'BKG-2026-991', desc: 'Auto Parts (Toyota)', type: 'Pallet', qty: 1, weight: '1,200 kg', vol: '1.5 cbm', loc: 'WH-A1-01', status: 'Ready for Stuffing' },
  { id: 'LCL-8842-2', bkg: 'BKG-2026-991', desc: 'Auto Parts (Toyota)', type: 'Pallet', qty: 1, weight: '1,200 kg', vol: '1.5 cbm', loc: 'WH-A1-02', status: 'Ready for Stuffing' },
  { id: 'LCL-9100-1', bkg: 'BKG-2026-991', desc: 'Electronics (Sony)', type: 'Cartons', qty: 50, weight: '450 kg', vol: '0.8 cbm', loc: 'WH-B3-12', status: 'Hold - Customs' },
  { id: 'LCL-IM-001', bkg: 'EDO-2026-1142', desc: 'Apparel (Nike)', type: 'Pallet', qty: 1, weight: '800 kg', vol: '2.1 cbm', loc: 'WH-C1-05', status: 'Ready for Pickup' },
  { id: 'LCL-IM-002', bkg: 'EDO-2026-1142', desc: 'Apparel (Nike)', type: 'Pallet', qty: 1, weight: '850 kg', vol: '2.1 cbm', loc: 'WH-C1-06', status: 'Ready for Pickup' },
  { id: 'LCL-7731-1', bkg: 'BKG-2026-992', desc: 'Machinery Engine', type: 'Crate', qty: 1, weight: '3,500 kg', vol: '4.2 cbm', loc: 'WH-D2-01', status: 'Stuffed' },
];

const LCL_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search cargo ID, BKG, location...' },
  { type: 'select', key: 'type', label: 'Type', options: [{ label: 'All', value: '' }, { label: 'Pallet', value: 'pallet' }, { label: 'Cartons', value: 'cartons' }, { label: 'Crate', value: 'crate' }] },
  { type: 'select', key: 'status', label: 'Status', options: [{ label: 'All', value: '' }, { label: 'Ready for Stuffing', value: 'stuffing' }, { label: 'Ready for Pickup', value: 'pickup' }, { label: 'Hold - Customs', value: 'hold' }, { label: 'Stuffed', value: 'stuffed' }] },
];

const LCL_SORT_OPTIONS: SortOption[] = [
  { label: 'Location A → Z', value: 'loc' },
  { label: 'Weight (heavy → light)', value: 'weight_desc' },
  { label: 'Volume (large → small)', value: 'vol_desc' },
  { label: 'Cargo ID', value: 'id' },
];

function StatusBadge({ status }: { status: string }) {
  if (status.includes('Ready for Stuffing')) return <span style={{ background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Ready (Stuff)</span>;
  if (status.includes('Ready for Pickup')) return <span style={{ background: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Ready (Pickup)</span>;
  if (status.includes('Hold')) return <span style={{ background: 'var(--gecko-error-100)', color: 'var(--gecko-error-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{status}</span>;
  if (status === 'Stuffed') return <span style={{ background: 'var(--gecko-gray-200)', color: 'var(--gecko-text-secondary)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Stuffed</span>;
  return null;
}

export default function LclCargoPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', type: '', status: '' });
  const [sortBy, setSortBy] = useState('');
  const { toast } = useToast();

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>LCL Cargo Register</h1>
            <span className="gecko-count-badge">6 shown of 842</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Live inventory of all loose cargo currently in the CFS warehouse.</div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton resource="LCL cargo" iconSize={16} />
          <FilterPopover
            fields={LCL_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', type: '', status: '' })}
            sortOptions={LCL_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Receive Manual Cargo', message: 'Manual cargo entry form coming soon.' })}><Icon name="plus" size={16} /> Receive Manual Cargo</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Cargo ID</th>
              <th>BKG / EDO Ref</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Qty & Type</th>
              <th style={{ textAlign: 'right' }}>Weight / Vol</th>
              <th>Location</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {LCL_CARGO.map((item) => (
              <tr key={item.id}>
                <td className="gecko-text-mono" style={{ fontWeight: 700, color: 'var(--gecko-primary-700)' }}>
                  <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>{item.id}</a>
                </td>
                <td className="gecko-text-mono" style={{ color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>{item.bkg}</td>
                <td>{item.desc}</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{item.qty}</div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>{item.type}</div>
                </td>
                <td className="gecko-text-mono" style={{ textAlign: 'right' }}>
                  <div>{item.weight}</div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>{item.vol}</div>
                </td>
                <td className="gecko-text-mono" style={{ fontWeight: 700, color: 'var(--gecko-info-600)' }}>{item.loc}</td>
                <td>
                  <StatusBadge status={item.status} />
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
