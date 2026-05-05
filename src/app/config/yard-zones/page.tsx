"use client";
import React, { useState, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PageToolbar } from '@/components/ui/OpsPrimitives';

// ── Types ──────────────────────────────────────────────────────────────────────

type ZoneStatus = 'Active' | 'Inactive';
type BlockStatus = 'Active' | 'Inactive' | 'Reserved';
type IsoRestriction = 'ALL' | '20GP' | '40GP' | '40HC' | 'RFGP' | 'HAZM';

interface Zone {
  id: string;
  name: string;
  color: string;
  blockCount: number;
  totalTeu: number;
  status: ZoneStatus;
}

interface Block {
  id: string;
  zoneId: string;
  blockId: string;
  rows: number;
  bays: number;
  maxTier: number;
  isoRestrictions: IsoRestriction[];
  status: BlockStatus;
  occupiedTeu: number;
}

interface AddBlockDraft {
  blockId: string;
  rows: string;
  bays: string;
  maxTier: string;
  isoRestrictions: IsoRestriction[];
  status: BlockStatus;
}

// ── Seed data ──────────────────────────────────────────────────────────────────

const ZONES: Zone[] = [
  { id: 'z1', name: 'Import Yard',  color: 'var(--gecko-primary-600)',        blockCount: 8,  totalTeu: 1200, status: 'Active'   },
  { id: 'z2', name: 'Export Yard',  color: 'var(--gecko-success-600)',         blockCount: 6,  totalTeu: 900,  status: 'Active'   },
  { id: 'z3', name: 'Reefer Zone',  color: 'var(--gecko-info-500, #3b82f6)',   blockCount: 3,  totalTeu: 240,  status: 'Active'   },
  { id: 'z4', name: 'Hazmat Zone',  color: 'var(--gecko-error-600)',           blockCount: 2,  totalTeu: 80,   status: 'Active'   },
  { id: 'z5', name: 'Empty Depot',  color: 'var(--gecko-warning-500)',         blockCount: 10, totalTeu: 2000, status: 'Active'   },
  { id: 'z6', name: 'Bonded Zone',  color: 'var(--gecko-gray-500, #6b7280)',   blockCount: 4,  totalTeu: 400,  status: 'Inactive' },
];

const ALL_BLOCKS: Block[] = [
  // z1 — Import Yard (8 blocks)
  { id: 'b1',  zoneId: 'z1', blockId: 'A01', rows: 6, bays: 10, maxTier: 5, isoRestrictions: ['ALL'],             status: 'Active',   occupiedTeu: 210 },
  { id: 'b2',  zoneId: 'z1', blockId: 'A02', rows: 6, bays: 10, maxTier: 5, isoRestrictions: ['ALL'],             status: 'Active',   occupiedTeu: 175 },
  { id: 'b3',  zoneId: 'z1', blockId: 'A03', rows: 8, bays: 12, maxTier: 4, isoRestrictions: ['20GP', '40GP'],    status: 'Active',   occupiedTeu: 290 },
  { id: 'b4',  zoneId: 'z1', blockId: 'A04', rows: 8, bays: 12, maxTier: 4, isoRestrictions: ['20GP', '40GP'],    status: 'Active',   occupiedTeu: 310 },
  { id: 'b5',  zoneId: 'z1', blockId: 'A05', rows: 4, bays: 8,  maxTier: 6, isoRestrictions: ['40HC'],            status: 'Active',   occupiedTeu: 90  },
  { id: 'b6',  zoneId: 'z1', blockId: 'A06', rows: 4, bays: 8,  maxTier: 6, isoRestrictions: ['40HC'],            status: 'Active',   occupiedTeu: 78  },
  { id: 'b7',  zoneId: 'z1', blockId: 'A07', rows: 6, bays: 10, maxTier: 5, isoRestrictions: ['ALL'],             status: 'Active',   occupiedTeu: 195 },
  { id: 'b8',  zoneId: 'z1', blockId: 'A08', rows: 6, bays: 10, maxTier: 3, isoRestrictions: ['ALL'],             status: 'Reserved', occupiedTeu: 0   },
  // z2 — Export Yard (6 blocks)
  { id: 'b9',  zoneId: 'z2', blockId: 'B01', rows: 6, bays: 10, maxTier: 5, isoRestrictions: ['ALL'],             status: 'Active',   occupiedTeu: 155 },
  { id: 'b10', zoneId: 'z2', blockId: 'B02', rows: 6, bays: 10, maxTier: 5, isoRestrictions: ['ALL'],             status: 'Active',   occupiedTeu: 180 },
  { id: 'b11', zoneId: 'z2', blockId: 'B03', rows: 8, bays: 10, maxTier: 4, isoRestrictions: ['20GP', '40GP'],    status: 'Active',   occupiedTeu: 240 },
  { id: 'b12', zoneId: 'z2', blockId: 'B04', rows: 8, bays: 10, maxTier: 4, isoRestrictions: ['20GP', '40GP'],    status: 'Active',   occupiedTeu: 195 },
  { id: 'b13', zoneId: 'z2', blockId: 'B05', rows: 4, bays: 8,  maxTier: 5, isoRestrictions: ['40HC'],            status: 'Active',   occupiedTeu: 75  },
  { id: 'b14', zoneId: 'z2', blockId: 'B06', rows: 4, bays: 8,  maxTier: 5, isoRestrictions: ['ALL'],             status: 'Inactive', occupiedTeu: 0   },
  // z3 — Reefer Zone (3 blocks)
  { id: 'b15', zoneId: 'z3', blockId: 'R01', rows: 4, bays: 8,  maxTier: 3, isoRestrictions: ['RFGP'],            status: 'Active',   occupiedTeu: 55  },
  { id: 'b16', zoneId: 'z3', blockId: 'R02', rows: 4, bays: 8,  maxTier: 3, isoRestrictions: ['RFGP'],            status: 'Active',   occupiedTeu: 48  },
  { id: 'b17', zoneId: 'z3', blockId: 'R03', rows: 3, bays: 6,  maxTier: 3, isoRestrictions: ['RFGP'],            status: 'Active',   occupiedTeu: 30  },
  // z4 — Hazmat Zone (2 blocks)
  { id: 'b18', zoneId: 'z4', blockId: 'H01', rows: 2, bays: 8,  maxTier: 2, isoRestrictions: ['HAZM'],            status: 'Active',   occupiedTeu: 18  },
  { id: 'b19', zoneId: 'z4', blockId: 'H02', rows: 2, bays: 8,  maxTier: 2, isoRestrictions: ['HAZM'],            status: 'Active',   occupiedTeu: 24  },
  // z5 — Empty Depot (10 blocks)
  { id: 'b20', zoneId: 'z5', blockId: 'E01', rows: 8, bays: 12, maxTier: 5, isoRestrictions: ['20GP'],            status: 'Active',   occupiedTeu: 290 },
  { id: 'b21', zoneId: 'z5', blockId: 'E02', rows: 8, bays: 12, maxTier: 5, isoRestrictions: ['20GP'],            status: 'Active',   occupiedTeu: 310 },
  { id: 'b22', zoneId: 'z5', blockId: 'E03', rows: 8, bays: 12, maxTier: 5, isoRestrictions: ['40GP'],            status: 'Active',   occupiedTeu: 270 },
  { id: 'b23', zoneId: 'z5', blockId: 'E04', rows: 8, bays: 12, maxTier: 5, isoRestrictions: ['40GP'],            status: 'Active',   occupiedTeu: 255 },
  { id: 'b24', zoneId: 'z5', blockId: 'E05', rows: 6, bays: 10, maxTier: 5, isoRestrictions: ['40HC'],            status: 'Active',   occupiedTeu: 140 },
  { id: 'b25', zoneId: 'z5', blockId: 'E06', rows: 6, bays: 10, maxTier: 5, isoRestrictions: ['40HC'],            status: 'Active',   occupiedTeu: 125 },
  { id: 'b26', zoneId: 'z5', blockId: 'E07', rows: 6, bays: 10, maxTier: 5, isoRestrictions: ['ALL'],             status: 'Active',   occupiedTeu: 190 },
  { id: 'b27', zoneId: 'z5', blockId: 'E08', rows: 6, bays: 10, maxTier: 5, isoRestrictions: ['ALL'],             status: 'Active',   occupiedTeu: 165 },
  { id: 'b28', zoneId: 'z5', blockId: 'E09', rows: 6, bays: 10, maxTier: 5, isoRestrictions: ['ALL'],             status: 'Active',   occupiedTeu: 148 },
  { id: 'b29', zoneId: 'z5', blockId: 'E10', rows: 6, bays: 10, maxTier: 5, isoRestrictions: ['ALL'],             status: 'Reserved', occupiedTeu: 0   },
  // z6 — Bonded Zone (4 blocks)
  { id: 'b30', zoneId: 'z6', blockId: 'C01', rows: 6, bays: 10, maxTier: 4, isoRestrictions: ['ALL'],             status: 'Inactive', occupiedTeu: 0   },
  { id: 'b31', zoneId: 'z6', blockId: 'C02', rows: 6, bays: 10, maxTier: 4, isoRestrictions: ['ALL'],             status: 'Inactive', occupiedTeu: 0   },
  { id: 'b32', zoneId: 'z6', blockId: 'C03', rows: 6, bays: 10, maxTier: 4, isoRestrictions: ['20GP', '40GP'],    status: 'Inactive', occupiedTeu: 0   },
  { id: 'b33', zoneId: 'z6', blockId: 'C04', rows: 6, bays: 10, maxTier: 4, isoRestrictions: ['20GP', '40GP'],    status: 'Inactive', occupiedTeu: 0   },
];

const ISO_ALL: IsoRestriction[] = ['ALL', '20GP', '40GP', '40HC', 'RFGP', 'HAZM'];

const DEFAULT_ADD_DRAFT: AddBlockDraft = {
  blockId: '',
  rows: '6',
  bays: '10',
  maxTier: '5',
  isoRestrictions: ['ALL'],
  status: 'Active',
};

// ── Helper functions ───────────────────────────────────────────────────────────

function teuCapacity(rows: number, bays: number, tier: number): number {
  return rows * bays * tier;
}

function parsePositive(v: string): number {
  const n = parseInt(v, 10);
  return isNaN(n) || n < 1 ? 1 : n;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ZoneStatusBadge({ status }: { status: ZoneStatus }) {
  const isActive = status === 'Active';
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 3, flexShrink: 0,
      background: isActive ? 'var(--gecko-success-50)' : 'var(--gecko-bg-subtle)',
      color: isActive ? 'var(--gecko-success-700)' : 'var(--gecko-text-disabled)',
      border: `1px solid ${isActive ? 'var(--gecko-success-200)' : 'var(--gecko-border)'}`,
    }}>
      {status}
    </span>
  );
}

function BlockStatusBadge({ status, onClick }: { status: BlockStatus; onClick?: () => void }) {
  const cfg: Record<BlockStatus, { bg: string; color: string; border: string }> = {
    Active:   { bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-700)', border: 'var(--gecko-success-200)'  },
    Inactive: { bg: 'var(--gecko-bg-subtle)',   color: 'var(--gecko-text-disabled)', border: 'var(--gecko-border)'     },
    Reserved: { bg: 'var(--gecko-warning-50)',  color: 'var(--gecko-warning-700)', border: 'var(--gecko-warning-200)'  },
  };
  const c = cfg[status];
  return (
    <span
      onClick={onClick}
      style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
        padding: '2px 7px', borderRadius: 3, flexShrink: 0,
        background: c.bg, color: c.color, border: `1px solid ${c.border}`,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      {status}
    </span>
  );
}

function IsoBadge({ iso }: { iso: IsoRestriction }) {
  const cfg: Record<IsoRestriction, { bg: string; color: string }> = {
    ALL:  { bg: 'var(--gecko-primary-50)',  color: 'var(--gecko-primary-700)' },
    '20GP': { bg: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)' },
    '40GP': { bg: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)' },
    '40HC': { bg: 'var(--gecko-info-50, #eff6ff)', color: 'var(--gecko-info-700, #1d4ed8)' },
    RFGP:  { bg: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)' },
    HAZM:  { bg: 'var(--gecko-error-50)',   color: 'var(--gecko-error-700)' },
  };
  const c = cfg[iso];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
      padding: '1px 5px', borderRadius: 3,
      background: c.bg, color: c.color,
      border: '1px solid transparent',
    }}>
      {iso}
    </span>
  );
}

function KpiCard({
  label, value, sub, accent,
}: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 160, padding: '14px 20px',
      background: 'var(--gecko-bg-surface)',
      border: '1px solid var(--gecko-border)', borderRadius: 10,
      borderTop: `3px solid ${accent ?? 'var(--gecko-primary-500)'}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: 'var(--gecko-text-primary)' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function UtilBar({ pct, color }: { pct: number; color: string }) {
  const barColor = pct >= 90 ? 'var(--gecko-error-500)' : pct >= 70 ? 'var(--gecko-warning-500)' : color;
  return (
    <div style={{ height: 4, borderRadius: 2, background: 'var(--gecko-border)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(pct, 100)}%`,
        background: barColor, borderRadius: 2,
        transition: 'width 0.3s',
      }} />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function YardZonesPage() {
  const [selectedZoneId, setSelectedZoneId] = useState<string>('z1');
  const [blocks, setBlocks] = useState<Block[]>(ALL_BLOCKS);
  const [addingBlock, setAddingBlock] = useState(false);
  const [addDraft, setAddDraft] = useState<AddBlockDraft>(DEFAULT_ADD_DRAFT);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Block | null>(null);
  const [savedMsg, setSavedMsg] = useState('');

  const selectedZone = ZONES.find(z => z.id === selectedZoneId) ?? ZONES[0];

  const zoneBlocks = useMemo(
    () => blocks.filter(b => b.zoneId === selectedZoneId),
    [blocks, selectedZoneId],
  );

  // ── KPI computations ────────────────────────────────────────────────────────

  const globalKpi = useMemo(() => {
    const totalTeu = ZONES.reduce((sum, z) => sum + z.totalTeu, 0);
    const activeZones = ZONES.filter(z => z.status === 'Active').length;
    const totalBlocks = ZONES.reduce((sum, z) => sum + z.blockCount, 0);

    let highestUtil = 0;
    let highestZoneName = '';
    ZONES.forEach(z => {
      const zBlocks = blocks.filter(b => b.zoneId === z.id);
      const cap = zBlocks.reduce((s, b) => s + teuCapacity(b.rows, b.bays, b.maxTier), 0);
      const occ = zBlocks.reduce((s, b) => s + b.occupiedTeu, 0);
      const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
      if (pct > highestUtil) { highestUtil = pct; highestZoneName = z.name; }
    });

    return { totalTeu, activeZones, totalBlocks, highestUtil, highestZoneName };
  }, [blocks]);

  const zoneKpi = useMemo(() => {
    const totalCap = zoneBlocks.reduce((s, b) => s + teuCapacity(b.rows, b.bays, b.maxTier), 0);
    const occupiedTeu = zoneBlocks.reduce((s, b) => s + b.occupiedTeu, 0);
    const utilPct = totalCap > 0 ? Math.round((occupiedTeu / totalCap) * 100) : 0;
    return { totalCap, occupiedTeu, utilPct, blockCount: zoneBlocks.length };
  }, [zoneBlocks]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const flash = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const cycleBlockStatus = (blockId: string) => {
    const order: BlockStatus[] = ['Active', 'Inactive', 'Reserved'];
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const next = order[(order.indexOf(b.status) + 1) % order.length];
      return { ...b, status: next };
    }));
  };

  const deleteBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
    flash('Block removed');
  };

  const startEditBlock = (block: Block) => {
    setEditingBlockId(block.id);
    setEditDraft({ ...block });
    setAddingBlock(false);
  };

  const cancelEdit = () => {
    setEditingBlockId(null);
    setEditDraft(null);
  };

  const saveEditBlock = () => {
    if (!editDraft) return;
    setBlocks(prev => prev.map(b => b.id === editDraft.id ? { ...editDraft } : b));
    setEditingBlockId(null);
    setEditDraft(null);
    flash('Block updated');
  };

  const saveAddBlock = () => {
    const rows = parsePositive(addDraft.rows);
    const bays = parsePositive(addDraft.bays);
    const maxTier = parsePositive(addDraft.maxTier);
    const newBlock: Block = {
      id: `b${Date.now()}`,
      zoneId: selectedZoneId,
      blockId: addDraft.blockId.trim() || `BLK${zoneBlocks.length + 1}`,
      rows,
      bays,
      maxTier,
      isoRestrictions: addDraft.isoRestrictions.length ? addDraft.isoRestrictions : ['ALL'],
      status: addDraft.status,
      occupiedTeu: 0,
    };
    setBlocks(prev => [newBlock, ...prev]);
    setAddingBlock(false);
    setAddDraft(DEFAULT_ADD_DRAFT);
    flash('Block added');
  };

  const toggleIsoInDraft = (iso: IsoRestriction, inAdd: boolean) => {
    if (inAdd) {
      setAddDraft(d => {
        const has = d.isoRestrictions.includes(iso);
        return { ...d, isoRestrictions: has ? d.isoRestrictions.filter(x => x !== iso) : [...d.isoRestrictions, iso] };
      });
    } else if (editDraft) {
      setEditDraft(d => {
        if (!d) return d;
        const has = d.isoRestrictions.includes(iso);
        return { ...d, isoRestrictions: has ? d.isoRestrictions.filter(x => x !== iso) : [...d.isoRestrictions, iso] };
      });
    }
  };

  // ── Rendering ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gecko-space-4)' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Yard Zones &amp; Blocks</h1>
            <span className="gecko-badge gecko-badge-info" style={{ fontSize: 10 }}>Config</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
            Define yard layout, block capacities, and container type restrictions per zone
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMsg && (
            <span style={{ fontSize: 12, color: 'var(--gecko-success-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="checkCircle" size={14} /> {savedMsg}
            </span>
          )}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="download" size={14} /> Export
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Global KPI strip ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard
          label="Total Yard Capacity"
          value={globalKpi.totalTeu.toLocaleString() + ' TEU'}
          sub="All zones combined"
          accent="var(--gecko-primary-500)"
        />
        <KpiCard
          label="Active Zones"
          value={globalKpi.activeZones}
          sub={`of ${ZONES.length} configured zones`}
          accent="var(--gecko-success-500)"
        />
        <KpiCard
          label="Total Blocks"
          value={globalKpi.totalBlocks}
          sub="Across all zones"
          accent="var(--gecko-info-500, #3b82f6)"
        />
        <KpiCard
          label="Highest Utilization"
          value={`${globalKpi.highestUtil}%`}
          sub={globalKpi.highestZoneName}
          accent={globalKpi.highestUtil >= 90 ? 'var(--gecko-error-500)' : globalKpi.highestUtil >= 70 ? 'var(--gecko-warning-500)' : 'var(--gecko-success-500)'}
        />
      </div>

      {/* ── Two-column main layout ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── Left panel — Zone list ── */}
        <div style={{
          width: 280, flexShrink: 0,
          background: 'var(--gecko-bg-surface)',
          border: '1px solid var(--gecko-border)',
          borderRadius: 10, overflow: 'hidden',
          position: 'sticky', top: 80,
        }}>
          {/* Left panel header */}
          <div style={{
            padding: '12px 14px', borderBottom: '1px solid var(--gecko-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="layers" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Zones</span>
            </div>
            <button
              className="gecko-btn gecko-btn-primary gecko-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 10px', height: 28 }}
            >
              <Icon name="plus" size={12} /> Add Zone
            </button>
          </div>

          {/* Zone cards */}
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
            {ZONES.map(zone => {
              const isSelected = zone.id === selectedZoneId;
              const zBlocks = blocks.filter(b => b.zoneId === zone.id);
              const zoneCap = zBlocks.reduce((s, b) => s + teuCapacity(b.rows, b.bays, b.maxTier), 0);
              const zoneOcc = zBlocks.reduce((s, b) => s + b.occupiedTeu, 0);
              const pct = zoneCap > 0 ? Math.round((zoneOcc / zoneCap) * 100) : 0;

              return (
                <button
                  key={zone.id}
                  onClick={() => { setSelectedZoneId(zone.id); setAddingBlock(false); cancelEdit(); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '11px 14px',
                    background: isSelected ? 'var(--gecko-primary-50)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--gecko-primary-600)' : '3px solid transparent',
                    borderBottom: '1px solid var(--gecko-bg-subtle)',
                    cursor: 'pointer', border: 'none',
                    borderLeftColor: isSelected ? 'var(--gecko-primary-600)' : 'transparent',
                    borderLeftWidth: 3, borderLeftStyle: 'solid',
                    fontFamily: 'inherit',
                    transition: 'background 0.12s',
                    outline: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: zone.color,
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'var(--gecko-primary-800)' : 'var(--gecko-text-primary)', flex: 1 }}>
                      {zone.name}
                    </span>
                    <ZoneStatusBadge status={zone.status} />
                  </div>
                  <div style={{ paddingLeft: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
                      {zone.blockCount} blocks · {zone.totalTeu.toLocaleString()} TEU cap
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: pct >= 90 ? 'var(--gecko-error-600)' : pct >= 70 ? 'var(--gecko-warning-700)' : 'var(--gecko-text-secondary)' }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{ paddingLeft: 18 }}>
                    <UtilBar pct={pct} color={zone.color} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right panel — Blocks ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Zone header */}
          <div style={{
            padding: '14px 18px',
            background: 'var(--gecko-bg-surface)',
            border: '1px solid var(--gecko-border)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              background: selectedZone.color,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--gecko-text-primary)' }}>
                  {selectedZone.name}
                </h2>
                <ZoneStatusBadge status={selectedZone.status} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
                {zoneKpi.blockCount} blocks · {zoneKpi.totalCap.toLocaleString()} TEU capacity · {zoneKpi.occupiedTeu.toLocaleString()} TEU occupied
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="edit" size={13} /> Edit Zone
              </button>
              <button
                className="gecko-btn gecko-btn-primary gecko-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => { setAddingBlock(true); cancelEdit(); setAddDraft(DEFAULT_ADD_DRAFT); }}
              >
                <Icon name="plus" size={13} /> Add Block
              </button>
            </div>
          </div>

          {/* Zone KPI mini-cards */}
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Total TEU */}
            <div style={{
              flex: 1, padding: '12px 16px',
              background: 'var(--gecko-bg-surface)',
              border: '1px solid var(--gecko-border)', borderRadius: 8,
              borderTop: '2px solid var(--gecko-primary-400)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gecko-text-secondary)', marginBottom: 4 }}>
                Total TEU Capacity
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
                {zoneKpi.totalCap.toLocaleString()}
              </div>
            </div>
            {/* Occupied TEU */}
            <div style={{
              flex: 1, padding: '12px 16px',
              background: 'var(--gecko-bg-surface)',
              border: '1px solid var(--gecko-border)', borderRadius: 8,
              borderTop: `2px solid ${zoneKpi.utilPct >= 90 ? 'var(--gecko-error-500)' : zoneKpi.utilPct >= 70 ? 'var(--gecko-warning-500)' : 'var(--gecko-success-500)'}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gecko-text-secondary)', marginBottom: 4 }}>
                Occupied TEU
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 6 }}>
                {zoneKpi.occupiedTeu.toLocaleString()}
              </div>
              <UtilBar pct={zoneKpi.utilPct} color={selectedZone.color} />
              <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
                {zoneKpi.utilPct}% utilization
              </div>
            </div>
            {/* Block count */}
            <div style={{
              flex: 1, padding: '12px 16px',
              background: 'var(--gecko-bg-surface)',
              border: '1px solid var(--gecko-border)', borderRadius: 8,
              borderTop: '2px solid var(--gecko-info-500, #3b82f6)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gecko-text-secondary)', marginBottom: 4 }}>
                Block Count
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
                {zoneKpi.blockCount}
              </div>
            </div>
          </div>

          {/* Blocks table */}
          <div style={{
            background: 'var(--gecko-bg-surface)',
            border: '1px solid var(--gecko-border)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            {/* Table header bar */}
            <div style={{
              padding: '10px 16px', borderBottom: '1px solid var(--gecko-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="database" size={15} style={{ color: 'var(--gecko-primary-600)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
                  Blocks — {selectedZone.name}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                  background: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)',
                }}>
                  {zoneKpi.blockCount}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="info" size={12} />
                Click status badge to cycle Active → Inactive → Reserved
              </div>
            </div>

            {/* Wide utilization bar */}
            <div style={{ padding: '8px 16px 6px', borderBottom: '1px solid var(--gecko-bg-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>
                  Zone Capacity Utilization
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: zoneKpi.utilPct >= 90 ? 'var(--gecko-error-600)' : zoneKpi.utilPct >= 70 ? 'var(--gecko-warning-700)' : 'var(--gecko-success-700)',
                }}>
                  {zoneKpi.occupiedTeu.toLocaleString()} / {zoneKpi.totalCap.toLocaleString()} TEU ({zoneKpi.utilPct}%)
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--gecko-border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${Math.min(zoneKpi.utilPct, 100)}%`,
                  background: zoneKpi.utilPct >= 90 ? 'var(--gecko-error-500)' : zoneKpi.utilPct >= 70 ? 'var(--gecko-warning-500)' : 'var(--gecko-success-500)',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ background: 'var(--gecko-bg-subtle)' }}>
                    {['Block ID', 'Rows × Bays', 'Max Tier', 'TEU Cap', 'ISO Restrictions', 'Ground Slots', 'Status', 'Actions'].map(col => (
                      <th key={col} style={{
                        padding: '8px 12px', textAlign: 'left',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                        textTransform: 'uppercase', color: 'var(--gecko-text-secondary)',
                        borderBottom: '1px solid var(--gecko-border)',
                        whiteSpace: 'nowrap',
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>

                  {/* Add Block inline row */}
                  {addingBlock && (
                    <tr style={{ background: 'var(--gecko-primary-50)', borderBottom: '1px solid var(--gecko-primary-100)' }}>
                      {/* Block ID */}
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <input
                          className="gecko-input gecko-input-sm"
                          placeholder="e.g. A09"
                          value={addDraft.blockId}
                          onChange={e => setAddDraft(d => ({ ...d, blockId: e.target.value }))}
                          style={{ width: 64, fontFamily: 'monospace', fontWeight: 700 }}
                        />
                      </td>
                      {/* Rows × Bays */}
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            className="gecko-input gecko-input-sm"
                            type="number" min={1} max={99}
                            value={addDraft.rows}
                            onChange={e => setAddDraft(d => ({ ...d, rows: e.target.value }))}
                            style={{ width: 44, textAlign: 'center' }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>×</span>
                          <input
                            className="gecko-input gecko-input-sm"
                            type="number" min={1} max={99}
                            value={addDraft.bays}
                            onChange={e => setAddDraft(d => ({ ...d, bays: e.target.value }))}
                            style={{ width: 44, textAlign: 'center' }}
                          />
                        </div>
                      </td>
                      {/* Max Tier */}
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <input
                          className="gecko-input gecko-input-sm"
                          type="number" min={1} max={10}
                          value={addDraft.maxTier}
                          onChange={e => setAddDraft(d => ({ ...d, maxTier: e.target.value }))}
                          style={{ width: 50, textAlign: 'center' }}
                        />
                      </td>
                      {/* TEU Cap (computed) */}
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
                          {(parsePositive(addDraft.rows) * parsePositive(addDraft.bays) * parsePositive(addDraft.maxTier)).toLocaleString()}
                        </span>
                      </td>
                      {/* ISO */}
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {ISO_ALL.map(iso => (
                            <span
                              key={iso}
                              onClick={() => toggleIsoInDraft(iso, true)}
                              style={{
                                fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3, cursor: 'pointer',
                                background: addDraft.isoRestrictions.includes(iso) ? 'var(--gecko-primary-600)' : 'var(--gecko-bg-subtle)',
                                color: addDraft.isoRestrictions.includes(iso) ? '#fff' : 'var(--gecko-text-secondary)',
                                border: `1px solid ${addDraft.isoRestrictions.includes(iso) ? 'var(--gecko-primary-600)' : 'var(--gecko-border)'}`,
                                userSelect: 'none',
                              }}
                            >
                              {iso}
                            </span>
                          ))}
                        </div>
                      </td>
                      {/* Ground Slots */}
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
                          {parsePositive(addDraft.rows) * parsePositive(addDraft.bays)}
                        </span>
                      </td>
                      {/* Status */}
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <select
                          className="gecko-input gecko-input-sm"
                          value={addDraft.status}
                          onChange={e => setAddDraft(d => ({ ...d, status: e.target.value as BlockStatus }))}
                          style={{ fontSize: 11 }}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Reserved">Reserved</option>
                        </select>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="gecko-btn gecko-btn-primary gecko-btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                            onClick={saveAddBlock}
                          >
                            <Icon name="save" size={12} /> Save
                          </button>
                          <button
                            className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                            onClick={() => setAddingBlock(false)}
                          >
                            <Icon name="x" size={12} /> Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Block rows */}
                  {zoneBlocks.map((block, i) => {
                    const cap = teuCapacity(block.rows, block.bays, block.maxTier);
                    const pct = cap > 0 ? Math.round((block.occupiedTeu / cap) * 100) : 0;
                    const isEditing = editingBlockId === block.id;

                    if (isEditing && editDraft) {
                      return (
                        <tr key={block.id} style={{
                          background: 'var(--gecko-warning-50)',
                          borderBottom: '1px solid var(--gecko-warning-100)',
                        }}>
                          <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                            <input
                              className="gecko-input gecko-input-sm"
                              value={editDraft.blockId}
                              onChange={e => setEditDraft(d => d ? { ...d, blockId: e.target.value } : d)}
                              style={{ width: 64, fontFamily: 'monospace', fontWeight: 700 }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input
                                className="gecko-input gecko-input-sm"
                                type="number" min={1}
                                value={editDraft.rows}
                                onChange={e => setEditDraft(d => d ? { ...d, rows: parseInt(e.target.value) || 1 } : d)}
                                style={{ width: 44, textAlign: 'center' }}
                              />
                              <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>×</span>
                              <input
                                className="gecko-input gecko-input-sm"
                                type="number" min={1}
                                value={editDraft.bays}
                                onChange={e => setEditDraft(d => d ? { ...d, bays: parseInt(e.target.value) || 1 } : d)}
                                style={{ width: 44, textAlign: 'center' }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                            <input
                              className="gecko-input gecko-input-sm"
                              type="number" min={1} max={10}
                              value={editDraft.maxTier}
                              onChange={e => setEditDraft(d => d ? { ...d, maxTier: parseInt(e.target.value) || 1 } : d)}
                              style={{ width: 50, textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
                              {teuCapacity(editDraft.rows, editDraft.bays, editDraft.maxTier).toLocaleString()}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {ISO_ALL.map(iso => (
                                <span
                                  key={iso}
                                  onClick={() => toggleIsoInDraft(iso, false)}
                                  style={{
                                    fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3, cursor: 'pointer',
                                    background: editDraft.isoRestrictions.includes(iso) ? 'var(--gecko-primary-600)' : 'var(--gecko-bg-subtle)',
                                    color: editDraft.isoRestrictions.includes(iso) ? '#fff' : 'var(--gecko-text-secondary)',
                                    border: `1px solid ${editDraft.isoRestrictions.includes(iso) ? 'var(--gecko-primary-600)' : 'var(--gecko-border)'}`,
                                    userSelect: 'none',
                                  }}
                                >
                                  {iso}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                            <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
                              {editDraft.rows * editDraft.bays}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                            <select
                              className="gecko-input gecko-input-sm"
                              value={editDraft.status}
                              onChange={e => setEditDraft(d => d ? { ...d, status: e.target.value as BlockStatus } : d)}
                              style={{ fontSize: 11 }}
                            >
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                              <option value="Reserved">Reserved</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                className="gecko-btn gecko-btn-primary gecko-btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                                onClick={saveEditBlock}
                              >
                                <Icon name="save" size={12} /> Save
                              </button>
                              <button
                                className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                                onClick={cancelEdit}
                              >
                                <Icon name="x" size={12} /> Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={block.id}
                        style={{
                          borderBottom: '1px solid var(--gecko-bg-subtle)',
                          background: i % 2 === 0 ? '#fff' : 'var(--gecko-bg-subtle, #f9fafb)',
                          transition: 'background 0.1s',
                        }}
                      >
                        {/* Block ID */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                          <span style={{
                            fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
                            color: 'var(--gecko-primary-800)',
                          }}>
                            {block.blockId}
                          </span>
                        </td>
                        {/* Rows × Bays */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: 13, color: 'var(--gecko-text-primary)' }}>
                            {block.rows} × {block.bays}
                          </span>
                        </td>
                        {/* Max Tier */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: 13, color: 'var(--gecko-text-primary)' }}>
                            {block.maxTier} high
                          </span>
                        </td>
                        {/* TEU Capacity */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
                              {cap.toLocaleString()}
                            </div>
                            {block.status === 'Active' && (
                              <div style={{ marginTop: 3, width: 80 }}>
                                <UtilBar pct={pct} color="var(--gecko-primary-500)" />
                                <div style={{ fontSize: 9, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
                                  {pct}% used
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        {/* ISO Restrictions */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {block.isoRestrictions.map(iso => (
                              <IsoBadge key={iso} iso={iso} />
                            ))}
                          </div>
                        </td>
                        {/* Ground Slots */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>
                            {(block.rows * block.bays).toLocaleString()}
                          </span>
                        </td>
                        {/* Status */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                          <BlockStatusBadge
                            status={block.status}
                            onClick={() => cycleBlockStatus(block.id)}
                          />
                        </td>
                        {/* Actions */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                              title="Edit block"
                              onClick={() => startEditBlock(block)}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28 }}
                            >
                              <Icon name="edit" size={14} />
                            </button>
                            <button
                              className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                              title="Delete block"
                              onClick={() => deleteBlock(block.id)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28,
                                color: 'var(--gecko-error-500)',
                              }}
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {zoneBlocks.length === 0 && !addingBlock && (
                    <tr>
                      <td colSpan={8} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--gecko-text-secondary)', fontSize: 13 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <Icon name="box" size={28} style={{ color: 'var(--gecko-border)' }} />
                          <span>No blocks defined for this zone.</span>
                          <button
                            className="gecko-btn gecko-btn-primary gecko-btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}
                            onClick={() => { setAddingBlock(true); setAddDraft(DEFAULT_ADD_DRAFT); }}
                          >
                            <Icon name="plus" size={13} /> Add First Block
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div style={{
              padding: '8px 16px', borderTop: '1px solid var(--gecko-border)',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11, color: 'var(--gecko-text-secondary)',
              background: 'var(--gecko-bg-subtle)',
            }}>
              <Icon name="info" size={13} />
              TEU capacity = Rows × Bays × Max Tier Height. Ground slots = Rows × Bays. Click status badge to cycle states.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
