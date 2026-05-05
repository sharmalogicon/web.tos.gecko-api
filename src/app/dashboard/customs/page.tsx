"use client";

import React from 'react';
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

const HOLD_TYPES = [
  { label: 'Customs Hold',            count: 12, pct: 42.9, color: 'var(--gecko-error-600)',   bg: 'var(--gecko-error-50)'   },
  { label: 'Bank / Financial Hold',   count: 7,  pct: 25.0, color: '#f97316',                  bg: '#fff7ed'                 },
  { label: 'Carrier / Line Hold',     count: 6,  pct: 21.4, color: 'var(--gecko-info-600)',    bg: 'var(--gecko-info-50)'    },
  { label: 'Quarantine / Biosecurity',count: 3,  pct: 10.7, color: '#7c3aed',                  bg: '#f5f3ff'                 },
];

const AGING_BUCKETS  = ['0-1d','1-2d','2-3d','3-5d','5-7d','7-10d','10-14d','14+d'];
const AGING_COUNTS   = [3, 5, 4, 6, 2, 4, 2, 2];
const AGING_COLORS   = [
  'var(--gecko-success-600)','var(--gecko-success-600)','var(--gecko-success-600)',
  '#f59e0b','#f59e0b',
  '#f97316',
  'var(--gecko-error-600)','var(--gecko-error-600)',
];
const AGE_SVG_W = 480;
const AGE_SVG_H = 120;
const AGE_PAD_T = 18;
const AGE_PAD_B = 22;
const AGE_PAD_L = 8;
const AGE_PAD_R = 8;
const AGE_CHART_H = AGE_SVG_H - AGE_PAD_T - AGE_PAD_B;
const AGE_MAX = Math.max(...AGING_COUNTS);
const AGE_GAP = 6;
const AGE_BAR_W = (AGE_SVG_W - AGE_PAD_L - AGE_PAD_R - (AGING_BUCKETS.length - 1) * AGE_GAP) / AGING_BUCKETS.length;

const RELEASE_DATA = [4,6,8,5,9,7,11,8,6,10,9,7,11,12];
const REL_SVG_W = 260;
const REL_SVG_H = 110;
const REL_PAD_L = 28;
const REL_PAD_R = 8;
const REL_PAD_T = 10;
const REL_PAD_B = 22;
const REL_CHART_W = REL_SVG_W - REL_PAD_L - REL_PAD_R;
const REL_CHART_H = REL_SVG_H - REL_PAD_T - REL_PAD_B;
const REL_MIN = 0;
const REL_MAX_V = Math.max(...RELEASE_DATA) + 1;
const REL_AVG = RELEASE_DATA.reduce((a, b) => a + b, 0) / RELEASE_DATA.length;

function relX(i: number) { return REL_PAD_L + (i / (RELEASE_DATA.length - 1)) * REL_CHART_W; }
function relY(v: number) { return REL_PAD_T + REL_CHART_H - ((v - REL_MIN) / (REL_MAX_V - REL_MIN)) * REL_CHART_H; }

const REL_POINTS = RELEASE_DATA.map((v, i) => `${relX(i)},${relY(v)}`).join(' ');
const REL_AREA = `M${relX(0)},${relY(RELEASE_DATA[0])} ` + RELEASE_DATA.map((v, i) => `L${relX(i)},${relY(v)}`).join(' ') + ` L${relX(RELEASE_DATA.length - 1)},${REL_SVG_H - REL_PAD_B} L${REL_PAD_L},${REL_SVG_H - REL_PAD_B} Z`;
const REL_AVG_Y = relY(REL_AVG);

const EXAM_QUEUE = [
  { ctr: 'MSKU 744218-3', customer: 'Thai Union',  size: '20GP', gateIn: 'Apr 28', holdType: 'Customs',    examiner: 'Customs Dept.', priority: 'HIGH'   },
  { ctr: 'OOLU 551928-1', customer: 'PTT Global',  size: '40HC', gateIn: 'Apr 29', holdType: 'Customs',    examiner: 'Customs Dept.', priority: 'MEDIUM' },
  { ctr: 'CMAU 883212-0', customer: 'CP Foods',    size: '20GP', gateIn: 'Apr 30', holdType: 'Customs',    examiner: 'Customs Dept.', priority: 'HIGH'   },
  { ctr: 'TCKU 229341-2', customer: 'Indorama',    size: '40GP', gateIn: 'May 1',  holdType: 'Quarantine', examiner: 'DOPA',          priority: 'HIGH'   },
  { ctr: 'MRKU 482910-1', customer: 'Thai Union',  size: '20GP', gateIn: 'May 2',  holdType: 'Customs',    examiner: 'Customs Dept.', priority: 'LOW'    },
  { ctr: 'TRLU 229481-0', customer: 'Bangchak',    size: '40HC', gateIn: 'May 3',  holdType: 'Customs',    examiner: 'Customs Dept.', priority: 'MEDIUM' },
  { ctr: 'SUDU 884210-3', customer: 'SCG',         size: '20GP', gateIn: 'May 4',  holdType: 'Customs',    examiner: 'Customs Dept.', priority: 'LOW'    },
];

const ACTIVITY_LOG = [
  { time: '14:18', ctr: 'CRXU 482910-3', type: 'RELEASED',    desc: 'Customs cleared',       customer: 'CP Foods'   },
  { time: '13:42', ctr: 'MSCU 384729-0', type: 'HOLD PLACED', desc: 'Bank hold',             customer: 'PTT Global' },
  { time: '13:11', ctr: 'GESU 290183-2', type: 'RELEASED',    desc: 'Bank cleared',          customer: 'Thai Union' },
  { time: '12:58', ctr: 'MSKU 119283-4', type: 'EXAMINATION', desc: 'Examination scheduled', customer: 'Indorama'   },
  { time: '12:22', ctr: 'TRLU 882910-4', type: 'RELEASED',    desc: 'Customs cleared',       customer: 'Betagro'    },
  { time: '11:48', ctr: 'SUDU 290184-1', type: 'HOLD PLACED', desc: 'Customs hold',          customer: 'CP Foods'   },
  { time: '11:30', ctr: 'CMAU 441829-2', type: 'UPDATED',     desc: 'Examiner assigned',     customer: 'SCG'        },
  { time: '11:14', ctr: 'OOLU 882931-0', type: 'RELEASED',    desc: 'Carrier hold cleared',  customer: 'Bangchak'   },
  { time: '10:55', ctr: 'MRKU 551024-7', type: 'HOLD PLACED', desc: 'Quarantine hold',       customer: 'Thai Union' },
  { time: '10:38', ctr: 'TCKU 229482-1', type: 'EXAMINATION', desc: 'Examination completed', customer: 'PTT Global' },
  { time: '10:11', ctr: 'GESU 774291-4', type: 'RELEASED',    desc: 'Financial cleared',     customer: 'Indorama'   },
  { time: '09:47', ctr: 'HLCU 338291-0', type: 'UPDATED',     desc: 'Priority escalated',    customer: 'CP Foods'   },
];

function eventColor(type: string) {
  if (type === 'RELEASED')    return { color: 'var(--gecko-success-600)', bg: 'var(--gecko-success-50)' };
  if (type === 'HOLD PLACED') return { color: 'var(--gecko-error-600)',   bg: 'var(--gecko-error-50)'   };
  if (type === 'EXAMINATION') return { color: 'var(--gecko-info-600)',    bg: 'var(--gecko-info-50)'    };
  return { color: 'var(--gecko-text-secondary)', bg: 'var(--gecko-bg-subtle)' };
}

function priorityStyle(p: string) {
  if (p === 'HIGH')   return { background: 'var(--gecko-error-50)',   color: 'var(--gecko-error-600)',   border: '1px solid var(--gecko-error-600)'   };
  if (p === 'MEDIUM') return { background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-600)', border: '1px solid var(--gecko-warning-600)' };
  return { background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', border: '1px solid var(--gecko-border)' };
}

export default function CustomsDashboardPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', marginBottom: 4 }}>Customs & Holds Dashboard</h1>
        <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Container holds, customs examination queue, hold aging, and release tracking</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <KpiCard label="Containers on Hold"  value="28"      sub="Across 4 hold types"      accent="var(--gecko-error-400)" />
        <KpiCard label="Customs Exam Queue"  value="7"       sub="Awaiting examination"      accent="var(--gecko-warning-400)" />
        <KpiCard label="Avg Release Time"    value="2.4 days" sub="Target: ≤ 3 days ✓"      accent="var(--gecko-success-400)" />
        <KpiCard label="Released Today"      value="12"      sub="↑ 4 vs yesterday"         accent="var(--gecko-success-400)" trend="up" />
        <KpiCard label="Holds > 7 Days"      value="8"       sub="Escalation required"      accent="var(--gecko-error-400)" trend="down" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <Widget title="Hold Type Breakdown">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {HOLD_TYPES.map((ht) => (
              <div key={ht.label} style={{ borderLeft: `4px solid ${ht.color}`, paddingLeft: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{ht.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20, background: ht.bg, color: ht.color }}>{ht.count} ctrs</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${ht.pct}%`, background: ht.color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', minWidth: 38 }}>{ht.pct}%</span>
                </div>
              </div>
            ))}
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--gecko-border)', fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
              Total: 28 containers on hold
            </div>
          </div>
        </Widget>

        <Widget title="Hold Aging Distribution">
          <svg viewBox={`0 0 ${AGE_SVG_W} ${AGE_SVG_H}`} width="100%" style={{ display: 'block' }}>
            {AGING_COUNTS.map((cnt, i) => {
              const bh = (cnt / AGE_MAX) * AGE_CHART_H;
              const bx = AGE_PAD_L + i * (AGE_BAR_W + AGE_GAP);
              const by = AGE_PAD_T + AGE_CHART_H - bh;
              return (
                <g key={i}>
                  <rect x={bx} y={by} width={AGE_BAR_W} height={bh} rx={3} fill={AGING_COLORS[i]} />
                  <text x={bx + AGE_BAR_W / 2} y={by - 4} textAnchor="middle" fontSize={10} fontWeight="700" fill="var(--gecko-text-primary)">{cnt}</text>
                  <text x={bx + AGE_BAR_W / 2} y={AGE_SVG_H - 4} textAnchor="middle" fontSize={9} fill="var(--gecko-text-secondary)">{AGING_BUCKETS[i]}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--gecko-text-secondary)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--gecko-success-600)', borderRadius: 2, display: 'inline-block' }} />0–3 days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2, display: 'inline-block' }} />3–7 days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#f97316', borderRadius: 2, display: 'inline-block' }} />7–10 days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--gecko-error-600)', borderRadius: 2, display: 'inline-block' }} />10+ days</span>
          </div>
        </Widget>

        <Widget title="Release Trend — Last 14 Days">
          <svg viewBox={`0 0 ${REL_SVG_W} ${REL_SVG_H}`} width="100%" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="relFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gecko-success-600)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--gecko-success-600)" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            <line x1={REL_PAD_L} y1={REL_AVG_Y} x2={REL_SVG_W - REL_PAD_R} y2={REL_AVG_Y} stroke="var(--gecko-text-secondary)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={REL_SVG_W - REL_PAD_R - 2} y={REL_AVG_Y - 4} textAnchor="end" fontSize={9} fill="var(--gecko-text-secondary)">avg 8.1</text>
            <path d={REL_AREA} fill="url(#relFill)" />
            <polyline points={REL_POINTS} stroke="var(--gecko-success-600)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x={REL_PAD_L} y={REL_SVG_H - 4} textAnchor="start" fontSize={9} fill="var(--gecko-text-secondary)">Apr 22</text>
            <text x={REL_SVG_W - REL_PAD_R} y={REL_SVG_H - 4} textAnchor="end" fontSize={9} fill="var(--gecko-text-secondary)">May 5</text>
          </svg>
        </Widget>

        <Widget title="Examination Queue — Customs" col={2}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--gecko-bg-subtle)' }}>
                  {['Container','Customer','Size','Gate-In','Hold Type','Examiner','Priority','Action'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--gecko-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--gecko-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXAM_QUEUE.map((row) => {
                  const ps = priorityStyle(row.priority);
                  return (
                    <tr key={row.ctr} style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                      <td style={{ padding: '9px 10px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.ctr}</td>
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>{row.customer}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', color: 'var(--gecko-text-secondary)' }}>{row.size}</span>
                      </td>
                      <td style={{ padding: '9px 10px', fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.gateIn}</td>
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>{row.holdType}</td>
                      <td style={{ padding: '9px 10px', fontSize: 11, color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.examiner}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, ...ps }}>{row.priority}</span>
                      </td>
                      <td style={{ padding: '9px 10px' }}>
                        <button style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--gecko-border)', background: 'transparent', color: 'var(--gecko-text-primary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {row.priority === 'HIGH' && row.holdType === 'Quarantine' ? 'Urgent' : 'Schedule'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Widget>

        <Widget title="Hold Activity — Today">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {ACTIVITY_LOG.map((ev, i) => {
              const ec = eventColor(ev.type);
              return (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 0', borderBottom: i < ACTIVITY_LOG.length - 1 ? '1px solid var(--gecko-border)' : 'none' }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', minWidth: 38, paddingTop: 1 }}>{ev.time}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{ev.ctr}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4, background: ec.bg, color: ec.color, whiteSpace: 'nowrap' }}>{ev.type}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{ev.desc} · <span style={{ fontWeight: 500 }}>{ev.customer}</span></div>
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
