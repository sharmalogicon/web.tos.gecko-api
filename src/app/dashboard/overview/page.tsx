import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ExportButton } from '@/components/ui/ExportButton';
import { RefreshButton } from '@/components/ui/RefreshButton';

function Sparkline({ data, color = 'var(--gecko-primary-500)', height = 40, width = 120, fill = true }: { data: number[], color?: string, height?: number, width?: number, fill?: boolean }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`);
  const line = 'M ' + pts.join(' L ');
  const area = line + ` L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path d={line} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KPICard({ label, value, delta, deltaKind = 'up', sublabel, spark, icon, accent = 'primary' }: any) {
  const accentMap: any = {
    primary: { bg: 'var(--gecko-primary-50)', fg: 'var(--gecko-primary-600)' },
    success: { bg: 'var(--gecko-success-50)', fg: 'var(--gecko-success-600)' },
    warning: { bg: 'var(--gecko-warning-50)', fg: 'var(--gecko-warning-600)' },
    accent:  { bg: 'var(--gecko-accent-50)',  fg: 'var(--gecko-accent-600)' },
    info:    { bg: 'var(--gecko-info-50)',    fg: 'var(--gecko-info-600)' },
  };
  const c = accentMap[accent];
  return (
    <div className="gecko-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--gecko-text-secondary)' }}>{label}</div>
          {sublabel && <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginTop: 2, letterSpacing: '0.04em' }}>{sublabel}</div>}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gecko-text-primary)', lineHeight: 1 }}>{value}</div>
          {delta && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 8, fontSize: 11, fontWeight: 600, color: deltaKind === 'up' ? 'var(--gecko-success-600)' : 'var(--gecko-error-600)' }}>
              <Icon name={deltaKind === 'up' ? 'arrowUp' : 'arrowDown'} size={11} stroke={2.5} />
              {delta}
              <span style={{ color: 'var(--gecko-text-secondary)', fontWeight: 400, marginLeft: 4 }}>vs yesterday</span>
            </div>
          )}
        </div>
        {spark && <Sparkline data={spark} color={c.fg} width={96} height={36} />}
      </div>
    </div>
  );
}

export default function DashboardOverviewPage() {
  const movementData = [
    { m: 'Jan', v: 320 }, { m: 'Feb', v: 380 }, { m: 'Mar', v: 340 },
    { m: 'Apr', v: 420 }, { m: 'May', v: 390 }, { m: 'Jun', v: 460 },
    { m: 'Jul', v: 510 }, { m: 'Aug', v: 480 }, { m: 'Sep', v: 540 },
    { m: 'Oct', v: 590, highlight: true }, { m: 'Nov', v: 520 }, { m: 'Dec', v: 470 },
  ];
  const maxMovement = Math.max(...movementData.map(d => d.v));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Operations Overview</h1>
            <span className="gecko-badge gecko-badge-success" style={{ fontSize: 10 }}><span className="gecko-badge-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gecko-success-500)', display: 'inline-block' }} />Live</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Thursday, 23 Apr 2026 · Laem Chabang ICD · Shift A (06:00–14:00)</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 36, border: '1px solid var(--gecko-border)', borderRadius: 6, fontSize: 12, color: 'var(--gecko-text-secondary)', background: 'var(--gecko-bg-surface)' }}>
            <Icon name="calendar" size={14} />
            Today · 23 Apr
            <Icon name="chevronDown" size={12} />
          </div>
          <ExportButton resource="Dashboard" variant="outline" iconSize={14} />
          <Link href="/gate/appointments" className="gecko-btn gecko-btn-primary gecko-btn-sm" style={{ textDecoration: 'none' }}><Icon name="plus" size={14} />New Appointment</Link>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KPICard label="Gate Transactions" sublabel="TODAY" value="150" delta="+12" spark={[120, 128, 135, 122, 140, 145, 138, 150]} icon="invoice" accent="primary" />
        <KPICard label="Truck Turnaround" sublabel="AVG MIN" value="38" delta="-4" spark={[46, 44, 42, 44, 40, 42, 40, 38]} icon="truck" accent="success" />
        <KPICard label="EIR-Out" sublabel="DELIVERIES (DLV)" value="44" delta="-6" deltaKind="down" spark={[52, 50, 48, 56, 50, 46, 48, 44]} icon="arrowUp" accent="accent" />
        <KPICard label="EIR-In" sublabel="RECEIPTS (RCV)" value="65" delta="+8" spark={[50, 55, 58, 54, 60, 62, 60, 65]} icon="arrowDown" accent="info" />
      </div>

      {/* Secondary row: movement chart + shift summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        {/* Monthly movement */}
        <div className="gecko-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Monthly Moves (RCV + DLV)</div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>Last 12 months · all yards · facility rollup</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['3M', '6M', '1Y'].map((p, i) => (
                <button key={p} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ height: 26, padding: '0 10px', fontSize: 11, fontWeight: 600, background: i === 2 ? 'var(--gecko-primary-50)' : 'transparent', color: i === 2 ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)' }}>{p}</button>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative', height: 180 }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 10, color: 'var(--gecko-text-disabled)', paddingRight: 8 }}>
              {[600, 400, 200, 0].map(n => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 24, textAlign: 'right' }}>{n}</span>
                  <div style={{ flex: 1, height: 1, background: n === 0 ? 'var(--gecko-border-strong)' : 'var(--gecko-border)', borderStyle: n === 0 ? 'solid' : 'dashed' }} />
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', left: 36, right: 0, top: 0, bottom: 20, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              {movementData.map((d, i) => {
                const h = (d.v / maxMovement) * 100;
                return (
                  <div key={d.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${h}%`, background: d.highlight ? 'var(--gecko-primary-600)' : 'var(--gecko-primary-200)', borderRadius: '4px 4px 0 0', position: 'relative' }}>
                        {d.highlight && (
                          <div style={{ position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)', background: 'var(--gecko-gray-900)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '3px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{d.v}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ position: 'absolute', left: 36, right: 0, bottom: 0, display: 'flex', gap: 6 }}>
              {movementData.map(d => (
                <div key={d.m} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--gecko-text-secondary)', fontWeight: 500 }}>{d.m}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Shift summary */}
        <div className="gecko-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Shift Summary</div>
            <span className="gecko-badge gecko-badge-primary" style={{ fontSize: 10 }}>SHIFT A</span>
          </div>
          {(() => {
            const colorClassMap: Record<string, string> = {
              'var(--gecko-info-500)': 'info',
              'var(--gecko-primary-500)': 'primary',
              'var(--gecko-success-500)': 'success',
              'var(--gecko-accent-500)': 'accent',
            };
            return [
              { label: 'Empty In', val: 124, pct: 82, color: 'var(--gecko-info-500)' },
              { label: 'Empty Out', val: 98, pct: 65, color: 'var(--gecko-primary-500)' },
              { label: 'Laden In', val: 156, pct: 88, color: 'var(--gecko-success-500)' },
              { label: 'Laden Out', val: 142, pct: 78, color: 'var(--gecko-accent-500)' },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gecko-text-secondary)' }}>{row.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{row.val}</span>
                </div>
                <div className="gecko-progress gecko-progress-sm">
                  <div className={`gecko-progress-bar gecko-progress-${colorClassMap[row.color] || 'primary'}`} style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ));
          })()}
          <div style={{ paddingTop: 10, marginTop: 4, borderTop: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--gecko-text-secondary)' }}>Total TEU</span>
            <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)', fontSize: 13 }}>520 / 600</span>
          </div>
        </div>
      </div>

      {/* Third row: Liner breakdown + Closing voyages */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Line-operator breakdown */}
        <div className="gecko-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Movement by Shipping Line</div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>This week · top 5</div>
            </div>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"><Icon name="moreH" size={16} /></button>
          </div>
          {[
            { name: 'MAERSK', code: 'MSK', v: 1248, pct: 100, color: 'var(--gecko-primary-600)' },
            { name: 'OOCL', code: 'OOL', v: 982, pct: 79, color: 'var(--gecko-info-600)' },
            { name: 'Evergreen', code: 'EGL', v: 764, pct: 61, color: 'var(--gecko-success-600)' },
            { name: 'CMA CGM', code: 'CMA', v: 621, pct: 50, color: 'var(--gecko-accent-600)' },
            { name: 'Hapag-Lloyd', code: 'HLC', v: 438, pct: 35, color: 'var(--gecko-warning-600)' },
          ].map(l => (
            <div key={l.code} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 60px', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--gecko-border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: l.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>{l.code}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{l.name}</div>
                <div className="gecko-progress gecko-progress-sm">
                  <div className="gecko-progress-bar" style={{ width: `${l.pct}%`, background: l.color }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{l.v.toLocaleString()}<div style={{ fontSize: 9, fontWeight: 500, color: 'var(--gecko-text-secondary)', letterSpacing: '0.04em' }}>TEU</div></div>
            </div>
          ))}
        </div>

        {/* Closing voyages */}
        <div className="gecko-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Closing Voyages</div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>Cutoff in next 48 hours</div>
            </div>
            <a href="#" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-primary-600)' }}>View all →</a>
          </div>
          {[
            { voyage: 'MSKK-142E', vessel: 'Maersk Kalmar', eta: '14h 20m', fullPct: 92, emptyPct: 78, risk: 'high' },
            { voyage: 'OOCL-089W', vessel: 'OOCL Hamburg', eta: '22h 05m', fullPct: 64, emptyPct: 54, risk: 'med' },
            { voyage: 'EGL-336N', vessel: 'Ever Given', eta: '36h 40m', fullPct: 48, emptyPct: 38, risk: 'low' },
            { voyage: 'CMA-771S', vessel: 'CMA Rossini', eta: '45h 10m', fullPct: 32, emptyPct: 22, risk: 'low' },
          ].map(v => (
            <div key={v.voyage} style={{ padding: '12px 0', borderBottom: '1px solid var(--gecko-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="ship" size={14} style={{ color: 'var(--gecko-text-secondary)' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)' }}>{v.voyage}</div>
                    <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>{v.vessel}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="clock" size={12} style={{ color: v.risk === 'high' ? 'var(--gecko-error-600)' : v.risk === 'med' ? 'var(--gecko-warning-600)' : 'var(--gecko-success-600)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: v.risk === 'high' ? 'var(--gecko-error-600)' : v.risk === 'med' ? 'var(--gecko-warning-600)' : 'var(--gecko-success-600)' }}>{v.eta}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}><span style={{ color: 'var(--gecko-text-secondary)' }}>FULL</span><span style={{ fontWeight: 700 }}>{v.fullPct}%</span></div>
                  <div className="gecko-progress gecko-progress-sm">
                    <div className="gecko-progress-bar gecko-progress-primary" style={{ width: `${v.fullPct}%` }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}><span style={{ color: 'var(--gecko-text-secondary)' }}>EMPTY</span><span style={{ fontWeight: 700 }}>{v.emptyPct}%</span></div>
                  <div className="gecko-progress gecko-progress-sm">
                    <div className="gecko-progress-bar gecko-progress-accent" style={{ width: `${v.emptyPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity table */}
      <div className="gecko-card">
        <div style={{ padding: 20, borderBottom: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Recent Gate Transactions</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>Last 10 EIR events across all yards</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="filter" size={13} />Filter</button>
            <RefreshButton resource="Dashboard" iconSize={13} />
          </div>
        </div>
        <div className="gecko-table-wrapper" style={{ border: 'none', borderRadius: 0, boxShadow: 'none', overflowX: 'auto' }}>
          <table className="gecko-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Unit</th>
                <th>ISO</th>
                <th>Move</th>
                <th>Line</th>
                <th>Truck</th>
                <th>Time</th>
                <th>Status</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {[
                { ctr: 'MSKU 744218-3', type: '40HC', mv: 'RCV',  liner: 'MSK', truck: '81-4422', t: '14:32', st: 'ok' },
                { ctr: 'OOLU 629114-9', type: '20GP', mv: 'DLV',  liner: 'OOL', truck: '70-9188', t: '14:28', st: 'ok' },
                { ctr: 'TCLU 501123-4', type: '40GP', mv: 'RCV',  liner: 'EGL', truck: '81-1203', t: '14:15', st: 'hold' },
                { ctr: 'CMAU 331876-2', type: '40HC', mv: 'DLV',  liner: 'CMA', truck: '70-4455', t: '14:08', st: 'ok' },
                { ctr: 'HLCU 823412-7', type: '45HC', mv: 'SHFT', liner: 'HLC', truck: '—',       t: '13:59', st: 'ok' },
                { ctr: 'MSKU 442901-0', type: '20GP', mv: 'RCV',  liner: 'MSK', truck: '81-7721', t: '13:45', st: 'err' },
              ].map(r => (
                <tr key={r.ctr}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, fontSize: 12 }}>{r.ctr}</td>
                  <td style={{ padding: '12px 16px' }}><span className="gecko-badge gecko-badge-gray" style={{ fontSize: 10 }}>{r.type}</span></td>
                  <td style={{ padding: '12px 16px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}><Icon name={r.mv === 'RCV' ? 'arrowDown' : r.mv === 'DLV' ? 'arrowUp' : 'refresh'} size={12} stroke={2} style={{ color: r.mv.includes('RCV') ? 'var(--gecko-success-600)' : r.mv.includes('DLV') ? 'var(--gecko-accent-600)' : 'var(--gecko-info-600)' }} />{r.mv}</span></td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600 }}>{r.liner}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{r.truck}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--gecko-font-mono)', fontSize: 11 }}>{r.t}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {r.st === 'ok' && <span className="gecko-badge gecko-badge-success" style={{ fontSize: 10 }}>Complete</span>}
                    {r.st === 'hold' && <span className="gecko-badge gecko-badge-warning" style={{ fontSize: 10 }}>On Hold</span>}
                    {r.st === 'err' && <span className="gecko-badge gecko-badge-error" style={{ fontSize: 10 }}>Discrepancy</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}><button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"><Icon name="moreH" size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
