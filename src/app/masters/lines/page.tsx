"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';

const LINE_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search SCAC, name, prefix...' },
  { type: 'select', key: 'edi', label: 'EDI', options: [{ label: 'All', value: '' }, { label: 'COPARN', value: 'coparn' }, { label: 'CODECO', value: 'codeco' }, { label: 'BAPLIE', value: 'baplie' }, { label: 'Manual', value: 'manual' }] },
  { type: 'select', key: 'alliance', label: 'Alliance', options: [{ label: 'All', value: '' }, { label: 'Gemini', value: 'gemini' }, { label: 'Premier', value: 'premier' }, { label: 'Independent', value: 'independent' }] },
  { type: 'select', key: 'status', label: 'Status', options: [{ label: 'All', value: '' }, { label: 'Active', value: 'active' }, { label: 'On hold', value: 'on-hold' }] },
];
const LINE_SORT_OPTIONS: SortOption[] = [
  { label: 'Name A → Z', value: 'name' },
  { label: 'Code A → Z', value: 'code' },
  { label: 'EDOs (high → low)', value: 'edos' },
  { label: 'Fleet size', value: 'fleet' },
];

const SHIPPING_LINES = [
  { id: 'MSC', scac: 'MSCU', name: 'Mediterranean Shipping Co.', hq: 'Geneva, CH', prefix: 'MSCU/MEDU', fleet: 18, edos: '1,284', edi: ['COPARN', 'CODECO', 'BAPLIE'], status: 'Active', color: '#FFCC00' },
  { id: 'OOCL', scac: 'OOLU', name: 'Orient Overseas Container Line', hq: 'Hong Kong, HK', prefix: 'OOLU/COCU', fleet: 14, edos: '942', edi: ['COPARN', 'CODECO'], status: 'Active', color: '#FF0000' },
  { id: 'MAEU', scac: 'MAEU', name: 'Maersk Line', hq: 'Copenhagen, DK', prefix: 'MAEU/MSKU', fleet: 16, edos: '1,118', edi: ['COPARN', 'CODECO', 'BAPLIE'], status: 'Active', color: '#40B4E5' },
  { id: 'CMA', scac: 'CMDU', name: 'CMA CGM Group', hq: 'Marseille, FR', prefix: 'CMAU/CXDU', fleet: 12, edos: '814', edi: ['COPARN', 'CODECO'], status: 'Active', color: '#D6001C' },
  { id: 'EMC', scac: 'EGLV', name: 'Evergreen Marine', hq: 'Taoyuan, TW', prefix: 'EGHU/EMCU', fleet: 9, edos: '612', edi: ['COPARN', 'CODECO'], status: 'Active', color: '#008B45' },
  { id: 'HLC', scac: 'HLCU', name: 'Hapag-Lloyd', hq: 'Hamburg, DE', prefix: 'HLXU/HLBU', fleet: 8, edos: '528', edi: ['COPARN', 'CODECO'], status: 'Active', color: '#FF8C00' },
  { id: 'YML', scac: 'YNLU', name: 'Yang Ming Marine', hq: 'Keelung, TW', prefix: 'YNLU/YMNU', fleet: 7, edos: '455', edi: ['COPARN'], status: 'Active', color: '#0047AB' },
  { id: 'ONE', scac: 'ONEY', name: 'Ocean Network Express', hq: 'Singapore, SG', prefix: 'ONEU/TCLU', fleet: 11, edos: '721', edi: ['COPARN', 'CODECO', 'BAPLIE'], status: 'Active', color: '#FF007F' },
  { id: 'ZIM', scac: 'ZIMU', name: 'ZIM Integrated Shipping', hq: 'Haifa, IL', prefix: 'ZIMU/ZCSU', fleet: 5, edos: '298', edi: ['COPARN'], status: 'Active', color: '#00008B' },
  { id: 'PIL', scac: 'PCIU', name: 'Pacific Intl Lines', hq: 'Singapore, SG', prefix: 'PCIU/PILU', fleet: 4, edos: '184', edi: ['manual'], status: 'Active', color: '#0055A4' },
  { id: 'WHL', scac: 'WHLC', name: 'Wan Hai Lines', hq: 'Taipei, TW', prefix: 'WHLU', fleet: 3, edos: '126', edi: ['COPARN'], status: 'On hold', color: '#005BBB' },
];

export default function ShippingLinesPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', edi: '', alliance: '', status: 'active' });
  const [sortBy, setSortBy] = useState('name');
  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Shipping Lines</h1>
            <span className="gecko-count-badge">42 lines</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-info-700)', background: 'var(--gecko-info-100)', padding: '2px 8px', borderRadius: 12 }}>34 EDI-linked</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>Line operators and carriers. Source of EDO, BL, and vessel schedule.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="download" size={16} /> Export</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="refreshCcw" size={16} /> Sync SMDG</button>
          <FilterPopover
            fields={LINE_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', edi: '', alliance: '', status: '' })}
            sortOptions={LINE_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={16} /> New Line</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 100 }}>Code</th>
              <th>SCAC</th>
              <th>Line Operator</th>
              <th>HQ</th>
              <th>Container Prefix</th>
              <th style={{ textAlign: 'right' }}>Fleet</th>
              <th style={{ textAlign: 'right' }}>EDOs (30d)</th>
              <th>EDI Messages</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {SHIPPING_LINES.map((line, i) => (
              <tr key={line.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: line.color }} />
                    <span className="gecko-text-mono" style={{ fontWeight: 700, color: 'var(--gecko-primary-700)' }}>{line.id}</span>
                  </div>
                </td>
                <td className="gecko-text-mono" style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{line.scac}</td>
                <td style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{line.name}</td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{line.hq}</td>
                <td className="gecko-text-mono" style={{ fontSize: 12, fontWeight: 600 }}>{line.prefix}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{line.fleet}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{line.edos}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {line.edi.map(msg => (
                      msg === 'manual'
                        ? <span key={msg} style={{ background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'lowercase' }}>{msg}</span>
                        : <span key={msg} style={{ background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{msg}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`gecko-status-dot gecko-status-dot-${line.status === 'Active' ? 'active' : 'warning'}`}>
                    {line.status}
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
