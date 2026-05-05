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

const REV_MONTHS = ['Jun 25', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan 26', 'Feb', 'Mar', 'Apr', 'May'];
const REV_VALUES = [820, 940, 880, 1050, 1120, 980, 1080, 1180, 1020, 1150, 1240, 1285];
const REV_AVG = Math.round(REV_VALUES.reduce((a, b) => a + b, 0) / REV_VALUES.length);
const REV_MAX = Math.max(...REV_VALUES);
const REV_SVG_W = 560;
const REV_SVG_H = 130;
const REV_PAD_L = 8;
const REV_PAD_R = 8;
const REV_PAD_T = 22;
const REV_PAD_B = 22;
const REV_CHART_H = REV_SVG_H - REV_PAD_T - REV_PAD_B;
const REV_BAR_W = (REV_SVG_W - REV_PAD_L - REV_PAD_R - (REV_MONTHS.length - 1) * 5) / REV_MONTHS.length;

function revBarX(i: number) { return REV_PAD_L + i * (REV_BAR_W + 5); }
function revBarH(v: number) { return (v / REV_MAX) * REV_CHART_H; }
function revBarY(v: number) { return REV_PAD_T + REV_CHART_H - revBarH(v); }
const REV_AVG_Y = REV_PAD_T + REV_CHART_H - (REV_AVG / REV_MAX) * REV_CHART_H;

const AR_BUCKETS = [
  { label: 'Current (< 30d)', amount: 214200, pct: 50.3, color: 'var(--gecko-success-600)' },
  { label: '30–60 days',       amount: 112400, pct: 26.4, color: '#f59e0b' },
  { label: '61–90 days',       amount:  72800, pct: 17.1, color: '#f97316' },
  { label: '90+ days',         amount:  26400, pct:  6.2, color: 'var(--gecko-error-600)' },
];

const TOP_CUSTOMERS = [
  { name: 'Thai Union Group',    rev: 284200 },
  { name: 'PTT Global Chemical', rev: 198400 },
  { name: 'Indorama Ventures',   rev: 164800 },
  { name: 'Siam Cement (SCG)',   rev: 142100 },
  { name: 'CP Foods',            rev: 118600 },
  { name: 'Bangchak Corp',       rev:  98200 },
  { name: 'AIS (Advanced Info)', rev:  84400 },
  { name: 'Betagro Public',      rev:  72800 },
  { name: 'Charoen Pokphand',    rev:  68200 },
  { name: 'Central Retail',      rev:  52800 },
];
const CUST_MAX = TOP_CUSTOMERS[0].rev;
const CUST_TOTAL = TOP_CUSTOMERS.reduce((a, c) => a + c.rev, 0);

const INV_STATUSES = [
  { label: 'Draft',             count: 6,  pct: 12.5, amount: '฿42,800',  bg: 'var(--gecko-bg-subtle)',    color: 'var(--gecko-text-secondary)', border: 'var(--gecko-border)' },
  { label: 'Sent / Pending',    count: 18, pct: 37.5, amount: '฿284,400', bg: 'var(--gecko-info-50)',      color: 'var(--gecko-info-600)',        border: 'var(--gecko-info-200)' },
  { label: 'Partially Paid',    count: 4,  pct: 8.3,  amount: '฿98,100',  bg: 'var(--gecko-warning-50)',   color: 'var(--gecko-warning-600)',     border: 'var(--gecko-warning-200)' },
  { label: 'Paid / Cleared',    count: 16, pct: 33.3, amount: '฿802,400', bg: 'var(--gecko-success-50)',   color: 'var(--gecko-success-600)',     border: 'var(--gecko-success-200)' },
  { label: 'Overdue',           count: 4,  pct: 8.3,  amount: '฿56,800',  bg: 'var(--gecko-error-50)',     color: 'var(--gecko-error-600)',       border: 'var(--gecko-error-200)' },
];

const INVOICED = [980, 1080, 1020, 1150, 1240, 1285];
const COLLECTED = [922, 1018, 968, 1098, 1168, 1210];
const PT_MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
const PT_W = 480;
const PT_H = 110;
const PT_PAD_L = 36;
const PT_PAD_R = 8;
const PT_PAD_T = 10;
const PT_PAD_B = 28;
const PT_CHART_W = PT_W - PT_PAD_L - PT_PAD_R;
const PT_CHART_H = PT_H - PT_PAD_T - PT_PAD_B;
const PT_ALL = [...INVOICED, ...COLLECTED];
const PT_MIN = Math.min(...PT_ALL) - 30;
const PT_MAX = Math.max(...PT_ALL) + 30;
const PT_RANGE = PT_MAX - PT_MIN;

function ptX(i: number) { return PT_PAD_L + (i / (INVOICED.length - 1)) * PT_CHART_W; }
function ptY(v: number) { return PT_PAD_T + PT_CHART_H - ((v - PT_MIN) / PT_RANGE) * PT_CHART_H; }

const INV_POINTS = INVOICED.map((v, i) => `${ptX(i)},${ptY(v)}`).join(' ');
const COL_POINTS = COLLECTED.map((v, i) => `${ptX(i)},${ptY(v)}`).join(' ');
const INV_AREA = `M${ptX(0)},${ptY(INVOICED[0])} ` + INVOICED.map((v, i) => `L${ptX(i)},${ptY(v)}`).join(' ') + ` L${ptX(INVOICED.length - 1)},${PT_H - PT_PAD_B} L${PT_PAD_L},${PT_H - PT_PAD_B} Z`;
const COL_AREA = `M${ptX(0)},${ptY(COLLECTED[0])} ` + COLLECTED.map((v, i) => `L${ptX(i)},${ptY(v)}`).join(' ') + ` L${ptX(COLLECTED.length - 1)},${PT_H - PT_PAD_B} L${PT_PAD_L},${PT_H - PT_PAD_B} Z`;

export default function AccountsRevenuePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', marginBottom: 4 }}>Accounts &amp; Revenue Dashboard</h1>
        <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Monthly revenue, accounts receivable aging, and top customer billing performance</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <KpiCard label="Revenue (MTD)"       value="฿1,284,500" sub="↑ 8.4% vs last month"      accent="var(--gecko-primary-400)"  trend="up" />
        <KpiCard label="Outstanding AR"      value="฿425,800"   sub="Across 28 customers"        accent="var(--gecko-warning-400)" />
        <KpiCard label="Overdue 30+ Days"    value="฿128,400"   sub="Needs follow-up"            accent="var(--gecko-error-400)"   trend="down" />
        <KpiCard label="Invoices Sent (MTD)" value="48"         sub="Avg ฿26,760 per invoice"    accent="var(--gecko-info-400)" />
        <KpiCard label="Collection Rate"     value="94.2%"      sub="↑ 1.8% vs last month"       accent="var(--gecko-success-400)" trend="up" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Widget title="Monthly Revenue — Last 12 Months" col={2}>
          <svg viewBox={`0 0 ${REV_SVG_W} ${REV_SVG_H}`} width="100%" style={{ display: 'block' }}>
            <line
              x1={REV_PAD_L} y1={REV_AVG_Y}
              x2={REV_SVG_W - REV_PAD_R} y2={REV_AVG_Y}
              stroke="var(--gecko-text-disabled)" strokeWidth={1} strokeDasharray="4 3"
            />
            <text x={REV_SVG_W - REV_PAD_R - 2} y={REV_AVG_Y - 3} textAnchor="end" fontSize={9} fill="var(--gecko-text-disabled)">avg ฿{REV_AVG}k</text>
            {REV_VALUES.map((v, i) => {
              const bh = revBarH(v);
              const bx = revBarX(i);
              const by = revBarY(v);
              const isCurrent = i === REV_VALUES.length - 1;
              const isHighVal = v >= 1150;
              const fill = isCurrent ? 'var(--gecko-primary-600)' : 'var(--gecko-primary-300)';
              return (
                <g key={i}>
                  <rect x={bx} y={by} width={REV_BAR_W} height={bh} rx={3} fill={fill} />
                  {(isHighVal || isCurrent) && (
                    <text x={bx + REV_BAR_W / 2} y={by - 4} textAnchor="middle" fontSize={9} fontWeight="700" fill="var(--gecko-text-primary)">{v}</text>
                  )}
                  <text x={bx + REV_BAR_W / 2} y={REV_SVG_H - 4} textAnchor="middle" fontSize={9} fill={isCurrent ? 'var(--gecko-primary-600)' : 'var(--gecko-text-secondary)'} fontWeight={isCurrent ? '700' : '400'}>{REV_MONTHS[i]}</text>
                </g>
              );
            })}
          </svg>
        </Widget>

        <Widget title="AR Aging Breakdown">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {AR_BUCKETS.map((b) => (
              <div key={b.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gecko-text-primary)' }}>{b.label}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: b.color }}>฿{b.amount.toLocaleString()}</span>
                    <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>{b.pct}%</span>
                  </div>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${b.pct * 2}%`, background: b.color, borderRadius: 5 }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>Total AR</span>
              <span style={{ fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>฿425,800</span>
            </div>
          </div>
        </Widget>

        <Widget title="Top 10 Customers by Revenue (MTD)" col={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TOP_CUSTOMERS.map((c, i) => {
              const barPct = (c.rev / CUST_MAX) * 100;
              const totalPct = ((c.rev / CUST_TOTAL) * 100).toFixed(1);
              return (
                <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '20px 160px 1fr 90px 40px', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-disabled)', textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barPct}%`, background: i === 0 ? 'var(--gecko-primary-600)' : 'var(--gecko-primary-300)', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', textAlign: 'right' }}>฿{c.rev.toLocaleString()}</span>
                  <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', textAlign: 'right' }}>{totalPct}%</span>
                </div>
              );
            })}
          </div>
        </Widget>

        <Widget title="Invoice Status Overview">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {INV_STATUSES.map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap', minWidth: 110, textAlign: 'center' }}>{s.label}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.pct * 2}%`, background: s.color, borderRadius: 4, opacity: 0.7 }} />
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', minWidth: 24, textAlign: 'center' }}>{s.count}</span>
                <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', minWidth: 32, textAlign: 'right' }}>{s.pct}%</span>
                <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)', color: s.color, minWidth: 70, textAlign: 'right' }}>{s.amount}</span>
              </div>
            ))}
            <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--gecko-text-secondary)' }}>Total invoices MTD</span>
              <span style={{ fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>48</span>
            </div>
          </div>
        </Widget>

        <Widget title="Payment Trend — Collections vs Invoiced (Last 6 Months)" col={2}>
          <svg viewBox={`0 0 ${PT_W} ${PT_H}`} width="100%" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="invFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gecko-primary-600)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--gecko-primary-600)" stopOpacity="0.01" />
              </linearGradient>
              <linearGradient id="colFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gecko-success-600)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--gecko-success-600)" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {[900, 1000, 1100, 1200].map((tick) => {
              const ty = ptY(tick);
              return (
                <g key={tick}>
                  <line x1={PT_PAD_L} y1={ty} x2={PT_W - PT_PAD_R} y2={ty} stroke="var(--gecko-border)" strokeWidth={0.5} />
                  <text x={PT_PAD_L - 4} y={ty + 3} textAnchor="end" fontSize={9} fill="var(--gecko-text-secondary)">{tick}</text>
                </g>
              );
            })}
            <path d={INV_AREA} fill="url(#invFill)" />
            <path d={COL_AREA} fill="url(#colFill)" />
            <polyline points={INV_POINTS} stroke="var(--gecko-primary-600)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={COL_POINTS} stroke="var(--gecko-success-600)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {INVOICED.map((v, i) => (
              <circle key={i} cx={ptX(i)} cy={ptY(v)} r={2.5} fill="var(--gecko-primary-600)" />
            ))}
            {COLLECTED.map((v, i) => (
              <circle key={i} cx={ptX(i)} cy={ptY(v)} r={2.5} fill="var(--gecko-success-600)" />
            ))}
            {PT_MONTHS.map((m, i) => (
              <text key={m} x={ptX(i)} y={PT_H - 8} textAnchor="middle" fontSize={9} fill="var(--gecko-text-secondary)">{m}</text>
            ))}
          </svg>
          <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 3, background: 'var(--gecko-primary-600)', borderRadius: 2, display: 'inline-block' }} />
              Invoiced (฿k)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 3, background: 'var(--gecko-success-600)', borderRadius: 2, display: 'inline-block' }} />
              Collected (฿k)
            </span>
          </div>
        </Widget>
      </div>
    </div>
  );
}
