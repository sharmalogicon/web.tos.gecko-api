"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';

const INVOICES = [
  { id: 'INV-26-009412', date: 'Apr 24, 2026', dueDate: 'May 24, 2026', customer: 'C-00142', custName: 'Thai Union Group PCL', amount: '฿12,450.00', vat: '฿871.50', total: '฿13,321.50', status: 'Draft' },
  { id: 'INV-26-009411', date: 'Apr 23, 2026', dueDate: 'May 23, 2026', customer: 'C-00308', custName: 'PTT Global Chemical', amount: '฿42,100.00', vat: '฿2,947.00', total: '฿45,047.00', status: 'Final' },
  { id: 'INV-26-009408', date: 'Apr 20, 2026', dueDate: 'May 20, 2026', customer: 'C-00211', custName: 'Siam Cement Group', amount: '฿8,400.00', vat: '฿588.00', total: '฿8,988.00', status: 'Final' },
  { id: 'INV-26-009395', date: 'Mar 15, 2026', dueDate: 'Apr 14, 2026', customer: 'C-00412', custName: 'CP Foods Co., Ltd.', amount: '฿1,200.00', vat: '฿84.00', total: '฿1,284.00', status: 'Overdue' },
  { id: 'INV-26-009388', date: 'Mar 10, 2026', dueDate: 'Apr 09, 2026', customer: 'C-00142', custName: 'Thai Union Group PCL', amount: '฿18,500.00', vat: '฿1,295.00', total: '฿19,795.00', status: 'Paid' },
  { id: 'INV-26-009382', date: 'Mar 05, 2026', dueDate: 'Apr 04, 2026', customer: 'C-00501', custName: 'Betagro Public Co.', amount: '฿4,600.00', vat: '฿322.00', total: '฿4,922.00', status: 'Paid' },
  { id: 'INV-26-009374', date: 'Feb 28, 2026', dueDate: 'Mar 30, 2026', customer: 'C-00622', custName: 'Bangchak Corporation PCL', amount: '฿2,100.00', vat: '฿147.00', total: '฿2,247.00', status: 'Paid' },
];

const INV_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search invoice no, customer...' },
  { type: 'select', key: 'status', label: 'Status', options: [{ label: 'All', value: '' }, { label: 'Draft', value: 'draft' }, { label: 'Final', value: 'final' }, { label: 'Overdue', value: 'overdue' }, { label: 'Paid', value: 'paid' }] },
  { type: 'select', key: 'date', label: 'Date range', options: [{ label: 'All time', value: '' }, { label: 'This month', value: 'month' }, { label: 'Last 30 days', value: '30d' }, { label: 'This year', value: 'year' }] },
  { type: 'select', key: 'terms', label: 'Payment terms', options: [{ label: 'All', value: '' }, { label: 'Cash', value: 'cash' }, { label: 'Net 30', value: 'net30' }, { label: 'Net 60', value: 'net60' }] },
];

const INV_SORT_OPTIONS: SortOption[] = [
  { label: 'Date (newest)', value: 'date_desc' },
  { label: 'Due date (soonest)', value: 'due_asc' },
  { label: 'Total (high → low)', value: 'total_desc' },
  { label: 'Customer A → Z', value: 'customer' },
];

function StatusBadge({ status }: { status: string }) {
  if (status === 'Draft') return <span style={{ background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Draft</span>;
  if (status === 'Final') return <span style={{ background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Final</span>;
  if (status === 'Overdue') return <span style={{ background: 'var(--gecko-error-100)', color: 'var(--gecko-error-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Overdue</span>;
  if (status === 'Paid') return <span style={{ background: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Paid</span>;
  return null;
}

export default function InvoicesPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', status: '', date: 'month', terms: '' });
  const [sortBy, setSortBy] = useState('date_desc');

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Invoices</h1>
            <span className="gecko-count-badge">7 shown of 14,208</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Consolidated bills for customers. Includes both cash and credit terms.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="download" size={16} /> Export</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="printer" size={16} /> Print Batch</button>
          <FilterPopover
            fields={INV_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', status: '', date: '', terms: '' })}
            sortOptions={INV_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <Link href="/billing/unbilled" className="gecko-btn gecko-btn-primary gecko-btn-sm" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={16} /> New from Unbilled Services
          </Link>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Due Date</th>
              <th>Customer (Bill-to)</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>VAT (7%)</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((inv) => (
              <tr key={inv.id}>
                <td className="gecko-text-mono" style={{ fontWeight: 700, color: 'var(--gecko-primary-600)' }}>
                  <Link href={`/billing/invoices/${inv.id}`}>{inv.id}</Link>
                </td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{inv.date}</td>
                <td style={{ color: inv.status === 'Overdue' ? 'var(--gecko-error-600)' : 'var(--gecko-text-secondary)', fontWeight: inv.status === 'Overdue' ? 600 : 400 }}>{inv.dueDate}</td>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{inv.custName}</div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>{inv.customer}</div>
                </td>
                <td className="gecko-text-mono" style={{ textAlign: 'right' }}>{inv.amount}</td>
                <td className="gecko-text-mono" style={{ textAlign: 'right', color: 'var(--gecko-text-secondary)' }}>{inv.vat}</td>
                <td className="gecko-text-mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--gecko-text-primary)' }}>{inv.total}</td>
                <td>
                  <StatusBadge status={inv.status} />
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
