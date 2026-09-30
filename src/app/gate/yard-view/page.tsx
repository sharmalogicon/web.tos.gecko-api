"use client";

/**
 * YARD VIEW — live against gecko_tos `yard.vw_container_in_yard`, counted by
 * GET /api/tos/yard/stock, with the yards (name, capacity) from MDM org.yard.
 *
 * KORAKIT locates boxes at yard level: a yard and an area code (the position
 * text the gate wrote — Vector's YardLocation), no blocks, bays, rows or tiers.
 * So this is a yard-level view: each yard's fill against its declared capacity,
 * its areas, and the stock by type, customer and dwell. The box-by-box list is
 * the stock list (/gate/stock); one box's story is the unit inquiry.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { formatDateTime } from '@/lib/api/tos';
import { yardsPath, type Yard } from '@/lib/api/yards';
import {
  YARD_STOCK_PERMISSIONS, occupancy, teuLabel, yardStockPath,
  type StockLoad, type YardStock, type YardStockGroup, type YardStockTally, type YardStockYard,
} from '@/lib/api/yard-stock';

interface Branch { branchId: string; branchCode: string; displayName: string }

const TOP_CUSTOMERS = 10;

// ─── Occupancy color bands ────────────────────────────────────────────────────

function occupancyColor(pct: number) {
  if (pct >= 0.85) return { fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d' }; // critical
  if (pct >= 0.60) return { fill: '#fef3c7', stroke: '#d97706', text: '#78350f' }; // high
  if (pct >= 0.30) return { fill: '#d1fae5', stroke: '#059669', text: '#064e3b' }; // moderate
  if (pct > 0)     return { fill: '#e0f2fe', stroke: '#0284c7', text: '#0c4a6e' }; // low
  return                  { fill: '#f9fafb', stroke: '#9ca3af', text: '#374151' }; // empty
}

function occupancyLabel(pct: number) {
  if (pct >= 0.85) return 'Critical';
  if (pct >= 0.60) return 'High';
  if (pct >= 0.30) return 'Moderate';
  if (pct > 0)     return 'Low';
  return                  'Empty';
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function YardViewPage() {
  const { can, branchesFor } = useSession();
  const [pickedBranch, setPickedBranch] = useState('');
  const [load, setLoad] = useState<StockLoad>('');
  const [selectedYard, setSelectedYard] = useState<string | null>(null);

  const { data: branchRows } = useApiList<Branch>('/api/branches?pageSize=100');
  const mine = new Set(branchesFor(YARD_STOCK_PERMISSIONS.view));
  const depots = (branchRows ?? []).filter(b => mine.size === 0 || mine.has(b.branchId));
  // A yard belongs to one depot, so the view is always for one.
  const branchId = pickedBranch || depots[0]?.branchId || '';

  const mayView = can(YARD_STOCK_PERMISSIONS.view) || mine.size > 0;
  const stock = useApi<YardStock>(branchId && mayView ? yardStockPath({ branchId, fullEmpty: load }) : null);
  const yardDetail = useApi<YardStock>(branchId && selectedYard && selectedYard !== 'none'
    ? yardStockPath({ branchId, yardId: selectedYard, fullEmpty: load }) : null);
  const yards = useApiList<Yard>(branchId ? yardsPath(branchId) : null);

  const data = stock.data;
  const yardById = new Map((yards.data ?? []).map(y => [y.yardId, y]));

  // Every active yard of the depot, stocked or not, then any stock outside a known yard.
  const stockedById = new Map((data?.yards ?? []).map(y => [y.yardId ?? 'none', y]));
  const cards: { key: string; yard: Yard | null; stock: YardStockYard | null }[] = [
    ...(yards.data ?? [])
      .filter(y => y.isActive || stockedById.has(y.yardId))
      .map(y => ({ key: y.yardId, yard: y, stock: stockedById.get(y.yardId) ?? null })),
    ...(data?.yards ?? [])
      .filter(y => !y.yardId || !yardById.has(y.yardId))
      .map(y => ({ key: y.yardId ?? 'none', yard: null, stock: y })),
  ].sort((a, b) => (b.stock?.tally.boxes ?? 0) - (a.stock?.tally.boxes ?? 0));

  const capacity = (yards.data ?? []).filter(y => y.isActive).reduce((n, y) => n + (y.capacityTeu ?? 0), 0);
  const fill = data ? occupancy(data.total.teu, capacity) : null;

  // The breakdown panel reads the selected yard, or the whole depot.
  const focus = selectedYard === 'none'
    ? null
    : selectedYard ? yardDetail.data : data;
  const focusName = selectedYard
    ? (selectedYard === 'none' ? 'Not in a yard' : yardById.get(selectedYard)?.nameEn ?? 'Yard')
    : 'All yards';

  const reload = () => { stock.reload(); yards.reload(); yardDetail.reload(); };
  const error = stock.error;

  return (
    <div className="gecko-stack">

      {/* Toolbar */}
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <div className="gecko-row gecko-row-wrap">
            <h1 className="gecko-page-title">Yard View</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
            {data && (
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', border: '1px solid var(--gecko-primary-200)' }}>
                {cards.length} {cards.length === 1 ? 'yard' : 'yards'} · {data.total.boxes.toLocaleString()} boxes · {teuLabel(data.total.teu)} TEU
              </span>
            )}
            {fill !== null && (
              <span style={{
                fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: occupancyColor(fill).fill, color: occupancyColor(fill).text, border: `1px solid ${occupancyColor(fill).stroke}`,
              }}>
                {pct(fill)} of {capacity.toLocaleString()} TEU capacity
              </span>
            )}
          </div>
          <p className="gecko-page-subtitle">
            What is in each yard now — boxes are located at yard level, by the area the gate wrote
            {data ? ` · as at ${formatDateTime(data.asAt)}` : ''}
          </p>
        </div>

        <div className="gecko-page-header-actions">
          <select className="gecko-input gecko-input-sm" aria-label="Depot" value={branchId}
            onChange={e => { setPickedBranch(e.target.value); setSelectedYard(null); }} style={{ minWidth: 170 }}>
            {depots.length === 0 && <option value="">No depot</option>}
            {depots.map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
          </select>
          <div className="gecko-segctrl">
            {([['', 'All'], ['FULL', 'Full'], ['EMPTY', 'Empty']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setLoad(v)} className={`gecko-segctrl-btn${load === v ? ' gecko-segctrl-btn-active' : ''}`}>
                {label}
              </button>
            ))}
          </div>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={13} /> Refresh
          </button>
          <Link href="/gate/stock" className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-inline-row">
            <Icon name="clipboardList" size={13} />Stock list
          </Link>
        </div>
      </div>

      {error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{error.title}</div>
            {error.explanation && <div>{error.explanation}</div>}
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="gecko-grid-5">
        <KpiCard label="Boxes in the yard" value={data?.total.boxes} sub={data ? `${teuLabel(data.total.teu)} TEU` : ''} tone="primary" />
        <KpiCard label="Full" value={data?.total.full} sub="laden" tone="info" />
        <KpiCard label="Empty" value={data?.total.empty} sub="MTY" tone="neutral" />
        <KpiCard label="On hold" value={data?.total.held} sub="cannot leave" tone="warning" />
        <KpiCard label="Over 30 days" value={data?.total.daysOver30} sub={data ? `longest ${data.total.maxDays} days` : ''} tone="danger" />
      </div>

      {/* Yards */}
      {data && cards.length === 0 && (
        <section className="gecko-card">
          <EmptyState icon="grid" title="Nothing in the yard"
            description={load ? `No ${load === 'FULL' ? 'full' : 'empty'} boxes at this depot right now.` : 'No boxes at this depot right now, and no yard is set up.'} />
        </section>
      )}
      <div className="gecko-grid-2" style={{ alignItems: 'stretch' }}>
        {cards.map(c => (
          <YardCard
            key={c.key}
            yard={c.yard}
            stock={c.stock}
            selected={selectedYard === c.key}
            onSelect={() => setSelectedYard(cur => (cur === c.key ? null : c.key))}
          />
        ))}
      </div>

      {/* Breakdown */}
      {data && data.total.boxes > 0 && (
        <>
          <div className="gecko-row gecko-row-between">
            <div className="gecko-eyebrow">Breakdown · {focusName}</div>
            {selectedYard && (
              <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setSelectedYard(null)}>
                <Icon name="x" size={12} /> All yards
              </button>
            )}
          </div>
          {selectedYard === 'none' && (
            <div className="gecko-helper-text">Boxes not placed in a yard cannot be narrowed further — see the stock list.</div>
          )}
          {focus && (
            <div className="gecko-grid-3" style={{ alignItems: 'flex-start' }}>
              <GroupTable title="By type" noun="Type" groups={focus.types} total={focus.total.boxes} />
              <GroupTable title="By customer" noun="Customer" groups={focus.customers} total={focus.total.boxes} named limit={TOP_CUSTOMERS} />
              <DwellCard tally={focus.total} />
            </div>
          )}
          {selectedYard && selectedYard !== 'none' && yardDetail.loading && !yardDetail.data && (
            <div className="gecko-helper-text">Loading the yard…</div>
          )}
        </>
      )}

      <div className="gecko-helper-text" style={{ textAlign: 'center' }}>
        Fill is TEU against the capacity set on each yard (Masters · Yards) · a box whose type is not in Container Types adds no TEU · click a yard for its breakdown
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, tone }: {
  label: string; value: number | undefined; sub: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}) {
  return (
    <div className="gecko-kpi-tile">
      <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${tone}`} style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', minWidth: 44, width: 'auto', padding: '0 8px' }}>
        {value === undefined ? '…' : value.toLocaleString()}
      </div>
      <div>
        <div className="gecko-cell-primary">{label}</div>
        <div className="gecko-kpi-tile-label" style={{ fontSize: 10 }}>{sub}</div>
      </div>
    </div>
  );
}

// ─── One yard ─────────────────────────────────────────────────────────────────

function YardCard({ yard, stock, selected, onSelect }: {
  yard: Yard | null; stock: YardStockYard | null; selected: boolean; onSelect: () => void;
}) {
  const t = stock?.tally;
  const fill = occupancy(t?.teu ?? 0, yard?.capacityTeu);
  const band = occupancyColor(fill ?? 0);
  const areas = stock?.areas ?? [];
  const biggest = areas.reduce((n, a) => Math.max(n, a.tally.boxes), 0);

  return (
    <section
      className="gecko-card gecko-card-tight gecko-stack"
      onClick={onSelect}
      style={{ cursor: 'pointer', outline: selected ? '2px solid var(--gecko-primary-500)' : undefined, outlineOffset: -1 }}
    >
      <div className="gecko-row gecko-row-between gecko-row-start">
        <div>
          <div className="gecko-row" style={{ gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: band.stroke }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
              {yard ? yard.nameEn : 'Not in a yard'}
            </span>
            {yard && <span className="gecko-mono" style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{yard.yardCode}</span>}
            {yard && !yard.isActive && <span className="gecko-badge gecko-badge-gray">Inactive</span>}
          </div>
          <div className="gecko-cell-meta">
            {yard ? `${yard.yardType} · ${yard.fullEmpty === 'BOTH' ? 'full and empty' : yard.fullEmpty.toLowerCase() + ' only'}` : 'Gated in without a yard'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="gecko-mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{(t?.boxes ?? 0).toLocaleString()}</div>
          <div className="gecko-cell-meta">boxes · {teuLabel(t?.teu ?? 0)} TEU</div>
        </div>
      </div>

      {/* Fill against capacity */}
      <div>
        <div className="gecko-row gecko-row-between" style={{ fontSize: 11, marginBottom: 4 }}>
          <span className="gecko-cell-meta">
            {yard?.capacityTeu ? `Capacity ${yard.capacityTeu.toLocaleString()} TEU` : 'No capacity set'}
          </span>
          {fill !== null && (
            <span style={{ fontWeight: 700, color: band.stroke }}>{pct(fill)} · {occupancyLabel(fill)}</span>
          )}
        </div>
        <div className="gecko-progress">
          <div className="gecko-progress-bar" style={{ width: `${Math.min(100, Math.round((fill ?? 0) * 100))}%`, background: band.stroke }} />
        </div>
      </div>

      {t && (
        <div className="gecko-row gecko-row-wrap" style={{ gap: 12, fontSize: 11 }}>
          <span><strong className="gecko-mono">{t.full}</strong> <span className="gecko-cell-meta">full</span></span>
          <span><strong className="gecko-mono">{t.empty}</strong> <span className="gecko-cell-meta">empty</span></span>
          <span><strong className="gecko-mono">{t.reefer}</strong> <span className="gecko-cell-meta">reefer</span></span>
          <span style={{ color: t.held ? 'var(--gecko-warning-700)' : undefined }}><strong className="gecko-mono">{t.held}</strong> <span className="gecko-cell-meta">on hold</span></span>
          <span style={{ color: t.daysOver30 ? 'var(--gecko-error-700)' : undefined }}><strong className="gecko-mono">{t.daysOver30}</strong> <span className="gecko-cell-meta">over 30 days</span></span>
        </div>
      )}

      {/* Areas — the position text the gate wrote */}
      {areas.length > 0 && (
        <div>
          <div className="gecko-eyebrow gecko-mb-1">Areas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 4 }}>
            {areas.map(a => {
              const share = biggest ? a.tally.boxes / biggest : 0;
              const c = occupancyColor(share);
              return (
                <div key={a.code ?? '—'}
                  title={`${a.code ?? 'No area'}: ${a.tally.boxes} boxes · ${teuLabel(a.tally.teu)} TEU · ${a.tally.full} full / ${a.tally.empty} empty`}
                  style={{ padding: '4px 6px', borderRadius: 4, background: c.fill, border: `1px solid ${c.stroke}55`, color: c.text }}>
                  <div className="gecko-mono gecko-truncate" style={{ fontSize: 11, fontWeight: 700 }}>{a.code ?? '—'}</div>
                  <div className="gecko-mono" style={{ fontSize: 10 }}>{a.tally.boxes}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Breakdown tables ─────────────────────────────────────────────────────────

function GroupTable({ title, noun, groups, total, named = false, limit }: {
  title: string; noun: string; groups: YardStockGroup[]; total: number; named?: boolean; limit?: number;
}) {
  const shown = limit ? groups.slice(0, limit) : groups;
  const rest = groups.length - shown.length;
  return (
    <section className="gecko-table-card">
      <div style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13 }}>{title}</div>
      <table className="gecko-table">
        <thead>
          <tr>
            <th>{noun}</th>
            <th style={{ textAlign: 'right', width: 60 }}>Full</th>
            <th style={{ textAlign: 'right', width: 60 }}>Empty</th>
            <th style={{ textAlign: 'right', width: 70 }}>Boxes</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(g => (
            <tr key={g.code ?? '—'}>
              <td>
                {named && g.name
                  ? <><div className="gecko-cell-primary gecko-truncate" style={{ maxWidth: 180 }}>{g.name}</div><div className="gecko-cell-meta gecko-mono">{g.code}</div></>
                  : <span className="gecko-mono-strong">{g.code ?? '—'}</span>}
              </td>
              <td className="gecko-num-tabular">{g.tally.full}</td>
              <td className="gecko-num-tabular">{g.tally.empty}</td>
              <td className="gecko-num-tabular" style={{ fontWeight: 700 }}>
                {g.tally.boxes}
                <div className="gecko-cell-meta">{total ? pct(g.tally.boxes / total) : ''}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rest > 0 && (
        <div className="gecko-cell-meta" style={{ padding: '8px 12px' }}>
          and {rest} more ({groups.slice(shown.length).reduce((n, g) => n + g.tally.boxes, 0).toLocaleString()} boxes)
        </div>
      )}
    </section>
  );
}

function DwellCard({ tally }: { tally: YardStockTally }) {
  const bands = [
    { label: '0–7 days', n: tally.days0To7, color: '#0284c7' },
    { label: '8–14 days', n: tally.days8To14, color: '#059669' },
    { label: '15–30 days', n: tally.days15To30, color: '#d97706' },
    { label: 'Over 30 days', n: tally.daysOver30, color: '#dc2626' },
  ];
  return (
    <section className="gecko-card gecko-card-tight gecko-stack">
      <div style={{ fontWeight: 700, fontSize: 13 }}>Dwell</div>
      {bands.map(b => (
        <div key={b.label}>
          <div className="gecko-row gecko-row-between" style={{ fontSize: 11, marginBottom: 3 }}>
            <span className="gecko-cell-meta">{b.label}</span>
            <span className="gecko-mono" style={{ fontWeight: 700 }}>{b.n.toLocaleString()}{tally.boxes ? ` · ${pct(b.n / tally.boxes)}` : ''}</span>
          </div>
          <div className="gecko-progress">
            <div className="gecko-progress-bar" style={{ width: `${tally.boxes ? Math.round((b.n / tally.boxes) * 100) : 0}%`, background: b.color }} />
          </div>
        </div>
      ))}
      <div className="gecko-cell-meta">Longest in the yard: <strong>{tally.maxDays}</strong> days · <strong>{tally.reefer}</strong> reefers</div>
    </section>
  );
}
