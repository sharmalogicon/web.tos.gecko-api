"use client";

import React from 'react';
import { presetRange } from '@/lib/api/reports';

export interface Depot { branchId: string; branchCode: string; displayName: string }

/**
 * Depot + a range of depot days, with quick ranges. A report is for ONE depot:
 * its days are that depot's.
 */
export function ReportParams({ depots, branchId, onBranch, from, to, onRange }: {
  depots: Depot[];
  branchId: string;
  onBranch: (branchId: string) => void;
  from: string;
  to: string;
  onRange: (from: string, to: string) => void;
}) {
  const presets = [
    ['today', 'Today'], ['yesterday', 'Yesterday'], ['thisMonth', 'This month'], ['lastMonth', 'Last month'],
  ] as const;
  const active = presets.find(([p]) => { const r = presetRange(p); return r.from === from && r.to === to; })?.[0];

  return (
    <div className="gecko-card" style={{ padding: 14 }}>
      <div className="gecko-row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="gecko-form-group">
          <label className="gecko-form-label">Depot</label>
          <select className="gecko-input gecko-input-sm" value={branchId} onChange={e => onBranch(e.target.value)} style={{ minWidth: 180 }}>
            {depots.length === 0 && <option value="">No depot</option>}
            {depots.map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
          </select>
        </div>
        <div className="gecko-form-group">
          <label className="gecko-form-label">From</label>
          <input type="date" className="gecko-input gecko-input-sm" value={from} max={to || undefined}
                 onChange={e => e.target.value && onRange(e.target.value, to)} />
        </div>
        <div className="gecko-form-group">
          <label className="gecko-form-label">To</label>
          <input type="date" className="gecko-input gecko-input-sm" value={to} min={from || undefined}
                 onChange={e => e.target.value && onRange(from, e.target.value)} />
        </div>
        <div className="gecko-segctrl">
          {presets.map(([p, label]) => (
            <button key={p} className={`gecko-segctrl-btn${active === p ? ' gecko-segctrl-btn-active' : ''}`}
                    onClick={() => { const r = presetRange(p); onRange(r.from, r.to); }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const TONE = {
  primary: 'var(--gecko-primary-700)', success: 'var(--gecko-success-700)', warning: 'var(--gecko-warning-700)',
  danger: 'var(--gecko-error-700)', info: 'var(--gecko-info-700)', neutral: 'var(--gecko-text-primary)',
} as const;

export function ReportKpi({ label, value, sub, tone = 'neutral' }: {
  label: string; value: string | undefined; sub?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}) {
  return (
    <div className="gecko-card gecko-card-tight">
      <div className="gecko-cell-meta">{label}</div>
      <div className="gecko-stat-num gecko-stat-num-sm gecko-mono" style={{ color: TONE[tone] }}>{value ?? '…'}</div>
      {sub && <div className="gecko-cell-meta">{sub}</div>}
    </div>
  );
}

/** A titled table card with an empty line when there are no rows. */
export function ReportTable({ title, head, rows, empty = 'Nothing in this range.', foot }: {
  title: string;
  head: { label: string; num?: boolean }[];
  rows: React.ReactNode[][];
  empty?: string;
  foot?: React.ReactNode;
}) {
  return (
    <section className="gecko-table-card">
      <div style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13 }}>{title}</div>
      <table className="gecko-table gecko-table-compact">
        <thead>
          <tr>{head.map(h => <th key={h.label} className={h.num ? 'gecko-num' : undefined}>{h.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={head.length} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 16 }}>{empty}</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={head[j]?.num ? 'gecko-num gecko-mono' : undefined}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {foot && <div className="gecko-cell-meta" style={{ padding: '8px 12px' }}>{foot}</div>}
    </section>
  );
}
