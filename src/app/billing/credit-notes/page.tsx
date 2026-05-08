"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { ExportButton } from '@/components/ui/ExportButton';
import { useToast } from '@/components/ui/Toast';
import { PrintDocumentModal, BarcodeScanInput } from '@/components/ui/BarcodeDisplay';

const CREDIT_NOTES = [
  { id: 'CN-26-00184', date: 'Apr 24, 2026', customer: 'C-00308', custName: 'PTT Global Chemical', invoice: 'INV-26-009411', reason: 'Billing Error - Lift duplicate', amount: '฿850.00', status: 'Approved' },
  { id: 'CN-26-00183', date: 'Apr 22, 2026', customer: 'C-00412', custName: 'CP Foods Co., Ltd.', invoice: 'INV-26-009395', reason: 'Damage claim settlement', amount: '฿1,200.00', status: 'Applied' },
  { id: 'CN-26-00182', date: 'Apr 18, 2026', customer: 'C-00142', custName: 'Thai Union Group PCL', invoice: 'INV-26-009388', reason: 'Volume discount retroactive', amount: '฿5,500.00', status: 'Applied' },
  { id: 'CN-26-00181', date: 'Apr 15, 2026', customer: 'C-00622', custName: 'Bangchak Corporation PCL', invoice: 'INV-26-009374', reason: 'SLA penalty deduction', amount: '฿2,100.00', status: 'Pending Approval' },
];

const CN_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search CN no, invoice no, customer...' },
  { type: 'select', key: 'status', label: 'Status', options: [{ label: 'All', value: '' }, { label: 'Pending Approval', value: 'pending' }, { label: 'Approved', value: 'approved' }, { label: 'Applied', value: 'applied' }] },
  { type: 'select', key: 'date', label: 'Date range', options: [{ label: 'All time', value: '' }, { label: 'This month', value: 'month' }, { label: 'Last 30 days', value: '30d' }] },
];

const CN_SORT_OPTIONS: SortOption[] = [
  { label: 'Date (newest)', value: 'date_desc' },
  { label: 'Amount (high → low)', value: 'amount_desc' },
  { label: 'CN Number', value: 'id' },
];

function StatusBadge({ status }: { status: string }) {
  if (status === 'Pending Approval') return <span style={{ background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Pending</span>;
  if (status === 'Approved') return <span style={{ background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Approved</span>;
  if (status === 'Applied') return <span style={{ background: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Applied</span>;
  return null;
}

export default function CreditNotesPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', status: '', date: '' });
  const [sortBy, setSortBy] = useState('date_desc');
  const { toast } = useToast();
  const [printDoc, setPrintDoc] = useState<{ id: string; docType: string; details: {label:string;value:string}[] } | null>(null);
  const [scannedId, setScannedId] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Credit Notes</h1>
            <span className="gecko-count-badge">4 shown</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Formal adjustments and refunds applied to finalized invoices.</div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton resource="Credit notes" iconSize={16} />
          <BarcodeScanInput onScan={v => setScannedId(v)} placeholder="Scan CN number…" size="sm" style={{ width: 200 }} />
          <FilterPopover
            fields={CN_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', status: '', date: '' })}
            sortOptions={CN_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Issue Credit Note', message: 'Credit-note creation form coming soon.' })}><Icon name="plus" size={16} /> Issue Credit Note</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>CN Number</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Original Invoice</th>
              <th>Reason</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {CREDIT_NOTES.map((cn) => (
              <tr key={cn.id} style={scannedId === cn.id ? { background: 'var(--gecko-primary-50)', borderLeft: '3px solid var(--gecko-primary-500)' } : undefined}>
                <td className="gecko-text-mono" style={{ fontWeight: 700, color: 'var(--gecko-error-600)' }}>
                  <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>{cn.id}</a>
                </td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{cn.date}</td>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{cn.custName}</div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>{cn.customer}</div>
                </td>
                <td className="gecko-text-mono" style={{ fontWeight: 600, color: 'var(--gecko-primary-600)' }}>
                  <Link href={`/billing/invoices/${cn.invoice}`}>{cn.invoice}</Link>
                </td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{cn.reason}</td>
                <td className="gecko-text-mono" style={{ textAlign: 'right', fontWeight: 700 }}>-{cn.amount}</td>
                <td>
                  <StatusBadge status={cn.status} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => setPrintDoc({ id: cn.id, docType: 'Credit Note', details: [
                      { label: 'Date', value: cn.date },
                      { label: 'Customer', value: cn.custName },
                      { label: 'Original Invoice', value: cn.invoice },
                      { label: 'Reason', value: cn.reason },
                      { label: 'Amount', value: cn.amount },
                      { label: 'Status', value: cn.status },
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
