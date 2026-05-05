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

const JOBS = [
  { no: 'CFS-2026-0142', type: 'STUFFING', container: 'MSKU 744218-3 20GP', customer: 'Thai Union', cbm: 28, crew: 'Crew A', start: '13:00', status: 'IN PROGRESS', pct: 75 },
  { no: 'CFS-2026-0141', type: 'STUFFING', container: 'OOLU 551928-1 40HC', customer: 'PTT Global', cbm: 62, crew: 'Crew B', start: '11:30', status: 'IN PROGRESS', pct: 40 },
  { no: 'CFS-2026-0140', type: 'STRIPPING', container: 'CMAU 883212-0 40HC', customer: 'CP Foods', cbm: 48, crew: 'Crew A', start: '09:00', status: 'COMPLETE', pct: 100 },
  { no: 'CFS-2026-0139', type: 'STUFFING', container: 'TCKU 229341-2 20GP', customer: 'Indorama', cbm: 24, crew: 'Crew C', start: '08:30', status: 'COMPLETE', pct: 100 },
  { no: 'CFS-2026-0138', type: 'STRIPPING', container: 'MSCU 881902-4 40HC', customer: 'Bangchak', cbm: 38, crew: 'Crew B', start: '07:45', status: 'COMPLETE', pct: 100 },
  { no: 'CFS-2026-0137', type: 'STUFFING', container: 'HLCU 332910-1 20GP', customer: 'Betagro', cbm: 22, crew: 'Crew C', start: '07:00', status: 'COMPLETE', pct: 100 },
  { no: 'CFS-2026-0136', type: 'STUFFING', container: 'EGLV 910284-2 40HC', customer: 'Thai Union', cbm: 54, crew: 'Crew A', start: '06:30', status: 'COMPLETE', pct: 100 },
  { no: 'CFS-2026-0135', type: 'STRIPPING', container: 'CMDU 772810-3 40HC', customer: 'PTT Global', cbm: 42, crew: 'Crew B', start: '06:00', status: 'COMPLETE', pct: 100 },
];

const SECTIONS = [
  { id: 'A', cap: 420, used: 380 },
  { id: 'B', cap: 380, used: 280 },
  { id: 'C', cap: 320, used: 188 },
  { id: 'D', cap: 280, used: 240 },
  { id: 'E', cap: 240, used: 120 },
  { id: 'F', cap: 200, used: 40 },
];

const CBM_14D = [184, 212, 248, 196, 278, 312, 268, 242, 188, 224, 264, 288, 272, 284];
const DAY_LABELS = ['Apr 22', 'Apr 23', 'Apr 24', 'Apr 25', 'Apr 26', 'Apr 27', 'Apr 28', 'Apr 29', 'Apr 30', 'May 1', 'May 2', 'May 3', 'May 4', 'May 5'];

const LCL_CARGO = [
  { lot: 'LCL-2026-0284', customer: 'Thai Union', cbm: 18.4, section: 'A', days: 8, status: 'READY' },
  { lot: 'LCL-2026-0281', customer: 'CP Foods', cbm: 12.2, section: 'C', days: 6, status: 'READY' },
  { lot: 'LCL-2026-0279', customer: 'Bangchak', cbm: 8.8, section: 'B', days: 5, status: 'ON HOLD' },
  { lot: 'LCL-2026-0276', customer: 'Indorama', cbm: 22.0, section: 'A', days: 5, status: 'READY' },
  { lot: 'LCL-2026-0274', customer: 'PTT Global', cbm: 14.6, section: 'D', days: 3, status: 'READY' },
  { lot: 'LCL-2026-0272', customer: 'Betagro', cbm: 9.4, section: 'B', days: 2, status: 'READY' },
  { lot: 'LCL-2026-0269', customer: 'Thai Union', cbm: 31.2, section: 'A', days: 2, status: 'ON HOLD' },
  { lot: 'LCL-2026-0266', customer: 'CP Foods', cbm: 7.8, section: 'C', days: 1, status: 'READY' },
];

const CBM_MAX = Math.max(...CBM_14D);
const CBM_TARGET = 250;
const CBM_SVG_H = 90;
const CBM_BAR_W = 26;
const CBM_BAR_GAP = 12;
const CBM_CHART_H = 75;

function sectionBarColor(pct: number) {
  if (pct >= 85) return 'var(--gecko-error-600)';
  if (pct >= 70) return 'var(--gecko-warning-600)';
  return 'var(--gecko-success-600)';
}

function jobStatusBadge(status: string) {
  if (status === 'IN PROGRESS') return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-info-100)', color: 'var(--gecko-info-600)' }}>IN PROGRESS</span>;
  if (status === 'COMPLETE') return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-600)' }}>COMPLETE</span>;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)' }}>PENDING</span>;
}

function lclRowBg(days: number) {
  if (days > 7) return 'var(--gecko-error-50)';
  if (days >= 4) return 'var(--gecko-warning-50)';
  return 'transparent';
}

export default function CfsOpsDashboard() {
  const targetY = CBM_SVG_H - (CBM_TARGET / CBM_MAX) * CBM_CHART_H;

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--gecko-bg-subtle)' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gecko-text-primary)', margin: 0 }}>CFS Operations Dashboard</h1>
        <p style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4, marginBottom: 0 }}>Container freight station stuffing, stripping, LCL cargo, and warehouse utilization</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Stuffing Jobs Today" value="8" sub="6 complete · 2 in progress" accent="var(--gecko-primary-400)" />
        <KpiCard label="Stripping Jobs Today" value="5" sub="All complete ✓" accent="var(--gecko-success-400)" />
        <KpiCard label="CBM Processed Today" value="284 cbm" sub="Target: 250 cbm ✓" accent="var(--gecko-success-400)" trend="up" />
        <KpiCard label="LCL in Warehouse" value="1,248 cbm" sub="68% of capacity (1,840 cbm)" accent="var(--gecko-warning-400)" />
        <KpiCard label="Pending Tally" value="3" sub="Awaiting confirmation" accent="var(--gecko-info-400)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Widget title="Active &amp; Today's Jobs" col={2}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                  {['Job No.', 'Type', 'Container', 'Customer', 'CBM', 'Crew', 'Start', 'Status', 'Progress'].map((h) => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {JOBS.map((j, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                    <td style={{ padding: '7px 8px', fontFamily: 'var(--gecko-font-mono)', fontSize: 10, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{j.no}</td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: j.type === 'STUFFING' ? 'var(--gecko-primary-50)' : 'var(--gecko-info-100)', color: j.type === 'STUFFING' ? 'var(--gecko-primary-600)' : 'var(--gecko-info-600)' }}>{j.type}</span>
                    </td>
                    <td style={{ padding: '7px 8px', fontFamily: 'var(--gecko-font-mono)', fontSize: 10, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{j.container}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{j.customer}</td>
                    <td style={{ padding: '7px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{j.cbm}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{j.crew}</td>
                    <td style={{ padding: '7px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{j.start}</td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{jobStatusBadge(j.status)}</td>
                    <td style={{ padding: '7px 8px', minWidth: 80 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${j.pct}%`, borderRadius: 3, background: j.pct === 100 ? 'var(--gecko-success-600)' : 'var(--gecko-primary-400)' }} />
                        </div>
                        <span style={{ fontSize: 10, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', minWidth: 28 }}>{j.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Widget>

        <Widget title="Warehouse Section Utilization">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {SECTIONS.map((s) => {
              const pct = Math.round((s.used / s.cap) * 100);
              const color = sectionBarColor(pct);
              return (
                <div key={s.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gecko-text-primary)', width: 20 }}>Sec {s.id}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
                      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{s.used}</span> / {s.cap} cbm
                      <span style={{ marginLeft: 8, fontWeight: 700, color }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 5, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Widget>

        <Widget title="CBM Throughput — Last 14 Days" col={2}>
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${CBM_14D.length * (CBM_BAR_W + CBM_BAR_GAP)} 110`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
              <line
                x1={0} y1={targetY}
                x2={CBM_14D.length * (CBM_BAR_W + CBM_BAR_GAP)} y2={targetY}
                stroke="var(--gecko-warning-600)" strokeWidth={1.5} strokeDasharray="5,4"
              />
              <text x={CBM_14D.length * (CBM_BAR_W + CBM_BAR_GAP) - 2} y={targetY - 3} textAnchor="end" fontSize={9} fill="var(--gecko-warning-600)">250 cbm</text>
              {CBM_14D.map((v, i) => {
                const barH = Math.max(4, (v / CBM_MAX) * CBM_CHART_H);
                const x = i * (CBM_BAR_W + CBM_BAR_GAP);
                const y = CBM_SVG_H - barH;
                const isCurrent = i === CBM_14D.length - 1;
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={CBM_BAR_W} height={barH} rx={3} fill={isCurrent ? 'var(--gecko-primary-700)' : 'var(--gecko-primary-400)'} />
                    <text x={x + CBM_BAR_W / 2} y={108} textAnchor="middle" fontSize={8} fill="var(--gecko-text-secondary)">{DAY_LABELS[i].replace('Apr ', '').replace('May ', 'M')}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </Widget>

        <Widget title="LCL Cargo Dwell — Pending Collection">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                  {['Lot No.', 'Customer', 'CBM', 'Section', 'Days', 'Status'].map((h) => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LCL_CARGO.map((row, i) => (
                  <tr key={i} style={{ background: lclRowBg(row.days), borderBottom: '1px solid var(--gecko-border)' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', fontSize: 10, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{row.lot}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.customer}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{row.cbm}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--gecko-text-primary)', textAlign: 'center' }}>{row.section}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: row.days > 7 ? 'var(--gecko-error-600)' : row.days >= 4 ? 'var(--gecko-warning-600)' : 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{row.days}d</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: row.status === 'READY' ? 'var(--gecko-success-50)' : 'var(--gecko-warning-100)', color: row.status === 'READY' ? 'var(--gecko-success-600)' : 'var(--gecko-warning-600)' }}>{row.status}</span>
                    </td>
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
