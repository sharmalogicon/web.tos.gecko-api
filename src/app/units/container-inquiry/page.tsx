"use client";

/**
 * CONTAINER INQUIRY — every box that has been through this depot.
 *
 * ONE ROW PER BOX, not per stay: each row is the box's LATEST stay, in the yard
 * now or long gone. That is what separates this from Yard Stock, which only
 * knows about boxes currently inside — a clerk asked "where did MSKU8112301 go?"
 * had nowhere to look once it had left.
 *
 * Bound to GET /api/tos/containers (Gecko.Tos ContainerInquiryEndpoints,
 * 2026-10-08), paged and filtered server-side: at a depot with 2,800 boxes a
 * screen that slices a fetched page would be answering about the wrong set.
 *
 * Read-only. Scoped like the gate — `tos.gate.view` per depot; a depot the user
 * does not cover answers 403, and a bad filter value 400, both shown as the
 * server words them.
 */

import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { TablePagination } from '@/components/ui/TablePagination';
import { FilterPopover, type FilterField } from '@/components/ui/FilterPopover';
import { useApi, useApiList, type Paged } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { useFacility } from '@/lib/api/facility';
import { formatContainerNo } from '@/lib/api/tos';
import { formatDateTime } from '@/lib/format';
import { useConditions } from '@/lib/api/lookups';
import {
  blankInquiryQuery, dayEnd, dayStart, INQUIRY_PERMISSION, inquiryPath, SORTS,
  STATUS_LABEL, type InquiryQuery, type InquiryRow,
} from '@/lib/api/container-inquiry';
import { ContainerDetailModal } from './_components/ContainerDetailModal';

/** A timestamp that fits a narrow column: the day, with the clock beneath. */
function Stamp({ iso }: { iso: string }) {
  const text = formatDateTime(iso);
  const [day, ...rest] = text.split(' ');
  return (
    <>
      <span className="gecko-cell-tight">{day}</span>
      {rest.length > 0 && <span className="gecko-cell-meta gecko-cell-tight">{rest.join(' ')}</span>}
    </>
  );
}

interface PartyRow { partyCode: string; nameEn: string }
interface EquipmentTypeRow { typeCode: string; descriptionEn: string; isActive: boolean }

const PAGE_SIZE = 50;

export default function ContainerInquiryPage() {
  const { can } = useSession();
  const { branch } = useFacility();
  const mayView = can(INQUIRY_PERMISSION);

  const [filters, setFilters] = useState<Record<string, string>>(() => ({
    ...blankInquiryQuery(), gateInFrom: '', gateInTo: '',
  }) as unknown as Record<string, string>);
  const [typed, setTyped] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const branchId = branch?.branchId ?? '';

  const { data: lines } = useApiList<PartyRow>('/api/master/parties?role=SHIPPING_LINE&pageSize=200');
  const { data: customers } = useApiList<PartyRow>('/api/master/parties?role=CUSTOMER&pageSize=200');
  const { data: agents } = useApiList<PartyRow>('/api/master/parties?role=FORWARDER&pageSize=200');
  const { data: types } = useApiList<EquipmentTypeRow>('/api/master/equipment-types?pageSize=200');
  const { conditions } = useConditions();

  /**
   * The search is debounced inside the query key rather than in state: the path
   * only changes once the clerk stops typing, and `useApi` keys its fetch on the
   * path, so a part-keyed number never fires a request per keystroke.
   */
  const [search, setSearch] = useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setSearch(typed), 300);
    return () => clearTimeout(t);
  }, [typed]);

  const query: InquiryQuery = useMemo(() => ({
    ...blankInquiryQuery(),
    ...filters,
    search,
    branchId,
    // The picker gives a plain date; the API compares an instant, and `to` is
    // exclusive — so "to the 8th" has to mean the end of the 8th.
    gateInFrom: dayStart(filters.gateInFrom ?? ''),
    gateInTo: dayEnd(filters.gateInTo ?? ''),
  }), [filters, search, branchId]);

  const path = mayView && branchId ? inquiryPath(query, page, PAGE_SIZE) : null;
  const { data, error, loading, reload } = useApi<Paged<InquiryRow>>(path);
  const rows = data?.items ?? [];
  const total = data?.totalCount ?? 0;

  const opt = (list: { value: string; label: string }[]) => [{ label: 'All', value: '' }, ...list];

  const fields: FilterField[] = [
    {
      type: 'select', key: 'status', label: 'Status',
      options: opt([{ label: 'In yard', value: 'IN_YARD' }, { label: 'Out of yard', value: 'OUT_OF_YARD' }]),
    },
    {
      type: 'select', key: 'fullEmpty', label: 'Empty / loaded',
      options: opt([{ label: 'Empty', value: 'EMPTY' }, { label: 'Loaded', value: 'FULL' }]),
    },
    {
      type: 'select', key: 'sizeCode', label: 'Size',
      options: opt([{ label: '20', value: '20' }, { label: '40', value: '40' }, { label: '45', value: '45' }]),
    },
    {
      type: 'select', key: 'equipmentTypeCode', label: 'Type',
      options: opt((types ?? []).filter(t => t.isActive)
        .map(t => ({ label: `${t.typeCode} — ${t.descriptionEn}`, value: t.typeCode }))),
    },
    {
      type: 'select', key: 'reefer', label: 'Reefer',
      options: opt([{ label: 'Reefers only', value: 'true' }]),
    },
    {
      type: 'select', key: 'lineCode', label: 'Line',
      options: opt((lines ?? []).map(p => ({ label: `${p.partyCode} — ${p.nameEn}`, value: p.partyCode }))),
    },
    {
      type: 'select', key: 'customerCode', label: 'Customer',
      options: opt((customers ?? []).map(p => ({ label: `${p.partyCode} — ${p.nameEn}`, value: p.partyCode }))),
    },
    {
      type: 'select', key: 'agentCode', label: 'Agent',
      options: opt((agents ?? []).map(p => ({ label: `${p.partyCode} — ${p.nameEn}`, value: p.partyCode }))),
    },
    // One free-text slot in the popover, and the booking is what a clerk pastes
    // off paperwork; the agent is picked from its code list below.
    { type: 'search', key: 'booking', placeholder: 'Booking: order no, carrier ref or B/L' },
    {
      type: 'select', key: 'conditionCode', label: 'Condition',
      options: opt(conditions.map(c => ({ label: `${c.conditionCode} — ${c.descriptionEn}`, value: c.conditionCode }))),
    },
    {
      type: 'select', key: 'gradeCode', label: 'Grade',
      options: opt(['A', 'B', 'C', 'D'].map(g => ({ label: g, value: g }))),
    },
    { type: 'select', key: 'heldOnly', label: 'Held', options: opt([{ label: 'Held only', value: 'true' }]) },
    { type: 'date', key: 'gateInFrom', label: 'Gated in from' },
    { type: 'date', key: 'gateInTo', label: 'Gated in to' },
  ];

  const change = (next: Record<string, string>) => { setFilters(next); setPage(1); };

  return (
    <div className="gecko-stack gecko-stack-xl gecko-cashbill-page">
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Container Inquiry</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
            <span className="gecko-count-badge">{loading && !data ? '…' : `${total} boxes`}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            Every box that has been through this depot — one row each, its latest stay, in the yard or gone.
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload} disabled={!path || loading}>
            {loading ? <span className="gecko-spinner gecko-spinner-sm" /> : <Icon name="refreshCcw" size={13} />}
            {loading ? 'Reading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {!mayView && (
        <div role="status" className="gecko-alert gecko-alert-warning">
          <Icon name="lock" size={16} />
          <span>Reading containers needs the gate-view permission at a depot.</span>
        </div>
      )}

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <strong>{error.status === 403 ? 'That depot is not one you cover' : error.title}</strong>
            {error.explanation && <div>{error.explanation}</div>}
          </div>
        </div>
      )}

      <section className="gecko-table-card gecko-table-card-menus">
        <div className="gecko-table-toolbar">
          <Icon name="box" size={13} />
          <input
            className="gecko-input gecko-input-sm gecko-text-mono gecko-inquiry-search"
            aria-label="Search by container number"
            placeholder="ABCU1234567 — part of a number is fine"
            value={typed}
            onChange={e => { setTyped(e.target.value.toUpperCase()); setPage(1); }} />
          <span className="gecko-table-toolbar-spacer" />
          <select className="gecko-select gecko-input-sm gecko-inquiry-sort" aria-label="Sort"
            value={filters.sort} onChange={e => change({ ...filters, sort: e.target.value })}>
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <FilterPopover
            fields={fields} values={filters} defaultValues={blankInquiryQuery() as unknown as Record<string, string>}
            tone="orange" onChange={setFilters} onApply={change}
            onClear={() => change(blankInquiryQuery() as unknown as Record<string, string>)} />
        </div>

        <div className="gecko-table-clip">
          <table className="gecko-table gecko-table-compact gecko-table-fixed">
            <thead>
              <tr>
                {/* These add up to 100. They did not, so Customer — the one
                    column with no width of its own — was left a sliver and
                    printed its code one digit per line. */}
                <th style={{ width: '12%' }}>Container</th>
                <th style={{ width: '8%' }}>Status</th>
                <th style={{ width: '7%' }}>Size / type</th>
                <th style={{ width: '5%' }}>F/E</th>
                <th style={{ width: '9%' }}>Line</th>
                <th style={{ width: '9%' }}>Agent</th>
                <th style={{ width: '12%' }}>Customer</th>
                <th style={{ width: '6%' }}>Position</th>
                <th style={{ width: '10%' }}>Gated in</th>
                <th style={{ width: '10%' }}>Gated out</th>
                <th className="gecko-num" style={{ width: '4%' }}>Days</th>
                <th style={{ width: '8%' }}>Booking</th>
              </tr>
            </thead>
            <tbody>
              {loading && <TableSkeleton columns={12} />}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={12} className="gecko-cell-bleed">
                  <EmptyState icon="search"
                    title={search || Object.values(filters).some(Boolean) ? 'No box matches' : 'No boxes yet'}
                    description={search || Object.values(filters).some(Boolean)
                      ? 'Clear the search or the filter to see every box this depot has handled.'
                      : 'Boxes appear here as they come through the gate.'} />
                </td></tr>
              )}
              {!loading && rows.map(r => (
                <tr key={r.containerVisitId} className="gecko-row-clickable" onClick={() => setOpen(r.containerNo)}>
                  <td className="gecko-cell-tight">
                    <span className="gecko-mono-strong gecko-link gecko-cell-tight">{formatContainerNo(r.containerNo)}</span>
                    {r.isHeld && <span className="gecko-badge gecko-badge-xs gecko-badge-error">held</span>}
                  </td>
                  <td>
                    <span className={`gecko-badge gecko-badge-xs ${r.status === 'IN_YARD' ? 'gecko-badge-success' : 'gecko-badge-gray'}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="gecko-mono gecko-cell-tight">
                    {r.equipmentTypeCode ?? '—'}
                    {/* The reefer mark is the one fact a clerk scans for: a plug
                        that is not booked is money and a box that spoils. */}
                    {r.isReefer && <Icon name="thermometer" size={11} />}
                  </td>
                  <td className="gecko-cell-meta">{r.fullEmpty.toLowerCase()}</td>
                  <td className="gecko-cell-tight">{r.lineName ?? r.lineCode}</td>
                  <td className="gecko-cell-tight">{r.agentName ?? r.agentCode ?? '—'}</td>
                  <td className="gecko-cell-tight">
                    <span className="gecko-cell-tight">{r.customerName ?? r.customerCode ?? '—'}</span>
                    {r.customerName && r.customerCode && (
                      <span className="gecko-cell-meta gecko-mono gecko-cell-tight">{r.customerCode}</span>
                    )}
                  </td>
                  <td className="gecko-cell-meta gecko-cell-tight">{r.positionText ?? 'no slot'}</td>
                  {/* The day on one line and the clock under it: "08-10-2026
                      17:43" on a tenth of the width is "08-10-2026 17:…". */}
                  <td className="gecko-cell-tight"><Stamp iso={r.gateInAt} /></td>
                  <td className="gecko-cell-tight">
                    {r.gateOutAt ? <Stamp iso={r.gateOutAt} /> : <span className="gecko-cell-meta">—</span>}
                  </td>
                  <td className="gecko-num gecko-mono">{r.daysInYard}</td>
                  <td className="gecko-cell-tight">
                    {r.orderNo ? (
                      <>
                        <span className="gecko-cell-tight">{r.carrierRef || r.subBlNo || r.orderNo}</span>
                        {(r.carrierRef || r.subBlNo) && (
                          <span className="gecko-cell-meta gecko-mono gecko-cell-tight">{r.orderNo}</span>
                        )}
                      </>
                    ) : <span className="gecko-cell-meta">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <TablePagination
            page={page} pageSize={PAGE_SIZE} totalItems={total}
            totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            startRow={(page - 1) * PAGE_SIZE + 1}
            endRow={Math.min(page * PAGE_SIZE, total)}
            loading={loading}
            onPageChange={setPage}
            // The API's page size, not the screen's: changing it re-asks the server.
            onPageSizeChange={() => {}}
            noun="boxes" />
        )}
      </section>

      {open && <ContainerDetailModal containerNo={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
