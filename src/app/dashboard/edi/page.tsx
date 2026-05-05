"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';

function KpiCard({ label, value, sub, accent, trend }: { label: string; value: string; sub?: string; accent?: string; trend?: 'up' | 'down' | 'neutral' }) {
  return (
    <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '18px 20px', borderTop: `3px solid ${accent ?? 'var(--gecko-primary-400)'}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: trend === 'up' ? 'var(--gecko-success-600)' : trend === 'down' ? 'var(--gecko-error-600)' : 'var(--gecko-text-secondary)', marginTop: 6 }}>{sub}</div>}
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

const HOURLY_VALS = [12, 8, 5, 3, 2, 4, 28, 84, 142, 128, 96, 88, 102, 118, 96, 84, 72, 68, 54, 42, 32, 28, 18, 12];
const CURRENT_HOUR = 14;
const BAR_W = 16;
const BAR_GAP = 6;
const CHART_H = 90;
const MAX_V = Math.max(...HOURLY_VALS);

const PARTNERS = [
  { code: 'MSCU', name: 'MSC', status: 'Online', last: '2min ago', count: 284 },
  { code: 'MAEU', name: 'Maersk', status: 'Online', last: '5min ago', count: 212 },
  { code: 'OOLU', name: 'OOCL', status: 'Online', last: '3min ago', count: 198 },
  { code: 'EGLV', name: 'Evergreen', status: 'Online', last: '8min ago', count: 164 },
  { code: 'CMDU', name: 'CMA CGM', status: 'Online', last: '1min ago', count: 182 },
  { code: 'HLCU', name: 'Hapag-Lloyd', status: 'Offline', last: '2hr ago', count: 0 },
  { code: 'ONEY', name: 'ONE', status: 'Online', last: '12min ago', count: 142 },
  { code: 'YMLU', name: 'Yang Ming', status: 'Degraded', last: '18min ago', count: 48 },
  { code: 'ZIMU', name: 'ZIM', status: 'Online', last: '7min ago', count: 98 },
  { code: 'CSAV', name: 'COSCO', status: 'Online', last: '4min ago', count: 124 },
  { code: 'PCIU', name: 'PIL', status: 'Offline', last: '45min ago', count: 0 },
  { code: 'SITC', name: 'SITC Int.', status: 'Online', last: '22min ago', count: 72 },
  { code: 'KMTC', name: 'KMTC', status: 'Online', last: '31min ago', count: 56 },
  { code: 'WHLC', name: 'Wan Hai', status: 'Online', last: '15min ago', count: 44 },
];

const MSG_TYPES = [
  { code: 'COPARN', name: 'Container Pre-advice', count: 842 },
  { code: 'COARRI', name: 'Container Arrival/Departure', count: 486 },
  { code: 'CODECO', name: 'Container Delivered/Received', count: 312 },
  { code: 'CUSCAR', name: 'Customs Cargo Report', count: 84 },
  { code: 'IFTMIN', name: 'Instruction for Transport', count: 68 },
  { code: 'BAPLIE', name: 'Bay Plan', count: 32 },
  { code: 'VERMAS', name: 'VGM/Weight Declaration', count: 23 },
];

const ERROR_LOG = [
  { time: '14:22', partner: 'HLCU', type: 'COPARN', error: 'Connection refused', status: 'Retry' },
  { time: '13:48', partner: 'YMLU', type: 'COARRI', error: 'Invalid container ref', status: 'Failed' },
  { time: '13:12', partner: 'HLCU', type: 'CODECO', error: 'Connection refused', status: 'Retry' },
  { time: '12:58', partner: 'PCIU', type: 'COPARN', error: 'Auth timeout', status: 'Failed' },
  { time: '12:34', partner: 'YMLU', type: 'VERMAS', error: 'Invalid weight format', status: 'Failed' },
  { time: '12:11', partner: 'HLCU', type: 'BAPLIE', error: 'Connection refused', status: 'Retry' },
  { time: '11:44', partner: 'PCIU', type: 'COARRI', error: 'Auth timeout', status: 'Resolved' },
  { time: '11:22', partner: 'YMLU', type: 'COPARN', error: 'Timeout', status: 'Resolved' },
  { time: '10:58', partner: 'HLCU', type: 'CODECO', error: 'Connection refused', status: 'Resolved' },
  { time: '10:31', partner: 'PCIU', type: 'CUSCAR', error: 'Invalid container ref', status: 'Resolved' },
];

function statusDot(status: string) {
  if (status === 'Online') return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--gecko-success-600)', marginRight: 5 }} />;
  if (status === 'Offline') return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--gecko-error-600)', marginRight: 5 }} />;
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--gecko-warning-600)', marginRight: 5 }} />;
}

function errorColor(error: string) {
  if (error.toLowerCase().includes('connection') || error.toLowerCase().includes('auth')) return 'var(--gecko-error-600)';
  if (error.toLowerCase().includes('invalid') || error.toLowerCase().includes('timeout')) return 'var(--gecko-warning-600)';
  return 'var(--gecko-text-secondary)';
}

function statusBadge(status: string) {
  if (status === 'Retry') return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-600)' }}>RETRY</span>;
  if (status === 'Failed') return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-error-100)', color: 'var(--gecko-error-600)' }}>FAILED</span>;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-600)' }}>RESOLVED</span>;
}

export default function EdiDashboard() {
  const maxMsgCount = MSG_TYPES[0].count;

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--gecko-bg-subtle)' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gecko-text-primary)', margin: 0 }}>EDI &amp; Partner Dashboard</h1>
        <p style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4, marginBottom: 0 }}>Message volume, partner connectivity, error rates, and processing health</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Messages Today" value="1,847" sub="↑ 12% vs yesterday" accent="var(--gecko-primary-400)" trend="up" />
        <KpiCard label="Error Rate" value="0.8%" sub="14 failed messages" accent="var(--gecko-success-400)" />
        <KpiCard label="Partners Online" value="12 / 14" sub="HAPAG, PIL offline" accent="var(--gecko-warning-400)" trend="down" />
        <KpiCard label="Avg Processing" value="340 ms" sub="Target: < 500ms ✓" accent="var(--gecko-success-400)" />
        <KpiCard label="Pending ACK" value="23" sub="Awaiting acknowledgement" accent="var(--gecko-info-400)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Widget title="Message Volume — Last 24 Hours" col={2}>
          <svg viewBox="0 0 560 110" width="100%" style={{ display: 'block', overflow: 'visible' }}>
            {HOURLY_VALS.map((v, i) => {
              const barH = Math.max(4, (v / MAX_V) * CHART_H);
              const x = i * (BAR_W + BAR_GAP);
              const y = CHART_H - barH + 8;
              const isOff = i <= 5 || i >= 20;
              const isCurrent = i === CURRENT_HOUR;
              const color = isCurrent ? 'var(--gecko-primary-700)' : isOff ? 'var(--gecko-primary-200)' : 'var(--gecko-primary-400)';
              return <rect key={i} x={x} y={y} width={BAR_W} height={barH} rx={3} fill={color} />;
            })}
            {[0, 4, 8, 12, 16, 20].map((h) => {
              const x = h * (BAR_W + BAR_GAP) + BAR_W / 2;
              return <text key={h} x={x} y={108} textAnchor="middle" fontSize={9} fill="var(--gecko-text-secondary)">{String(h).padStart(2, '0')}</text>;
            })}
          </svg>
        </Widget>

        <Widget title="Partner Health Status">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PARTNERS.map((p) => {
              const bg = p.status === 'Offline' ? 'var(--gecko-error-50)' : p.status === 'Degraded' ? 'var(--gecko-warning-50)' : 'var(--gecko-bg-subtle)';
              return (
                <div key={p.code} style={{ background: bg, border: '1px solid var(--gecko-border)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{p.code}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{p.count > 0 ? p.count : '—'}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginBottom: 3 }}>{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 10, color: 'var(--gecko-text-secondary)' }}>
                    {statusDot(p.status)}
                    <span style={{ fontWeight: 600 }}>{p.status}</span>
                    <span style={{ marginLeft: 'auto' }}>{p.last}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Widget>

        <Widget title="Message Types Breakdown" col={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MSG_TYPES.map((m) => {
              const pct = Math.round((m.count / maxMsgCount) * 100);
              return (
                <div key={m.code}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)', marginRight: 8 }}>{m.code}</span>
                      <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{m.name}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{m.count}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: 'var(--gecko-primary-400)', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Widget>

        <Widget title="Recent Error Log">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                  {['Time', 'Partner', 'Type', 'Error', 'Status'].map((h) => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ERROR_LOG.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.time}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{row.partner}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.type}</td>
                    <td style={{ padding: '6px 8px', color: errorColor(row.error), fontWeight: 500, whiteSpace: 'nowrap' }}>{row.error}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{statusBadge(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Widget>
      </div>
    </div>
  );
}
