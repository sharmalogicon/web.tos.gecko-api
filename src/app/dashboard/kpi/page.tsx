"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

function KpiCard({ label, value, sub, accent, trend }: { label: string; value: string; sub?: string; accent?: string; trend?: 'up'|'down'|'neutral' }) {
  return (
    <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: '18px 20px', borderTop: `3px solid ${accent ?? 'var(--gecko-primary-400)'}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: trend==='up' ? 'var(--gecko-success-600)' : trend==='down' ? 'var(--gecko-error-600)' : 'var(--gecko-text-secondary)', marginTop: 6 }}>{sub}</div>}
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

const MONTHS = ['Jun\'25','Jul\'25','Aug\'25','Sep\'25','Oct\'25','Nov\'25','Dec\'25','Jan\'26','Feb\'26','Mar\'26','Apr\'26','May\'26'];
const ACTUALS  = [3120,3480,3240,3820,4080,3640,3920,4180,3760,4120,4480,4284];
const TARGETS  = [3600,3600,3600,3800,3800,3800,3960,3960,3960,3960,3960,3960];

const TEU_SVG_W = 560;
const TEU_SVG_H = 130;
const TEU_PAD_T = 18;
const TEU_PAD_B = 24;
const TEU_PAD_L = 36;
const TEU_PAD_R = 8;
const TEU_CHART_H = TEU_SVG_H - TEU_PAD_T - TEU_PAD_B;
const TEU_CHART_W = TEU_SVG_W - TEU_PAD_L - TEU_PAD_R;
const TEU_MAX = Math.max(...ACTUALS, ...TARGETS) * 1.05;
const TEU_GAP = 5;
const TEU_BAR_W = (TEU_CHART_W - (MONTHS.length - 1) * TEU_GAP) / MONTHS.length;

function teuBarX(i: number) { return TEU_PAD_L + i * (TEU_BAR_W + TEU_GAP); }
function teuY(v: number) { return TEU_PAD_T + TEU_CHART_H - (v / TEU_MAX) * TEU_CHART_H; }

const KPI_SCORECARD = [
  { kpi: 'Throughput (TEU/month)', actual: '4,284',  target: '3,960',  status: 'on'    },
  { kpi: 'Avg Dwell Time (days)',  actual: '4.2',     target: '≤5.0',   status: 'on'    },
  { kpi: 'Gate Process Time (min)',actual: '18',      target: '≤20',    status: 'on'    },
  { kpi: 'Appt Compliance (%)',    actual: '87%',     target: '≥90%',   status: 'watch' },
  { kpi: 'D&D Capture Rate',       actual: '96.4%',   target: '≥95%',   status: 'on'    },
  { kpi: 'Billing Cycle (days)',   actual: '2.3',     target: '≤3.0',   status: 'on'    },
  { kpi: 'Equip Utilization (%)',  actual: '84%',     target: '≥85%',   status: 'watch' },
  { kpi: 'Reefer Alarm Rate (%)',  actual: '6.25%',   target: '≤5%',    status: 'breach'},
  { kpi: 'EDI Error Rate (%)',     actual: '0.8%',    target: '≤1%',    status: 'on'    },
  { kpi: 'Customs Release (days)', actual: '2.4',     target: '≤3.0',   status: 'on'    },
];

function scorecardBadge(status: string) {
  if (status === 'on')     return { bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-600)',  label: 'ON TRACK' };
  if (status === 'watch')  return { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-600)', label: 'WATCH'    };
  return { bg: 'var(--gecko-error-50)', color: 'var(--gecko-error-600)', label: 'BREACH' };
}

type EquipStatus = 'ACTIVE' | 'IDLE' | 'MAINTENANCE' | 'BREAKDOWN';
const EQUIPMENT: { id: string; type: string; status: EquipStatus; hours: number; util: number; service: string }[] = [
  { id: 'RS-01', type: 'Reach Stacker',  status: 'ACTIVE',      hours: 312, util: 89, service: 'Mar 15' },
  { id: 'RS-02', type: 'Reach Stacker',  status: 'ACTIVE',      hours: 298, util: 85, service: 'Mar 20' },
  { id: 'RS-03', type: 'Reach Stacker',  status: 'BREAKDOWN',   hours: 0,   util: 0,  service: 'Apr 28' },
  { id: 'RS-04', type: 'Reach Stacker',  status: 'ACTIVE',      hours: 320, util: 91, service: 'Feb 12' },
  { id: 'RS-05', type: 'Reach Stacker',  status: 'ACTIVE',      hours: 285, util: 81, service: 'Apr 10' },
  { id: 'RS-06', type: 'Reach Stacker',  status: 'IDLE',        hours: 120, util: 34, service: 'Apr 01' },
  { id: 'RS-07', type: 'Reach Stacker',  status: 'ACTIVE',      hours: 305, util: 87, service: 'Mar 28' },
  { id: 'RS-08', type: 'Reach Stacker',  status: 'ACTIVE',      hours: 290, util: 83, service: 'Apr 05' },
  { id: 'FL-01', type: 'Forklift',       status: 'ACTIVE',      hours: 268, util: 76, service: 'Apr 14' },
  { id: 'FL-02', type: 'Forklift',       status: 'BREAKDOWN',   hours: 0,   util: 0,  service: 'May 02' },
  { id: 'FL-03', type: 'Forklift',       status: 'ACTIVE',      hours: 275, util: 78, service: 'Mar 22' },
  { id: 'FL-04', type: 'Forklift',       status: 'ACTIVE',      hours: 260, util: 74, service: 'Apr 18' },
  { id: 'TL-01', type: 'Top Loader',     status: 'ACTIVE',      hours: 332, util: 95, service: 'Feb 28' },
  { id: 'TL-02', type: 'Top Loader',     status: 'MAINTENANCE', hours: 0,   util: 0,  service: 'May 04' },
  { id: 'TL-03', type: 'Top Loader',     status: 'ACTIVE',      hours: 310, util: 88, service: 'Mar 10' },
  { id: 'YT-01', type: 'Yard Tractor',   status: 'ACTIVE',      hours: 340, util: 97, service: 'Feb 20' },
  { id: 'YT-02', type: 'Yard Tractor',   status: 'ACTIVE',      hours: 318, util: 91, service: 'Mar 05' },
  { id: 'RTG-01',type: 'RTG',            status: 'ACTIVE',      hours: 350, util: 93, service: 'Jan 30' },
  { id: 'RTG-02',type: 'RTG',            status: 'IDLE',        hours: 88,  util: 25, service: 'Apr 22' },
];

function equipStatusStyle(s: EquipStatus) {
  if (s === 'ACTIVE')      return { bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-600)'  };
  if (s === 'IDLE')        return { bg: 'var(--gecko-bg-subtle)',   color: 'var(--gecko-text-secondary)' };
  if (s === 'MAINTENANCE') return { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-600)'  };
  return { bg: 'var(--gecko-error-50)', color: 'var(--gecko-error-600)' };
}

const THROUGHPUT_OPS = [
  { label: 'Import Full In',   teu: 1284, pct: 30.0,  color: 'var(--gecko-primary-600)' },
  { label: 'Export Full Out',  teu: 1142, pct: 26.7,  color: 'var(--gecko-info-600)'    },
  { label: 'Transshipment',    teu: 892,  pct: 20.8,  color: '#7c3aed'                  },
  { label: 'Empty In',         teu: 524,  pct: 12.2,  color: 'var(--gecko-success-600)' },
  { label: 'Empty Out',        teu: 442,  pct: 10.3,  color: '#f59e0b'                  },
];

const YARD_BLOCKS = [
  { id: 'A', pct: 94 },
  { id: 'B', pct: 88 },
  { id: 'C', pct: 72 },
  { id: 'D', pct: 65 },
  { id: 'E', pct: 84 },
  { id: 'F', pct: 45 },
  { id: 'G', pct: 78 },
  { id: 'H', pct: 58 },
];

function blockColor(pct: number) {
  if (pct > 95) return { bg: 'var(--gecko-error-600)',   text: '#fff' };
  if (pct > 85) return { bg: '#f97316',                  text: '#fff' };
  if (pct > 70) return { bg: '#f59e0b',                  text: '#fff' };
  return { bg: 'var(--gecko-success-600)', text: '#fff' };
}

type Period = 'today' | 'week' | 'month';

export default function KpiDashboardPage() {
  const [period, setPeriod] = useState<Period>('month');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', marginBottom: 4 }}>Productivity & KPI Dashboard</h1>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Terminal-wide KPIs, throughput trends, equipment utilization, and performance scorecards</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 8, padding: 3 }}>
          {(['today','week','month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 14px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: period === p ? 'var(--gecko-bg-surface)' : 'transparent',
                color: period === p ? 'var(--gecko-primary-600)' : 'var(--gecko-text-secondary)',
                boxShadow: period === p ? 'var(--gecko-shadow-sm)' : 'none',
                textTransform: 'capitalize',
              }}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <KpiCard label="Monthly Throughput"  value="4,284 TEU" sub="108% of target (3,960)"      accent="var(--gecko-success-400)" trend="up" />
        <KpiCard label="Equip. Utilization"  value="84%"       sub="16 of 19 units active"        accent="var(--gecko-primary-400)" />
        <KpiCard label="Gate Process Time"   value="18 min"    sub="↓ 2 min vs last month"        accent="var(--gecko-success-400)" trend="up" />
        <KpiCard label="Yard Occupancy"      value="72%"       sub="1,840 of 2,560 slots"         accent="var(--gecko-warning-400)" />
        <KpiCard label="Breakdowns (MTD)"    value="6"         sub="Avg 0.2 per day"              accent="var(--gecko-error-400)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <Widget title="Monthly TEU Throughput — Last 12 Months" col={2}>
          <svg viewBox={`0 0 ${TEU_SVG_W} ${TEU_SVG_H}`} width="100%" style={{ display: 'block' }}>
            {[1000,2000,3000,4000].map(tick => {
              const ty = teuY(tick);
              return (
                <g key={tick}>
                  <line x1={TEU_PAD_L} y1={ty} x2={TEU_SVG_W - TEU_PAD_R} y2={ty} stroke="var(--gecko-border)" strokeWidth={0.5} />
                  <text x={TEU_PAD_L - 4} y={ty + 3} textAnchor="end" fontSize={9} fill="var(--gecko-text-secondary)">{tick >= 1000 ? `${tick/1000}k` : tick}</text>
                </g>
              );
            })}
            {ACTUALS.map((val, i) => {
              const isLast = i === ACTUALS.length - 1;
              const aboveTarget = val >= TARGETS[i];
              const barColor = aboveTarget
                ? (isLast ? '#16a34a' : 'var(--gecko-success-600)')
                : (isLast ? '#dc2626' : 'var(--gecko-error-600)');
              const bx = teuBarX(i);
              const by = teuY(val);
              const bh = TEU_PAD_T + TEU_CHART_H - by;
              const targetY = teuY(TARGETS[i]);
              return (
                <g key={i}>
                  <rect x={bx} y={by} width={TEU_BAR_W} height={bh} rx={2} fill={barColor} opacity={isLast ? 1 : 0.75} />
                  <line x1={bx} y1={targetY} x2={bx + TEU_BAR_W} y2={targetY} stroke="var(--gecko-error-600)" strokeWidth={1.5} strokeDasharray="2 2" />
                  <text x={bx + TEU_BAR_W / 2} y={TEU_SVG_H - 6} textAnchor="middle" fontSize={8} fill="var(--gecko-text-secondary)">{MONTHS[i]}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--gecko-success-600)', borderRadius: 2, display: 'inline-block' }} />Above target</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--gecko-error-600)', borderRadius: 2, display: 'inline-block' }} />Below target</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 2, background: 'var(--gecko-error-600)', display: 'inline-block', borderTop: '2px dashed var(--gecko-error-600)' }} />Target line</span>
          </div>
        </Widget>

        <Widget title="KPI Scorecard">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--gecko-bg-subtle)' }}>
                {['KPI','Actual','Target','Status'].map(h => (
                  <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--gecko-text-secondary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--gecko-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KPI_SCORECARD.map((row) => {
                const badge = scorecardBadge(row.status);
                return (
                  <tr key={row.kpi} style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                    <td style={{ padding: '7px 8px', fontSize: 11, color: 'var(--gecko-text-primary)' }}>{row.kpi}</td>
                    <td style={{ padding: '7px 8px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 11 }}>{row.actual}</td>
                    <td style={{ padding: '7px 8px', fontSize: 11, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>{row.target}</td>
                    <td style={{ padding: '7px 8px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: badge.bg, color: badge.color }}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Widget>

        <Widget title="Equipment Utilization & Status" col={2}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--gecko-bg-subtle)' }}>
                  {['Unit ID','Type','Status','Hours (MTD)','Utilization %','Last Service'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--gecko-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--gecko-border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EQUIPMENT.map((eq) => {
                  const ss = equipStatusStyle(eq.status);
                  const utilColor = eq.util >= 85 ? 'var(--gecko-success-600)' : eq.util >= 50 ? 'var(--gecko-warning-600)' : eq.util === 0 ? 'var(--gecko-error-600)' : 'var(--gecko-text-secondary)';
                  return (
                    <tr key={eq.id} style={{ borderBottom: '1px solid var(--gecko-border)', background: eq.status === 'BREAKDOWN' ? 'var(--gecko-error-50)' : eq.status === 'MAINTENANCE' ? 'var(--gecko-warning-50)' : undefined }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{eq.id}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--gecko-text-secondary)' }}>{eq.type}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: ss.bg, color: ss.color }}>{eq.status}</span>
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'var(--gecko-font-mono)' }}>{eq.hours > 0 ? eq.hours : '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--gecko-bg-subtle)', overflow: 'hidden', minWidth: 60 }}>
                            <div style={{ height: '100%', width: `${eq.util}%`, background: utilColor, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: utilColor, minWidth: 32 }}>{eq.util}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>{eq.service}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Widget>

        <Widget title="Throughput by Operation Type (MTD)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {THROUGHPUT_OPS.map((op) => (
              <div key={op.label}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gecko-text-primary)' }}>{op.label}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{op.teu.toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>TEU</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', color: op.color, fontWeight: 600 }}>{op.pct}%</span>
                  </div>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${op.pct}%`, background: op.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--gecko-text-secondary)' }}>Total MTD</span>
              <span style={{ fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>4,284 TEU</span>
            </div>
          </div>
        </Widget>

        <Widget title="Yard Block Occupancy" col={2}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {YARD_BLOCKS.map((blk) => {
              const bc = blockColor(blk.pct);
              return (
                <div
                  key={blk.id}
                  style={{
                    background: bc.bg,
                    borderRadius: 10,
                    padding: '20px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, color: bc.text, lineHeight: 1 }}>Block {blk.id}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--gecko-font-mono)', color: bc.text, lineHeight: 1 }}>{blk.pct}%</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, background: 'var(--gecko-success-600)', borderRadius: 3, display: 'inline-block' }} />&lt;70% Available</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: 3, display: 'inline-block' }} />70–85% Busy</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, background: '#f97316', borderRadius: 3, display: 'inline-block' }} />85–95% Near Full</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, background: 'var(--gecko-error-600)', borderRadius: 3, display: 'inline-block' }} />&gt;95% Critical</span>
          </div>
        </Widget>
      </div>
    </div>
  );
}
