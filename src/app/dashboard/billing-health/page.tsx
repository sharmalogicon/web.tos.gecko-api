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

function Widget({ title, children, col, action }: { title: string; children: React.ReactNode; col?: number; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', gridColumn: col ? `span ${col}` : undefined, overflow: 'hidden' }}>
      <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{title}</span>{action}
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

const AGING_DAYS = ['0d', '1d', '2d', '3d', '4d', '5d', '6d', '7d', '8d', '9d', '10d', '11d', '12d'];
const AGING_COUNTS = [8, 11, 9, 7, 4, 3, 2, 1, 1, 0, 1, 0, 1];
const AGING_MAX = Math.max(...AGING_COUNTS);
const AGING_SVG_W = 520;
const AGING_SVG_H = 110;
const AGING_PAD_L = 8;
const AGING_PAD_R = 8;
const AGING_PAD_T = 22;
const AGING_PAD_B = 22;
const AGING_CHART_H = AGING_SVG_H - AGING_PAD_T - AGING_PAD_B;
const AGING_BAR_W = (AGING_SVG_W - AGING_PAD_L - AGING_PAD_R - (AGING_DAYS.length - 1) * 5) / AGING_DAYS.length;

function agingBarColor(i: number): string {
  if (i <= 2) return 'var(--gecko-success-600)';
  if (i <= 5) return '#f59e0b';
  if (i <= 7) return '#f97316';
  return 'var(--gecko-error-600)';
}

const AUTO_BILL_ROWS = [
  { code: 'STORAGE-L', total: 28, auto: 26, autoPct: 93,  manual: 2,  color: 'var(--gecko-success-600)' },
  { code: 'LIFT-ON',   total: 24, auto: 22, autoPct: 92,  manual: 2,  color: 'var(--gecko-success-600)' },
  { code: 'GATE-IN',   total: 18, auto: 18, autoPct: 100, manual: 0,  color: 'var(--gecko-success-600)' },
  { code: 'THC',       total: 12, auto: 8,  autoPct: 67,  manual: 4,  color: '#f59e0b' },
  { code: 'STUFFING',  total: 8,  auto: 4,  autoPct: 50,  manual: 4,  color: '#f97316' },
  { code: 'RDOC',      total: 6,  auto: 0,  autoPct: 0,   manual: 6,  color: 'var(--gecko-error-600)' },
];

const EXCEPTIONS = [
  { so: 'SO-2026-0882', type: 'Rate Not Found',     container: 'OOLU 551928-1', amount: '฿0',    charge: 'STORAGE-L' },
  { so: 'SO-2026-0876', type: 'Customer Not Found', container: 'MSKU 744218-3', amount: '฿0',    charge: 'LIFT-ON' },
  { so: 'SO-2026-0859', type: 'Tariff Expired',     container: 'TCKU 229341-2', amount: '฿850',  charge: 'THC' },
  { so: 'SO-2026-0841', type: 'Duplicate Charge',   container: 'CMAU 883212-0', amount: '฿280',  charge: 'GATE-IN' },
  { so: 'SO-2026-0833', type: 'Rate Not Found',     container: 'HLCU 412019-5', amount: '฿0',    charge: 'STORAGE-L' },
  { so: 'SO-2026-0821', type: 'Tariff Expired',     container: 'APZU 334810-1', amount: '฿1,200', charge: 'LIFT-ON' },
  { so: 'SO-2026-0814', type: 'Customer Not Found', container: 'MSDU 558301-7', amount: '฿0',    charge: 'GATE-IN' },
  { so: 'SO-2026-0801', type: 'Duplicate Charge',   container: 'GESU 774120-3', amount: '฿450',  charge: 'THC' },
];

function exceptionBadge(type: string): { bg: string; color: string } {
  if (type === 'Rate Not Found')     return { bg: 'var(--gecko-error-50)',   color: 'var(--gecko-error-600)' };
  if (type === 'Customer Not Found') return { bg: 'var(--gecko-warning-50)', color: '#f97316' };
  if (type === 'Tariff Expired')     return { bg: '#fefce8',                 color: '#ca8a04' };
  return { bg: 'var(--gecko-info-50)', color: 'var(--gecko-info-600)' };
}

const DTB_DATA = [3.1,2.8,3.2,2.9,2.6,2.4,2.8,3.0,2.7,2.5,2.3,2.6,2.9,2.7,2.4,2.2,2.5,2.8,2.6,2.3,2.1,2.4,2.7,2.5,2.2,2.0,2.3,2.6,2.4,2.3];
const DTB_W = 520;
const DTB_H = 110;
const DTB_PAD_L = 36;
const DTB_PAD_R = 12;
const DTB_PAD_T = 10;
const DTB_PAD_B = 22;
const DTB_CHART_W = DTB_W - DTB_PAD_L - DTB_PAD_R;
const DTB_CHART_H = DTB_H - DTB_PAD_T - DTB_PAD_B;
const DTB_MIN = 1.6;
const DTB_MAX_V = 3.4;
const DTB_RANGE = DTB_MAX_V - DTB_MIN;
const DTB_TARGET = 3.0;

function dtbX(i: number) { return DTB_PAD_L + (i / (DTB_DATA.length - 1)) * DTB_CHART_W; }
function dtbY(v: number) { return DTB_PAD_T + DTB_CHART_H - ((v - DTB_MIN) / DTB_RANGE) * DTB_CHART_H; }

const DTB_POINTS = DTB_DATA.map((v, i) => `${dtbX(i)},${dtbY(v)}`).join(' ');
const DTB_AREA = `M${dtbX(0)},${dtbY(DTB_DATA[0])} ` + DTB_DATA.map((v, i) => `L${dtbX(i)},${dtbY(v)}`).join(' ') + ` L${dtbX(DTB_DATA.length - 1)},${DTB_H - DTB_PAD_B} L${DTB_PAD_L},${DTB_H - DTB_PAD_B} Z`;
const DTB_TARGET_Y = dtbY(DTB_TARGET);

const UNBILLED_CUSTOMERS = [
  { name: 'Thai Union Group', sos: 14, amount: '฿28,400', color: '#6366f1' },
  { name: 'PTT Global',       sos: 8,  amount: '฿18,200', color: 'var(--gecko-primary-600)' },
  { name: 'CP Foods',         sos: 7,  amount: '฿14,800', color: 'var(--gecko-success-600)' },
  { name: 'Indorama',         sos: 6,  amount: '฿12,400', color: '#f59e0b' },
  { name: 'Betagro',          sos: 5,  amount: '฿8,400',  color: '#f97316' },
];

export default function BillingHealthPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', marginBottom: 4 }}>Billing Health Dashboard</h1>
        <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Service order billing pipeline, exceptions, auto-bill coverage, and time-to-bill</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <KpiCard label="Unbilled SOs"         value="47"        sub="฿85,640 pending billing"        accent="var(--gecko-warning-400)"  trend="down" />
        <KpiCard label="Avg Days to Bill"      value="2.3 days"  sub="Target: ≤ 3 days ✓"            accent="var(--gecko-success-400)" />
        <KpiCard label="Billing Exceptions"    value="8"         sub="Require manual review"          accent="var(--gecko-error-400)"    trend="down" />
        <KpiCard label="Auto-Bill Coverage"    value="78%"       sub="22% billed manually"            accent="var(--gecko-info-400)"     trend="up" />
        <KpiCard label="Oldest Unbilled"       value="12 days"   sub="SO-2026-0714 · CP Foods"        accent="var(--gecko-error-400)"    trend="down" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Widget title="Unbilled Service Orders — Aging" col={2}>
          <svg viewBox={`0 0 ${AGING_SVG_W} ${AGING_SVG_H}`} width="100%" style={{ display: 'block' }}>
            {AGING_COUNTS.map((cnt, i) => {
              if (cnt === 0) {
                return (
                  <g key={i}>
                    <text
                      x={AGING_PAD_L + i * (AGING_BAR_W + 5) + AGING_BAR_W / 2}
                      y={AGING_SVG_H - AGING_PAD_B + 14}
                      textAnchor="middle" fontSize={9} fill="var(--gecko-text-secondary)"
                    >{AGING_DAYS[i]}</text>
                  </g>
                );
              }
              const bh = (cnt / AGING_MAX) * AGING_CHART_H;
              const bx = AGING_PAD_L + i * (AGING_BAR_W + 5);
              const by = AGING_PAD_T + AGING_CHART_H - bh;
              return (
                <g key={i}>
                  <rect x={bx} y={by} width={AGING_BAR_W} height={bh} rx={3} fill={agingBarColor(i)} />
                  <text x={bx + AGING_BAR_W / 2} y={by - 4} textAnchor="middle" fontSize={10} fontWeight="700" fill="var(--gecko-text-primary)">{cnt}</text>
                  <text x={bx + AGING_BAR_W / 2} y={AGING_SVG_H - AGING_PAD_B + 14} textAnchor="middle" fontSize={9} fill="var(--gecko-text-secondary)">{AGING_DAYS[i]}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--gecko-text-secondary)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--gecko-success-600)', borderRadius: 2, display: 'inline-block' }} />0–2 days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2, display: 'inline-block' }} />3–5 days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#f97316', borderRadius: 2, display: 'inline-block' }} />6–7 days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--gecko-error-600)', borderRadius: 2, display: 'inline-block' }} />8+ days</span>
          </div>
        </Widget>

        <Widget title="Auto-Bill vs Manual">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {AUTO_BILL_ROWS.map((row) => (
              <div key={row.code}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{row.code}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ color: row.color, fontWeight: 700 }}>{row.autoPct}% auto</span>
                    <span style={{ color: 'var(--gecko-text-secondary)' }}>{row.manual} manual</span>
                    <span style={{ color: 'var(--gecko-text-disabled)' }}>/ {row.total}</span>
                  </div>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--gecko-bg-subtle)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', width: `${row.autoPct}%`, background: row.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </Widget>

        <Widget title="Billing Exceptions">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--gecko-bg-subtle)' }}>
                  {['SO Number', 'Exception', 'Container', 'Amount', 'Charge'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--gecko-text-secondary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--gecko-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXCEPTIONS.map((ex) => {
                  const badge = exceptionBadge(ex.type);
                  return (
                    <tr key={ex.so} style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{ex.so}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{ex.type}</span>
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{ex.container}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{ex.amount}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>{ex.charge}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Widget>

        <Widget title="Days to Bill Trend — Last 30 Days" col={2}>
          <svg viewBox={`0 0 ${DTB_W} ${DTB_H}`} width="100%" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="dtbFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gecko-primary-500)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--gecko-primary-500)" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {[2.0, 2.5, 3.0].map((tick) => {
              const ty = dtbY(tick);
              return (
                <g key={tick}>
                  <line x1={DTB_PAD_L} y1={ty} x2={DTB_W - DTB_PAD_R} y2={ty} stroke="var(--gecko-border)" strokeWidth={0.5} />
                  <text x={DTB_PAD_L - 4} y={ty + 3} textAnchor="end" fontSize={9} fill="var(--gecko-text-secondary)">{tick.toFixed(1)}</text>
                </g>
              );
            })}
            <line
              x1={DTB_PAD_L} y1={DTB_TARGET_Y}
              x2={DTB_W - DTB_PAD_R} y2={DTB_TARGET_Y}
              stroke="var(--gecko-error-600)" strokeWidth={1.2} strokeDasharray="5 3"
            />
            <text x={DTB_W - DTB_PAD_R - 2} y={DTB_TARGET_Y - 4} textAnchor="end" fontSize={9} fill="var(--gecko-error-600)" fontWeight="600">Target: 3 days</text>
            <path d={DTB_AREA} fill="url(#dtbFill)" />
            <polyline points={DTB_POINTS} stroke="var(--gecko-primary-500)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {DTB_DATA.map((v, i) => (
              <circle key={i} cx={dtbX(i)} cy={dtbY(v)} r={i === DTB_DATA.length - 1 ? 4 : 2} fill="var(--gecko-primary-500)" />
            ))}
            {[0, 7, 14, 21, 29].map((di, li) => {
              const lbls = ['Apr 5', 'Apr 12', 'Apr 19', 'Apr 26', 'May 4'];
              return (
                <text key={lbls[li]} x={dtbX(di)} y={DTB_H - 4} textAnchor="middle" fontSize={9} fill="var(--gecko-text-secondary)">{lbls[li]}</text>
              );
            })}
          </svg>
        </Widget>

        <Widget title="Top 5 Unbilled by Customer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {UNBILLED_CUSTOMERS.map((c) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--gecko-text-primary)' }}>{c.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-600)', fontFamily: 'var(--gecko-font-mono)' }}>{c.sos} SOs</span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', minWidth: 58, textAlign: 'right' }}>{c.amount}</span>
                <button style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--gecko-border)', background: 'transparent', color: 'var(--gecko-text-secondary)', cursor: 'pointer' }}>View</button>
              </div>
            ))}
          </div>
        </Widget>
      </div>
    </div>
  );
}
