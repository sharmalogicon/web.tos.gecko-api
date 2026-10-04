"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { DateField } from '@/components/ui/DateField';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useServerList } from '@/lib/api/use-server-list';
import { saveBlob } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import {
  TOS_PERMISSIONS, formatContainerNo, formatDateTime,
  type GateDirection, type GateTransactionSummary,
} from '@/lib/api/tos';
import { GATE_API, dayRange, eirPath } from '@/lib/api/gate-eir';

/**
 * EIR REGISTER — live against gecko_tos `gate.gate_transaction`, one direction.
 *
 * Read-only: every EIR the gate desk wrote, at the depots this user covers
 * (the API scopes the rows by branch). New moves are recorded at the desk.
 */
const COPY: Record<GateDirection, { title: string; other: string; otherLabel: string; newLabel: string; noun: string }> = {
  IN:  { title: 'EIR-In register',  other: '/gate/eir-out', otherLabel: 'EIR-Out register', newLabel: 'New gate-in',  noun: 'gate-ins' },
  OUT: { title: 'EIR-Out register', other: '/gate/eir-in',  otherLabel: 'EIR-In register',  newLabel: 'New gate-out', noun: 'gate-outs' },
};

export function EirRegister({ direction }: { direction: GateDirection }) {
  const { can } = useSession();
  const copy = COPY[direction];
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [containerNo, setContainerNo] = useState('');
  const [truck, setTruck] = useState('');
  const [status, setStatus] = useState('');
  const [lateOnly, setLateOnly] = useState(false);

  const range = dayRange(fromDay, toDay);
  const list = useServerList<GateTransactionSummary>(`${GATE_API}/transactions`, {
    direction, from: range.from, to: range.to,
    containerNo: containerNo.replace(/\s/g, '').length === 11 ? containerNo.replace(/\s/g, '') : undefined,
    truck: truck.trim() || undefined, status: status || undefined, lateOnly: lateOnly || undefined,
  }, copy.noun);
  const rows = list.rows ?? [];
  const filtered = !!(list.search || fromDay || toDay || containerNo || truck || status || lateOnly);

  const clear = () => { list.setSearch(''); setFromDay(''); setToDay(''); setContainerNo(''); setTruck(''); setStatus(''); setLateOnly(false); };

  const exportCsv = () => {
    const head = ['EIR', 'Time', 'Container', 'Movement', 'F/E', 'Order', 'Line', 'Truck', 'Late', 'Status'];
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = rows.map(r => [r.eirNo, r.transactionAt, r.containerNo, r.movementCode, r.fullEmpty, r.orderNo, r.lineCode, r.truckPlate, r.isLate ? 'yes' : '', r.status].map(cell).join(','));
    saveBlob(new Blob([[head.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' }), `eir-${direction.toLowerCase()}.csv`);
  };

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 60 }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">{copy.title}</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
            <span className="gecko-count-badge">{list.data ? `${list.total} ${copy.noun}` : '…'}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            Every equipment interchange receipt the gate desk recorded, newest first. Open one for its seals, survey, photos and the printed EIR.
          </div>
        </div>
        <div className="gecko-toolbar">
          <Link href={copy.other} className="gecko-btn gecko-btn-outline gecko-btn-sm">{copy.otherLabel}</Link>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Icon name="download" size={14} /> Export page
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={list.reload}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
          {can(TOS_PERMISSIONS.gateCreate) && (
            <Link href="/gate/desk" className="gecko-btn gecko-btn-primary gecko-btn-sm">
              <Icon name="plus" size={14} /> {copy.newLabel}
            </Link>
          )}
        </div>
      </div>

      {list.error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{list.error.title}</div>
            {list.error.explanation && <div>{list.error.explanation}</div>}
          </div>
        </div>
      )}

      <div className="gecko-card" style={{ padding: 14 }}>
        <div className="gecko-row gecko-stack-md" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="gecko-form-group" style={{ flex: '1 1 240px' }}>
            <label className="gecko-form-label">EIR, container or booking</label>
            <input className="gecko-input" value={list.search} placeholder="EIR number, ABCU1234567 or an order number"
                   onChange={e => list.setSearch(e.target.value)} />
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">From</label>
            <DateField value={fromDay} onChange={setFromDay} max={toDay || undefined} aria-label="From" />
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">To</label>
            <DateField value={toDay} onChange={setToDay} min={fromDay || undefined} aria-label="To" />
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">Container</label>
            <input className="gecko-input" value={containerNo} maxLength={13} placeholder="all 11 characters"
                   onChange={e => setContainerNo(e.target.value.toUpperCase())} style={{ width: 150 }} />
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">Truck plate</label>
            <input className="gecko-input" value={truck} maxLength={20} onChange={e => setTruck(e.target.value)} style={{ width: 130 }} />
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label">Status</label>
            <select className="gecko-input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Any</option>
              <option value="COMPLETED">Completed</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>
          <label className="gecko-row" style={{ gap: 6, alignItems: 'center', paddingBottom: 8 }}>
            <input type="checkbox" checked={lateOnly} onChange={e => setLateOnly(e.target.checked)} /> Late only
          </label>
          {filtered && <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={clear}>Clear</button>}
        </div>
      </div>

      {!list.loading && rows.length === 0 && !list.error ? (
        <EmptyState
          icon="clipboardList"
          title={filtered ? 'No EIR matches' : `No ${copy.noun} yet`}
          description={filtered
            ? 'Nothing matches these filters at the depots you cover.'
            : 'An EIR appears here the moment the gate desk records the move.'}
        />
      ) : (
        <div className="gecko-card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="gecko-table">
            <thead>
              <tr>
                <th>EIR</th><th>Time</th><th>Container</th><th>Movement</th><th>Order</th><th>Line</th><th>Truck</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.gateTransactionId}>
                  <td>
                    <Link href={eirPath(r.direction, r.gateTransactionId)} className="gecko-link" style={{ fontWeight: 600 }}>{r.eirNo}</Link>
                  </td>
                  <td>{formatDateTime(r.transactionAt)}</td>
                  <td style={{ fontFamily: 'var(--gecko-font-mono, monospace)' }}>{formatContainerNo(r.containerNo)}</td>
                  <td>{r.movementCode}<div className="gecko-cell-meta">{r.fullEmpty.toLowerCase()}</div></td>
                  <td>{r.orderNo}</td>
                  <td>{r.lineCode}</td>
                  <td>{r.truckPlate}</td>
                  <td>
                    <span className={`gecko-badge gecko-badge-xs gecko-badge-${r.status === 'VOIDED' ? 'error' : 'success'}`}>{r.status.toLowerCase()}</span>
                    {r.isLate && <span className="gecko-badge gecko-badge-xs gecko-badge-warning" style={{ marginLeft: 4 }}>late</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.footer}
        </div>
      )}
    </div>
  );
}
