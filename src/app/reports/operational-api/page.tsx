"use client";

/**
 * OPERATIONAL REPORTS — gate movements, live against GET /api/tos/reports/gate-moves
 * (totals) and the gate register GET /api/tos/gate/transactions (the EIRs).
 *
 * A move is a completed EIR on a truck visit the gate recorded (a voided EIR moved
 * nothing and is shown apart; Vector's migrated stock snapshot is not flow). Days
 * are the depot's. The old catalogue of ~28 WinForms reports generated nothing;
 * the stock on hand is the yard stock list and the yard view, linked below.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useServerList } from '@/lib/api/use-server-list';
import { saveBlob } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { formatContainerNo, formatDateTime, type GateTransactionSummary } from '@/lib/api/tos';
import {
  GATE_MOVES_PATH, REPORT_PERMISSIONS, dayRangeInstants, presetRange, reportPath, toCsv,
  type GateMovesGroup, type GateMovesReport,
} from '@/lib/api/reports';
import { ReportKpi, ReportParams, ReportTable, type Depot } from '../_components/ReportParams';

const TOP = 15;

export default function OperationalReportsPage() {
  const { branchesFor } = useSession();
  const [picked, setPicked] = useState('');
  const [range, setRange] = useState(() => presetRange('thisMonth'));

  const { data: branchRows } = useApiList<Depot>('/api/branches?pageSize=100');
  const mine = new Set(branchesFor(REPORT_PERMISSIONS.gateMoves));
  const depots = (branchRows ?? []).filter(b => mine.size === 0 || mine.has(b.branchId));
  const branchId = picked || depots[0]?.branchId || '';

  const report = useApi<GateMovesReport>(branchId ? reportPath(GATE_MOVES_PATH, branchId, range.from, range.to) : null);
  const r = report.data;
  const busiest = r?.days.reduce((a, d) => (d.tally.moves > a.tally.moves ? d : a), r.days[0]);
  const instants = dayRangeInstants(range.from, range.to);
  const eirs = useServerList<GateTransactionSummary>('/api/tos/gate/transactions', {
    branchId: branchId || undefined, from: instants.from, to: instants.to,
  }, 'EIRs');

  const exportCsv = () => {
    if (!r) return;
    const rows = r.days.map(d => [d.day, d.tally.fullIn, d.tally.emptyIn, d.tally.in, d.tally.fullOut, d.tally.emptyOut, d.tally.out, d.tally.moves, d.tally.teu]);
    rows.push(['Total', r.total.fullIn, r.total.emptyIn, r.total.in, r.total.fullOut, r.total.emptyOut, r.total.out, r.total.moves, r.total.teu]);
    saveBlob(toCsv(['Day', 'Full in', 'Empty in', 'In', 'Full out', 'Empty out', 'Out', 'Moves', 'TEU'], rows),
      `gate-moves-${r.branchCode}-${r.from}-${r.to}.csv`);
  };

  const exportCustomers = () => {
    if (!r) return;
    saveBlob(toCsv(['Customer', 'Name', 'In', 'Out', 'Moves', 'TEU'],
      r.customers.map(c => [c.code ?? '', c.name ?? '', c.tally.in, c.tally.out, c.tally.moves, c.tally.teu])),
      `gate-moves-by-customer-${r.branchCode}-${r.from}-${r.to}.csv`);
  };

  const groupRows = (groups: GateMovesGroup[], limit?: number) =>
    (limit ? groups.slice(0, limit) : groups).map(g => [
      g.name
        ? <><div className="gecko-cell-primary gecko-truncate" style={{ maxWidth: 220 }}>{g.name}</div><div className="gecko-cell-meta gecko-mono">{g.code}</div></>
        : <span className="gecko-mono-strong">{g.code ?? '—'}</span>,
      g.tally.in, g.tally.out, <strong key="m">{g.tally.moves}</strong>,
    ]);

  const more = (groups: GateMovesGroup[], limit: number) => groups.length > limit
    ? `and ${groups.length - limit} more (${groups.slice(limit).reduce((n, g) => n + g.tally.moves, 0).toLocaleString()} moves) — in the CSV`
    : undefined;

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Operational Reports</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
          </div>
          <p className="gecko-page-subtitle gecko-mt-1">
            Gate movements — the boxes in and out of a depot over a range of days, by day, movement, customer, line and type.
          </p>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportCsv} disabled={!r}>
            <Icon name="download" size={14} /> By day
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportCustomers} disabled={!r || r.customers.length === 0}>
            <Icon name="download" size={14} /> By customer
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => { report.reload(); eirs.reload(); }}>
            <Icon name="refreshCcw" size={14} /> Refresh
          </button>
        </div>
      </div>

      <ReportParams depots={depots} branchId={branchId} onBranch={setPicked}
                    from={range.from} to={range.to} onRange={(from, to) => setRange({ from, to })} />

      {report.error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{report.error.title}</div>
            {report.error.explanation && <div>{report.error.explanation}</div>}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="gecko-grid-5">
        <ReportKpi label="Moves" value={r?.total.moves.toLocaleString()} sub={r ? `${r.total.teu.toLocaleString()} TEU` : undefined} tone="primary" />
        <ReportKpi label="In" value={r?.total.in.toLocaleString()} sub={r ? `${r.total.fullIn} full · ${r.total.emptyIn} empty` : undefined} tone="info" />
        <ReportKpi label="Out" value={r?.total.out.toLocaleString()} sub={r ? `${r.total.fullOut} full · ${r.total.emptyOut} empty` : undefined} tone="success" />
        <ReportKpi label="Busiest day" value={r ? (busiest?.tally.moves ?? 0).toLocaleString() : undefined}
                   sub={busiest && busiest.tally.moves ? busiest.day : undefined} />
        <ReportKpi label="Voided EIRs" value={r?.voided.toLocaleString()} sub="not counted as moves" tone={r && r.voided ? 'warning' : 'neutral'} />
      </div>

      {r && (
        <>
          <div className="gecko-grid-2" style={{ alignItems: 'flex-start' }}>
            <ReportTable
              title="By day"
              head={[{ label: 'Day' }, { label: 'Full in', num: true }, { label: 'Empty in', num: true }, { label: 'Full out', num: true },
                     { label: 'Empty out', num: true }, { label: 'Moves', num: true }]}
              rows={r.days.map(d => [
                <span key="d" style={{ color: d.tally.moves ? undefined : 'var(--gecko-text-disabled)' }}>{d.day}</span>,
                d.tally.fullIn, d.tally.emptyIn, d.tally.fullOut, d.tally.emptyOut, <strong key="m">{d.tally.moves}</strong>,
              ])}
              foot={`Total ${r.total.moves.toLocaleString()} moves · ${r.total.teu.toLocaleString()} TEU`}
            />
            <div className="gecko-stack">
              <ReportTable
                title="By movement"
                head={[{ label: 'Movement' }, { label: 'Direction' }, { label: 'F/E' }, { label: 'Moves', num: true }, { label: 'TEU', num: true }]}
                rows={r.movements.map(m => [<span key="c" className="gecko-mono-strong">{m.movementCode}</span>, m.direction, m.fullEmpty, m.moves, m.teu])}
              />
              <ReportTable
                title="By type"
                head={[{ label: 'Type' }, { label: 'In', num: true }, { label: 'Out', num: true }, { label: 'Moves', num: true }]}
                rows={groupRows(r.types)}
              />
            </div>
          </div>

          <div className="gecko-grid-2" style={{ alignItems: 'flex-start' }}>
            <ReportTable
              title="By customer"
              head={[{ label: 'Customer' }, { label: 'In', num: true }, { label: 'Out', num: true }, { label: 'Moves', num: true }]}
              rows={groupRows(r.customers, TOP)}
              foot={more(r.customers, TOP)}
            />
            <ReportTable
              title="By line"
              head={[{ label: 'Line' }, { label: 'In', num: true }, { label: 'Out', num: true }, { label: 'Moves', num: true }]}
              rows={groupRows(r.lines, TOP)}
              foot={more(r.lines, TOP)}
            />
          </div>
        </>
      )}

      {r && r.migrated > 0 && (
        <div className="gecko-alert gecko-alert-info">
          <Icon name="info" size={18} />
          <div>
            <strong>{r.migrated.toLocaleString()} EIRs in this range came over from Vector</strong> — the gate-in of each box
            that was still in the yard when GECKO took over. They are listed below, but they are not counted as moves:
            Vector&apos;s other gate moves were not migrated, so counting these would show only part of the flow.
          </div>
        </div>
      )}

      {/* The EIRs behind the numbers */}
      <div className="gecko-row gecko-row-between">
        <div className="gecko-eyebrow">
          EIRs in the range · {eirs.total.toLocaleString()}
          {r && r.migrated > 0 ? ` · ${r.migrated.toLocaleString()} migrated from Vector` : ''}
        </div>
        <input className="gecko-input gecko-input-sm" value={eirs.search} placeholder="EIR, container, order or truck"
               onChange={e => eirs.setSearch(e.target.value)} style={{ width: 240 }} />
      </div>
      <div className="gecko-table-wrapper">
        <table className="gecko-table gecko-table-compact">
          <thead>
            <tr><th>EIR</th><th>Time</th><th>Container</th><th>Movement</th><th>F/E</th><th>Order</th><th>Line</th><th>Truck</th><th>Status</th></tr>
          </thead>
          <tbody>
            {!eirs.loading && (eirs.rows ?? []).length === 0 && (
              <tr><td colSpan={9} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 16 }}>No EIRs in this range.</td></tr>
            )}
            {(eirs.rows ?? []).map(e => (
              <tr key={e.gateTransactionId}>
                <td>
                  <Link href={`/gate/${e.direction === 'IN' ? 'eir-in' : 'eir-out'}/${e.gateTransactionId}`} className="gecko-mono-strong gecko-link">{e.eirNo}</Link>
                </td>
                <td>{formatDateTime(e.transactionAt)}</td>
                <td className="gecko-mono">{formatContainerNo(e.containerNo)}</td>
                <td className="gecko-mono">{e.movementCode}</td>
                <td>{e.fullEmpty}</td>
                <td className="gecko-mono">{e.orderNo}</td>
                <td className="gecko-mono">{e.lineCode}</td>
                <td className="gecko-mono">{e.truckPlate}</td>
                <td>
                  <span className={`gecko-badge ${e.status === 'VOIDED' ? 'gecko-badge-gray' : 'gecko-badge-success'}`}>{e.status === 'VOIDED' ? 'Voided' : 'Completed'}</span>
                  {e.isLate && <span className="gecko-badge gecko-badge-warning" style={{ marginLeft: 4 }}>Late</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {eirs.footer}
      </div>

      {/* Other live views of the depot */}
      <div className="gecko-row gecko-row-wrap" style={{ gap: 8 }}>
        <span className="gecko-cell-meta">Stock on hand:</span>
        <Link href="/gate/stock" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="clipboardList" size={13} /> Yard stock</Link>
        <Link href="/gate/yard-view" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="grid" size={13} /> Yard view</Link>
        <Link href="/units/equipment-pool" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="layers" size={13} /> Equipment pool</Link>
        <Link href="/gate/eir-in" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="arrowRight" size={13} /> EIR-in register</Link>
        <Link href="/gate/eir-out" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="arrowRight" size={13} /> EIR-out register</Link>
      </div>
    </div>
  );
}
