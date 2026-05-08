"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ExportButton } from '@/components/ui/ExportButton';

function KpiCard({ label, value, sub, accent, trend }: { label: string; value: string; sub?: string; accent?: string; trend?: 'up' | 'down' | 'neutral' }) {
  return (
    <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '18px 20px', borderTop: `3px solid ${accent ?? 'var(--gecko-primary-400)'}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: trend === 'up' ? 'var(--gecko-success-600)' : trend === 'down' ? 'var(--gecko-error-600)' : 'var(--gecko-text-secondary)' }}>{sub}</div>}
    </div>
  );
}

function Widget({ title, children, col }: { title: string; children: React.ReactNode; col?: number }) {
  return (
    <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', gridColumn: col ? `span ${col}` : undefined, overflow: 'hidden' }}>
      <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{title}</div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

const HOURLY_DATA = [0, 0, 0, 0, 0, 0, 18, 24, 28, 22, 14, 12, 16, 19, 21, 18, 15, 10, 8, 4, 0, 0, 0, 0];
const CURRENT_HOUR = 14;
const BAR_W = 18;
const BAR_GAP = 5;
const CHART_H = 100;
const MAX_VAL = Math.max(...HOURLY_DATA);

const LANES = [
  { id: 1, status: 'Active', queue: '3 trucks', last: 'BKKO-4829 · 2min ago' },
  { id: 2, status: 'Active', queue: '1 truck', last: 'BKKO-3311 · 5min ago' },
  { id: 3, status: 'Active', queue: '0 trucks', last: 'BKKO-5521 · 12min ago' },
  { id: 4, status: 'Active', queue: '5 trucks', last: 'BKKO-1102 · 1min ago' },
  { id: 5, status: 'Closed', queue: '—', last: '—' },
  { id: 6, status: 'Closed', queue: '—', last: '—' },
];

const COMPLIANCE_HOURS = [
  { hour: '07:00', pct: 92 },
  { hour: '08:00', pct: 84 },
  { hour: '09:00', pct: 78 },
  { hour: '10:00', pct: 91 },
  { hour: '11:00', pct: 95 },
  { hour: '12:00', pct: 88 },
];

const QUEUE_TRUCKS = [
  { n: 1, plate: 'GBB-8821', driver: 'Somchai P.', haulier: 'Siam Haulage', container: 'MSKU 744218-3', status: 'FULL IN', appt: '14:30', wait: '8 min' },
  { n: 2, plate: 'KNK-4419', driver: 'Prasit W.', haulier: 'Thai Truck', container: 'OOLU 551928-1', status: 'FULL IN', appt: '14:45', wait: '4 min' },
  { n: 3, plate: 'BSK-3312', driver: 'Wichit S.', haulier: 'A1 Transport', container: '—', status: 'EMPTY IN', appt: '15:00', wait: '1 min' },
  { n: 4, plate: 'GBK-9902', driver: 'Somsak T.', haulier: 'Laem Chabang Log.', container: 'CMAU 883212-0', status: 'FULL OUT', appt: '15:00', wait: '0 min' },
  { n: 5, plate: 'KNB-7781', driver: 'Niran K.', haulier: 'Siam Haulage', container: '—', status: 'EMPTY OUT', appt: '15:15', wait: '—' },
  { n: 6, plate: 'BKK-2241', driver: 'Surin W.', haulier: 'Thai Truck', container: 'MSCU 221099-7', status: 'FULL IN', appt: '15:15', wait: '—' },
  { n: 7, plate: 'PKN-8832', driver: 'Taworn C.', haulier: 'Fast Cargo', container: '—', status: 'EMPTY IN', appt: '15:30', wait: '—' },
  { n: 8, plate: 'NKP-5519', driver: 'Vuthi P.', haulier: 'A1 Transport', container: 'TCNU 441820-3', status: 'FULL OUT', appt: '15:30', wait: '—' },
  { n: 9, plate: 'CNX-3301', driver: 'Anont S.', haulier: 'Laem Chabang Log.', container: '—', status: 'EMPTY OUT', appt: '15:45', wait: '—' },
  { n: 10, plate: 'LPH-9920', driver: 'Krit M.', haulier: 'Siam Haulage', container: 'HLCU 774412-9', status: 'FULL IN', appt: '15:45', wait: '—' },
];

function statusBadgeStyle(status: string) {
  if (status === 'FULL IN') return { background: 'var(--gecko-info-50)', color: 'var(--gecko-info-600)', border: '1px solid var(--gecko-info-600)' };
  if (status === 'FULL OUT') return { background: 'var(--gecko-success-50)', color: 'var(--gecko-success-600)', border: '1px solid var(--gecko-success-600)' };
  return { background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', border: '1px solid var(--gecko-border)' };
}

function complianceBarColor(pct: number) {
  if (pct >= 90) return 'var(--gecko-success-600)';
  if (pct >= 75) return 'var(--gecko-warning-600)';
  return 'var(--gecko-error-600)';
}

export default function GateTrafficDashboardPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      <nav className="gecko-breadcrumb">
        <span className="gecko-breadcrumb-item">Masters</span>
        <span className="gecko-breadcrumb-sep">/</span>
        <span className="gecko-breadcrumb-item">Dashboard</span>
        <span className="gecko-breadcrumb-sep">/</span>
        <span className="gecko-breadcrumb-current">Gate &amp; Traffic</span>
      </nav>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--gecko-text-primary)' }}>Gate &amp; Traffic Dashboard</h1>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>Real-time gate throughput, truck queue, and lane performance</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="refresh" size={14} />Refresh</button>
          <ExportButton resource="Gate traffic" variant="primary" iconSize={14} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <KpiCard label="Trucks In Today" value="124" sub="↑ 12% vs yesterday" accent="var(--gecko-primary-400)" trend="up" />
        <KpiCard label="Avg Turn Time" value="18 min" sub="Target: 20 min ✓" accent="var(--gecko-success-400)" trend="neutral" />
        <KpiCard label="Gate Throughput" value="14 / hr" sub="Peak hour: 08:00–09:00" accent="var(--gecko-info-400)" />
        <KpiCard label="Appt. Compliance" value="87%" sub="↓ 3% vs last week" accent="var(--gecko-warning-400)" trend="down" />
        <KpiCard label="Lanes Active" value="4 / 6" sub="Lanes 5 & 6 closed" accent="var(--gecko-error-400)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Widget title="Hourly Gate Throughput" col={2}>
          <svg viewBox="0 0 560 120" width="100%" style={{ display: 'block', overflow: 'visible' }}>
            {HOURLY_DATA.map((val, hour) => {
              const barH = val > 0 ? (val / MAX_VAL) * 80 : 0;
              const x = hour * (BAR_W + BAR_GAP) + 2;
              const y = CHART_H - barH;
              const isCurrent = hour === CURRENT_HOUR;
              return (
                <g key={hour}>
                  {val > 0 && (
                    <rect
                      x={x}
                      y={y}
                      width={BAR_W}
                      height={barH}
                      rx={3}
                      fill={isCurrent ? 'var(--gecko-primary-600)' : 'var(--gecko-primary-400)'}
                      opacity={val === 0 ? 0.2 : 1}
                    />
                  )}
                  {val === 0 && (
                    <rect x={x} y={CHART_H - 2} width={BAR_W} height={2} rx={1} fill="var(--gecko-border)" />
                  )}
                  {[6, 9, 12, 15, 18].includes(hour) && (
                    <text x={x + BAR_W / 2} y={CHART_H + 14} textAnchor="middle" fontSize={9} fill="var(--gecko-text-secondary)">{String(hour).padStart(2, '0')}</text>
                  )}
                </g>
              );
            })}
            <line x1={2} y1={CHART_H} x2={558} y2={CHART_H} stroke="var(--gecko-border)" strokeWidth={1} />
          </svg>
        </Widget>

        <Widget title="Live Lane Status">
          <table className="gecko-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>Lane</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>Queue</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>Last Truck</th>
              </tr>
            </thead>
            <tbody>
              {LANES.map(lane => (
                <tr key={lane.id} style={{ opacity: lane.status === 'Closed' ? 0.5 : 1, borderBottom: '1px solid var(--gecko-border)' }}>
                  <td style={{ padding: '7px 8px', fontWeight: 700, fontFamily: 'var(--gecko-font-mono)' }}>L{lane.id}</td>
                  <td style={{ padding: '7px 8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10 }}>{lane.status === 'Active' ? '🟢' : '🔴'}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: lane.status === 'Active' ? 'var(--gecko-success-600)' : 'var(--gecko-error-600)' }}>{lane.status}</span>
                    </span>
                  </td>
                  <td style={{ padding: '7px 8px', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{lane.queue}</td>
                  <td style={{ padding: '7px 8px', fontSize: 10, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)' }}>{lane.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Widget>

        <Widget title="Appointment Compliance by Hour">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {COMPLIANCE_HOURS.map(row => (
              <div key={row.hour} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 36px', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', textAlign: 'right' }}>{row.hour}</span>
                <div style={{ height: 14, background: 'var(--gecko-bg-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: complianceBarColor(row.pct), borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: complianceBarColor(row.pct), textAlign: 'right' }}>{row.pct}%</span>
              </div>
            ))}
          </div>
        </Widget>

        <Widget title="Gate Queue — Next 10 Trucks" col={2}>
          <div style={{ overflowX: 'auto' }}>
            <table className="gecko-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['#', 'Plate No.', 'Driver', 'Haulier', 'Container', 'Status', 'Appt. Time', 'Wait'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--gecko-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {QUEUE_TRUCKS.map(row => (
                  <tr key={row.n} style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>{row.n}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 12 }}>{row.plate}</td>
                    <td style={{ padding: '8px 10px', fontSize: 12 }}>{row.driver}</td>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{row.haulier}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--gecko-font-mono)', fontSize: 11 }}>{row.container}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span className="gecko-badge gecko-badge-sm" style={{ ...statusBadgeStyle(row.status), fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>{row.status}</span>
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--gecko-font-mono)', fontSize: 11 }}>{row.appt}</td>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{row.wait}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Widget>

        <Widget title="Turn Time Distribution">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { range: '< 10 min', count: 8, pct: 15, color: 'var(--gecko-success-600)' },
              { range: '10–15 min', count: 22, pct: 41, color: 'var(--gecko-success-600)' },
              { range: '15–20 min', count: 16, pct: 30, color: 'var(--gecko-warning-600)' },
              { range: '20–30 min', count: 6, pct: 11, color: 'var(--gecko-warning-600)' },
              { range: '> 30 min', count: 2, pct: 4, color: 'var(--gecko-error-600)' },
            ].map(r => (
              <div key={r.range} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 28px', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{r.range}</span>
                <div style={{ height: 12, background: 'var(--gecko-bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textAlign: 'right' }}>{r.count}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--gecko-border)', fontSize: 11, color: 'var(--gecko-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Avg turn time today</span>
              <span style={{ fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>18 min</span>
            </div>
          </div>
        </Widget>
      </div>
    </div>
  );
}
