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

const DAILY_DATA = [8200,9100,7800,10200,11400,9800,12100,10800,13200,11900,12800,14100,11200,12400,13800,10900,11800,12200,14400,13100,12800,11400,15200,13800,14100,12900,13400,14800,13200,12800];
const AVG_VAL = Math.round(DAILY_DATA.reduce((a, b) => a + b, 0) / DAILY_DATA.length);
const MAX_VAL = Math.max(...DAILY_DATA);
const SVG_W = 580;
const SVG_H = 110;
const BAR_W = 12;
const BAR_GAP = 6;
const CHART_PAD_B = 20;
const CHART_PAD_T = 8;
const CHART_H = SVG_H - CHART_PAD_B - CHART_PAD_T;

const AT_RISK_ROWS = [
  { ctr: 'MSKU 744218-3', customer: 'Thai Union', size: '20GP', used: 12, free: 14, left: 2, rate: '฿280/day', exposure: '฿3,360' },
  { ctr: 'OOLU 551928-1', customer: 'PTT Global', size: '40HC', used: 11, free: 14, left: 3, rate: '฿420/day', exposure: '฿4,620' },
  { ctr: 'CMAU 883212-0', customer: 'CP Foods', size: '20GP', used: 10, free: 14, left: 4, rate: '฿280/day', exposure: '฿2,800' },
  { ctr: 'HLCU 291044-5', customer: 'Bangchak Corp', size: '40GP', used: 9,  free: 14, left: 5, rate: '฿350/day', exposure: '฿3,150' },
  { ctr: 'TCKU 618833-7', customer: 'Siam Cement', size: '40HC', used: 8,  free: 14, left: 6, rate: '฿420/day', exposure: '฿2,520' },
  { ctr: 'GESU 402917-2', customer: 'Thai Union', size: '20GP', used: 7,  free: 14, left: 7, rate: '฿280/day', exposure: '฿1,960' },
  { ctr: 'APZU 774122-6', customer: 'PTT Global', size: '40HC', used: 6,  free: 14, left: 8, rate: '฿420/day', exposure: '฿3,360' },
  { ctr: 'MSDU 339018-4', customer: 'CP Foods', size: '20GP', used: 5,  free: 14, left: 9, rate: '฿280/day', exposure: '฿2,520' },
];

const TOP_CUSTOMERS = [
  { name: 'Thai Union Group',    amount: 84200 },
  { name: 'PTT Global Chemical', amount: 62800 },
  { name: 'CP Foods Co.',        amount: 48400 },
  { name: 'Bangchak Corp',       amount: 36100 },
  { name: 'Siam Cement',         amount: 29200 },
];
const MAX_CUSTOMER = TOP_CUSTOMERS[0].amount;

const STATUS_BREAKDOWN = [
  { label: 'In Free Time (unused)', count: 142, pct: 60, color: 'var(--gecko-success-600)', bg: 'var(--gecko-success-50)' },
  { label: 'Charged (accruing)',    count: 89,  pct: 37, color: 'var(--gecko-warning-600)', bg: 'var(--gecko-warning-50)' },
  { label: 'Approaching Limit (< 2d)', count: 23, pct: 10, color: 'var(--gecko-error-600)', bg: 'var(--gecko-error-50)' },
];

function daysBadge(left: number) {
  if (left <= 2) return { bg: 'var(--gecko-error-50)', color: 'var(--gecko-error-600)', border: '1px solid var(--gecko-error-600)' };
  if (left <= 5) return { bg: 'var(--gecko-warning-50)', color: 'var(--gecko-warning-600)', border: '1px solid var(--gecko-warning-600)' };
  return { bg: 'var(--gecko-success-50)', color: 'var(--gecko-success-600)', border: '1px solid var(--gecko-success-600)' };
}

function barColor(i: number, total: number) {
  if (i === total - 1) return 'var(--gecko-primary-700)';
  if (i >= total - 7) return 'var(--gecko-primary-500)';
  return 'var(--gecko-text-disabled)';
}

export default function DDAccrualPage() {
  const avgY = CHART_PAD_T + CHART_H - (AVG_VAL / MAX_VAL) * CHART_H;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>D&D Accrual Dashboard</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-600)', border: '1px solid var(--gecko-success-600)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gecko-success-500)', display: 'inline-block' }} />
            Live
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Live detention &amp; demurrage accrual, at-risk containers, and revenue capture</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <KpiCard label="Total D&D (MTD)"    value="฿284,500" sub="↑ 18% vs last month"      accent="var(--gecko-primary-400)" trend="up" />
        <KpiCard label="Daily Accrual Rate" value="฿12,800"  sub="Per day at current rate"   accent="var(--gecko-info-400)" />
        <KpiCard label="In Free Time"       value="142 ctrs" sub="No charge yet"              accent="var(--gecko-success-400)" />
        <KpiCard label="At-Risk (< 2 days)" value="23 ctrs"  sub="Free time expiring soon"   accent="var(--gecko-warning-400)" trend="down" />
        <KpiCard label="Uncaptured Revenue" value="฿48,200"  sub="Not yet invoiced"           accent="var(--gecko-error-400)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Widget title="Daily D&D Accrual — Last 30 Days" col={2}>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
            <line x1={0} y1={avgY} x2={SVG_W} y2={avgY} stroke="var(--gecko-text-disabled)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={SVG_W - 2} y={avgY - 4} textAnchor="end" fontSize={9} fill="var(--gecko-text-secondary)">avg ฿{AVG_VAL.toLocaleString()}</text>
            {DAILY_DATA.map((v, i) => {
              const bh = (v / MAX_VAL) * CHART_H;
              const bx = i * (BAR_W + BAR_GAP);
              const by = CHART_PAD_T + CHART_H - bh;
              return (
                <rect
                  key={i}
                  x={bx}
                  y={by}
                  width={BAR_W}
                  height={bh}
                  rx={2}
                  fill={barColor(i, DAILY_DATA.length)}
                />
              );
            })}
            {(['May 1', 'May 7', 'May 14', 'May 21', 'May 5'] as const).map((label, li) => {
              const idxMap = [0, 6, 13, 20, 29];
              const ix = idxMap[li] * (BAR_W + BAR_GAP) + BAR_W / 2;
              return (
                <text key={label} x={ix} y={SVG_H - 4} textAnchor="middle" fontSize={9} fill="var(--gecko-text-secondary)">{label}</text>
              );
            })}
          </svg>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--gecko-text-disabled)', borderRadius: 2, display: 'inline-block' }} />Past days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--gecko-primary-500)', borderRadius: 2, display: 'inline-block' }} />Recent week</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--gecko-primary-700)', borderRadius: 2, display: 'inline-block' }} />Today</span>
          </div>
        </Widget>

        <Widget title="By Customer — Top 5 Exposure">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {TOP_CUSTOMERS.map((c) => {
              const pct = (c.amount / MAX_CUSTOMER) * 100;
              return (
                <div key={c.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gecko-text-primary)' }}>{c.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>฿{c.amount.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gecko-primary-500)', borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Widget>

        <Widget title="At-Risk Containers — Free Time Expiring" col={2}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--gecko-bg-subtle)' }}>
                  {['Container', 'Customer', 'Size', 'Days Used', 'Free Time', 'Days Left', 'Daily Rate', 'Exposure'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--gecko-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--gecko-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AT_RISK_ROWS.map((row) => {
                  const badge = daysBadge(row.left);
                  const rowBg = row.left <= 2 ? 'var(--gecko-error-50)' : undefined;
                  return (
                    <tr key={row.ctr} style={{ background: rowBg, borderBottom: '1px solid var(--gecko-border)' }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>{row.ctr}</td>
                      <td style={{ padding: '9px 12px' }}>{row.customer}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', color: 'var(--gecko-text-secondary)' }}>{row.size}</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', fontFamily: 'var(--gecko-font-mono)' }}>{row.used}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', fontFamily: 'var(--gecko-font-mono)' }}>{row.free}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, ...badge }}>{row.left}d</span>
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: 'var(--gecko-font-mono)' }}>{row.rate}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-error-600)' }}>{row.exposure}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Widget>

        <Widget title="Free Time Status Breakdown">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {STATUS_BREAKDOWN.map((s) => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: s.color }}>{s.count} ctrs</span>
                </div>
                <div style={{ height: 14, borderRadius: 6, background: 'var(--gecko-bg-subtle)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 6, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 600, color: s.color }}>{s.pct}%</span>
                  of total container inventory
                </div>
              </div>
            ))}
            <div style={{ marginTop: 4, padding: '10px 14px', borderRadius: 8, background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)', marginBottom: 4 }}>TOTAL TRACKED</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>254 ctrs</div>
            </div>
          </div>
        </Widget>
      </div>
    </div>
  );
}
