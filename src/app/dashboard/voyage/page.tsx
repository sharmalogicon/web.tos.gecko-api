"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

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

type Period = 'active' | 'upcoming' | 'all';

const VOYAGES = [
  { vessel: 'OOCL SEOUL', voyageNo: 'MSK-142E', line: 'Maersk', lineColor: 'var(--gecko-primary-600)', teuBooked: 420, teuTotal: 600, eta: 'May 7', etd: 'May 8', status: 'Accepting', cutoffLabel: 'CY Cut-off: 18hrs', cutoffUrgent: true },
  { vessel: 'MSC LISBON', voyageNo: 'OOL-089W', line: 'OOCL', lineColor: 'var(--gecko-info-600)', teuBooked: 280, teuTotal: 400, eta: 'May 7', etd: 'May 9', status: 'Open', cutoffLabel: 'CY Cut-off: 42hrs', cutoffUrgent: true },
  { vessel: 'EVER WEB', voyageNo: 'OOL-112E', line: 'Evergreen', lineColor: 'var(--gecko-success-600)', teuBooked: 580, teuTotal: 650, eta: 'May 10', etd: 'May 11', status: 'Accepting', cutoffLabel: 'CY Cut-off: 5 days', cutoffUrgent: false },
  { vessel: 'HYUNDAI PRIDE', voyageNo: 'MSK-198E', line: 'Maersk', lineColor: 'var(--gecko-primary-600)', teuBooked: 190, teuTotal: 500, eta: 'May 12', etd: 'May 13', status: 'Open', cutoffLabel: 'CY Cut-off: 7 days', cutoffUrgent: false },
  { vessel: 'CMA CGM MARCO POLO', voyageNo: 'CMA-019W', line: 'CMA CGM', lineColor: 'var(--gecko-warning-600)', teuBooked: 300, teuTotal: 300, eta: 'May 14', etd: 'May 14', status: 'Closed', cutoffLabel: 'Cut-off passed', cutoffUrgent: false },
  { vessel: 'COSCO YANTIAN', voyageNo: 'CSYL-087E', line: 'COSCO', lineColor: 'var(--gecko-error-600)', teuBooked: 120, teuTotal: 400, eta: 'May 16', etd: 'May 17', status: 'Open', cutoffLabel: 'CY Cut-off: 11 days', cutoffUrgent: false },
];

const WEEKLY_TEU = [1820, 2100, 1950, 2380, 2240, 2800, 2650, 3100, 2900, 3200, 3050, 3156];
const W = 480;
const H = 120;
const PAD_L = 36;
const PAD_B = 24;
const PAD_T = 12;
const CHART_W = W - PAD_L - 8;
const CHART_H = H - PAD_B - PAD_T;
const MAX_TEU = Math.max(...WEEKLY_TEU);

function teuFillColor(pct: number) {
  if (pct > 90) return 'var(--gecko-error-600)';
  if (pct >= 70) return 'var(--gecko-warning-600)';
  return 'var(--gecko-success-600)';
}

function teuFillBg(pct: number) {
  if (pct > 90) return 'var(--gecko-error-50)';
  if (pct >= 70) return 'var(--gecko-warning-50)';
  return 'var(--gecko-success-50)';
}

function statusBadge(status: string) {
  if (status === 'Accepting') return { bg: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-600)', border: '1px solid var(--gecko-primary-600)' };
  if (status === 'Closed') return { bg: 'var(--gecko-error-50)', color: 'var(--gecko-error-600)', border: '1px solid var(--gecko-error-600)' };
  return { bg: 'var(--gecko-success-50)', color: 'var(--gecko-success-600)', border: '1px solid var(--gecko-success-600)' };
}

const CUTOFFS = [
  { voyageNo: 'MSK-142E', vessel: 'OOCL SEOUL', type: 'CY Cut-off', datetime: 'May 6 18:00', urgency: 'red' },
  { voyageNo: 'MSK-142E', vessel: 'OOCL SEOUL', type: 'VGM Cut-off', datetime: 'May 6 20:00', urgency: 'red' },
  { voyageNo: 'OOL-089W', vessel: 'MSC LISBON', type: 'CY Cut-off', datetime: 'May 7 12:00', urgency: 'orange' },
  { voyageNo: 'OOL-112E', vessel: 'EVER WEB', type: 'CY Cut-off', datetime: 'May 9 08:00', urgency: 'yellow' },
  { voyageNo: 'OOL-112E', vessel: 'EVER WEB', type: 'VGM Cut-off', datetime: 'May 9 18:00', urgency: 'yellow' },
  { voyageNo: 'MSK-198E', vessel: 'HYUNDAI PRIDE', type: 'CY Cut-off', datetime: 'May 11 08:00', urgency: 'green' },
  { voyageNo: 'CMA-019W', vessel: 'MARCO POLO', type: 'B/L Cut-off', datetime: 'May 14 17:00', urgency: 'green' },
  { voyageNo: 'CSYL-087E', vessel: 'COSCO YANTIAN', type: 'CY Cut-off', datetime: 'May 15 08:00', urgency: 'green' },
];

function urgencyColor(u: string) {
  if (u === 'red') return 'var(--gecko-error-600)';
  if (u === 'orange') return 'var(--gecko-warning-600)';
  if (u === 'yellow') return '#ca8a04';
  return 'var(--gecko-success-600)';
}

function urgencyBg(u: string) {
  if (u === 'red') return 'var(--gecko-error-50)';
  if (u === 'orange') return 'var(--gecko-warning-50)';
  if (u === 'yellow') return '#fef9c3';
  return 'var(--gecko-success-50)';
}

export default function VoyageDashboardPage() {
  const [period, setPeriod] = useState<Period>('active');

  const pts = WEEKLY_TEU.map((v, i) => {
    const x = PAD_L + (i / (WEEKLY_TEU.length - 1)) * CHART_W;
    const y = PAD_T + CHART_H - (v / MAX_TEU) * CHART_H;
    return { x, y };
  });

  const polylinePoints = pts.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = `M${pts[0].x},${PAD_T + CHART_H} ` + pts.map(p => `L${p.x},${p.y}`).join(' ') + ` L${pts[pts.length - 1].x},${PAD_T + CHART_H} Z`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      <nav className="gecko-breadcrumb">
        <span className="gecko-breadcrumb-item">Masters</span>
        <span className="gecko-breadcrumb-sep">/</span>
        <span className="gecko-breadcrumb-item">Dashboard</span>
        <span className="gecko-breadcrumb-sep">/</span>
        <span className="gecko-breadcrumb-current">Voyage &amp; Vessel</span>
      </nav>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--gecko-text-primary)' }}>Voyage &amp; Vessel Dashboard</h1>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>Active voyages, TEU fill rates, upcoming ETAs and cut-off countdowns</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['active', 'upcoming', 'all'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '5px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid var(--gecko-border)',
                background: period === p ? 'var(--gecko-primary-600)' : 'var(--gecko-bg-surface)',
                color: period === p ? '#fff' : 'var(--gecko-text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <KpiCard label="Active Voyages" value="8" sub="3 accepting bookings" accent="var(--gecko-primary-400)" />
        <KpiCard label="TEU Allotment" value="4,200" sub="Across all active voyages" accent="var(--gecko-info-400)" />
        <KpiCard label="TEU Booked" value="3,156" sub="75.1% fill rate" accent="var(--gecko-success-400)" trend="up" />
        <KpiCard label="ETAs — Next 7 Days" value="3" sub="Next: MSC LISBON · May 7" accent="var(--gecko-warning-400)" />
        <KpiCard label="Cut-offs Today" value="2" sub="MSK-142E · OOL-089W" accent="var(--gecko-error-400)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Widget title="Active Voyage Cards" col={3}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {VOYAGES.map(v => {
              const pct = Math.round((v.teuBooked / v.teuTotal) * 100);
              const fillColor = teuFillColor(pct);
              const fillBg = teuFillBg(pct);
              const badge = statusBadge(v.status);
              return (
                <div key={v.voyageNo} style={{ background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)', lineHeight: 1.2 }}>{v.vessel}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{v.voyageNo}</div>
                    </div>
                    <span style={{ ...badge, fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>{v.status}</span>
                  </div>

                  <div>
                    <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: v.lineColor + '20', color: v.lineColor, border: `1px solid ${v.lineColor}40` }}>{v.line}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
                      <span>TEU Fill</span>
                      <span style={{ fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: fillColor }}>{v.teuBooked} / {v.teuTotal} TEU</span>
                    </div>
                    <div style={{ height: 8, background: fillBg, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: fillColor, borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', textAlign: 'right' }}>{pct}% filled</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                    <div style={{ color: 'var(--gecko-text-secondary)' }}>ETA <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{v.eta}</span></div>
                    <div style={{ color: 'var(--gecko-text-secondary)' }}>ETD <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{v.etd}</span></div>
                  </div>

                  <div style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, background: v.cutoffUrgent ? 'var(--gecko-error-50)' : 'var(--gecko-bg-surface)', color: v.cutoffUrgent ? 'var(--gecko-error-600)' : 'var(--gecko-text-secondary)', border: `1px solid ${v.cutoffUrgent ? 'var(--gecko-error-600)' : 'var(--gecko-border)'}`, fontWeight: v.cutoffUrgent ? 700 : 400 }}>
                    {v.cutoffLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </Widget>

        <Widget title="TEU Booking Trend (Last 12 Weeks)" col={2}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
            {[0, 1000, 2000, 3000].map(gridVal => {
              const gy = PAD_T + CHART_H - (gridVal / MAX_TEU) * CHART_H;
              return (
                <g key={gridVal}>
                  <line x1={PAD_L} y1={gy} x2={W - 8} y2={gy} stroke="var(--gecko-border)" strokeWidth={1} strokeDasharray={gridVal === 0 ? '0' : '3 3'} />
                  <text x={PAD_L - 4} y={gy + 4} textAnchor="end" fontSize={9} fill="var(--gecko-text-secondary)">{gridVal > 0 ? (gridVal / 1000).toFixed(0) + 'k' : '0'}</text>
                </g>
              );
            })}
            <path d={areaPath} fill="var(--gecko-primary-400)" opacity={0.1} />
            <polyline points={polylinePoints} fill="none" stroke="var(--gecko-primary-600)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={3.5} fill="var(--gecko-primary-600)" />
                <circle cx={p.x} cy={p.y} r={2} fill="white" />
                {i % 3 === 0 && (
                  <text x={p.x} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--gecko-text-secondary)">W{i + 1}</text>
                )}
              </g>
            ))}
          </svg>
        </Widget>

        <Widget title="Upcoming Cut-offs">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {CUTOFFS.map((c, i) => {
              const col = urgencyColor(c.urgency);
              const bg = urgencyBg(c.urgency);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'stretch', borderBottom: i < CUTOFFS.length - 1 ? '1px solid var(--gecko-border)' : 'none', padding: '8px 0' }}>
                  <div style={{ width: 4, borderRadius: 2, background: col, marginRight: 10, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{c.voyageNo}</div>
                        <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 1 }}>{c.vessel}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: bg, color: col, fontWeight: 700, border: `1px solid ${col}40` }}>{c.type}</div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{c.datetime}</div>
                      </div>
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
