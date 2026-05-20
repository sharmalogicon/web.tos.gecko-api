"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';

/* ──────────────────────────────────────────────────────────────────────────
   Shared yard schema — mirrors /config/yard-zones + /gate/yard-view.
   Reads the same localStorage template so the dashboard stays in sync with
   what ops actually configured.
   ────────────────────────────────────────────────────────────────────────── */

type BlockType  = 'IMPORT' | 'EXPORT' | 'EMPTY' | 'REEFER' | 'DAMAGE' | 'HAZ' | 'OOG' | 'TRANSHIPMENT';
type Allocation = 'OPEN' | 'LINE_RESERVED' | 'AGENT_RESERVED' | 'CUSTOMER_RESERVED';

interface YardBlock {
  id: string; code: string; type: BlockType;
  bays: number; rows: number; tiers: number;
  x: number; y: number;
  allocation: Allocation; reservedParty: string;
  isoAccepted: string[]; reeferPlugCount: number;
}

interface YardTemplate {
  version: 1; yardId: string; name: string; savedAt: string;
  canvas: { width: number; height: number; gridPx: number };
  blocks: YardBlock[];
}

const STORAGE_KEY = 'gecko.yardTemplate.lcb.import-yard';
const GRID_PX = 20;

const BLOCK_TYPES: Record<BlockType, { label: string; fill: string; stroke: string; text: string }> = {
  IMPORT:       { label: 'Import',  fill: '#dbeafe', stroke: '#2563eb', text: '#1e3a8a' },
  EXPORT:       { label: 'Export',  fill: '#d1fae5', stroke: '#059669', text: '#064e3b' },
  EMPTY:        { label: 'Empty',   fill: '#f3f4f6', stroke: '#6b7280', text: '#374151' },
  REEFER:       { label: 'Reefer',  fill: '#cffafe', stroke: '#0891b2', text: '#155e75' },
  DAMAGE:       { label: 'Damage',  fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d' },
  HAZ:          { label: 'HAZ',     fill: '#ffedd5', stroke: '#ea580c', text: '#7c2d12' },
  OOG:          { label: 'OOG',     fill: '#ede9fe', stroke: '#7c3aed', text: '#4c1d95' },
  TRANSHIPMENT: { label: 'T/S',     fill: '#fef3c7', stroke: '#d97706', text: '#78350f' },
};

/* ──────────────────────────────────────────────────────────────────────────
   Mock data — deterministic from the block hash so the dashboard is stable
   across reloads. In production these come from the live yard inventory API.
   ────────────────────────────────────────────────────────────────────────── */

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

interface BlockMetrics {
  capacityTeu: number;
  occupiedTeu: number;
  occupancyPct: number;
  containerCount: number;
  avgDwellDays: number;
  longestDwellDays: number;
  holdCount: number;
  damagedCount: number;
  reeferActive: number;
  reeferCapacity: number;
}

function blockMetrics(b: YardBlock): BlockMetrics {
  const h = hashKey(b.id);
  const cap = b.bays * b.rows * b.tiers;
  // Occupancy — type-biased so reefer/empty trend higher
  let occRatio: number;
  switch (b.type) {
    case 'IMPORT':       occRatio = 0.55 + ((h % 35) / 100); break;
    case 'EXPORT':       occRatio = 0.42 + ((h % 30) / 100); break;
    case 'EMPTY':        occRatio = 0.70 + ((h % 28) / 100); break;
    case 'REEFER':       occRatio = 0.60 + ((h % 35) / 100); break;
    case 'DAMAGE':       occRatio = 0.20 + ((h % 25) / 100); break;
    case 'HAZ':          occRatio = 0.35 + ((h % 20) / 100); break;
    case 'OOG':          occRatio = 0.25 + ((h % 25) / 100); break;
    case 'TRANSHIPMENT': occRatio = 0.50 + ((h % 30) / 100); break;
  }
  occRatio = Math.min(0.98, occRatio);
  const occupiedTeu = Math.round(cap * occRatio);
  const containerCount = Math.round(occupiedTeu / 1.4); // mix of 20s + 40s

  const avgDwell =
    b.type === 'IMPORT' ? 4 + ((h >>> 4) % 8) :
    b.type === 'EXPORT' ? 2 + ((h >>> 4) % 5) :
    b.type === 'EMPTY'  ? 10 + ((h >>> 4) % 14) :
    b.type === 'REEFER' ? 3 + ((h >>> 4) % 5) :
    b.type === 'DAMAGE' ? 12 + ((h >>> 4) % 20) :
                          5 + ((h >>> 4) % 10);
  const longestDwell = avgDwell + 5 + ((h >>> 8) % 12);

  // Holds = customs/finance/legal — only IMPORT and TRANSHIPMENT realistically
  const holdCount =
    b.type === 'IMPORT' || b.type === 'TRANSHIPMENT'
      ? Math.round(containerCount * (0.04 + ((h >>> 12) % 6) / 100))
      : b.type === 'HAZ' ? Math.round(containerCount * 0.15) : 0;

  // Damaged — every block has a few, more in DAMAGE block obviously
  const damagedCount =
    b.type === 'DAMAGE' ? containerCount :
    Math.round(containerCount * 0.02);

  // Reefer plug status
  const reeferCapacity = b.reeferPlugCount;
  const reeferActive =
    b.type === 'REEFER'
      ? Math.min(reeferCapacity, Math.round(containerCount * 0.85))
      : Math.min(reeferCapacity, Math.round(containerCount * 0.05));

  return {
    capacityTeu: cap,
    occupiedTeu,
    occupancyPct: cap > 0 ? occupiedTeu / cap : 0,
    containerCount,
    avgDwellDays: avgDwell,
    longestDwellDays: longestDwell,
    holdCount,
    damagedCount,
    reeferActive,
    reeferCapacity,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Color lenses
   ────────────────────────────────────────────────────────────────────────── */

type Lens = 'occupancy' | 'dwell' | 'holds' | 'reefer' | 'type';

function occupancyColor(pct: number) {
  if (pct >= 0.85) return { fill: '#fee2e2', stroke: '#dc2626', label: 'Critical (>85%)' };
  if (pct >= 0.60) return { fill: '#fef3c7', stroke: '#d97706', label: 'High (60–85%)' };
  if (pct >= 0.30) return { fill: '#d1fae5', stroke: '#059669', label: 'Moderate (30–60%)' };
  if (pct >  0)    return { fill: '#e0f2fe', stroke: '#0284c7', label: 'Low (<30%)' };
                   return { fill: '#f9fafb', stroke: '#9ca3af', label: 'Empty' };
}

function dwellColor(days: number) {
  if (days >= 14) return { fill: '#fee2e2', stroke: '#dc2626', label: '14+ days' };
  if (days >= 7)  return { fill: '#fef3c7', stroke: '#d97706', label: '7–13 days' };
  if (days >= 4)  return { fill: '#d1fae5', stroke: '#059669', label: '4–6 days' };
  if (days >  0)  return { fill: '#e0f2fe', stroke: '#0284c7', label: '1–3 days' };
                  return { fill: '#f9fafb', stroke: '#9ca3af', label: 'No containers' };
}

function holdsColor(count: number) {
  if (count >= 10) return { fill: '#fee2e2', stroke: '#dc2626', label: '10+ holds' };
  if (count >= 3)  return { fill: '#fef3c7', stroke: '#d97706', label: '3–9 holds' };
  if (count >  0)  return { fill: '#fed7aa', stroke: '#ea580c', label: '1–2 holds' };
                   return { fill: '#d1fae5', stroke: '#059669', label: 'No holds' };
}

function reeferColor(active: number, cap: number, type: BlockType) {
  if (type !== 'REEFER' && cap === 0) return { fill: '#f9fafb', stroke: '#9ca3af', label: 'Not reefer' };
  const pct = cap > 0 ? active / cap : 0;
  if (pct >= 0.85) return { fill: '#fee2e2', stroke: '#dc2626', label: 'Plugs critical (>85%)' };
  if (pct >= 0.60) return { fill: '#fef3c7', stroke: '#d97706', label: 'Plugs high (60–85%)' };
  if (pct >= 0.30) return { fill: '#cffafe', stroke: '#0891b2', label: 'Plugs moderate' };
  if (pct >  0)    return { fill: '#e0f2fe', stroke: '#0284c7', label: 'Plugs low' };
                   return { fill: '#f9fafb', stroke: '#9ca3af', label: 'No plugs active' };
}

function blockColor(b: YardBlock, m: BlockMetrics, lens: Lens) {
  switch (lens) {
    case 'occupancy': return occupancyColor(m.occupancyPct);
    case 'dwell':     return dwellColor(m.avgDwellDays);
    case 'holds':     return holdsColor(m.holdCount);
    case 'reefer':    return reeferColor(m.reeferActive, m.reeferCapacity, b.type);
    case 'type':      return { fill: BLOCK_TYPES[b.type].fill, stroke: BLOCK_TYPES[b.type].stroke, label: BLOCK_TYPES[b.type].label };
  }
}

const LENS_LEGENDS: Record<Lens, { label: string; bands: { fill: string; stroke: string; label: string }[] }> = {
  occupancy: {
    label: 'Block occupancy %',
    bands: [
      { fill: '#fee2e2', stroke: '#dc2626', label: 'Critical (>85%)' },
      { fill: '#fef3c7', stroke: '#d97706', label: 'High (60–85%)' },
      { fill: '#d1fae5', stroke: '#059669', label: 'Moderate (30–60%)' },
      { fill: '#e0f2fe', stroke: '#0284c7', label: 'Low (<30%)' },
      { fill: '#f9fafb', stroke: '#9ca3af', label: 'Empty' },
    ],
  },
  dwell: {
    label: 'Average dwell days',
    bands: [
      { fill: '#fee2e2', stroke: '#dc2626', label: '14+ days' },
      { fill: '#fef3c7', stroke: '#d97706', label: '7–13 days' },
      { fill: '#d1fae5', stroke: '#059669', label: '4–6 days' },
      { fill: '#e0f2fe', stroke: '#0284c7', label: '1–3 days' },
    ],
  },
  holds: {
    label: 'Holds per block',
    bands: [
      { fill: '#fee2e2', stroke: '#dc2626', label: '10+ holds' },
      { fill: '#fef3c7', stroke: '#d97706', label: '3–9 holds' },
      { fill: '#fed7aa', stroke: '#ea580c', label: '1–2 holds' },
      { fill: '#d1fae5', stroke: '#059669', label: 'No holds' },
    ],
  },
  reefer: {
    label: 'Reefer plug utilization',
    bands: [
      { fill: '#fee2e2', stroke: '#dc2626', label: 'Plugs critical (>85%)' },
      { fill: '#fef3c7', stroke: '#d97706', label: 'Plugs high (60–85%)' },
      { fill: '#cffafe', stroke: '#0891b2', label: 'Plugs moderate' },
      { fill: '#e0f2fe', stroke: '#0284c7', label: 'Plugs low' },
      { fill: '#f9fafb', stroke: '#9ca3af', label: 'Not reefer' },
    ],
  },
  type: {
    label: 'Block type',
    bands: (Object.entries(BLOCK_TYPES) as [BlockType, typeof BLOCK_TYPES[BlockType]][]).map(
      ([_k, v]) => ({ fill: v.fill, stroke: v.stroke, label: v.label })
    ),
  },
};

/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */

export default function YardGlancePage() {
  const [template, setTemplate] = useState<YardTemplate | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lens, setLens] = useState<Lens>('occupancy');
  const [now, setNow] = useState(new Date());
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTemplate(JSON.parse(raw));
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  // Auto-refresh tick every 30s — production would re-fetch live inventory
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const blocks = template?.blocks ?? [];

  const metrics = useMemo(() => {
    const map = new Map<string, BlockMetrics>();
    for (const b of blocks) map.set(b.id, blockMetrics(b));
    return map;
  }, [blocks]);

  const totals = useMemo(() => {
    let cap = 0, occ = 0, containers = 0, holds = 0, damaged = 0, reeferActive = 0, reeferCap = 0;
    let dwellSum = 0, dwellCount = 0;
    for (const b of blocks) {
      const m = metrics.get(b.id);
      if (!m) continue;
      cap += m.capacityTeu;
      occ += m.occupiedTeu;
      containers += m.containerCount;
      holds += m.holdCount;
      damaged += m.damagedCount;
      reeferActive += m.reeferActive;
      reeferCap += m.reeferCapacity;
      if (m.containerCount > 0) {
        dwellSum += m.avgDwellDays * m.containerCount;
        dwellCount += m.containerCount;
      }
    }
    return {
      cap, occ, containers, holds, damaged, reeferActive, reeferCap,
      utilPct: cap > 0 ? occ / cap : 0,
      avgDwell: dwellCount > 0 ? dwellSum / dwellCount : 0,
      blockCount: blocks.length,
    };
  }, [blocks, metrics]);

  const hotspots = useMemo(() => {
    return blocks
      .map(b => {
        const m = metrics.get(b.id)!;
        // Priority score blends utilization, holds, and long dwell
        const score = m.occupancyPct * 100 + m.holdCount * 4 + (m.longestDwellDays / 2);
        return { b, m, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [blocks, metrics]);

  const canvasW = template?.canvas.width ?? 1400;
  const canvasH = template?.canvas.height ?? 900;

  if (!loaded) {
    return (
      <div className="gecko-empty-card" style={{ padding: 40 }}>
        Loading yard layout…
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title="No yard configured yet"
        description="Build the yard layout in Configuration first. Drop blocks on the canvas and they'll show up here with live metrics."
        action={
          <Link href="/config/yard-zones" className="gecko-btn gecko-btn-primary gecko-btn-sm">
            <Icon name="settings" size={14} /> Open yard editor
          </Link>
        }
      />
    );
  }

  const LENS_OPTIONS: { value: Lens; label: string; icon: string }[] = [
    { value: 'occupancy', label: 'Occupancy', icon: 'layers' },
    { value: 'dwell',     label: 'Dwell time', icon: 'clock' },
    { value: 'holds',     label: 'Holds',     icon: 'alertTriangle' },
    { value: 'reefer',    label: 'Reefer plugs', icon: 'activity' },
    { value: 'type',      label: 'Block type', icon: 'package' },
  ];

  return (
    <div className="gecko-stack gecko-stack-lg" style={{ paddingBottom: 40 }}>

      {/* Page header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row" style={{ gap: 10, marginBottom: 4 }}>
            <h1 className="gecko-page-title">Yard at a Glance</h1>
            <span className="gecko-pill gecko-pill-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="gecko-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gecko-success-500)' }} />
              Live
            </span>
          </div>
          <p className="gecko-page-subtitle">
            {template?.name ?? 'Yard'} — {blocks.length} blocks · refreshed {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setNow(new Date())}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
          <Link href="/gate/yard-view" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            <Icon name="maximize" size={14} /> Full yard view
          </Link>
          <Link href="/config/yard-zones" className="gecko-btn gecko-btn-ghost gecko-btn-sm">
            <Icon name="settings" size={14} /> Configure
          </Link>
        </div>
      </div>

      {/* KPI strip — 6 columns, no catalog gecko-grid-6 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        <KpiTile
          icon="layers" tone="primary"
          label="Yard utilization"
          value={`${(totals.utilPct * 100).toFixed(1)}%`}
          sub={`${totals.occ.toLocaleString()} / ${totals.cap.toLocaleString()} TEU`}
        />
        <KpiTile
          icon="package" tone="info"
          label="Containers in yard"
          value={totals.containers.toLocaleString()}
          sub={`across ${totals.blockCount} blocks`}
        />
        <KpiTile
          icon="clock" tone={totals.avgDwell >= 7 ? 'warning' : 'success'}
          label="Average dwell"
          value={`${totals.avgDwell.toFixed(1)}`}
          sub="days (weighted)"
        />
        <KpiTile
          icon="alertTriangle" tone={totals.holds > 50 ? 'danger' : totals.holds > 10 ? 'warning' : 'success'}
          label="Holds"
          value={totals.holds.toLocaleString()}
          sub="customs · finance · legal"
        />
        <KpiTile
          icon="activity" tone="info"
          label="Reefer plugs"
          value={`${totals.reeferActive} / ${totals.reeferCap}`}
          sub={totals.reeferCap > 0 ? `${((totals.reeferActive / totals.reeferCap) * 100).toFixed(0)}% utilized` : 'no plugs installed'}
        />
        <KpiTile
          icon="x" tone={totals.damaged > 30 ? 'danger' : 'neutral'}
          label="Damaged units"
          value={totals.damaged.toLocaleString()}
          sub="awaiting M&R disposition"
        />
      </div>

      {/* Mini yard + Hotspots */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'flex-start' }}>

        {/* Mini yard map */}
        <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gecko-section-header-title">Yard map · {LENS_LEGENDS[lens].label}</div>
              <div className="gecko-section-header-subtitle">Hover a block for details · click <strong>Full yard view</strong> for cell-level inspection</div>
            </div>
            <div className="gecko-segctrl">
              {LENS_OPTIONS.map(o => (
                <button
                  key={o.value}
                  className={`gecko-segctrl-btn ${lens === o.value ? 'gecko-segctrl-btn-active' : ''}`}
                  onClick={() => setLens(o.value)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Icon name={o.icon} size={11} /> {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* SVG aerial view */}
          <div style={{ padding: 18, background: '#f8fafc' }}>
            <svg
              viewBox={`0 0 ${canvasW} ${canvasH}`}
              style={{ width: '100%', height: 'auto', maxHeight: 420, display: 'block', background: '#ffffff', borderRadius: 8, border: '1px solid var(--gecko-border)' }}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid backdrop */}
              <defs>
                <pattern id="yardGrid" width={GRID_PX * 5} height={GRID_PX * 5} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID_PX * 5} 0 L 0 0 0 ${GRID_PX * 5}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width={canvasW} height={canvasH} fill="url(#yardGrid)" />

              {blocks.map(b => {
                const m = metrics.get(b.id)!;
                const col = blockColor(b, m, lens);
                const w = b.bays * GRID_PX;
                const h = b.rows * GRID_PX;
                const isHovered = hoveredBlockId === b.id;
                return (
                  <g
                    key={b.id}
                    onMouseEnter={() => setHoveredBlockId(b.id)}
                    onMouseLeave={() => setHoveredBlockId(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={b.x} y={b.y} width={w} height={h}
                      fill={col.fill}
                      stroke={isHovered ? '#0f172a' : col.stroke}
                      strokeWidth={isHovered ? 3 : 1.5}
                      rx={3}
                    />
                    {/* Block code label */}
                    <text
                      x={b.x + w / 2} y={b.y + h / 2 - 2}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(28, Math.max(14, Math.min(w, h) / 6))}
                      fontWeight="700"
                      fill={col.stroke}
                      fontFamily="ui-monospace, SF Mono, Menlo, monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {b.code}
                    </text>
                    {/* Metric value below */}
                    <text
                      x={b.x + w / 2} y={b.y + h / 2 + 22}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(18, Math.max(10, Math.min(w, h) / 10))}
                      fontWeight="600"
                      fill={col.stroke}
                      opacity={0.85}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {lensMetricLabel(lens, m, b.type)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
              {LENS_LEGENDS[lens].bands.map(band => (
                <span key={band.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: band.fill, border: `1.5px solid ${band.stroke}` }} />
                  {band.label}
                </span>
              ))}
            </div>
          </div>

          {/* Hover detail strip */}
          {hoveredBlockId && (() => {
            const b = blocks.find(x => x.id === hoveredBlockId);
            const m = b ? metrics.get(b.id) : undefined;
            if (!b || !m) return null;
            return (
              <div style={{ padding: '10px 18px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
                <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 800, color: BLOCK_TYPES[b.type].stroke }}>{b.code}</span>
                <span className="gecko-pill" style={{ background: BLOCK_TYPES[b.type].fill, color: BLOCK_TYPES[b.type].stroke, border: `1px solid ${BLOCK_TYPES[b.type].stroke}40`, fontSize: 10 }}>
                  {BLOCK_TYPES[b.type].label}
                </span>
                <Metric label="Util"   value={`${(m.occupancyPct * 100).toFixed(0)}%`} />
                <Metric label="TEU"    value={`${m.occupiedTeu}/${m.capacityTeu}`} />
                <Metric label="Cntrs"  value={m.containerCount} />
                <Metric label="Dwell"  value={`${m.avgDwellDays}d avg · ${m.longestDwellDays}d longest`} />
                <Metric label="Holds"  value={m.holdCount} tone={m.holdCount > 0 ? 'warning' : 'neutral'} />
                {b.reeferPlugCount > 0 && (
                  <Metric label="Reefer plugs" value={`${m.reeferActive}/${m.reeferCapacity}`} />
                )}
              </div>
            );
          })()}
        </div>

        {/* Hotspots */}
        <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="alertTriangle" size={14} style={{ color: 'var(--gecko-warning-600)' }} />
            <div className="gecko-section-header-title" style={{ flex: 1 }}>Hotspots</div>
            <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>top 5</span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {hotspots.map(({ b, m }, idx) => {
              const t = BLOCK_TYPES[b.type];
              return (
                <div
                  key={b.id}
                  onMouseEnter={() => setHoveredBlockId(b.id)}
                  onMouseLeave={() => setHoveredBlockId(null)}
                  style={{
                    padding: '12px 18px',
                    borderBottom: idx < hotspots.length - 1 ? '1px solid var(--gecko-border)' : 'none',
                    background: hoveredBlockId === b.id ? 'var(--gecko-bg-subtle)' : 'transparent',
                    cursor: 'pointer', transition: 'background 120ms',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: t.fill, color: t.stroke, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, border: `1px solid ${t.stroke}40` }}>
                      {idx + 1}
                    </div>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 13, fontWeight: 800, color: t.stroke }}>{b.code}</span>
                    <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{t.label}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
                    <span><strong style={{ color: 'var(--gecko-text-primary)' }}>{(m.occupancyPct * 100).toFixed(0)}%</strong> util</span>
                    <span>·</span>
                    <span><strong style={{ color: 'var(--gecko-text-primary)' }}>{m.avgDwellDays}d</strong> dwell</span>
                    {m.holdCount > 0 && (<><span>·</span><span style={{ color: 'var(--gecko-warning-700)' }}><strong>{m.holdCount}</strong> holds</span></>)}
                    {m.damagedCount > 0 && b.type !== 'DAMAGE' && (<><span>·</span><span style={{ color: 'var(--gecko-error-700)' }}><strong>{m.damagedCount}</strong> DM</span></>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Block-by-block table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div className="gecko-section-header-title">Block-by-block breakdown</div>
            <div className="gecko-section-header-subtitle">{blocks.length} blocks · sorted by criticality (utilization × dwell × holds)</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="gecko-table gecko-table-compact" style={{ fontSize: 12, minWidth: 920 }}>
            <thead>
              <tr>
                <th>Block</th>
                <th>Type</th>
                <th>Alloc</th>
                <th style={{ textAlign: 'right' }}>Capacity (TEU)</th>
                <th style={{ textAlign: 'right' }}>Occupied</th>
                <th>Utilization</th>
                <th style={{ textAlign: 'right' }}>Containers</th>
                <th style={{ textAlign: 'right' }}>Avg dwell</th>
                <th style={{ textAlign: 'right' }}>Longest</th>
                <th style={{ textAlign: 'right' }}>Holds</th>
                <th style={{ textAlign: 'right' }}>Reefer plugs</th>
              </tr>
            </thead>
            <tbody>
              {hotspots /* sorted by criticality */
                .concat(
                  blocks
                    .filter(b => !hotspots.some(h => h.b.id === b.id))
                    .map(b => ({ b, m: metrics.get(b.id)!, score: 0 }))
                )
                .map(({ b, m }) => {
                  const t = BLOCK_TYPES[b.type];
                  return (
                    <tr key={b.id} onMouseEnter={() => setHoveredBlockId(b.id)} onMouseLeave={() => setHoveredBlockId(null)} className="gecko-row-clickable">
                      <td className="gecko-text-mono" style={{ fontWeight: 700, color: t.stroke }}>{b.code}</td>
                      <td>
                        <span className="gecko-pill" style={{ background: t.fill, color: t.stroke, border: `1px solid ${t.stroke}40`, fontSize: 10 }}>{t.label}</span>
                      </td>
                      <td style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>
                        {b.allocation === 'OPEN' ? 'Open' : b.reservedParty || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>{m.capacityTeu}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{m.occupiedTeu}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="gecko-progress gecko-progress-sm" style={{ flex: 1, minWidth: 80, background: 'var(--gecko-gray-100)' }}>
                            <div
                              className="gecko-progress-bar"
                              style={{
                                width: `${m.occupancyPct * 100}%`,
                                background:
                                  m.occupancyPct >= 0.85 ? 'var(--gecko-error-500)' :
                                  m.occupancyPct >= 0.60 ? 'var(--gecko-warning-500)' :
                                                            'var(--gecko-success-500)',
                              }}
                            />
                          </div>
                          <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700, minWidth: 36, textAlign: 'right' }}>
                            {(m.occupancyPct * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>{m.containerCount}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', color: m.avgDwellDays >= 7 ? 'var(--gecko-warning-700)' : 'var(--gecko-text-primary)' }}>{m.avgDwellDays}d</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', color: m.longestDwellDays >= 14 ? 'var(--gecko-error-700)' : 'var(--gecko-text-secondary)' }}>{m.longestDwellDays}d</td>
                      <td style={{ textAlign: 'right' }}>
                        {m.holdCount > 0
                          ? <span className="gecko-pill gecko-pill-warning" style={{ fontSize: 10 }}>{m.holdCount}</span>
                          : <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>
                        {b.reeferPlugCount > 0
                          ? `${m.reeferActive}/${m.reeferCapacity}`
                          : <span style={{ color: 'var(--gecko-text-disabled)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Helper components
   ────────────────────────────────────────────────────────────────────────── */

function KpiTile({ icon, tone, label, value, sub }: {
  icon: string; tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  label: string; value: string | number; sub: string;
}) {
  return (
    <div className="gecko-kpi-tile">
      <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${tone}`}><Icon name={icon} size={16} /></div>
      <div className="gecko-kpi-tile-value">{value}</div>
      <div className="gecko-kpi-tile-label">{label}</div>
      <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{label}</span>
      <span style={{
        fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color:
          tone === 'warning' ? 'var(--gecko-warning-700)' : 'var(--gecko-text-primary)',
      }}>
        {value}
      </span>
    </span>
  );
}

function lensMetricLabel(lens: Lens, m: BlockMetrics, type: BlockType): string {
  switch (lens) {
    case 'occupancy': return `${(m.occupancyPct * 100).toFixed(0)}%`;
    case 'dwell':     return `${m.avgDwellDays}d`;
    case 'holds':     return m.holdCount > 0 ? `${m.holdCount} hold${m.holdCount === 1 ? '' : 's'}` : 'clear';
    case 'reefer':    return m.reeferCapacity > 0 ? `${m.reeferActive}/${m.reeferCapacity}` : '—';
    case 'type':      return BLOCK_TYPES[type].label;
  }
}
