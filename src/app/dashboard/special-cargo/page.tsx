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

const REEFERS: { id: string; customer: string; setTemp: string; actTemp: string; status: 'NORMAL' | 'ALARM' | 'UNPLUGGED'; slot: string }[] = [
  { id: 'MRKU 482910-1', customer: 'Thai Union', setTemp: '-18°C', actTemp: '-17.8°C', status: 'NORMAL', slot: 'P-042' },
  { id: 'MRKU 482911-2', customer: 'Thai Union', setTemp: '-18°C', actTemp: '-16.2°C', status: 'ALARM', slot: 'P-043' },
  { id: 'TRLU 229481-0', customer: 'Betagro', setTemp: '-25°C', actTemp: '-25.1°C', status: 'NORMAL', slot: 'P-018' },
  { id: 'SUDU 884210-3', customer: 'Bangchak', setTemp: '+4°C', actTemp: '+4.2°C', status: 'NORMAL', slot: 'P-061' },
  { id: 'MRKU 398210-2', customer: 'Thai Union', setTemp: '-18°C', actTemp: '-21.4°C', status: 'ALARM', slot: 'P-044' },
  { id: 'TCKU 190283-1', customer: 'CP Foods', setTemp: '-18°C', actTemp: '-18.1°C', status: 'NORMAL', slot: 'P-022' },
  { id: 'CRXU 482910-3', customer: 'Indorama', setTemp: '+2°C', actTemp: '+2.1°C', status: 'NORMAL', slot: 'P-033' },
  { id: 'MSCU 384729-0', customer: 'PTT Global', setTemp: '-20°C', actTemp: '-12.8°C', status: 'ALARM', slot: 'P-071' },
  { id: 'GESU 290183-2', customer: 'Thai Union', setTemp: '-18°C', actTemp: '-18.0°C', status: 'NORMAL', slot: 'P-019' },
  { id: 'TRLU 882910-4', customer: 'Betagro', setTemp: '-25°C', actTemp: '-24.9°C', status: 'NORMAL', slot: 'P-016' },
  { id: 'SUDU 290184-1', customer: 'CP Foods', setTemp: '+4°C', actTemp: '—', status: 'UNPLUGGED', slot: '—' },
  { id: 'MSCU 190294-3', customer: 'PTT Global', setTemp: '-18°C', actTemp: '—', status: 'UNPLUGGED', slot: '—' },
];

const DG_CLASSES = [
  { cls: '2.1', name: 'Flammable Gas', count: 4, color: '#e53e3e' },
  { cls: '3', name: 'Flammable Liquid', count: 6, color: '#dd6b20' },
  { cls: '4.1', name: 'Flammable Solid', count: 1, color: '#d69e2e' },
  { cls: '5.1', name: 'Oxidizer', count: 2, color: '#d4a017' },
  { cls: '6.1', name: 'Toxic', count: 3, color: '#718096' },
  { cls: '8', name: 'Corrosive', count: 2, color: '#4a5568' },
];

const ACTIVE_ALARMS = [
  { ctr: 'MRKU 482911-2', customer: 'Thai Union', slot: 'P-043', setT: '-18°C', actT: '-16.2°C', dev: '+1.8°C', dur: '28 min', action: 'INVESTIGATE' },
  { ctr: 'MRKU 398210-2', customer: 'Thai Union', slot: 'P-044', setT: '-18°C', actT: '-21.4°C', dev: '-3.4°C', dur: '15 min', action: 'INVESTIGATE' },
  { ctr: 'MSCU 384729-0', customer: 'PTT Global', slot: 'P-071', setT: '-20°C', actT: '-12.8°C', dev: '+7.2°C', dur: '5 min', action: 'CRITICAL' },
];

const RESOLVED_ALARMS = [
  { ctr: 'TRLU 229481-0', customer: 'Betagro', slot: 'P-018', setT: '-25°C', actT: '-22.1°C', dev: '+2.9°C', dur: '44 min', action: 'RESOLVED', ts: '11:28' },
  { ctr: 'SUDU 884210-3', customer: 'Bangchak', slot: 'P-061', setT: '+4°C', actT: '+6.8°C', dev: '+2.8°C', dur: '12 min', action: 'RESOLVED', ts: '10:42' },
  { ctr: 'TCKU 190283-1', customer: 'CP Foods', slot: 'P-022', setT: '-18°C', actT: '-15.4°C', dev: '+2.6°C', dur: '8 min', action: 'RESOLVED', ts: '09:55' },
  { ctr: 'GESU 290183-2', customer: 'Thai Union', slot: 'P-019', setT: '-18°C', actT: '-20.9°C', dev: '-2.9°C', dur: '22 min', action: 'RESOLVED', ts: '08:34' },
  { ctr: 'CRXU 482910-3', customer: 'Indorama', slot: 'P-033', setT: '+2°C', actT: '+4.1°C', dev: '+2.1°C', dur: '6 min', action: 'RESOLVED', ts: '07:18' },
];

const OOG_UNITS = [
  { ctr: 'MSKU 844910-1', type: 'OOG (Flat Rack)', customer: 'Thai Union', dims: '12.4m × 2.8m × 3.2m', loc: 'Zone D-14', notes: 'Crane-only' },
  { ctr: 'OOLU 229481-3', type: 'Break Bulk', customer: 'PTT Global', dims: '8.2m × 2.4m × 2.9m', loc: 'Zone D-18', notes: 'Hazmat' },
  { ctr: 'CMDU 882910-2', type: 'OOG (Flat Rack)', customer: 'Betagro', dims: '14.1m × 2.9m × 3.4m', loc: 'Zone D-12', notes: 'Crane-only' },
  { ctr: 'HLCU 331029-4', type: 'Break Bulk', customer: 'Bangchak', dims: '6.8m × 2.2m × 2.6m', loc: 'Zone D-22', notes: 'Heavy lift' },
  { ctr: 'TRLU 209481-1', type: 'OOG (Open Top)', customer: 'Indorama', dims: '12.0m × 2.4m × 3.1m', loc: 'Zone D-16', notes: 'Lashing req.' },
  { ctr: 'TCKU 882019-0', type: 'Break Bulk', customer: 'CP Foods', dims: '9.4m × 2.6m × 2.8m', loc: 'Zone D-20', notes: 'Temperature sensitive' },
  { ctr: 'MSCU 447120-3', type: 'OOG (Flat Rack)', customer: 'PTT Global', dims: '11.8m × 3.0m × 3.6m', loc: 'Zone D-10', notes: 'Crane-only' },
];

function reeferCardStyle(status: 'NORMAL' | 'ALARM' | 'UNPLUGGED') {
  if (status === 'ALARM') return { background: 'var(--gecko-error-50)', borderLeft: '3px solid var(--gecko-error-600)' };
  if (status === 'UNPLUGGED') return { background: 'var(--gecko-warning-50)', borderLeft: '3px solid var(--gecko-warning-600)' };
  return { background: 'var(--gecko-bg-surface)', borderLeft: '3px solid var(--gecko-success-600)' };
}

function actionBadge(action: string) {
  if (action === 'CRITICAL') return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-error-600)', color: '#fff' }}>CRITICAL</span>;
  if (action === 'INVESTIGATE') return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-600)' }}>INVESTIGATE</span>;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-600)' }}>RESOLVED</span>;
}

export default function SpecialCargoDashboard() {
  const dgMax = Math.max(...DG_CLASSES.map((d) => d.count));

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--gecko-bg-subtle)' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gecko-text-primary)', margin: 0 }}>Reefer &amp; Special Cargo Dashboard</h1>
        <p style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4, marginBottom: 0 }}>Reefer status, temperature monitoring, dangerous goods, and OOG tracking</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Reefers in Yard" value="48" sub="42 plugged · 6 unplugged" accent="var(--gecko-info-400)" />
        <KpiCard label="Temp Alarms" value="3" sub="Immediate attention required" accent="var(--gecko-error-400)" trend="down" />
        <KpiCard label="DG Containers" value="18" sub="Across 6 IMO classes" accent="var(--gecko-warning-400)" />
        <KpiCard label="OOG Units" value="7" sub="Break bulk + flat rack" accent="var(--gecko-primary-400)" />
        <KpiCard label="Reefer Inspections Due" value="12" sub="Next 24 hours" accent="var(--gecko-warning-400)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Widget title="Reefer Container Status Grid" col={2}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {REEFERS.map((r) => (
              <div key={r.id} style={{ ...reeferCardStyle(r.status), border: '1px solid var(--gecko-border)', borderRadius: 8, padding: '10px 10px 10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', marginBottom: 3, lineHeight: 1.3 }}>{r.id}</div>
                <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginBottom: 5 }}>{r.customer}</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--gecko-text-secondary)' }}>Set: </span>{r.setTemp}
                  {r.actTemp !== '—' && <><span style={{ color: 'var(--gecko-text-disabled)', margin: '0 3px' }}>/</span><span style={{ color: r.status === 'ALARM' ? 'var(--gecko-error-600)' : 'var(--gecko-text-primary)' }}>{r.actTemp}</span></>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: r.status === 'ALARM' ? 'var(--gecko-error-600)' : r.status === 'UNPLUGGED' ? 'var(--gecko-warning-600)' : 'var(--gecko-success-600)', color: '#fff' }}>{r.status}</span>
                  <span style={{ fontSize: 9, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)' }}>{r.slot}</span>
                </div>
              </div>
            ))}
          </div>
        </Widget>

        <Widget title="DG — Dangerous Goods by IMO Class">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {DG_CLASSES.map((d) => {
              const pct = Math.round((d.count / dgMax) * 100);
              return (
                <div key={d.cls}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: d.color, color: '#fff', minWidth: 28, textAlign: 'center' }}>{d.cls}</span>
                      <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{d.count}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: d.color, opacity: 0.75 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Widget>

        <Widget title="Temperature Alarm Log" col={2}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                  {['Container', 'Customer', 'Slot', 'Set Temp', 'Actual', 'Deviation', 'Duration', 'Action'].map((h) => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACTIVE_ALARMS.map((row, i) => (
                  <tr key={i} style={{ background: 'var(--gecko-error-50)', borderBottom: '1px solid var(--gecko-border)' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', fontSize: 10, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{row.ctr}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.customer}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.slot}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{row.setT}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-error-600)', whiteSpace: 'nowrap' }}>{row.actT}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-error-600)', whiteSpace: 'nowrap' }}>{row.dev}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.dur}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{actionBadge(row.action)}</td>
                  </tr>
                ))}
                {RESOLVED_ALARMS.map((row, i) => (
                  <tr key={`r-${i}`} style={{ background: 'var(--gecko-success-50)', borderBottom: '1px solid var(--gecko-border)' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', fontSize: 10, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{row.ctr}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.customer}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.slot}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{row.setT}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.actT}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.dev}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.dur}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{actionBadge(row.action)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Widget>

        <Widget title="OOG &amp; Break Bulk">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                  {['Container', 'Type', 'Customer', 'Dimensions', 'Location', 'Notes'].map((h) => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {OOG_UNITS.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', fontSize: 10, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{row.ctr}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: row.type.includes('Flat Rack') ? 'var(--gecko-primary-50)' : row.type.includes('Open Top') ? 'var(--gecko-info-100)' : 'var(--gecko-warning-50)', color: row.type.includes('Flat Rack') ? 'var(--gecko-primary-600)' : row.type.includes('Open Top') ? 'var(--gecko-info-600)' : 'var(--gecko-warning-600)' }}>{row.type}</span>
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.customer}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--gecko-font-mono)', fontSize: 10, color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{row.dims}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', whiteSpace: 'nowrap' }}>{row.loc}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{row.notes}</td>
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
