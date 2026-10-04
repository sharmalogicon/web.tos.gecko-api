"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { useApiList } from '@/lib/api/use-api';
import { formatDate } from '@/lib/format';

/**
 * LIVE against gecko_tos (booking.booking + vw_booking_progress), batch B.
 *
 * Two columns the mock merged are now separate: STATUS is what a person decided
 * (OPEN / CANCELLED / CLOSED); PROGRESS is derived — NOT_STARTED, IN_PROGRESS,
 * COMPLETED, or EXPIRED (an open release past its valid-to, on the depot's own
 * calendar). A "DRAFT" does not exist: a booking is created whole or not at all.
 *
 * What the mock had and the API does not, so it is gone rather than faked:
 *  - vessel name, ETD and CY cut-off per row — the booking POINTS at the call
 *    and copies nothing (D-2); the call ref + voyage link there instead.
 *  - "Full in" / "Loaded" counters — steps are done by the gate (Phase 5);
 *    what exists now is boxes assigned / completed of the quantity asked for.
 *  - bulk transfer / bulk cancel buttons and an Export button that only raised
 *    toasts (there is no export endpoint).
 *  - customer NAMES and commodity text — the booking stores party codes.
 */

interface BookingRow {
  bookingId: string;
  orderNo: string;
  branchId: string;
  branchCode: string | null;
  carrierRef: string | null;
  orderTypeCode: string;
  directionCode: string;
  lineCode: string;
  customerCode: string | null;
  vesselCallId: string | null;
  callRef: string | null;
  voyage: string | null;
  status: string;
  progress: string;
  qtyRequired: number;
  qtyAssigned: number;
  qtyCompleted: number;
  validTo: string | null;
  source: string;
  createdAt: string;
}

interface Branch { branchId: string; branchCode: string; displayName: string }

const PROGRESS: Record<string, { label: string; color: string; bg: string; hint: string }> = {
  NOT_STARTED: { label: 'Not started', color: 'var(--gecko-info-700)',       bg: 'var(--gecko-info-50)',    hint: 'No box has passed the gate yet' },
  IN_PROGRESS: { label: 'In progress', color: 'var(--gecko-primary-700)',    bg: 'var(--gecko-primary-50)', hint: 'At least one gate step done' },
  COMPLETED:   { label: 'Completed',   color: 'var(--gecko-success-700)',    bg: 'var(--gecko-success-50)', hint: 'Every box on it finished every required step' },
  EXPIRED:     { label: 'Expired',     color: 'var(--gecko-warning-700)',    bg: 'var(--gecko-warning-50)', hint: 'Open, but the release validity ended — the gate will refuse it' },
  CANCELLED:   { label: 'Cancelled',   color: 'var(--gecko-error-700)',     bg: 'var(--gecko-error-50)',  hint: 'Cancelled before any box moved' },
  CLOSED:      { label: 'Closed',      color: 'var(--gecko-text-secondary)', bg: 'var(--gecko-bg-subtle)',  hint: 'Closed by hand; open boxes were released' },
};
const progressOf = (p: string) => PROGRESS[p] ?? { label: p, color: 'var(--gecko-text-secondary)', bg: 'var(--gecko-bg-subtle)', hint: '' };

const fmtDate = formatDate;   // dd-MM-yyyy, the one date format in this app

function QtyBar({ required, assigned, completed }: { required: number; assigned: number; completed: number }) {
  const pctDone = required > 0 ? Math.min(100, (completed / required) * 100) : 0;
  const pctAssigned = required > 0 ? Math.min(100 - pctDone, (assigned / required) * 100) : 0;
  return (
    <div style={{ minWidth: 96 }} title={`${completed} completed · ${assigned} on the booking · ${required} asked for`}>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)' }}>
        <div style={{ width: `${pctDone}%`, background: 'var(--gecko-success-500)' }} />
        <div style={{ width: `${pctAssigned}%`, background: 'var(--gecko-primary-400)' }} />
      </div>
      <div className="gecko-cell-meta" style={{ marginTop: 3, fontFamily: 'var(--gecko-font-mono)' }}>
        {assigned + completed}/{required}{completed > 0 ? ` · ${completed} done` : ''}
      </div>
    </div>
  );
}

function ProgressBadge({ progress }: { progress: string }) {
  const p = progressOf(progress);
  return (
    <span title={p.hint} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, color: p.color, background: p.bg, whiteSpace: 'nowrap' }}>
      {progress === 'EXPIRED' && <Icon name="clock" size={11} />}
      {p.label}
    </span>
  );
}

const EMPTY_FILTERS = { search: '', status: '', progress: '', orderTypeCode: '', lineCode: '', branchId: '' };

export default function BookingRegisterPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchDraft, setSearchDraft] = useState('');
  const set = (patch: Partial<typeof EMPTY_FILTERS>) => setFilters(f => ({ ...f, ...patch }));

  const path = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '200' });
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    return `/api/tos/bookings?${params.toString()}`;
  }, [filters]);
  const { data, error, loading, reload, totalCount } = useApiList<BookingRow>(path);
  const { data: branches } = useApiList<Branch>('/api/branches?pageSize=100');
  const rows = useMemo(() => data ?? [], [data]);

  const kpis = useMemo(() => ({
    open: rows.filter(r => r.status === 'OPEN').length,
    inProgress: rows.filter(r => r.progress === 'IN_PROGRESS').length,
    expired: rows.filter(r => r.progress === 'EXPIRED').length,
    boxesOpen: rows.filter(r => r.status === 'OPEN').reduce((s, r) => s + Math.max(0, r.qtyRequired - r.qtyAssigned - r.qtyCompleted), 0),
  }), [rows]);

  const lines = useMemo(() => [...new Set(rows.map(r => r.lineCode))].sort(), [rows]);
  const orderTypes = useMemo(() => [...new Set(rows.map(r => r.orderTypeCode))].sort(), [rows]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(rows);

  return (
    <div className="gecko-stack">

      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <div className="gecko-row">
            <h1 className="gecko-page-title">Booking Register</h1>
            <span className="gecko-count-badge">{loading && !data ? '…' : `${totalCount} bookings`}</span>
          </div>
          <p className="gecko-page-subtitle">
            Every order the depot has been asked to carry out — status is what a person decided, progress is what the gate has done.
          </p>
        </div>
        <div className="gecko-page-header-actions gecko-row">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}><Icon name="refreshCcw" size={14} /> Refresh</button>
          <Link href="/bookings/new" className="gecko-btn gecko-btn-primary gecko-btn-sm gecko-inline-row" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={14} /> New Booking
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} />
          <span>{error.message}</span>
          {error.status === 401 && <Link href="/login" className="gecko-link">Sign in</Link>}
        </div>
      )}

      <div className="gecko-grid-4" style={{ gap: 10 }}>
        {[
          { label: 'Open bookings', value: kpis.open, icon: 'clipboardList', color: 'var(--gecko-primary-600)' },
          { label: 'In progress', value: kpis.inProgress, icon: 'activity', color: 'var(--gecko-info-600)' },
          { label: 'Expired releases', value: kpis.expired, icon: 'clock', color: 'var(--gecko-warning-600)' },
          { label: 'Boxes still to name', value: kpis.boxesOpen, icon: 'box', color: 'var(--gecko-text-secondary)' },
        ].map(k => (
          <div key={k.label} className="gecko-card gecko-card-tight gecko-row gecko-stack-md">
            <Icon name={k.icon} size={18} style={{ color: k.color }} />
            <div>
              <div className="gecko-page-title" style={{ fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>{loading && !data ? '…' : k.value}</div>
              <div className="gecko-stat-block-sub" style={{ marginTop: 2 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="gecko-row gecko-row-wrap" style={{ gap: 8 }}>
        <form className="gecko-row" style={{ gap: 6 }} onSubmit={e => { e.preventDefault(); set({ search: searchDraft.trim() }); }}>
          <input className="gecko-input gecko-input-sm" aria-label="Search bookings" style={{ width: 300 }}
            placeholder="Order no, carrier ref, customer ref or container no…"
            value={searchDraft} onChange={e => setSearchDraft(e.target.value)} />
          <button type="submit" className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="search" size={13} /> Search</button>
        </form>
        <select className="gecko-input gecko-input-sm" aria-label="Progress" value={filters.progress} onChange={e => set({ progress: e.target.value })} style={{ width: 150 }}>
          <option value="">All progress</option>
          {Object.entries(PROGRESS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="gecko-input gecko-input-sm" aria-label="Status" value={filters.status} onChange={e => set({ status: e.target.value })} style={{ width: 130 }}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select className="gecko-input gecko-input-sm" aria-label="Depot" value={filters.branchId} onChange={e => set({ branchId: e.target.value })} style={{ width: 150 }}>
          <option value="">All depots</option>
          {(branches ?? []).map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode}</option>)}
        </select>
        <select className="gecko-input gecko-input-sm" aria-label="Order type" value={filters.orderTypeCode} onChange={e => set({ orderTypeCode: e.target.value })} style={{ width: 170 }}>
          <option value="">All order types</option>
          {(filters.orderTypeCode && !orderTypes.includes(filters.orderTypeCode) ? [filters.orderTypeCode, ...orderTypes] : orderTypes).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="gecko-input gecko-input-sm" aria-label="Line" value={filters.lineCode} onChange={e => set({ lineCode: e.target.value })} style={{ width: 110 }}>
          <option value="">All lines</option>
          {(filters.lineCode && !lines.includes(filters.lineCode) ? [filters.lineCode, ...lines] : lines).map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        {Object.values(filters).some(Boolean) && (
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => { setFilters(EMPTY_FILTERS); setSearchDraft(''); }}>
            <Icon name="x" size={13} /> Clear
          </button>
        )}
      </div>

      <div className="gecko-table-card">
        <table className="gecko-table">
          <thead>
            <tr>
              <th>Order No / Carrier Ref</th>
              <th>Order Type</th>
              <th>Line</th>
              <th>Customer</th>
              <th>Vessel call</th>
              <th>Boxes</th>
              <th>Valid to</th>
              <th>Progress</th>
              <th>Source</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'var(--gecko-text-secondary)' }}>Loading bookings…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'var(--gecko-text-secondary)' }}>No bookings match these filters.</td></tr>
            ) : pageItems.map(b => (
              <tr key={b.bookingId} style={{ opacity: b.status === 'CANCELLED' ? 0.6 : 1 }}>
                <td>
                  <Link href={`/bookings/${b.bookingId}`} className="gecko-id-link">{b.orderNo}</Link>
                  <div className="gecko-cell-meta">{b.carrierRef ?? '—'}{b.branchCode ? ` · ${b.branchCode}` : ''}</div>
                </td>
                <td>
                  <div style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>{b.orderTypeCode}</div>
                  <div className="gecko-cell-meta">{b.directionCode}</div>
                </td>
                <td className="gecko-text-mono">{b.lineCode}</td>
                <td className="gecko-text-mono">{b.customerCode ?? '—'}</td>
                <td>
                  {b.vesselCallId
                    ? <Link href={`/masters/vessels/schedule/${b.vesselCallId}`} className="gecko-id-link">{b.callRef}</Link>
                    : <span className="gecko-cell-meta">—</span>}
                  {b.voyage && <div className="gecko-cell-meta">voyage {b.voyage}</div>}
                </td>
                <td><QtyBar required={b.qtyRequired} assigned={b.qtyAssigned} completed={b.qtyCompleted} /></td>
                <td style={{ whiteSpace: 'nowrap', color: b.progress === 'EXPIRED' ? 'var(--gecko-warning-700)' : undefined }}>{fmtDate(b.validTo)}</td>
                <td><ProgressBadge progress={b.progress} /></td>
                <td><span className="gecko-badge gecko-badge-xs gecko-badge-gray">{b.source}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination page={page} pageSize={pageSize} totalItems={totalItems} totalPages={totalPages}
          startRow={startRow} endRow={endRow} onPageChange={setPage} onPageSizeChange={setPageSize} noun="bookings" />
      </div>
      {totalCount > rows.length && (
        <div className="gecko-cell-meta">Showing the newest {rows.length} of {totalCount}; narrow the filters to see the rest.</div>
      )}
    </div>
  );
}
