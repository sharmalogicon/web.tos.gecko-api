"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

// ─── Types & constants ────────────────────────────────────────────────────────

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

interface Preset {
  name: string;
  type: BlockType;
  bays: number;
  rows: number;
  tiers: number;
  reeferPlugs?: number;
}

const PRESETS: Preset[] = [
  { name: 'Std Import',   type: 'IMPORT',  bays: 8,  rows: 4, tiers: 3 },
  { name: 'Std Export',   type: 'EXPORT',  bays: 8,  rows: 4, tiers: 3 },
  { name: 'Std Empty',    type: 'EMPTY',   bays: 10, rows: 3, tiers: 4 },
  { name: 'Std Reefer',   type: 'REEFER',  bays: 6,  rows: 3, tiers: 3, reeferPlugs: 54 },
  { name: 'Damage stack', type: 'DAMAGE',  bays: 4,  rows: 2, tiers: 2 },
  { name: 'HAZ stack',    type: 'HAZ',     bays: 4,  rows: 2, tiers: 2 },
  { name: 'OOG bay',      type: 'OOG',     bays: 6,  rows: 2, tiers: 1 },
];

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5];
const ISO_TYPES = ['20', '40', '45'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return 'b' + Math.random().toString(36).slice(2, 9);
}

function snap(v: number) {
  return Math.round(v / GRID_PX) * GRID_PX;
}

function blockCapacity(b: YardBlock) {
  return b.bays * b.rows * b.tiers;
}

function defaultBlockCode(blocks: YardBlock[]) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const ch of letters) {
    if (!blocks.some(b => b.code === ch)) return ch;
  }
  return `B${blocks.length + 1}`;
}

function blockFromPreset(p: Preset, blocks: YardBlock[]): YardBlock {
  const offset = (blocks.length % 8) * GRID_PX;
  return {
    id: uid(),
    code: defaultBlockCode(blocks),
    type: p.type,
    bays: p.bays,
    rows: p.rows,
    tiers: p.tiers,
    x: snap(CANVAS_W / 2 - (p.bays * GRID_PX) / 2 + offset),
    y: snap(CANVAS_H / 2 - (p.rows * GRID_PX) / 2 + offset),
    allocation: 'OPEN',
    reservedParty: '',
    isoAccepted: ['20', '40'],
    reeferPlugCount: p.reeferPlugs ?? 0,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function YardConfigPage() {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<YardBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [templateName, setTemplateName] = useState('Current layout');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const t = JSON.parse(raw) as YardTemplate;
        setBlocks(t.blocks ?? []);
        setTemplateName(t.name ?? 'Current layout');
        setLastSavedAt(t.savedAt ?? null);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  // Debounced auto-save
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      const now = new Date().toISOString();
      const tpl: YardTemplate = {
        version: 1, yardId: 'lcb.import-yard', name: templateName, savedAt: now,
        canvas: { width: CANVAS_W, height: CANVAS_H, gridPx: GRID_PX },
        blocks,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tpl));
        setLastSavedAt(now);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [blocks, templateName, loaded]);

  const selected = useMemo(() => blocks.find(b => b.id === selectedId) ?? null, [blocks, selectedId]);

  const stats = useMemo(() => {
    const totalCap = blocks.reduce((s, b) => s + blockCapacity(b), 0);
    const byType: Record<string, { count: number; cap: number }> = {};
    blocks.forEach(b => {
      byType[b.type] = byType[b.type] ?? { count: 0, cap: 0 };
      byType[b.type].count += 1;
      byType[b.type].cap += blockCapacity(b);
    });
    const reeferPlugs = blocks.filter(b => b.type === 'REEFER').reduce((s, b) => s + (b.reeferPlugCount ?? 0), 0);
    return { totalCap, byType, reeferPlugs, blockCount: blocks.length };
  }, [blocks]);

  // Mutations
  const addPreset = (p: Preset) => {
    const b = blockFromPreset(p, blocks);
    setBlocks(prev => [...prev, b]);
    setSelectedId(b.id);
  };

  const updateBlock = (id: string, patch: Partial<YardBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const clearAll = () => {
    if (!confirm(`Remove all ${blocks.length} block(s) from the canvas?`)) return;
    setBlocks([]);
    setSelectedId(null);
  };

  const exportJson = () => {
    const tpl: YardTemplate = {
      version: 1, yardId: 'lcb.import-yard', name: templateName, savedAt: new Date().toISOString(),
      canvas: { width: CANVAS_W, height: CANVAS_H, gridPx: GRID_PX }, blocks,
    };
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `yard-template-${templateName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast({ variant: 'success', title: 'Template exported', message: 'Downloaded JSON ready for backup or import.' });
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const tpl = JSON.parse(String(reader.result)) as YardTemplate;
        if (!tpl || tpl.version !== 1 || !Array.isArray(tpl.blocks)) throw new Error('Invalid');
        setBlocks(tpl.blocks);
        setTemplateName(tpl.name ?? 'Imported layout');
        setSelectedId(null);
        toast({ variant: 'success', title: 'Template imported', message: `${tpl.blocks.length} blocks loaded.` });
      } catch {
        toast({ variant: 'danger', title: 'Import failed', message: 'File is not a valid Gecko yard template.' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="gecko-stack" style={{ gap: 12 }}>

      {/* Top toolbar */}
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <div className="gecko-row gecko-row-wrap" style={{ gap: 10 }}>
            <h1 className="gecko-page-title">Yard Zones &amp; Blocks</h1>
            <span className="gecko-pill gecko-pill-primary">{stats.blockCount} blocks · {stats.totalCap} TEU</span>
            {stats.reeferPlugs > 0 && (
              <span className="gecko-pill gecko-pill-info">{stats.reeferPlugs} reefer plugs</span>
            )}
          </div>
          <p className="gecko-page-subtitle">
            Visual layout — Laem Chabang ICD · Import Yard · {lastSavedAt ? `auto-saved ${new Date(lastSavedAt).toLocaleTimeString()}` : 'not yet saved'}
          </p>
        </div>

        <div className="gecko-page-header-actions">
          <ZoomControl zoom={zoom} setZoom={setZoom} />
          <label className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-inline-row" style={{ gap: 6, cursor: 'pointer' }}>
            <Icon name="upload" size={13} />
            Import JSON
            <input type="file" accept="application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
          </label>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportJson} disabled={blocks.length === 0}>
            <Icon name="download" size={13} />Export JSON
          </button>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={clearAll} disabled={blocks.length === 0} style={{ color: 'var(--gecko-error-600)' }}>
            <Icon name="trash" size={13} />Clear
          </button>
        </div>
      </div>

      {/* Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 320px', gap: 12, alignItems: 'flex-start' }}>
        <BlockPalette presets={PRESETS} onAdd={addPreset} />
        <Canvas
          ref={svgRef}
          blocks={blocks}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          updateBlock={updateBlock}
          zoom={zoom}
        />
        <PropertiesPanel
          block={selected}
          allBlocks={blocks}
          updateBlock={updateBlock}
          removeBlock={removeBlock}
          stats={stats}
          templateName={templateName}
          setTemplateName={setTemplateName}
        />
      </div>

      <div className="gecko-cell-meta" style={{ textAlign: 'center', paddingTop: 6 }}>
        Click a preset to add a block · drag any block on the canvas to position it · click to select &amp; edit · changes auto-save to this browser
      </div>
    </div>
  );
}

// ─── Block palette ────────────────────────────────────────────────────────────

function BlockPalette({ presets, onAdd }: { presets: Preset[]; onAdd: (p: Preset) => void }) {
  return (
    <section className="gecko-card gecko-stack" style={{ padding: 14, gap: 10 }}>
      <div>
        <div className="gecko-eyebrow">Add block</div>
        <div className="gecko-cell-meta">Click a preset to add</div>
      </div>

      <div className="gecko-stack" style={{ gap: 6 }}>
        {presets.map(p => {
          const meta = BLOCK_TYPES[p.type];
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => onAdd(p)}
              style={{
                display: 'grid', gridTemplateColumns: '14px 1fr auto', alignItems: 'center', gap: 8,
                padding: '8px 10px', border: `1px solid ${meta.stroke}33`,
                background: meta.fill, color: meta.text, borderRadius: 8,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 2, background: meta.stroke, display: 'inline-block' }} />
              <span className="gecko-stack" style={{ gap: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</span>
                <span style={{ fontSize: 10, opacity: 0.75, fontFamily: 'var(--gecko-font-mono)' }}>
                  {p.bays}×{p.rows}×{p.tiers} · {p.bays * p.rows * p.tiers} TEU{p.reeferPlugs ? ` · ${p.reeferPlugs} plugs` : ''}
                </span>
              </span>
              <Icon name="plus" size={12} />
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--gecko-border)' }}>
        <div className="gecko-eyebrow" style={{ marginBottom: 8 }}>Legend</div>
        <div className="gecko-stack" style={{ gap: 4 }}>
          {(Object.keys(BLOCK_TYPES) as BlockType[]).map(t => {
            const m = BLOCK_TYPES[t];
            return (
              <div key={t} className="gecko-row" style={{ gap: 6, fontSize: 11 }}>
                <span style={{ width: 14, height: 10, background: m.fill, border: `1px solid ${m.stroke}`, borderRadius: 2 }} />
                <span style={{ color: 'var(--gecko-text-secondary)' }}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Zoom control ─────────────────────────────────────────────────────────────

function ZoomControl({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  const idx = ZOOM_LEVELS.indexOf(zoom);
  return (
    <div className="gecko-row" style={{ gap: 4, padding: '2px 4px', background: 'var(--gecko-bg-subtle)', borderRadius: 6, border: '1px solid var(--gecko-border)' }}>
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

// ─── Canvas ───────────────────────────────────────────────────────────────────

interface DragState {
  id: string;
  startBlockX: number;
  startBlockY: number;
  mouseStartX: number;
  mouseStartY: number;
  moved: boolean;
}

const Canvas = React.forwardRef<SVGSVGElement, {
  blocks: YardBlock[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  updateBlock: (id: string, p: Partial<YardBlock>) => void;
  zoom: number;
}>(function Canvas({ blocks, selectedId, setSelectedId, updateBlock, zoom }, ref) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const localRef = useRef<SVGSVGElement | null>(null);
  const setRef = useCallback((el: SVGSVGElement | null) => {
    localRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<SVGSVGElement | null>).current = el;
  }, [ref]);

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const svg = localRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  }, [zoom]);

  const onBlockMouseDown = (e: React.MouseEvent, b: YardBlock) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = toSvg(e.clientX, e.clientY);
    setDrag({ id: b.id, startBlockX: b.x, startBlockY: b.y, mouseStartX: pos.x, mouseStartY: pos.y, moved: false });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const pos = toSvg(e.clientX, e.clientY);
    const dx = pos.x - drag.mouseStartX;
    const dy = pos.y - drag.mouseStartY;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    const b = blocks.find(bl => bl.id === drag.id);
    if (!b) return;
    const maxX = CANVAS_W - b.bays * GRID_PX;
    const maxY = CANVAS_H - b.rows * GRID_PX;
    const newX = Math.max(0, Math.min(maxX, drag.startBlockX + dx));
    const newY = Math.max(0, Math.min(maxY, drag.startBlockY + dy));
    updateBlock(drag.id, { x: newX, y: newY });
    if (!drag.moved) setDrag({ ...drag, moved: true });
  };

  const onMouseUp = () => {
    if (!drag) return;
    if (drag.moved) {
      const b = blocks.find(bl => bl.id === drag.id);
      if (b) {
        const maxX = CANVAS_W - b.bays * GRID_PX;
        const maxY = CANVAS_H - b.rows * GRID_PX;
        const x = Math.max(0, Math.min(maxX, snap(b.x)));
        const y = Math.max(0, Math.min(maxY, snap(b.y)));
        updateBlock(drag.id, { x, y });
      }
    } else {
      setSelectedId(drag.id);
    }
    setDrag(null);
  };

  const onCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Deselect when clicking the background
    if (e.target === e.currentTarget) {
      setSelectedId(null);
    } else if ((e.target as Element).getAttribute('data-grid') === 'true') {
      setSelectedId(null);
    }
  };

  const gridLines = useMemo(() => {
    const lines: React.ReactElement[] = [];
    for (let x = 0; x <= CANVAS_W; x += GRID_PX) {
      lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={CANVAS_H} stroke="#e5e7eb" strokeWidth={x % 100 === 0 ? 0.6 : 0.3} />);
    }
    for (let y = 0; y <= CANVAS_H; y += GRID_PX) {
      lines.push(<line key={`h${y}`} x1={0} y1={y} x2={CANVAS_W} y2={y} stroke="#e5e7eb" strokeWidth={y % 100 === 0 ? 0.6 : 0.3} />);
    }
    return lines;
  }, []);

  return (
    <section className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        overflow: 'auto', maxHeight: '78vh', background: '#f9fafb',
      }}>
        <svg
          ref={setRef}
          width={CANVAS_W * zoom}
          height={CANVAS_H * zoom}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onMouseDown={onCanvasMouseDown}
          style={{ display: 'block', userSelect: 'none', background: '#fafafa' }}
        >
          <rect data-grid="true" x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#fcfcfd" />
          {gridLines}
          <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="none" stroke="#d1d5db" strokeWidth={1.5} />
          <text x={14} y={28} fill="#9ca3af" fontSize={14} fontFamily="ui-monospace, monospace" fontWeight={600}>
            LCB · IMPORT YARD · {CANVAS_W / GRID_PX} × {CANVAS_H / GRID_PX} TEU footprint
          </text>

          {blocks.map(b => (
            <BlockNode
              key={b.id}
              block={b}
              selected={selectedId === b.id}
              onMouseDown={e => onBlockMouseDown(e, b)}
            />
          ))}

          {blocks.length === 0 && (
            <g transform={`translate(${CANVAS_W / 2}, ${CANVAS_H / 2})`}>
              <text textAnchor="middle" y={-8} fill="#9ca3af" fontSize={20} fontWeight={700}>Empty yard canvas</text>
              <text textAnchor="middle" y={18} fill="#9ca3af" fontSize={13}>Click a preset on the left to add your first block</text>
            </g>
          )}
        </svg>
      </div>
    </section>
  );
});

// ─── Block render ─────────────────────────────────────────────────────────────

function BlockNode({ block, selected, onMouseDown }: {
  block: YardBlock; selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const meta = BLOCK_TYPES[block.type];
  const w = block.bays * GRID_PX;
  const h = block.rows * GRID_PX;
  const cap = blockCapacity(block);
  const tierStripeHeight = 3;

  return (
    <g
      transform={`translate(${block.x},${block.y})`}
      style={{ cursor: selected ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown}
    >
      <rect
        x={0} y={0} width={w} height={h}
        fill={meta.fill}
        stroke={selected ? '#0ea5e9' : meta.stroke}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      <rect x={0} y={0} width={w} height={tierStripeHeight} fill={meta.stroke} opacity={0.6} />

      <text x={6} y={tierStripeHeight + 14} fill={meta.text} fontSize={Math.min(15, Math.max(10, w / 6))} fontWeight={700} fontFamily="ui-monospace, monospace">
        {block.code}
      </text>

      {w >= 80 && (
        <text x={w - 6} y={tierStripeHeight + 12} textAnchor="end" fill={meta.text} fontSize={9} fontWeight={700} letterSpacing="0.06em">
          {meta.label.toUpperCase()}
        </text>
      )}

      {h >= 50 && (
        <>
          <text x={w / 2} y={h - 14} textAnchor="middle" fill={meta.text} fontSize={9} opacity={0.85} fontFamily="ui-monospace, monospace">
            {block.bays}×{block.rows}×{block.tiers}
          </text>
          <text x={w / 2} y={h - 4} textAnchor="middle" fill={meta.text} fontSize={9} opacity={0.85} fontFamily="ui-monospace, monospace">
            {cap} TEU{block.type === 'REEFER' && block.reeferPlugCount ? ` · ${block.reeferPlugCount}p` : ''}
          </text>
        </>
      )}

      {block.allocation !== 'OPEN' && h >= 60 && (
        <g transform={`translate(4, ${h - 28})`}>
          <rect x={0} y={0} width={6} height={6} rx={1.5} fill={meta.stroke} />
          <text x={10} y={6} fill={meta.text} fontSize={8} fontWeight={600}>
            {block.reservedParty || 'Reserved'}
          </text>
        </g>
      )}

      {selected && (
        <rect x={-3} y={-3} width={w + 6} height={h + 6} fill="none" stroke="#0ea5e9" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
      )}
    </g>
  );
}

// ─── Properties panel ────────────────────────────────────────────────────────

function PropertiesPanel({ block, allBlocks, updateBlock, removeBlock, stats, templateName, setTemplateName }: {
  block: YardBlock | null; allBlocks: YardBlock[];
  updateBlock: (id: string, p: Partial<YardBlock>) => void;
  removeBlock: (id: string) => void;
  stats: { totalCap: number; byType: Record<string, { count: number; cap: number }>; reeferPlugs: number; blockCount: number };
  templateName: string; setTemplateName: (s: string) => void;
}) {

  if (!block) {
    return (
      <section className="gecko-card gecko-stack" style={{ padding: 14, gap: 14 }}>
        <div>
          <div className="gecko-eyebrow">Template</div>
          <div className="gecko-cell-meta">Auto-saved to this browser</div>
        </div>
        <PropField label="Template name">
          <input
            className="gecko-input gecko-input-sm"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            placeholder="e.g., Current layout"
          />
        </PropField>

        <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--gecko-border)' }}>
          <div className="gecko-eyebrow" style={{ marginBottom: 8 }}>Yard summary</div>
          <div className="gecko-stack" style={{ gap: 4 }}>
            <SummaryRow label="Total blocks"   value={stats.blockCount} />
            <SummaryRow label="Total capacity" value={`${stats.totalCap} TEU`} />
            <SummaryRow label="Reefer plugs"   value={stats.reeferPlugs} />
          </div>
        </div>

        {stats.blockCount > 0 && (
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--gecko-border)' }}>
            <div className="gecko-eyebrow" style={{ marginBottom: 8 }}>By type</div>
            <div className="gecko-stack" style={{ gap: 4 }}>
              {(Object.keys(stats.byType) as BlockType[]).map(t => {
                const m = BLOCK_TYPES[t];
                const s = stats.byType[t];
                return (
                  <div key={t} className="gecko-row gecko-row-between" style={{ fontSize: 11 }}>
                    <span className="gecko-inline-row" style={{ gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: m.stroke }} />
                      {m.label}
                    </span>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)' }}>
                      {s.count} · {s.cap} TEU
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 4, padding: 10, background: 'var(--gecko-bg-subtle)', borderRadius: 6, fontSize: 11, color: 'var(--gecko-text-secondary)', lineHeight: 1.5 }}>
          Click any block on the canvas to edit its properties here.
        </div>
      </section>
    );
  }

  const meta = BLOCK_TYPES[block.type];
  const cap = blockCapacity(block);
  const codeDuplicate = allBlocks.some(b => b.id !== block.id && b.code === block.code);

  return (
    <section className="gecko-card gecko-stack" style={{ padding: 14, gap: 14 }}>
      <div className="gecko-row gecko-row-between" style={{ gap: 8 }}>
        <div>
          <div className="gecko-eyebrow">Block</div>
          <div className="gecko-row" style={{ fontSize: 16, fontWeight: 700, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: meta.stroke }} />
            {block.code}
          </div>
        </div>
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => removeBlock(block.id)} style={{ color: 'var(--gecko-error-600)' }}>
          <Icon name="trash" size={13} />Remove
        </button>
      </div>

      <div className="gecko-grid-2" style={{ gap: 8 }}>
        <PropField label="Code">
          <input
            className="gecko-input gecko-input-sm"
            value={block.code}
            onChange={e => updateBlock(block.id, { code: e.target.value.toUpperCase().slice(0, 4) })}
            style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, borderColor: codeDuplicate ? 'var(--gecko-error-600)' : undefined }}
          />
          {codeDuplicate && <div style={{ fontSize: 10, color: 'var(--gecko-error-700)', marginTop: 3 }}>Code already used</div>}
        </PropField>
        <PropField label="Type">
          <select
            className="gecko-input gecko-input-sm"
            value={block.type}
            onChange={e => updateBlock(block.id, { type: e.target.value as BlockType })}
          >
            {(Object.keys(BLOCK_TYPES) as BlockType[]).map(t => (
              <option key={t} value={t}>{BLOCK_TYPES[t].label}</option>
            ))}
          </select>
        </PropField>
      </div>

      <div className="gecko-grid-3" style={{ gap: 8 }}>
        <PropField label="Bays">
          <input
            className="gecko-input gecko-input-sm" type="number" min={1} max={40}
            value={block.bays}
            onChange={e => updateBlock(block.id, { bays: Math.max(1, Math.min(40, parseInt(e.target.value, 10) || 1)) })}
            style={{ fontFamily: 'var(--gecko-font-mono)' }}
          />
        </PropField>
        <PropField label="Rows">
          <input
            className="gecko-input gecko-input-sm" type="number" min={1} max={20}
            value={block.rows}
            onChange={e => updateBlock(block.id, { rows: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) })}
            style={{ fontFamily: 'var(--gecko-font-mono)' }}
          />
        </PropField>
        <PropField label="Tiers">
          <input
            className="gecko-input gecko-input-sm" type="number" min={1} max={6}
            value={block.tiers}
            onChange={e => updateBlock(block.id, { tiers: Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 1)) })}
            style={{ fontFamily: 'var(--gecko-font-mono)' }}
          />
        </PropField>
      </div>

      <div className="gecko-row gecko-row-between" style={{ padding: 10, background: 'var(--gecko-bg-subtle)', borderRadius: 6, fontSize: 12 }}>
        <span style={{ color: 'var(--gecko-text-secondary)' }}>Capacity</span>
        <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
          {cap} TEU <span style={{ color: 'var(--gecko-text-secondary)', fontWeight: 500 }}>({block.bays}×{block.rows}×{block.tiers})</span>
        </span>
      </div>

      <PropField label="Allocation policy">
        <select
          className="gecko-input gecko-input-sm"
          value={block.allocation}
          onChange={e => updateBlock(block.id, { allocation: e.target.value as Allocation, reservedParty: e.target.value === 'OPEN' ? '' : block.reservedParty })}
        >
          {(Object.keys(ALLOCATION_LABEL) as Allocation[]).map(a => (
            <option key={a} value={a}>{ALLOCATION_LABEL[a]}</option>
          ))}
        </select>
      </PropField>

      {block.allocation !== 'OPEN' && (
        <PropField label={block.allocation === 'LINE_RESERVED' ? 'Line code' : block.allocation === 'AGENT_RESERVED' ? 'Agent code' : 'Customer code'}>
          <input
            className="gecko-input gecko-input-sm"
            value={block.reservedParty}
            onChange={e => updateBlock(block.id, { reservedParty: e.target.value.toUpperCase() })}
            placeholder={block.allocation === 'LINE_RESERVED' ? 'e.g., MAERSK' : block.allocation === 'AGENT_RESERVED' ? 'e.g., MAEU-TH' : 'e.g., SCG'}
            style={{ fontFamily: 'var(--gecko-font-mono)' }}
          />
        </PropField>
      )}

      <PropField label="ISO sizes accepted">
        <div className="gecko-row" style={{ gap: 6 }}>
          {ISO_TYPES.map(iso => {
            const on = block.isoAccepted.includes(iso);
            return (
              <button
                key={iso} type="button"
                onClick={() => {
                  const next = on ? block.isoAccepted.filter(x => x !== iso) : [...block.isoAccepted, iso];
                  updateBlock(block.id, { isoAccepted: next });
                }}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)',
                  cursor: 'pointer', border: `1px solid ${on ? 'var(--gecko-primary-600)' : 'var(--gecko-border)'}`,
                  background: on ? 'var(--gecko-primary-600)' : 'transparent',
                  color: on ? '#fff' : 'var(--gecko-text-secondary)',
                }}
              >{iso}&apos;</button>
            );
          })}
        </div>
      </PropField>

      {block.type === 'REEFER' && (
        <PropField label="Reefer plug count">
          <input
            className="gecko-input gecko-input-sm" type="number" min={0} max={500}
            value={block.reeferPlugCount}
            onChange={e => updateBlock(block.id, { reeferPlugCount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            style={{ fontFamily: 'var(--gecko-font-mono)' }}
          />
        </PropField>
      )}

      <div className="gecko-grid-2" style={{ paddingTop: 10, borderTop: '1px solid var(--gecko-border)', gap: 8 }}>
        <PropField label="X position">
          <input
            className="gecko-input gecko-input-sm" type="number"
            value={block.x}
            onChange={e => updateBlock(block.id, { x: snap(Math.max(0, parseInt(e.target.value, 10) || 0)) })}
            style={{ fontFamily: 'var(--gecko-font-mono)' }}
          />
        </PropField>
        <PropField label="Y position">
          <input
            className="gecko-input gecko-input-sm" type="number"
            value={block.y}
            onChange={e => updateBlock(block.id, { y: snap(Math.max(0, parseInt(e.target.value, 10) || 0)) })}
            style={{ fontFamily: 'var(--gecko-font-mono)' }}
          />
        </PropField>
      </div>
    </section>
  );
}

function PropField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gecko-field">
      <label className="gecko-field-label">{label}</label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="gecko-row gecko-row-between" style={{ fontSize: 11.5 }}>
      <span style={{ color: 'var(--gecko-text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{value}</span>
    </div>
  );
}
