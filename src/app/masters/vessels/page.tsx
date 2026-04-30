"use client";
import React, { useState, useMemo } from 'react';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';

const VESSEL_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search IMO, name, call sign...' },
  { type: 'select', key: 'line', label: 'Line', options: [{ label: 'All', value: '' }, { label: 'MSC', value: 'msc' }, { label: 'OOCL', value: 'oocl' }, { label: 'Maersk', value: 'maeu' }, { label: 'CMA CGM', value: 'cma' }] },
  { type: 'select', key: 'class', label: 'Class', options: [{ label: 'All', value: '' }, { label: 'ULCV', value: 'ulcv' }, { label: 'Post-Panamax', value: 'postpanamax' }, { label: 'Panamax', value: 'panamax' }] },
  { type: 'select', key: 'eta', label: 'ETA window', options: [{ label: 'All', value: '' }, { label: 'Next 7 days', value: '7d' }, { label: 'Next 30 days', value: '30d' }, { label: 'Scheduled', value: 'scheduled' }] },
];
const VESSEL_SORT_OPTIONS: SortOption[] = [
  { label: 'ETA (soonest)', value: 'eta_asc' },
  { label: 'Name A → Z', value: 'name' },
  { label: 'TEU (large → small)', value: 'teu_desc' },
  { label: 'Built (newest)', value: 'built_desc' },
];

const VESSELS = [
  { imo: '9345612', name: 'MSC LISBON', line: 'NSC', flag: 'PA', class: 'Post-Panamax', loa: '299.9m', teu: '11,312', built: '2008', voyage: '142E', eta: 'Apr 24 - 06:00', status: 'Expected' },
  { imo: '9776418', name: 'OOCL SEOUL', line: 'OOCL', flag: 'HK', class: 'ULCV', loa: '399.9m', teu: '21,413', built: '2017', voyage: '512E', eta: 'Apr 23 - 14:00', status: 'Arriving' },
  { imo: '9778820', name: 'MAERSK HONAM', line: 'NAEU', flag: 'SG', class: 'ULCV', loa: '399.9m', teu: '15,262', built: '2017', voyage: '804W', eta: 'Apr 25 - 22:00', status: 'Expected' },
  { imo: '9839891', name: 'CMA CGM JACQUES SAADE', line: 'CMA', flag: 'FR', class: 'ULCV', loa: '400.0m', teu: '23,000', built: '2020', voyage: '0FTE4W1MA', eta: 'Apr 28 - 08:00', status: 'Scheduled' },
  { imo: '9302555', name: 'EVER GIVEN', line: 'EMC', flag: 'PA', class: 'ULCV', loa: '399.9m', teu: '20,124', built: '2018', voyage: '0112E', eta: 'May 02 - 06:00', status: 'Scheduled' },
  { imo: '9725132', name: 'ONE STORK', line: 'ONE', flag: 'JP', class: 'Post-Panamax', loa: '364.0m', teu: '14,052', built: '2015', voyage: '055E', eta: 'Apr 26 - 10:00', status: 'Scheduled' },
  { imo: '9501578', name: 'HYUNDAI EARTH', line: 'HLC', flag: 'MH', class: 'Post-Panamax', loa: '366.5m', teu: '13,100', built: '2012', voyage: '—', eta: '—', status: 'Archived' },
];

const ACTIVE_VOYAGES = [
  { voyage: '512E', vessel: 'OOCL SEOUL', berth: 'B-3', eta: 'Today 14:00', etd: 'Apr 24 02:00', disch: 820, load: 640 },
  { voyage: '142E', vessel: 'MSC LISBON', berth: 'C-1', eta: 'Apr 24 06:00', etd: 'Apr 24 18:00', disch: 540, load: 480 },
  { voyage: '804W', vessel: 'MAERSK HONAM', berth: 'B-2', eta: 'Apr 25 22:00', etd: 'Apr 26 14:00', disch: 910, load: 720 },
];

function StatusBadge({ status }: { status: string }) {
  let bg = 'var(--gecko-gray-100)', color = 'var(--gecko-gray-700)';
  if (status === 'Expected') { bg = 'var(--gecko-info-50)'; color = 'var(--gecko-info-700)'; }
  if (status === 'Arriving') { bg = 'var(--gecko-warning-50)'; color = 'var(--gecko-warning-700)'; }
  return <span style={{ background: bg, color: color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, border: `1px solid ${bg.replace('50', '200')}` }}>{status}</span>;
}

export default function VesselsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', line: '', class: '', eta: '7d' });
  const [sortBy, setSortBy] = useState('eta_asc');

  const filtered = useMemo(() => VESSELS, []);
  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered);

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Vessels & Voyages</h1>
            <span className="gecko-count-badge">126 vessels</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-info-700)', background: 'var(--gecko-info-100)', padding: '2px 8px', borderRadius: 12 }}>14 in next 7 days</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>Vessel catalog with IMO-keyed identity, plus current and scheduled voyages.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="download" size={16} /> Export</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="refreshCcw" size={16} /> Import BAPLIE</button>
          <FilterPopover
            fields={VESSEL_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', line: '', class: '', eta: '' })}
            sortOptions={VESSEL_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={16} /> New Vessel</button>
        </div>
      </div>

      {/* Vessels Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>IMO</th>
              <th>Vessel</th>
              <th>Line</th>
              <th>Flag</th>
              <th>Class</th>
              <th style={{ textAlign: 'right' }}>LOA</th>
              <th style={{ textAlign: 'right' }}>TEU</th>
              <th style={{ textAlign: 'right' }}>Built</th>
              <th>Next Voyage · ETA</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((v, i) => (
              <tr key={v.imo}>
                <td className="gecko-text-mono" style={{ fontWeight: 600, color: 'var(--gecko-primary-600)' }}>
                  <Link href={`/masters/vessels/${v.imo}`}>{v.imo}</Link>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="anchor" size={16} style={{ color: 'var(--gecko-info-500)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{v.name}</span>
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>{v.line}</td>
                <td style={{ color: 'var(--gecko-text-secondary)', fontSize: 11, fontWeight: 600 }}>{v.flag} {v.flag}</td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{v.class}</td>
                <td className="gecko-text-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{v.loa}</td>
                <td className="gecko-text-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{v.teu}</td>
                <td style={{ textAlign: 'right', color: 'var(--gecko-text-secondary)' }}>{v.built}</td>
                <td>
                  <div className="gecko-text-mono" style={{ fontWeight: 600 }}>{v.voyage}</div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{v.eta}</div>
                </td>
                <td>
                  <StatusBadge status={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination page={page} pageSize={pageSize} totalItems={totalItems}
          totalPages={totalPages} startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={setPageSize} noun="vessels" />
      </div>

      {/* Active Voyages Section */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Active voyages at Laem Chabang</h3>
            <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>Vessels berthed or expected at this facility in the next 48h</div>
          </div>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-text-secondary)' }}>
            Berth schedule <Icon name="arrowRight" size={14} />
          </button>
        </div>

        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Voyage</th>
              <th>Vessel</th>
              <th>Berth</th>
              <th>ETA</th>
              <th>ETD</th>
              <th style={{ textAlign: 'right' }}>Discharge</th>
              <th style={{ textAlign: 'right' }}>Load</th>
            </tr>
          </thead>
          <tbody>
            {ACTIVE_VOYAGES.map((v) => (
              <tr key={v.voyage}>
                <td className="gecko-text-mono" style={{ fontWeight: 700 }}>{v.voyage}</td>
                <td style={{ fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>{v.vessel}</td>
                <td>
                  <span style={{ color: 'var(--gecko-primary-600)', background: 'var(--gecko-primary-50)', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>{v.berth}</span>
                </td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{v.eta}</td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{v.etd}</td>
                <td className="gecko-text-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{v.disch}</td>
                <td className="gecko-text-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{v.load}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
