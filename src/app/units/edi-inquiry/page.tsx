"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { ExportButton } from '@/components/ui/ExportButton';
import { RefreshButton } from '@/components/ui/RefreshButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type Direction = 'IN' | 'OUT';
type EdiStatus = 'Acked' | 'Error' | 'Pending' | 'Sent';
type MessageType = 'COPARN' | 'CODECO' | 'COARRI' | 'BAPLIE' | 'MOVINS' | 'COPRAR' | 'IFTMIN' | 'CUSCAR' | 'CUSREP';

interface EdiEvent {
  id: string;
  ts: string;
  partner: string;
  messageType: MessageType;
  direction: Direction;
  status: EdiStatus;
  reference: string;        // booking, container, voyage
  referenceType: 'BOOKING' | 'CONTAINER' | 'VOYAGE';
  msgRef: string;           // EDIFACT message reference number
  segments: number;
  errorDetail?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const EVENTS: EdiEvent[] = [
  { id: 'E0001', ts: '2026-04-26T08:42', partner: 'EVERGREEN', messageType: 'COPARN', direction: 'IN',  status: 'Acked',   reference: 'EGLV149602390730', referenceType: 'BOOKING', msgRef: 'COP-EMC-260426-001', segments: 14 },
  { id: 'E0002', ts: '2026-04-26T08:45', partner: 'EVERGREEN', messageType: 'CODECO', direction: 'OUT', status: 'Acked',   reference: 'EITU9845240',      referenceType: 'CONTAINER', msgRef: 'COD-OUT-260426-001', segments: 11 },
  { id: 'E0003', ts: '2026-04-26T07:18', partner: 'COSCO',     messageType: 'COPARN', direction: 'IN',  status: 'Error',   reference: 'COSU4260407771',   referenceType: 'BOOKING',  msgRef: 'COP-COS-260426-002', segments: 12, errorDetail: 'Container number checksum mismatch' },
  { id: 'E0004', ts: '2026-04-26T07:22', partner: 'COSCO',     messageType: 'CONTRL', direction: 'OUT' as Direction, status: 'Sent',    reference: 'COP-COS-260426-002', referenceType: 'BOOKING',  msgRef: 'CTRL-OUT-260426-001', segments: 4 } as any,
  { id: 'E0005', ts: '2026-04-26T06:50', partner: 'MAERSK',    messageType: 'BAPLIE', direction: 'IN',  status: 'Acked',   reference: 'MSC LISBON · FE025W', referenceType: 'VOYAGE', msgRef: 'BPL-MSK-260426-001', segments: 248 },
  { id: 'E0006', ts: '2026-04-26T06:14', partner: 'CUSTOMS',   messageType: 'CUSCAR', direction: 'OUT', status: 'Sent',    reference: 'EGLV149602390729', referenceType: 'BOOKING',  msgRef: 'CUS-OUT-260426-001', segments: 22 },
  { id: 'E0007', ts: '2026-04-26T06:18', partner: 'CUSTOMS',   messageType: 'CUSREP', direction: 'IN',  status: 'Acked',   reference: 'EGLV149602390729', referenceType: 'BOOKING',  msgRef: 'CUS-REP-260426-001', segments: 9 },
  { id: 'E0008', ts: '2026-04-26T05:33', partner: 'MSC',       messageType: 'COARRI', direction: 'OUT', status: 'Acked',   reference: 'MAEU4260419834',   referenceType: 'CONTAINER', msgRef: 'COA-OUT-260426-001', segments: 14 },
  { id: 'E0009', ts: '2026-04-26T04:12', partner: 'OOIL',      messageType: 'COPARN', direction: 'IN',  status: 'Pending', reference: 'OOLU2604022341',   referenceType: 'BOOKING',  msgRef: 'COP-OOL-260426-001', segments: 13 },
  { id: 'E0010', ts: '2026-04-26T03:48', partner: 'YML',       messageType: 'MOVINS', direction: 'IN',  status: 'Acked',   reference: 'YM UPRIGHTNESS · 009W', referenceType: 'VOYAGE', msgRef: 'MOV-YML-260426-001', segments: 88 },
  { id: 'E0011', ts: '2026-04-26T02:16', partner: 'HAPAG',     messageType: 'COPRAR', direction: 'OUT', status: 'Acked',   reference: 'HLCU4260411078',   referenceType: 'BOOKING',  msgRef: 'COR-HLC-260426-001', segments: 18 },
  { id: 'E0012', ts: '2026-04-26T01:59', partner: 'EVERGREEN', messageType: 'IFTMIN', direction: 'IN',  status: 'Error',   reference: 'EGLV149602390730', referenceType: 'BOOKING',  msgRef: 'IFT-EMC-260426-001', segments: 16, errorDetail: 'Missing UN/LOCODE for transit port' },
  { id: 'E0013', ts: '2026-04-26T00:33', partner: 'COSCO',     messageType: 'BAPLIE', direction: 'IN',  status: 'Acked',   reference: 'COSCO YANTIAN · 026E', referenceType: 'VOYAGE', msgRef: 'BPL-COS-260426-001', segments: 312 },
  { id: 'E0014', ts: '2026-04-25T23:11', partner: 'APL',       messageType: 'COPARN', direction: 'IN',  status: 'Acked',   reference: 'APLU4260319102',   referenceType: 'BOOKING',  msgRef: 'COP-APL-260425-006', segments: 11 },
  { id: 'E0015', ts: '2026-04-25T22:48', partner: 'CUSTOMS',   messageType: 'CUSCAR', direction: 'OUT', status: 'Sent',    reference: 'COSU4260407771',   referenceType: 'BOOKING',  msgRef: 'CUS-OUT-260425-008', segments: 21 },
  { id: 'E0016', ts: '2026-04-25T21:25', partner: 'MAERSK',    messageType: 'CODECO', direction: 'OUT', status: 'Acked',   reference: 'MAEU4260419837',   referenceType: 'CONTAINER', msgRef: 'COD-OUT-260425-014', segments: 11 },
  { id: 'E0017', ts: '2026-04-25T20:02', partner: 'MSC',       messageType: 'IFTMIN', direction: 'IN',  status: 'Acked',   reference: 'MSMU7226041109',   referenceType: 'BOOKING',  msgRef: 'IFT-MSC-260425-009', segments: 17 },
  { id: 'E0018', ts: '2026-04-25T18:44', partner: 'EVERGREEN', messageType: 'COARRI', direction: 'OUT', status: 'Acked',   reference: 'EGHU9213381',      referenceType: 'CONTAINER', msgRef: 'COA-OUT-260425-022', segments: 15 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2,'0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}-${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

const MSG_DESC: Record<MessageType | 'CONTRL', string> = {
  COPARN: 'Booking confirmation — line → terminal',
  CODECO: 'Gate-out / depot release acknowledgement',
  COARRI: 'Container arrival report',
  BAPLIE: 'Vessel stowage plan',
  MOVINS: 'Stowage instruction',
  COPRAR: 'Pre-arrival container release',
  IFTMIN: 'International forwarding instruction',
  CUSCAR: 'Customs cargo report',
  CUSREP: 'Customs response',
  CONTRL: 'EDIFACT syntax-level acknowledgement',
};

const STATUS_META: Record<EdiStatus, { badge: string; color: string }> = {
  Acked:   { badge: 'gecko-badge-success', color: 'var(--gecko-success-700)' },
  Error:   { badge: 'gecko-badge-error',   color: 'var(--gecko-error-700)'   },
  Pending: { badge: 'gecko-badge-warning', color: 'var(--gecko-warning-700)' },
  Sent:    { badge: 'gecko-badge-info',    color: 'var(--gecko-info-700)'    },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EdiInquiryPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    query: '', partner: '', messageType: '', direction: '', status: '',
  });
  const [sortBy, setSortBy] = useState('ts_desc');
  const [selectedEvent, setSelectedEvent] = useState<EdiEvent | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    let rows = EVENTS.filter(e => {
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!e.reference.toLowerCase().includes(q) && !e.msgRef.toLowerCase().includes(q) && !e.partner.toLowerCase().includes(q)) return false;
      }
      if (filters.partner     && e.partner     !== filters.partner)     return false;
      if (filters.messageType && e.messageType !== filters.messageType) return false;
      if (filters.direction   && e.direction   !== filters.direction)   return false;
      if (filters.status      && e.status      !== filters.status)      return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      switch (sortBy) {
        case 'ts_desc':    return b.ts.localeCompare(a.ts);
        case 'ts_asc':     return a.ts.localeCompare(b.ts);
        case 'partner':    return a.partner.localeCompare(b.partner);
        case 'type':       return a.messageType.localeCompare(b.messageType);
        default:           return 0;
      }
    });
    return rows;
  }, [filters, sortBy]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered, 20);

  // KPI counts (against the entire dataset, not filtered)
  const todayKey = '2026-04-26';
  const kpi = useMemo(() => ({
    today:     EVENTS.filter(e => e.ts.startsWith(todayKey)).length,
    error:     EVENTS.filter(e => e.status === 'Error').length,
    pending:   EVENTS.filter(e => e.status === 'Pending').length,
    acked:     EVENTS.filter(e => e.status === 'Acked').length,
  }), []);

  const filterFields: FilterField[] = [
    { type: 'search', key: 'query',       placeholder: 'Search reference, msg ref, or partner…' },
    { type: 'select', key: 'partner',     label: 'Partner', options: [
        { value: '', label: 'All partners' },
        ...Array.from(new Set(EVENTS.map(e => e.partner))).sort().map(p => ({ value: p, label: p })),
    ] },
    { type: 'select', key: 'messageType', label: 'Message Type', options: [
        { value: '', label: 'All types' },
        ...Array.from(new Set(EVENTS.map(e => e.messageType))).sort().map(t => ({ value: t, label: `${t} — ${MSG_DESC[t] ?? ''}` })),
    ] },
    { type: 'select', key: 'direction',   label: 'Direction', options: [
        { value: '', label: 'In + Out' }, { value: 'IN', label: '↓ Inbound' }, { value: 'OUT', label: '↑ Outbound' },
    ] },
    { type: 'select', key: 'status',      label: 'Status', options: [
        { value: '', label: 'All statuses' }, { value: 'Acked', label: 'Acked' }, { value: 'Error', label: 'Error' }, { value: 'Pending', label: 'Pending' }, { value: 'Sent', label: 'Sent' },
    ] },
  ];

  const sortOptions: SortOption[] = [
    { value: 'ts_desc', label: 'Newest first' },
    { value: 'ts_asc',  label: 'Oldest first' },
    { value: 'partner', label: 'Partner (A → Z)' },
    { value: 'type',    label: 'Message type' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gecko-text-primary)', margin: 0 }}>EDI Event Inquiry</h1>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', border: '1px solid var(--gecko-primary-200)' }}>
              {filtered.length} of {EVENTS.length}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
            Audit trail of every EDIFACT message — COPARN, CODECO, COARRI, BAPLIE, MOVINS, COPRAR, CUSCAR, IFTMIN.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ExportButton resource="EDI events" iconSize={13} />
          <RefreshButton resource="EDI events" iconSize={13} />
          <Link href="/dashboard/edi" className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ textDecoration: 'none' }}>
            <Icon name="zap" size={13} /> EDI Dashboard
          </Link>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Today',   value: kpi.today,   icon: 'clock',         color: 'var(--gecko-primary-700)', bg: 'var(--gecko-primary-50)' },
          { label: 'Acked',   value: kpi.acked,   icon: 'check',         color: 'var(--gecko-success-700)', bg: 'var(--gecko-success-50)' },
          { label: 'Pending', value: kpi.pending, icon: 'clock',         color: 'var(--gecko-warning-700)', bg: 'var(--gecko-warning-50)' },
          { label: 'Errors',  value: kpi.error,   icon: 'alertTriangle', color: 'var(--gecko-error-700)',   bg: 'var(--gecko-error-50)'   },
        ].map(k => (
          <div key={k.label} style={{ padding: '12px 14px', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={k.icon} size={17} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--gecko-text-primary)' }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter ── */}
      <FilterPopover
        fields={filterFields}
        values={filters}
        onChange={setFilters}
        onApply={setFilters}
        onClear={() => setFilters({ query: '', partner: '', messageType: '', direction: '', status: '' })}
        sortOptions={sortOptions}
        sortValue={sortBy}
        onSortChange={setSortBy}
      />

      {/* ── Table ── */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table className="gecko-table">
          <thead>
            <tr>
              <th style={{ width: 160 }}>Timestamp</th>
              <th style={{ width: 110 }}>Partner</th>
              <th style={{ width: 100 }}>Type</th>
              <th style={{ width: 80 }}>Direction</th>
              <th>Reference</th>
              <th style={{ width: 200 }}>Message Ref</th>
              <th style={{ width: 70, textAlign: 'right' }}>Seg</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    icon="zap"
                    title="No EDI events match the current filters"
                    description="Try clearing the search or adjusting partner / type / direction / status filters."
                  />
                </td>
              </tr>
            )}
            {pageItems.map(e => {
              const status = STATUS_META[e.status];
              return (
                <tr key={e.id} style={{ background: e.status === 'Error' ? 'rgba(239, 68, 68, 0.04)' : undefined }}>
                  <td className="gecko-text-mono" style={{ fontSize: 11.5 }}>{fmtDateTime(e.ts)}</td>
                  <td><div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{e.partner}</div></td>
                  <td>
                    <span className="gecko-badge gecko-badge-info gecko-text-mono" title={MSG_DESC[e.messageType] ?? ''}>{e.messageType}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: e.direction === 'IN' ? 'var(--gecko-info-50)' : 'var(--gecko-primary-50)', color: e.direction === 'IN' ? 'var(--gecko-info-700)' : 'var(--gecko-primary-700)' }}>
                      {e.direction === 'IN' ? '↓ IN' : '↑ OUT'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 64 }}>{e.referenceType}</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>{e.reference}</span>
                    </div>
                  </td>
                  <td className="gecko-text-mono" style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{e.msgRef}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontSize: 11.5 }}>{e.segments}</td>
                  <td>
                    <span className={`gecko-badge ${status.badge}`}>{e.status}</span>
                  </td>
                  <td>
                    <button onClick={() => setSelectedEvent(e)} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ fontSize: 11 }}>
                      <Icon name="fileText" size={11} /> Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <TablePagination
          page={page} pageSize={pageSize} totalItems={totalItems} totalPages={totalPages}
          startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={setPageSize}
          noun="EDI events"
        />
      </div>

      {/* ── Detail Modal ── */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onResend={() => {
            toast({ variant: 'info', title: 'Message queued', message: `${selectedEvent.messageType} re-queued for delivery to ${selectedEvent.partner}.` });
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function EventDetailModal({ event, onClose, onResend }: { event: EdiEvent; onClose: () => void; onResend: () => void }) {
  const status = STATUS_META[event.status];
  return (
    <div className="gecko-overlay" onClick={onClose}>
      <div className="gecko-modal gecko-modal-lg" style={{ display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="gecko-modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="gecko-badge gecko-badge-info gecko-text-mono">{event.messageType}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: event.direction === 'IN' ? 'var(--gecko-info-50)' : 'var(--gecko-primary-50)', color: event.direction === 'IN' ? 'var(--gecko-info-700)' : 'var(--gecko-primary-700)' }}>
                {event.direction === 'IN' ? '↓ IN' : '↑ OUT'}
              </span>
              <span className={`gecko-badge ${status.badge}`}>{event.status}</span>
            </div>
            <div className="gecko-modal-title" style={{ marginTop: 8 }}>{MSG_DESC[event.messageType] ?? event.messageType}</div>
            <div className="gecko-modal-description">{event.partner} · {fmtDateTime(event.ts)}</div>
          </div>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" onClick={onClose} aria-label="Close" type="button">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="gecko-modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Kv label="Event ID"   value={event.id}   mono />
            <Kv label="Partner"    value={event.partner} mono />
            <Kv label="Reference"  value={`${event.referenceType} · ${event.reference}`} mono />
            <Kv label="Message Ref" value={event.msgRef} mono />
            <Kv label="Segments"   value={event.segments.toString()} mono />
            <Kv label="Timestamp"  value={fmtDateTime(event.ts)} mono />
          </div>

          {event.errorDetail && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--gecko-error-50)', border: '1px solid var(--gecko-error-200)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gecko-error-700)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Error Detail</div>
              <div style={{ fontSize: 13, color: 'var(--gecko-error-700)' }}>{event.errorDetail}</div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Payload (preview)</div>
            <pre style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 8, padding: 12, overflow: 'auto', maxHeight: 220, margin: 0 }}>
{`UNH+${event.msgRef}+${event.messageType}:D:00B:UN'
BGM+12+${event.id}+9'
DTM+137:${event.ts.replace(/[-:T]/g, '').slice(0, 12)}:203'
NAD+CA+${event.partner}'
RFF+BN:${event.reference}'
... (${event.segments} segments total)
UNT+${event.segments}+${event.msgRef}'`}
            </pre>
          </div>
        </div>

        <div className="gecko-modal-footer">
          <button onClick={onClose} className="gecko-btn gecko-btn-outline gecko-btn-sm">Close</button>
          {(event.status === 'Error' || event.status === 'Pending') && (
            <button onClick={onResend} className="gecko-btn gecko-btn-primary gecko-btn-sm">
              <Icon name="refreshCcw" size={13} /> Re-send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--gecko-text-disabled)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: mono ? 'var(--gecko-font-mono)' : 'inherit' }}>{value}</div>
    </div>
  );
}
