"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { PrintDocumentModal, BarcodeScanInput } from '@/components/ui/BarcodeDisplay';

const TALLY_LISTS = [
  { id: 'TL-26-00892', date: 'Apr 24, 2026', type: 'Stuffing', container: 'MSKU 881290-0', clerk: 'Somchai K.', items: 14, weight: '12,450 kg', status: 'In Progress' },
  { id: 'TL-26-00891', date: 'Apr 24, 2026', type: 'Stripping', container: 'CMAU 441922-1', clerk: 'Somchai K.', items: 8, weight: '8,200 kg', status: 'Completed' },
  { id: 'TL-26-00889', date: 'Apr 23, 2026', type: 'Stuffing', container: 'TCLU 199245-0', clerk: 'Nawat P.', items: 42, weight: '22,100 kg', status: 'Completed' },
  { id: 'TL-26-00884', date: 'Apr 22, 2026', type: 'Stripping', container: 'HLXU 441920-8', clerk: 'Nawat P.', items: 112, weight: '24,500 kg', status: 'Completed' },
  { id: 'TL-26-00870', date: 'Apr 20, 2026', type: 'Stuffing', container: 'CXDU 881234-5', clerk: 'Somsak J.', items: 2, weight: '4,800 kg', status: 'Completed' },
];

const TALLY_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search tally no, container...' },
  { type: 'select', key: 'type', label: 'Type', options: [{ label: 'All', value: '' }, { label: 'Stuffing', value: 'stuffing' }, { label: 'Stripping', value: 'stripping' }] },
  { type: 'select', key: 'status', label: 'Status', options: [{ label: 'All', value: '' }, { label: 'In Progress', value: 'in-progress' }, { label: 'Completed', value: 'completed' }] },
  { type: 'select', key: 'date', label: 'Date range', options: [{ label: 'All time', value: '' }, { label: 'This week', value: 'week' }, { label: 'This month', value: 'month' }] },
];

const TALLY_SORT_OPTIONS: SortOption[] = [
  { label: 'Date (newest)', value: 'date_desc' },
  { label: 'Tally No', value: 'id' },
  { label: 'Weight (heavy → light)', value: 'weight_desc' },
  { label: 'Items (most)', value: 'items_desc' },
];

function StatusBadge({ status }: { status: string }) {
  if (status === 'In Progress') return <span style={{ background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>In Progress</span>;
  if (status === 'Completed') return <span style={{ background: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Completed</span>;
  return null;
}

export default function TallyListsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', type: '', status: '', date: '' });
  const [sortBy, setSortBy] = useState('');
  const [printDoc, setPrintDoc] = useState<{ id: string; docType: string; details: {label:string;value:string}[] } | null>(null);
  const [scannedId, setScannedId] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Cargo Tally</h1>
            <span className="gecko-count-badge">5 shown</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Master ledger of all CFS stuffing and stripping operations.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="download" size={16} /> Export</button>
          <BarcodeScanInput onScan={v => setScannedId(v)} placeholder="Scan tally no or container…" size="sm" style={{ width: 220 }} />
          <FilterPopover
            fields={TALLY_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', type: '', status: '', date: '' })}
            sortOptions={TALLY_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <Link href="/cfs/stuffing" className="gecko-btn gecko-btn-primary gecko-btn-sm" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={16} /> New Stuffing Tally
          </Link>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Tally No</th>
              <th>Date</th>
              <th>Type</th>
              <th>Container</th>
              <th>Clerk</th>
              <th style={{ textAlign: 'right' }}>Items</th>
              <th style={{ textAlign: 'right' }}>Total Weight</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {TALLY_LISTS.map((tl) => (
              <tr key={tl.id} style={scannedId && (tl.id === scannedId || tl.container.toLowerCase().includes(scannedId.toLowerCase())) ? { background: 'var(--gecko-primary-50)', borderLeft: '3px solid var(--gecko-primary-500)' } : undefined}>
                <td className="gecko-text-mono" style={{ fontWeight: 700, color: 'var(--gecko-primary-600)' }}>
                  <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>{tl.id}</a>
                </td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{tl.date}</td>
                <td>
                  {tl.type === 'Stuffing'
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--gecko-primary-700)' }}><Icon name="chevronRight" size={14} /> Stuffing</span>
                    : <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--gecko-error-700)' }}><Icon name="chevronLeft" size={14} /> Stripping</span>
                  }
                </td>
                <td className="gecko-text-mono" style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{tl.container}</td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{tl.clerk}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{tl.items}</td>
                <td className="gecko-text-mono" style={{ textAlign: 'right' }}>{tl.weight}</td>
                <td>
                  <StatusBadge status={tl.status} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => setPrintDoc({ id: tl.id, docType: 'Cargo Tally', details: [
                      { label: 'Date', value: tl.date },
                      { label: 'Type', value: tl.type },
                      { label: 'Container', value: tl.container },
                      { label: 'Clerk', value: tl.clerk },
                      { label: 'Items', value: String(tl.items) },
                      { label: 'Total Weight', value: tl.weight },
                    ]})}
                    className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                    title="Print / Barcode"
                  >
                    <Icon name="printer" size={13} />
                  </button>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--gecko-text-disabled)', cursor: 'pointer' }}><Icon name="moreHorizontal" size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {printDoc && (
        <PrintDocumentModal
          open={!!printDoc}
          onClose={() => setPrintDoc(null)}
          docType={printDoc.docType}
          docNo={printDoc.id}
          barcodeValue={printDoc.id}
          details={printDoc.details}
        />
      )}

    </div>
  );
}
