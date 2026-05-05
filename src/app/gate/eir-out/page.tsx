"use client";
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { PageToolbar } from '@/components/ui/OpsPrimitives';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';

// ── Sample data ──────────────────────────────────────────────────────────────
// arrivedMinsAgo: simulates live wait. In production this comes from gate-in record timestamp.

interface QueueContainer { edo: string; iso: string; line: string; ctr: string; }

interface QueueItem {
  id: string; plate: string; trailer: string; driver: string; haulier: string;
  lane: string; appt: string; arrivedAt: string; arrivedMinsAgo: number;
  containers: QueueContainer[];
  status: 'waiting' | 'processing' | 'overdue';
}

const QUEUE: QueueItem[] = [
  { id: 'GIN-4429', plate: '70-4455', trailer: 'TLR-442-9', driver: 'Prem Kanchana',    haulier: 'Laem Chabang Trans.',  lane: 'Lane 3', appt: 'APT-04-4432', arrivedAt: '14:05', arrivedMinsAgo: 42,
    containers: [{ edo:'EDO-9912', iso:'20GP', line:'OOL', ctr:'TGHU 552040-3' }, { edo:'EDO-9913', iso:'20GP', line:'OOL', ctr:'OOLU 629114-7' }],
    status: 'overdue' },
  { id: 'GIN-4430', plate: '80-2211', trailer: 'TLR-381-4', driver: 'Somchai Phakdi',   haulier: 'THA Logistics Co.',    lane: 'Lane 1', appt: 'APT-04-4418', arrivedAt: '14:28', arrivedMinsAgo: 19,
    containers: [{ edo:'EDO-9901', iso:'40HC', line:'CMA', ctr:'CMAU 331876-2' }],
    status: 'waiting' },
  { id: 'GIN-4431', plate: '71-9033', trailer: 'TLR-209-1', driver: 'Wichai Boonsri',   haulier: 'Siam Freight Ltd.',    lane: 'Lane 2', appt: 'APT-04-4401', arrivedAt: '13:55', arrivedMinsAgo: 52,
    containers: [{ edo:'EDO-9888', iso:'40HC', line:'MSK', ctr:'MSKU 744218-3' }, { edo:'EDO-9889', iso:'20GP', line:'MSK', ctr:'MSCU 881290-0' }],
    status: 'overdue' },
  { id: 'GIN-4432', plate: '82-5670', trailer: 'TLR-560-8', driver: 'Kanit Rattana',    haulier: 'Eastern Gateway Trans.', lane: 'Lane 4', appt: 'APT-04-4440', arrivedAt: '14:38', arrivedMinsAgo: 9,
    containers: [{ edo:'EDO-9920', iso:'20GP', line:'OOL', ctr:'TEMU 458223-1' }],
    status: 'waiting' },
  { id: 'GIN-4433', plate: '73-1124', trailer: 'TLR-771-3', driver: 'Prasert Duangjai', haulier: 'LC Haulage PCL',        lane: 'Lane 3', appt: 'Walk-in',    arrivedAt: '14:15', arrivedMinsAgo: 32,
    containers: [{ edo:'EDO-9931', iso:'40HC', line:'CMA', ctr:'CMAU 509871-4' }],
    status: 'overdue' },
  { id: 'GIN-4434', plate: '84-8892', trailer: 'TLR-114-5', driver: 'Nattawut Srisuk',  haulier: 'Nakhon Trans.',         lane: 'Lane 1', appt: 'APT-04-4451', arrivedAt: '14:40', arrivedMinsAgo: 7,
    containers: [{ edo:'EDO-9944', iso:'20GP', line:'OOL', ctr:'OOLU 774422-6' }, { edo:'EDO-9945', iso:'20RF', line:'OOL', ctr:'OOLU 889012-2' }],
    status: 'waiting' },
  { id: 'GIN-4435', plate: '70-3341', trailer: 'TLR-330-2', driver: 'Anon Khamwong',    haulier: 'Laem Chabang Trans.',  lane: 'Lane 2', appt: 'APT-04-4457', arrivedAt: '14:42', arrivedMinsAgo: 5,
    containers: [{ edo:'EDO-9960', iso:'40HC', line:'EVR', ctr:'EISU 330015-9' }],
    status: 'waiting' },
  { id: 'GIN-4436', plate: '72-6618', trailer: 'TLR-891-6', driver: 'Chalerm Siripat',  haulier: 'Thai Union Trans.',    lane: 'Lane 4', appt: 'APT-04-4398', arrivedAt: '13:48', arrivedMinsAgo: 59,
    containers: [{ edo:'EDO-9872', iso:'40HC', line:'CMA', ctr:'CMAU 220451-5' }],
    status: 'overdue' },
  { id: 'GIN-4437', plate: '81-4403', trailer: 'TLR-004-7', driver: 'Surachai Bunnak',  haulier: 'Map Ta Phut Cargo',    lane: 'Lane 1', appt: 'APT-04-4461', arrivedAt: '14:44', arrivedMinsAgo: 3,
    containers: [{ edo:'EDO-9977', iso:'20GP', line:'MSK', ctr:'MSKU 661200-8' }],
    status: 'waiting' },
  { id: 'GIN-4438', plate: '75-7722', trailer: 'TLR-228-0', driver: 'Boonchai Laolek',  haulier: 'Siam Freight Ltd.',    lane: 'Lane 3', appt: 'Walk-in',    arrivedAt: '14:22', arrivedMinsAgo: 25,
    containers: [{ edo:'EDO-9910', iso:'20GP', line:'OOL', ctr:'TGHU 118844-1' }, { edo:'EDO-9911', iso:'20GP', line:'OOL', ctr:'TGHU 229955-3' }],
    status: 'waiting' },
  { id: 'GIN-4439', plate: '83-9001', trailer: 'TLR-601-9', driver: 'Teerayut Wongsri', haulier: 'Eastern Gateway Trans.', lane: 'Lane 2', appt: 'APT-04-4470', arrivedAt: '14:46', arrivedMinsAgo: 1,
    containers: [{ edo:'EDO-9990', iso:'40HC', line:'EVR', ctr:'EISU 770088-4' }],
    status: 'waiting' },
  { id: 'GIN-4440', plate: '76-2234', trailer: 'TLR-450-1', driver: 'Panya Chaisuwan',  haulier: 'LC Haulage PCL',       lane: 'Lane 1', appt: 'APT-04-4411', arrivedAt: '14:00', arrivedMinsAgo: 47,
    containers: [{ edo:'EDO-9855', iso:'40HC', line:'CMA', ctr:'CMAU 445002-1' }],
    status: 'overdue' },
  { id: 'GIN-4441', plate: '85-5519', trailer: 'TLR-119-4', driver: 'Ratchanon Saelee', haulier: 'THA Logistics Co.',    lane: 'Lane 4', appt: 'APT-04-4480', arrivedAt: '14:45', arrivedMinsAgo: 2,
    containers: [{ edo:'EDO-9998', iso:'20GP', line:'MSK', ctr:'MSKU 330244-7' }],
    status: 'waiting' },
  { id: 'GIN-4442', plate: '74-6677', trailer: 'TLR-887-2', driver: 'Mongkol Phetsom',  haulier: 'Nakhon Trans.',        lane: 'Lane 3', appt: 'Walk-in',    arrivedAt: '14:12', arrivedMinsAgo: 35,
    containers: [{ edo:'EDO-9904', iso:'20GP', line:'OOL', ctr:'OOLU 552011-8' }, { edo:'EDO-9905', iso:'40GP', line:'OOL', ctr:'OOLU 663022-0' }],
    status: 'overdue' },
  { id: 'GIN-4443', plate: '86-3344', trailer: 'TLR-772-3', driver: 'Suthep Jankaew',   haulier: 'Map Ta Phut Cargo',    lane: 'Lane 2', appt: 'APT-04-4490', arrivedAt: '14:43', arrivedMinsAgo: 4,
    containers: [{ edo:'EDO-9995', iso:'40HC', line:'CMA', ctr:'CMAU 881123-6' }],
    status: 'waiting' },
];

// ── Wait time helpers ─────────────────────────────────────────────────────────

function fmtWait(mins: number) {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function WaitBadge({ mins }: { mins: number }) {
  const overdue = mins > 30;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700,
      fontFamily: 'var(--gecko-font-mono)',
      background: overdue ? 'var(--gecko-error-600)' : mins > 20 ? 'var(--gecko-warning-100)' : 'var(--gecko-success-50)',
      color: overdue ? '#fff' : mins > 20 ? 'var(--gecko-warning-700)' : 'var(--gecko-success-700)',
    }}>
      {overdue && <Icon name="warning" size={10} />}
      {fmtWait(mins)}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GateOutQueuePage() {
  const [query, setQuery]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLane, setFilterLane]     = useState('all');
  const [tick, setTick] = useState(0);

  // Increment tick every 60s so waiting times stay fresh
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    return QUEUE.filter(r => {
      if (filterStatus === 'overdue'  && r.arrivedMinsAgo <= 30) return false;
      if (filterStatus === 'waiting'  && r.arrivedMinsAgo >  30) return false;
      if (filterLane !== 'all' && r.lane !== filterLane) return false;
      if (query) {
        const q = query.toLowerCase();
        const match = r.plate.toLowerCase().includes(q)
          || r.driver.toLowerCase().includes(q)
          || r.haulier.toLowerCase().includes(q)
          || r.id.toLowerCase().includes(q)
          || r.containers.some(c => c.edo.toLowerCase().includes(q) || c.ctr.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filterStatus, filterLane, tick]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered);

  const overdueCount = QUEUE.filter(r => r.arrivedMinsAgo > 30).length;
  const onTimeCount  = QUEUE.filter(r => r.arrivedMinsAgo <= 30).length;
  const avgWait      = Math.round(QUEUE.reduce((s, r) => s + r.arrivedMinsAgo, 0) / QUEUE.length);
  const totalCtr     = QUEUE.reduce((s, r) => s + r.containers.length, 0);

  const lanes = ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageToolbar
        title="Gate-Out · Truck Queue"
        subtitle="Live list of trucks waiting in the yard for container release · refresh every 60 s"
        badges={[
          { label: `${QUEUE.length} trucks`, kind: 'gray' },
          overdueCount > 0 ? { label: `${overdueCount} overdue`, kind: 'error' } : { label: 'All on time', kind: 'success' },
        ]}
        actions={
          <>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="refresh" size={13} />Refresh</button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="print" size={13} />Print Queue</button>
            <Link href="/gate/eir-in" className="gecko-btn gecko-btn-primary gecko-btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="plus" size={13} />New Gate-In
            </Link>
          </>
        }
      />

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Trucks in queue',  value: QUEUE.length,  sub: `${totalCtr} containers total`,     icon: 'truck',   tone: 'primary' },
          { label: 'On time (≤ 30m)', value: onTimeCount,  sub: 'within SLA',                        icon: 'check',   tone: 'success' },
          { label: 'Overdue (> 30m)', value: overdueCount, sub: 'exceeding dwell SLA',               icon: 'warning', tone: 'error'   },
          { label: 'Avg wait',         value: `${avgWait}m`, sub: 'across all trucks today',          icon: 'clock',   tone: overdueCount > 0 ? 'warning' : 'success' },
        ].map(k => (
          <div key={k.label} className="gecko-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `var(--gecko-${k.tone}-50)`, color: `var(--gecko-${k.tone}-600)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={k.icon} size={17} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1, color: `var(--gecko-${k.tone}-700)` }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{k.label}</div>
              <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginTop: 1 }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
            <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)' }} />
            <input
              className="gecko-input gecko-input-sm"
              placeholder="Search plate, driver, haulier, EDO, or container…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          <select className="gecko-input gecko-input-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 160 }}>
            <option value="all">All statuses</option>
            <option value="waiting">On time only</option>
            <option value="overdue">Overdue only</option>
          </select>

          <select className="gecko-input gecko-input-sm" value={filterLane} onChange={e => setFilterLane(e.target.value)} style={{ width: 120 }}>
            <option value="all">All lanes</option>
            {lanes.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gecko-text-secondary)', flexShrink: 0 }}>
            {filtered.length} of {QUEUE.length} trucks
          </div>
        </div>

        {/* Overdue callout */}
        {overdueCount > 0 && (
          <div style={{ padding: '8px 16px', background: 'var(--gecko-error-50)', borderBottom: '1px solid var(--gecko-error-200)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <Icon name="warning" size={14} style={{ color: 'var(--gecko-error-600)', flexShrink: 0 }} />
            <span style={{ color: 'var(--gecko-error-700)', fontWeight: 600 }}>{overdueCount} truck{overdueCount > 1 ? 's' : ''} waiting over 30 minutes</span>
            <span style={{ color: 'var(--gecko-error-600)' }}>— rows highlighted in red. Process these first.</span>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--gecko-bg-subtle)', borderBottom: '1px solid var(--gecko-border)' }}>
                {['GIN Ref', 'Truck · Driver', 'Haulier', 'Containers', 'Lane', 'Arrived', 'Waiting', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--gecko-text-secondary)', fontSize: 13 }}>
                    No trucks match the current filter
                  </td>
                </tr>
              ) : pageItems.map((r, idx) => {
                const overdue = r.arrivedMinsAgo > 30;
                const rowBg   = overdue
                  ? idx % 2 === 0 ? 'var(--gecko-error-50)' : '#fff1f1'
                  : idx % 2 === 0 ? '#fff' : 'var(--gecko-bg-subtle)';
                const rowBorder = overdue ? '1px solid var(--gecko-error-200)' : undefined;

                return (
                  <tr
                    key={r.id}
                    style={{
                      background: rowBg,
                      borderBottom: rowBorder ?? '1px solid var(--gecko-border)',
                      borderLeft: overdue ? '3px solid var(--gecko-error-500)' : '3px solid transparent',
                    }}
                  >
                    {/* GIN Ref */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700, color: overdue ? 'var(--gecko-error-700)' : 'var(--gecko-text-primary)' }}>{r.id}</span>
                    </td>

                    {/* Truck · Driver */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: overdue ? 'var(--gecko-error-100)' : 'var(--gecko-primary-50)', color: overdue ? 'var(--gecko-error-600)' : 'var(--gecko-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon name="truck" size={14} />
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 13, color: overdue ? 'var(--gecko-error-700)' : 'var(--gecko-text-primary)' }}>{r.plate}</div>
                          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 1 }}>{r.driver}</div>
                        </div>
                      </div>
                    </td>

                    {/* Haulier */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 12, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{r.haulier}</div>
                      <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)', marginTop: 1 }}>
                        {r.appt.startsWith('APT') ? r.appt : <span style={{ color: 'var(--gecko-warning-600)', fontWeight: 600 }}>Walk-in</span>}
                      </div>
                    </td>

                    {/* Containers */}
                    <td style={{ padding: '12px 14px', minWidth: 220 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {r.containers.map(c => (
                          <div key={c.edo} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{c.ctr}</span>
                            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 10, padding: '1px 5px', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 3, color: 'var(--gecko-text-secondary)' }}>{c.iso}</span>
                            <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>{c.edo} · {c.line}</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Lane */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', borderRadius: 4, fontFamily: 'var(--gecko-font-mono)' }}>{r.lane}</span>
                    </td>

                    {/* Arrived */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 600, color: overdue ? 'var(--gecko-error-700)' : 'var(--gecko-text-primary)' }}>{r.arrivedAt}</span>
                    </td>

                    {/* Waiting */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <WaitBadge mins={r.arrivedMinsAgo} />
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {overdue
                        ? <span className="gecko-badge gecko-badge-error" style={{ fontSize: 10 }}>Overdue</span>
                        : r.arrivedMinsAgo <= 5
                          ? <span className="gecko-badge gecko-badge-info" style={{ fontSize: 10 }}>Just arrived</span>
                          : <span className="gecko-badge gecko-badge-success" style={{ fontSize: 10 }}>Waiting</span>
                      }
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <Link
                        href={`/gate/eir-out/${r.id}`}
                        className="gecko-btn gecko-btn-sm"
                        style={{
                          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: overdue ? 'var(--gecko-error-600)' : 'var(--gecko-primary-600)',
                          color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6,
                        }}
                      >
                        <Icon name="arrowRight" size={13} />Open EIR-Out
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page} pageSize={pageSize} totalItems={totalItems}
          totalPages={totalPages} startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={setPageSize}
          noun="trucks"
        />
      </div>
    </div>
  );
}
