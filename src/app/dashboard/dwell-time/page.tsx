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

const HIST_BUCKETS = ['0-1d', '1-2d', '2-3d', '3-5d', '5-7d', '7-10d', '10-14d', '14+d'];
const HIST_COUNTS  = [42, 68, 84, 112, 74, 38, 24, 12];
const HIST_COLORS  = [
  'var(--gecko-success-600)', 'var(--gecko-success-600)', 'var(--gecko-success-600)',
  'var(--gecko-success-600)', 'var(--gecko-success-600)',
  '#f59e0b',
  '#f97316',
  'var(--gecko-error-600)',
];
const HIST_SVG_W = 480;
const HIST_SVG_H = 130;
const HIST_PAD_B  = 22;
const HIST_PAD_T  = 18;
const HIST_PAD_L  = 8;
const HIST_PAD_R  = 8;
const HIST_CHART_H = HIST_SVG_H - HIST_PAD_B - HIST_PAD_T;
const HIST_MAX    = Math.max(...HIST_COUNTS);
const HIST_BAR_W  = (HIST_SVG_W - HIST_PAD_L - HIST_PAD_R - (HIST_BUCKETS.length - 1) * 6) / HIST_BUCKETS.length;

const DWELL_TREND = [4.8,4.6,5.1,4.9,4.7,4.4,4.2,4.5,4.8,4.6,4.3,4.1,4.4,4.7,4.5,4.2,4.0,4.3,4.6,4.4,4.1,3.9,4.2,4.5,4.3,4.0,3.8,4.1,4.4,4.2];
const TREND_W = 460;
const TREND_H = 110;
const TREND_PAD_L = 32;
const TREND_PAD_R = 8;
const TREND_PAD_T = 10;
const TREND_PAD_B = 22;
const TREND_CHART_W = TREND_W - TREND_PAD_L - TREND_PAD_R;
const TREND_CHART_H = TREND_H - TREND_PAD_T - TREND_PAD_B;
const TREND_MIN = Math.min(...DWELL_TREND) - 0.2;
const TREND_MAX_V = Math.max(...DWELL_TREND) + 0.2;
const TREND_RANGE = TREND_MAX_V - TREND_MIN;
const TARGET_LINE = 5.0;

function trendX(i: number) { return TREND_PAD_L + (i / (DWELL_TREND.length - 1)) * TREND_CHART_W; }
function trendY(v: number) { return TREND_PAD_T + TREND_CHART_H - ((v - TREND_MIN) / TREND_RANGE) * TREND_CHART_H; }

const TREND_POINTS = DWELL_TREND.map((v, i) => `${trendX(i)},${trendY(v)}`).join(' ');
const TREND_AREA   = `M${trendX(0)},${trendY(DWELL_TREND[0])} ` + DWELL_TREND.map((v, i) => `L${trendX(i)},${trendY(v)}`).join(' ') + ` L${trendX(DWELL_TREND.length - 1)},${TREND_H - TREND_PAD_B} L${TREND_PAD_L},${TREND_H - TREND_PAD_B} Z`;
const TARGET_Y     = trendY(TARGET_LINE);

const CUSTOMERS_DWELL = [
  { name: 'Thai Union Group',    days: 5.8, over: true,  near: false },
  { name: 'PTT Global Chem',     days: 4.1, over: false, near: false },
  { name: 'CP Foods',            days: 3.8, over: false, near: false },
  { name: 'Betagro Public',      days: 3.2, over: false, near: false },
  { name: 'Indorama Ventures',   days: 6.4, over: true,  near: false },
  { name: 'Charoen Pokphand',    days: 4.9, over: false, near: true  },
  { name: 'Bangchak Corp',       days: 3.5, over: false, near: false },
];
const MAX_DAYS = Math.max(...CUSTOMERS_DWELL.map(c => c.days));

function dwellBarColor(c: { over: boolean; near: boolean }) {
  if (c.over) return 'var(--gecko-error-600)';
  if (c.near) return '#f59e0b';
  return 'var(--gecko-success-600)';
}

const LONG_DWELL = [
  { ctr: 'CMAU 293810-1', customer: 'Thai Union Group',  size: '40HC', gateIn: 'Apr 16', dwell: 18, line: 'MSK', holds: ['CUSTOMS'],         status: 'On Hold' },
  { ctr: 'OOLU 881240-7', customer: 'Indorama Ventures', size: '20GP', gateIn: 'Apr 20', dwell: 14, line: 'OOL', holds: ['BANK HOLD'],        status: 'On Hold' },
  { ctr: 'TCKU 551029-3', customer: 'Thai Union Group',  size: '40GP', gateIn: 'Apr 20', dwell: 14, line: 'EGL', holds: [],                   status: 'Pending' },
  { ctr: 'HLCU 734819-0', customer: 'Indorama Ventures', size: '40HC', gateIn: 'Apr 23', dwell: 11, line: 'HLC', holds: ['CARRIER'],          status: 'On Hold' },
  { ctr: 'MSKU 619024-5', customer: 'CP Foods',          size: '20GP', gateIn: 'Apr 24', dwell: 10, line: 'MSK', holds: [],                   status: 'Pending' },
  { ctr: 'GESU 448129-1', customer: 'Charoen Pokphand',  size: '40HC', gateIn: 'Apr 24', dwell: 10, line: 'CMA', holds: ['CUSTOMS'],          status: 'On Hold' },
  { ctr: 'APZU 337512-8', customer: 'PTT Global Chem',   size: '20GP', gateIn: 'Apr 25', dwell:  9, line: 'OOL', holds: [],                   status: 'Pending' },
  { ctr: 'MSDU 902314-6', customer: 'Bangchak Corp',     size: '40GP', gateIn: 'Apr 26', dwell:  8, line: 'MSK', holds: ['BANK HOLD'],        status: 'On Hold' },
  { ctr: 'CSNU 781020-4', customer: 'Thai Union Group',  size: '20GP', gateIn: 'Apr 26', dwell:  8, line: 'COS', holds: [],                   status: 'Pending' },
  { ctr: 'TEXU 651834-2', customer: 'Betagro Public',    size: '40HC', gateIn: 'Apr 27', dwell:  7, line: 'EGL', holds: ['CARRIER'],          status: 'On Hold' },
  { ctr: 'KKFU 229018-9', customer: 'CP Foods',          size: '20GP', gateIn: 'Apr 27', dwell:  7, line: 'MSK', holds: [],                   status: 'Available' },
  { ctr: 'YMLU 484921-3', customer: 'Indorama Ventures', size: '40HC', gateIn: 'Apr 28', dwell:  6, line: 'YML', holds: [],                   status: 'Available' },
  { ctr: 'FCIU 310819-7', customer: 'PTT Global Chem',   size: '20GP', gateIn: 'Apr 28', dwell:  6, line: 'OOL', holds: ['CUSTOMS'],          status: 'On Hold' },
  { ctr: 'SEGU 771024-1', customer: 'Charoen Pokphand',  size: '40GP', gateIn: 'Apr 29', dwell:  5, line: 'CMA', holds: [],                   status: 'Available' },
  { ctr: 'HLCU 503817-5', customer: 'Bangchak Corp',     size: '40HC', gateIn: 'Apr 29', dwell:  5, line: 'HLC', holds: [],                   status: 'Available' },
  { ctr: 'OOLU 661234-8', customer: 'Thai Union Group',  size: '20GP', gateIn: 'Apr 30', dwell:  4, line: 'OOL', holds: [],                   status: 'Available' },
  { ctr: 'MSKU 819034-2', customer: 'Betagro Public',    size: '40GP', gateIn: 'Apr 30', dwell:  4, line: 'MSK', holds: [],                   status: 'Available' },
  { ctr: 'APZU 556120-6', customer: 'CP Foods',          size: '20GP', gateIn: 'May 1',  dwell:  3, line: 'COS', holds: ['BANK HOLD'],        status: 'On Hold' },
  { ctr: 'TCKU 233019-4', customer: 'PTT Global Chem',   size: '40HC', gateIn: 'May 1',  dwell:  3, line: 'EGL', holds: [],                   status: 'Available' },
  { ctr: 'CMAU 441201-9', customer: 'Charoen Pokphand',  size: '20GP', gateIn: 'May 2',  dwell:  2, line: 'MSK', holds: [],                   status: 'Available' },
];

function holdBadge(hold: string) {
  if (hold === 'CUSTOMS')   return { bg: 'var(--gecko-error-50)',   color: 'var(--gecko-error-600)',   border: '1px solid var(--gecko-error-600)' };
  if (hold === 'BANK HOLD') return { bg: 'var(--gecko-warning-50)', color: 'var(--gecko-warning-600)', border: '1px solid var(--gecko-warning-600)' };
  if (hold === 'CARRIER')   return { bg: 'var(--gecko-info-50)',    color: 'var(--gecko-info-600)',    border: '1px solid var(--gecko-info-600)' };
  return {};
}

function rowBg(dwell: number) {
  if (dwell >= 14) return 'var(--gecko-error-50)';
  if (dwell >= 7)  return 'var(--gecko-warning-50)';
  return undefined;
}

function statusBadge(status: string) {
  if (status === 'On Hold')  return { bg: 'var(--gecko-error-50)',   color: 'var(--gecko-error-600)'   };
  if (status === 'Pending')  return { bg: 'var(--gecko-warning-50)', color: 'var(--gecko-warning-600)' };
  return { bg: 'var(--gecko-success-50)', color: 'var(--gecko-success-600)' };
}

const SIZE_STATS = [
  { label: "20' GP", avg: 3.9, units: 238 },
  { label: "40' GP", avg: 4.5, units: 186 },
  { label: "40' HC", avg: 4.8, units: 142 },
  { label: "20' RF", avg: 3.2, units: 28  },
  { label: "40' RF", avg: 3.6, units: 44  },
];

export default function DwellTimePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Container Dwell Time Dashboard</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-600)', border: '1px solid var(--gecko-success-600)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gecko-success-500)', display: 'inline-block' }} />
            Live
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Average container dwell, long-stay alerts, and dwell trends by customer and line</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <KpiCard label="Avg Dwell (All)"      value="4.2 days"    sub="Target: ≤ 5 days ✓"              accent="var(--gecko-success-400)" />
        <KpiCard label="Containers > 7 Days"  value="34"          sub="Requires attention"               accent="var(--gecko-warning-400)" />
        <KpiCard label="Containers > 14 Days" value="12"          sub="Escalation required"              accent="var(--gecko-error-400)" />
        <KpiCard label="Longest Dwell"        value="18 days"     sub="CMAU 293810-1 · C-00142"          accent="var(--gecko-error-400)" trend="down" />
        <KpiCard label="Dwell Improving"      value="↓ 0.4 days"  sub="vs last month avg"                accent="var(--gecko-success-400)" trend="up" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Widget title="Dwell Distribution — All Containers" col={2}>
          <svg viewBox={`0 0 ${HIST_SVG_W} ${HIST_SVG_H}`} width="100%" style={{ display: 'block' }}>
            {HIST_COUNTS.map((cnt, i) => {
              const bh = (cnt / HIST_MAX) * HIST_CHART_H;
              const bx = HIST_PAD_L + i * (HIST_BAR_W + 6);
              const by = HIST_PAD_T + HIST_CHART_H - bh;
              return (
                <g key={i}>
                  <rect x={bx} y={by} width={HIST_BAR_W} height={bh} rx={3} fill={HIST_COLORS[i]} />
                  <text x={bx + HIST_BAR_W / 2} y={by - 4} textAnchor="middle" fontSize={10} fontWeight="700" fill="var(--gecko-text-primary)">{cnt}</text>
                  <text x={bx + HIST_BAR_W / 2} y={HIST_SVG_H - 4} textAnchor="middle" fontSize={9} fill="var(--gecko-text-secondary)">{HIST_BUCKETS[i]}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--gecko-text-secondary)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--gecko-success-600)', borderRadius: 2, display: 'inline-block' }} />0–5 days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2, display: 'inline-block' }} />5–10 days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#f97316', borderRadius: 2, display: 'inline-block' }} />10–14 days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--gecko-error-600)', borderRadius: 2, display: 'inline-block' }} />14+ days</span>
          </div>
        </Widget>

        <Widget title="Dwell by Customer — Avg Days">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {CUSTOMERS_DWELL.map((c) => {
              const pct = (c.days / MAX_DAYS) * 100;
              const color = dwellBarColor(c);
              return (
                <div key={c.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gecko-text-primary)' }}>{c.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color }}>{c.days}d</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--gecko-bg-subtle)', overflow: 'visible', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
                    <div style={{ position: 'absolute', top: -1, left: `${(5.0 / MAX_DAYS) * 100}%`, height: 10, width: 2, background: 'var(--gecko-error-600)', borderRadius: 1 }} title="Target: 5 days" />
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 10, height: 2, background: 'var(--gecko-error-600)', borderRadius: 1 }} />
              Target line: 5 days
            </div>
          </div>
        </Widget>

        <Widget title="Long-Dwell Alert List — Top 20" col={3}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--gecko-bg-subtle)' }}>
                  {['Container', 'Customer', 'Size', 'Gate-In', 'Dwell (days)', 'Line', 'Holds', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--gecko-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--gecko-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LONG_DWELL.map((row) => {
                  const st = statusBadge(row.status);
                  return (
                    <tr key={row.ctr} style={{ background: rowBg(row.dwell), borderBottom: '1px solid var(--gecko-border)' }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>{row.ctr}</td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{row.customer}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', color: 'var(--gecko-text-secondary)' }}>{row.size}</span>
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{row.gateIn}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 800, color: row.dwell >= 14 ? 'var(--gecko-error-600)' : row.dwell >= 7 ? 'var(--gecko-warning-600)' : 'var(--gecko-text-primary)' }}>{row.dwell}</span>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600 }}>{row.line}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {row.holds.length === 0
                            ? <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>—</span>
                            : row.holds.map(h => {
                                const hb = holdBadge(h);
                                return (
                                  <span key={h} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', ...hb }}>{h}</span>
                                );
                              })
                          }
                        </div>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...st }}>{row.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Widget>

        <Widget title="30-Day Dwell Trend" col={2}>
          <svg viewBox={`0 0 ${TREND_W} ${TREND_H}`} width="100%" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gecko-primary-500)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--gecko-primary-500)" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {[3.8, 4.0, 4.5, 5.0, 5.1].map(tick => {
              const ty = trendY(tick);
              return (
                <g key={tick}>
                  <line x1={TREND_PAD_L} y1={ty} x2={TREND_W - TREND_PAD_R} y2={ty} stroke="var(--gecko-border)" strokeWidth={0.5} />
                  <text x={TREND_PAD_L - 4} y={ty + 3} textAnchor="end" fontSize={9} fill="var(--gecko-text-secondary)">{tick.toFixed(1)}</text>
                </g>
              );
            })}
            <line x1={TREND_PAD_L} y1={TARGET_Y} x2={TREND_W - TREND_PAD_R} y2={TARGET_Y} stroke="var(--gecko-error-600)" strokeWidth={1.2} strokeDasharray="5 3" />
            <text x={TREND_W - TREND_PAD_R - 2} y={TARGET_Y - 4} textAnchor="end" fontSize={9} fill="var(--gecko-error-600)" fontWeight="600">Target 5.0</text>
            <path d={TREND_AREA} fill="url(#trendFill)" />
            <polyline points={TREND_POINTS} stroke="var(--gecko-primary-500)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {DWELL_TREND.map((v, i) => (
              <circle key={i} cx={trendX(i)} cy={trendY(v)} r={i === DWELL_TREND.length - 1 ? 4 : 2.5} fill="var(--gecko-primary-500)" />
            ))}
            {[0, 6, 13, 20, 29].map((di, li) => {
              const labels = ['Apr 5', 'Apr 11', 'Apr 18', 'Apr 25', 'May 4'];
              return (
                <text key={labels[li]} x={trendX(di)} y={TREND_H - 4} textAnchor="middle" fontSize={9} fill="var(--gecko-text-secondary)">{labels[li]}</text>
              );
            })}
          </svg>
        </Widget>

        <Widget title="Dwell by Container Size">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {SIZE_STATS.map((s) => {
              const color = s.avg > 5 ? 'var(--gecko-error-600)' : s.avg >= 4.5 ? '#f59e0b' : 'var(--gecko-success-600)';
              const barPct = (s.avg / 7) * 100;
              return (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)', whiteSpace: 'nowrap', minWidth: 50, textAlign: 'center' }}>{s.label}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color }}>{s.avg}d avg</span>
                      <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{s.units} units</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, background: color, borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Widget>
      </div>
    </div>
  );
}
