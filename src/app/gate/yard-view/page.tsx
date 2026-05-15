"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

// ─── Shared types (must match /config/yard-zones) ──────────────────────────────

type BlockType  = 'IMPORT' | 'EXPORT' | 'EMPTY' | 'REEFER' | 'DAMAGE' | 'HAZ' | 'OOG' | 'TRANSHIPMENT';
type Allocation = 'OPEN' | 'LINE_RESERVED' | 'AGENT_RESERVED' | 'CUSTOMER_RESERVED';

interface YardBlock {
  id: string;
  code: string;
  type: BlockType;
  bays: number;
  rows: number;
  tiers: number;
  x: number;
  y: number;
  allocation: Allocation;
  reservedParty: string;
  isoAccepted: string[];
  reeferPlugCount: number;
}

interface YardTemplate {
  version: 1;
  yardId: string;
  name: string;
  savedAt: string;
  canvas: { width: number; height: number; gridPx: number };
  blocks: YardBlock[];
}

const STORAGE_KEY = 'gecko.yardTemplate.lcb.import-yard';
const CANVAS_W = 1400;
const CANVAS_H = 900;
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

const ALLOCATION_LABEL: Record<Allocation, string> = {
  OPEN:               'Open to all',
  LINE_RESERVED:      'Reserved to line',
  AGENT_RESERVED:     'Reserved to agent',
  CUSTOMER_RESERVED:  'Reserved to customer',
};

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// ─── Mock data — deterministic from (blockId, bay, row, tier) ─────────────────

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

interface CellData {
  filledTiers: number;
}

function mockCell(blockId: string, bay: number, row: number, maxTiers: number): CellData {
  const h = hashKey(`${blockId}-${bay}-${row}`);
  // Skew toward "some filled" — bias the distribution so most stacks are 1–maxTiers, with ~15% empty
  const r = h % 100;
  if (r < 15) return { filledTiers: 0 };
  return { filledTiers: 1 + (h % maxTiers) };
}

// Block-level average occupancy for the heatmap bands
function blockAvgOccupancy(b: YardBlock): { occupiedTeu: number; capacity: number; pct: number } {
  let occ = 0;
  for (let bay = 0; bay < b.bays; bay++) {
    for (let row = 0; row < b.rows; row++) {
      occ += mockCell(b.id, bay, row, b.tiers).filledTiers;
    }
  }
  const cap = b.bays * b.rows * b.tiers;
  return { occupiedTeu: occ, capacity: cap, pct: cap > 0 ? occ / cap : 0 };
}

interface ContainerData {
  no: string;
  iso: string;
  customer: string;
  cargoClass: 'NONE' | 'EMPTY' | 'REEFER' | 'HAZ' | 'OOG';
  condition: 'SOUND' | 'DAMAGED';
  weightKg: number;
}

const LINE_PREFIXES = ['MAEU', 'COSU', 'EGHU', 'TGHU', 'YMLU', 'CMAU', 'HLBU', 'APLU', 'MSCU', 'OOLU'];
const CUSTOMERS    = ['TCL Electronics', 'Thai Union Group', 'PTT Global Chemical', 'Siam Cement (SCG)', 'CP Group', 'Central Retail', 'Bangkok Glass', 'Indorama Ventures', 'Minor Intl.', 'AEON (Thailand)', 'Bangchak Corp.'];

// All tiers in one stack share an ISO size — you can't stack 20' on top of 40' in real terminals
function stackIsoSize(blockId: string, blockType: BlockType, bay: number, row: number): string {
  const h = hashKey(`${blockId}-${bay}-${row}-iso`);
  switch (blockType) {
    case 'REEFER': return h % 2 === 0 ? '40RF' : '20RF';
    case 'EMPTY':  return h % 2 === 0 ? '40HC' : '20GP';
    case 'HAZ':    return '20GP';
    case 'OOG':    return '40HC';
    default:       return h % 3 === 0 ? '40HC' : '20GP';
  }
}

function mockContainer(blockId: string, blockType: BlockType, iso: string, bay: number, row: number, tier: number): ContainerData {
  const h = hashKey(`${blockId}-${bay}-${row}-${tier}`);
  const linePrefix = LINE_PREFIXES[h % LINE_PREFIXES.length];
  const serial = (1000000 + (h % 9000000)).toString().padStart(7, '0');

  const cargoClass: ContainerData['cargoClass'] =
    blockType === 'EMPTY'  ? 'EMPTY'  :
    blockType === 'REEFER' ? 'REEFER' :
    blockType === 'HAZ'    ? 'HAZ'    :
    blockType === 'OOG'    ? 'OOG'    : 'NONE';

  const customer = blockType === 'EMPTY' ? '—' : CUSTOMERS[(h >>> 8) % CUSTOMERS.length];
  const condition: 'SOUND' | 'DAMAGED' = (h >>> 16) % 25 === 0 ? 'DAMAGED' : 'SOUND';

  let weightKg: number;
  if (blockType === 'EMPTY') {
    weightKg = (iso === '40HC' || iso === '40RF') ? 3800 : 2200;
  } else {
    weightKg = 5000 + (h % 17000);  // 5–22 t
  }

  return { no: `${linePrefix}${serial}`, iso, customer, cargoClass, condition, weightKg };
}

// ─── Occupancy color bands ────────────────────────────────────────────────────

function occupancyColor(pct: number) {
  if (pct >= 0.85) return { fill: '#fee2e2', stroke: '#dc2626' }; // critical
  if (pct >= 0.60) return { fill: '#fef3c7', stroke: '#d97706' }; // high
  if (pct >= 0.30) return { fill: '#d1fae5', stroke: '#059669' }; // moderate
  if (pct > 0)     return { fill: '#e0f2fe', stroke: '#0284c7' }; // low
  return                  { fill: '#f9fafb', stroke: '#9ca3af' }; // empty
}

function occupancyLabel(pct: number) {
  if (pct >= 0.85) return 'Critical';
  if (pct >= 0.60) return 'High';
  if (pct >= 0.30) return 'Moderate';
  if (pct > 0)     return 'Low';
  return                  'Empty';
}

function rowLabel(rowIdx: number) {
  return String.fromCharCode(65 + rowIdx);
}

function bayLabel(bayIdx: number) {
  return String(bayIdx + 1).padStart(2, '0');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ColorMode = 'occupancy' | 'type';
interface CellSelection { blockId: string; bay: number; row: number; }

export default function YardViewPage() {
  const [template, setTemplate] = useState<YardTemplate | null>(null);
  const [loaded, setLoaded]     = useState(false);
  const [selectedCell, setSelectedCell] = useState<CellSelection | null>(null);
  const [hoveredCell,  setHoveredCell]  = useState<CellSelection | null>(null);
  const [zoom, setZoom] = useState(1.5);                    // default 1.5× so internal grid is visible
  const [colorMode, setColorMode] = useState<ColorMode>('occupancy');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTemplate(JSON.parse(raw));
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  const blocks = template?.blocks ?? [];
  const showInternalGrid = zoom >= 0.75;

  // ── Aggregate stats (cell-level) ────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalCap = 0, totalOccupied = 0, totalCells = 0;
    const cellBands = { empty: 0, low: 0, moderate: 0, high: 0, critical: 0 };

    blocks.forEach(b => {
      for (let bay = 0; bay < b.bays; bay++) {
        for (let row = 0; row < b.rows; row++) {
          totalCells++;
          const cell = mockCell(b.id, bay, row, b.tiers);
          totalCap += b.tiers;
          totalOccupied += cell.filledTiers;
          const pct = cell.filledTiers / b.tiers;
          if (pct >= 0.85)      cellBands.critical++;
          else if (pct >= 0.60) cellBands.high++;
          else if (pct >= 0.30) cellBands.moderate++;
          else if (pct > 0)     cellBands.low++;
          else                  cellBands.empty++;
        }
      }
    });

    return {
      totalCap, totalOccupied, totalCells,
      pct: totalCap ? totalOccupied / totalCap : 0,
      cellBands,
    };
  }, [blocks]);

  const selectedBlock = useMemo(
    () => selectedCell ? blocks.find(b => b.id === selectedCell.blockId) ?? null : null,
    [blocks, selectedCell]
  );

  if (!loaded) return null;

  if (blocks.length === 0) {
    return (
      <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Icon name="grid" size={32} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gecko-text-primary)', margin: 0, marginBottom: 8 }}>No yard layout configured</h2>
        <p style={{ color: 'var(--gecko-text-secondary)', fontSize: 14, maxWidth: 480, margin: '0 auto 24px' }}>
          Build the yard layout in Configuration first. Drop blocks on the canvas, set their type and capacity, and they&apos;ll appear here with live occupancy.
        </p>
        <Link href="/config/yard-zones" className="gecko-btn gecko-btn-primary gecko-btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="settings" size={13} />Open Yard Configuration
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gecko-text-primary)', margin: 0 }}>Yard Plan</h1>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', border: '1px solid var(--gecko-primary-200)' }}>
              {blocks.length} blocks · {stats.totalCells} stacks · {stats.totalCap} TEU
            </span>
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: stats.pct >= 0.85 ? '#fee2e2' : stats.pct >= 0.60 ? '#fef3c7' : '#d1fae5',
              color: stats.pct >= 0.85 ? '#7f1d1d' : stats.pct >= 0.60 ? '#78350f' : '#064e3b',
              border: `1px solid ${stats.pct >= 0.85 ? '#fca5a5' : stats.pct >= 0.60 ? '#fcd34d' : '#86efac'}`,
            }}>
              {Math.round(stats.pct * 100)}% · {stats.totalOccupied} / {stats.totalCap} TEU
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
            Live yard occupancy — Laem Chabang ICD · Import Yard · {template?.savedAt ? `template saved ${new Date(template.savedAt).toLocaleString()}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="gecko-segctrl">
            {(['occupancy', 'type'] as const).map(m => (
              <button key={m} onClick={() => setColorMode(m)} className={`gecko-segctrl-btn${colorMode === m ? ' gecko-segctrl-btn-active' : ''}`}>
                {m === 'occupancy' ? 'Heatmap' : 'By type'}
              </button>
            ))}
          </div>
          <ZoomControl zoom={zoom} setZoom={setZoom} />
          <Link href="/config/yard-zones" className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="edit" size={13} />Edit layout
          </Link>
        </div>
      </div>

      {/* KPI strip — cell-level bands */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <KpiCard label="Empty (0%)"        value={stats.cellBands.empty}    tone="neutral" />
        <KpiCard label="Low (1–30%)"       value={stats.cellBands.low}      tone="info" />
        <KpiCard label="Moderate (30–60%)" value={stats.cellBands.moderate} tone="success" />
        <KpiCard label="High (60–85%)"     value={stats.cellBands.high}     tone="warning" />
        <KpiCard label="Critical (>85%)"   value={stats.cellBands.critical} tone="danger" />
      </div>

      {/* Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedCell ? '1fr 360px' : '1fr', gap: 12, alignItems: 'flex-start' }}>

        {/* Canvas (read-only with cell-level grid) */}
        <section className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflow: 'auto', maxHeight: '72vh', background: '#f9fafb' }}>
            <svg
              width={CANVAS_W * zoom}
              height={CANVAS_H * zoom}
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              style={{ display: 'block', userSelect: 'none', background: '#fafafa' }}
              onClick={e => { if (e.target === e.currentTarget) setSelectedCell(null); }}
            >
              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#fcfcfd" />

              {/* Background dot grid */}
              {Array.from({ length: Math.floor(CANVAS_W / GRID_PX) + 1 }).map((_, i) =>
                Array.from({ length: Math.floor(CANVAS_H / GRID_PX) + 1 }).map((__, j) => (
                  <circle key={`d-${i}-${j}`} cx={i * GRID_PX} cy={j * GRID_PX} r={0.6} fill="#d1d5db" />
                ))
              )}

              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="none" stroke="#d1d5db" strokeWidth={1.5} />
              <text x={14} y={28} fill="#9ca3af" fontSize={14} fontFamily="ui-monospace, monospace" fontWeight={600}>
                LCB · IMPORT YARD · LIVE OCCUPANCY
              </text>

              {/* Blocks */}
              {blocks.map(b => (
                <BlockNodeView
                  key={b.id}
                  block={b}
                  colorMode={colorMode}
                  showInternalGrid={showInternalGrid}
                  selectedCell={selectedCell}
                  hoveredCell={hoveredCell}
                  onCellSelect={(bay, row) => {
                    setSelectedCell(cur =>
                      cur && cur.blockId === b.id && cur.bay === bay && cur.row === row
                        ? null
                        : { blockId: b.id, bay, row }
                    );
                  }}
                  onCellHover={(bay, row) => setHoveredCell({ blockId: b.id, bay, row })}
                  onCellLeave={() => setHoveredCell(null)}
                />
              ))}

              {/* Hover tooltip */}
              {hoveredCell && (() => {
                const b = blocks.find(x => x.id === hoveredCell.blockId);
                if (!b) return null;
                const cell = mockCell(b.id, hoveredCell.bay, hoveredCell.row, b.tiers);
                const pct  = cell.filledTiers / b.tiers;
                const tipX = Math.min(b.x + b.bays * GRID_PX + 8, CANVAS_W - 230);
                const tipY = Math.max(b.y, 36);
                return (
                  <g transform={`translate(${tipX}, ${tipY})`} pointerEvents="none">
                    <rect width={220} height={80} rx={6} fill="#0f172a" opacity={0.94} />
                    <text x={10} y={18} fill="#fff" fontSize={12} fontWeight={700} fontFamily="ui-monospace, monospace">
                      {b.code} · Bay {bayLabel(hoveredCell.bay)} · Row {rowLabel(hoveredCell.row)}
                    </text>
                    <text x={10} y={36} fill="#cbd5e1" fontSize={10}>
                      Block: {BLOCK_TYPES[b.type].label} · {ALLOCATION_LABEL[b.allocation]}
                    </text>
                    <text x={10} y={54} fill="#fff" fontSize={11}>
                      <tspan fontFamily="ui-monospace, monospace" fontWeight={700}>{cell.filledTiers}</tspan>
                      <tspan fontSize={10} fill="#cbd5e1"> / {b.tiers}</tspan>
                      <tspan fontSize={10}> tiers · </tspan>
                      <tspan fontWeight={700}>{Math.round(pct * 100)}%</tspan>
                    </text>
                    <text x={10} y={70} fill="#94a3b8" fontSize={10}>
                      {occupancyLabel(pct)} · click for stack detail
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>
        </section>

        {/* Cell detail drawer */}
        {selectedCell && selectedBlock && (
          <CellDetail
            block={selectedBlock}
            bay={selectedCell.bay}
            row={selectedCell.row}
            onClose={() => setSelectedCell(null)}
          />
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', textAlign: 'center', paddingTop: 4 }}>
        Hover any stack for quick stats · click for the cross-section (vertical tier view) · all occupancy data is mocked for demo (real-time feed wires up in Phase 2)
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, tone }: { label: string; value: number; tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  return (
    <div className="gecko-kpi-tile">
      <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${tone}`} style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)' }}>
        {value}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{label}</div>
        <div className="gecko-kpi-tile-label" style={{ fontSize: 10 }}>stacks in this band</div>
      </div>
    </div>
  );
}

// ─── Zoom control ─────────────────────────────────────────────────────────────

function ZoomControl({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  const idx = ZOOM_LEVELS.indexOf(zoom);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px', background: 'var(--gecko-bg-subtle)', borderRadius: 6, border: '1px solid var(--gecko-border)' }}>
      <button
        className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
        onClick={() => idx > 0 && setZoom(ZOOM_LEVELS[idx - 1])}
        disabled={idx <= 0}
        title="Zoom out"
        style={{ height: 26, width: 26, fontSize: 14 }}
      >−</button>
      <span style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, minWidth: 36, textAlign: 'center', color: 'var(--gecko-text-primary)' }}>
        {Math.round(zoom * 100)}%
      </span>
      <button
        className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
        onClick={() => idx < ZOOM_LEVELS.length - 1 && setZoom(ZOOM_LEVELS[idx + 1])}
        disabled={idx >= ZOOM_LEVELS.length - 1}
        title="Zoom in"
        style={{ height: 26, width: 26, fontSize: 14 }}
      >+</button>
    </div>
  );
}

// ─── Block render (read-only, with internal grid + per-cell cells) ────────────

function BlockNodeView({ block, colorMode, showInternalGrid, selectedCell, hoveredCell, onCellSelect, onCellHover, onCellLeave }: {
  block: YardBlock;
  colorMode: ColorMode;
  showInternalGrid: boolean;
  selectedCell: CellSelection | null;
  hoveredCell: CellSelection | null;
  onCellSelect: (bay: number, row: number) => void;
  onCellHover: (bay: number, row: number) => void;
  onCellLeave: () => void;
}) {
  const typeMeta = BLOCK_TYPES[block.type];
  const w = block.bays * GRID_PX;
  const h = block.rows * GRID_PX;
  const avg = blockAvgOccupancy(block);

  const baseFill = colorMode === 'occupancy' ? occupancyColor(avg.pct).fill : typeMeta.fill;

  return (
    <g transform={`translate(${block.x},${block.y})`}>
      {/* Outer block fill (low-zoom fallback OR base for internal cells) */}
      <rect x={0} y={0} width={w} height={h} fill={baseFill} stroke={typeMeta.stroke} strokeWidth={1.5} />

      {/* Type stripe at top */}
      <rect x={0} y={0} width={w} height={3} fill={typeMeta.stroke} opacity={0.7} />

      {/* Internal grid + per-cell rects (only when zoomed enough to read) */}
      {showInternalGrid && Array.from({ length: block.bays }).map((_, bay) =>
        Array.from({ length: block.rows }).map((__, row) => {
          const cellX = bay * GRID_PX;
          const cellY = row * GRID_PX;
          const cell = mockCell(block.id, bay, row, block.tiers);
          const pct  = cell.filledTiers / block.tiers;
          const fill = colorMode === 'occupancy' ? occupancyColor(pct).fill : typeMeta.fill;
          const isHovered  = hoveredCell?.blockId === block.id && hoveredCell.bay === bay && hoveredCell.row === row;
          const isSelected = selectedCell?.blockId === block.id && selectedCell.bay === bay && selectedCell.row === row;
          return (
            <rect
              key={`${bay}-${row}`}
              x={cellX} y={cellY}
              width={GRID_PX} height={GRID_PX}
              fill={fill}
              stroke={isSelected ? '#0ea5e9' : (isHovered ? '#0ea5e9' : `${typeMeta.stroke}55`)}
              strokeWidth={isSelected ? 2 : (isHovered ? 1.5 : 0.5)}
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onCellSelect(bay, row); }}
              onMouseEnter={() => onCellHover(bay, row)}
              onMouseLeave={onCellLeave}
            />
          );
        })
      )}

      {/* Code (top-left) */}
      <text x={6} y={17} fill={typeMeta.text} fontSize={Math.min(15, Math.max(10, w / 6))} fontWeight={700} fontFamily="ui-monospace, monospace" pointerEvents="none">
        {block.code}
      </text>

      {/* Block avg % (top-right) */}
      {w >= 80 && colorMode === 'occupancy' && (
        <text x={w - 6} y={15} textAnchor="end" fill={typeMeta.text} fontSize={10} fontWeight={700} fontFamily="ui-monospace, monospace" pointerEvents="none">
          {Math.round(avg.pct * 100)}%
        </text>
      )}

      {/* Type label (bottom-center) — only if block big enough */}
      {h >= 60 && (
        <text x={w / 2} y={h - 6} textAnchor="middle" fill={typeMeta.text} fontSize={9} opacity={0.75} fontWeight={700} letterSpacing="0.04em" pointerEvents="none">
          {typeMeta.label.toUpperCase()} · {avg.occupiedTeu}/{avg.capacity} TEU
        </text>
      )}
    </g>
  );
}

// ─── Cell detail (cross-section / stack view) ─────────────────────────────────

function CellDetail({ block, bay, row, onClose }: {
  block: YardBlock; bay: number; row: number; onClose: () => void;
}) {
  const meta     = BLOCK_TYPES[block.type];
  const stackIso = stackIsoSize(block.id, block.type, bay, row);
  const cell     = mockCell(block.id, bay, row, block.tiers);
  const pct      = cell.filledTiers / block.tiers;

  // Tiers rendered top → bottom (tier=tiers at top, tier=1 at bottom = ground)
  const tierRows = Array.from({ length: block.tiers }).map((_, idx) => {
    const tierNum = block.tiers - idx;
    const isFilled = tierNum <= cell.filledTiers;
    const container = isFilled ? mockContainer(block.id, block.type, stackIso, bay, row, tierNum) : null;
    return { tierNum, isFilled, container };
  });

  // Container width depends on ISO length
  const isoWidth = (() => {
    if (stackIso.startsWith('20')) return 150;
    if (stackIso.startsWith('45')) return 260;
    return 240;                          // 40' default
  })();

  const positionStart = `${block.code}-${bayLabel(bay)}-${rowLabel(row)}-01`;
  const positionEnd   = `${block.code}-${bayLabel(bay)}-${rowLabel(row)}-${String(block.tiers).padStart(2, '0')}`;

  return (
    <section className="gecko-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 80, alignSelf: 'flex-start' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Stack cross-section</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: meta.stroke }} />
            {block.code}-{bayLabel(bay)}-{rowLabel(row)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
            <span style={{ color: meta.stroke, fontWeight: 600 }}>{meta.label}</span> · {ALLOCATION_LABEL[block.allocation]}{block.reservedParty ? ` · ${block.reservedParty}` : ''}
          </div>
        </div>
        <button onClick={onClose} className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" title="Close" style={{ height: 28, width: 28 }}>
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* Stack summary */}
      <div style={{ padding: 10, background: 'var(--gecko-bg-subtle)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Stack height</span>
        <span>
          <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{cell.filledTiers}</span>
          <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}> / {block.tiers}</span>
          <span style={{ fontSize: 11, color: occupancyColor(pct).stroke, fontWeight: 700, marginLeft: 10 }}>{Math.round(pct * 100)}% · {occupancyLabel(pct)}</span>
        </span>
      </div>

      {/* Cross-section view */}
      <div style={{ background: 'linear-gradient(180deg, #fafafa 0%, #f3f4f6 100%)', border: '1px solid var(--gecko-border)', borderRadius: 6, padding: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          {tierRows.map(({ tierNum, isFilled, container }) => (
            <TierRow
              key={tierNum}
              tierNum={tierNum}
              isFilled={isFilled}
              container={container}
              isoWidth={isoWidth}
              stackIso={stackIso}
            />
          ))}
          {/* Ground indicator */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, fontSize: 9, color: 'var(--gecko-text-disabled)', letterSpacing: '0.08em', fontWeight: 700 }}>
            <span style={{ flex: 1, height: 1, background: '#9ca3af' }} />
            <span>GROUND · YARD SURFACE</span>
            <span style={{ flex: 1, height: 1, background: '#9ca3af' }} />
          </div>
        </div>
      </div>

      {/* Position footer */}
      <div style={{ padding: '8px 10px', background: 'var(--gecko-bg-subtle)', borderRadius: 6, fontSize: 11 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Position</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontFamily: 'var(--gecko-font-mono)' }}>
          <span style={{ color: 'var(--gecko-text-primary)', fontWeight: 700 }}>{positionStart}</span>
          <span style={{ color: 'var(--gecko-text-disabled)' }}>→</span>
          <span style={{ color: 'var(--gecko-text-primary)', fontWeight: 700 }}>{positionEnd}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
          Block <strong>{block.code}</strong> · Bay <strong>{bayLabel(bay)}</strong> · Row <strong>{rowLabel(row)}</strong> · tiers 01–{String(block.tiers).padStart(2, '0')}
        </div>
      </div>
    </section>
  );
}

// ─── Single tier row in the cross-section ─────────────────────────────────────

function TierRow({ tierNum, isFilled, container, isoWidth, stackIso }: {
  tierNum: number; isFilled: boolean; container: ContainerData | null;
  isoWidth: number; stackIso: string;
}) {
  // Solid container — filled tier
  if (isFilled && container) {
    const isReefer = container.cargoClass === 'REEFER';
    const isHaz    = container.cargoClass === 'HAZ';
    const isEmpty  = container.cargoClass === 'EMPTY';
    const isDamaged = container.condition === 'DAMAGED';

    const ctrFill = isDamaged ? '#fee2e2' :
                    isHaz     ? '#ffedd5' :
                    isReefer  ? '#cffafe' :
                    isEmpty   ? '#f3f4f6' :
                                '#dbeafe';
    const ctrStroke = isDamaged ? '#dc2626' :
                      isHaz     ? '#ea580c' :
                      isReefer  ? '#0891b2' :
                      isEmpty   ? '#6b7280' :
                                  '#2563eb';
    const ctrText   = isDamaged ? '#7f1d1d' :
                      isHaz     ? '#7c2d12' :
                      isReefer  ? '#155e75' :
                      isEmpty   ? '#374151' :
                                  '#1e3a8a';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <span style={{ fontSize: 9, color: 'var(--gecko-text-disabled)', fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', minWidth: 32, textAlign: 'right' }}>
          T-{String(tierNum).padStart(2, '0')}
        </span>
        <div
          style={{
            width: isoWidth,
            padding: '6px 10px',
            background: ctrFill,
            border: `1.5px solid ${ctrStroke}`,
            borderRadius: 3,
            color: ctrText,
            position: 'relative',
            boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {/* Corner casting marks */}
          <span style={{ position: 'absolute', top: 1, left: 1, width: 5, height: 5, background: ctrStroke, opacity: 0.4 }} />
          <span style={{ position: 'absolute', top: 1, right: 1, width: 5, height: 5, background: ctrStroke, opacity: 0.4 }} />
          <span style={{ position: 'absolute', bottom: 1, left: 1, width: 5, height: 5, background: ctrStroke, opacity: 0.4 }} />
          <span style={{ position: 'absolute', bottom: 1, right: 1, width: 5, height: 5, background: ctrStroke, opacity: 0.4 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 11 }}>{container.no}</span>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 9, opacity: 0.75 }}>{stackIso}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.85, gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{container.customer}</span>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', flexShrink: 0 }}>
              {(container.weightKg / 1000).toFixed(1)}t
              {isDamaged && <span style={{ marginLeft: 6, color: '#dc2626', fontWeight: 700 }}> · DMG</span>}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Empty tier — dotted outline
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <span style={{ fontSize: 9, color: 'var(--gecko-text-disabled)', fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', minWidth: 32, textAlign: 'right' }}>
        T-{String(tierNum).padStart(2, '0')}
      </span>
      <div
        style={{
          width: isoWidth,
          padding: '6px 10px',
          background: 'transparent',
          border: '1.5px dashed #cbd5e1',
          borderRadius: 3,
          color: '#94a3b8',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 10,
          fontStyle: 'italic',
        }}
      >
        <span>vacant</span>
        <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 9, opacity: 0.7 }}>{stackIso}</span>
      </div>
    </div>
  );
}
