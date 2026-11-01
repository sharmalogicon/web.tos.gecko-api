"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { PartyPicker } from '@/components/ui/PartyPicker';
import { useToast } from '@/components/ui/Toast';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { useApi } from '@/lib/api/use-api';
import { rememberAnswer } from '@/lib/api/api-cache';
import { ApiError } from '@/lib/api/problem';
import {
  BLOCK_SIZES, BLOCK_TYPES, blockBody, createYardBlock, deleteYardBlock, generateYardSlots,
  saveYardLayout, updateYardBlock, useYardMap, useYardSettings, yardBlocksPath,
  type BlockType, type SaveYardBlock, type YardBlock, type YardBlockPlacement,
} from '@/lib/api/yard-map';
import {
  CANVAS_H, CANVAS_W, GRID_PX, TYPE_STYLE, UNTYPED_STYLE,
  blockBox, blockStyle, isPlaced, snap, typeLabel,
} from '@/components/yard/block-style';
import { YardMapOff } from '@/components/yard/YardMapOff';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

/**
 * THE YARD, AS THE DEPOT DRAWS IT — on the server, not in this browser.
 *
 * This screen used to keep the whole layout in localStorage under
 * `gecko.yardTemplate.lcb.import-yard`: one key, one hard-coded yard, and a
 * layout that existed only in the browser that drew it. A supervisor who laid
 * the yard out on the office PC had drawn nothing at all as far as the gate was
 * concerned, and a cleared cache lost it. Import JSON / Export JSON / Clear all
 * were the backup plan for that, and they are gone with it.
 *
 * Now every block is a row of gecko_master org.yard_block:
 *
 *   GET    /api/master/yards/{yardId}/blocks      the yard's blocks
 *   POST   /api/master/yards/{yardId}/blocks      a preset adds one
 *   PUT    /api/master/yard-blocks/{id}           the properties panel saves one
 *   PUT    /api/master/yards/{yardId}/layout      a drag saves positions, all or none
 *   POST   /api/master/yard-blocks/{id}/slots/generate   rows × bays × tiers
 *   DELETE /api/master/yard-blocks/{id}?rowVersion=
 *
 * EVERY WRITE ANSWERS WITH THE BLOCK AS IT NOW IS, and that answer replaces
 * what is on the canvas. It is the only way the next write has a rowVersion the
 * server will accept, and it means a save costs one round trip, not two.
 * `reload()` is for the one case where our copy is known to be wrong: a 409.
 *
 * Changing anything needs `mdm.org.manage` AT THIS DEPOT. Without it the canvas
 * still draws — a clerk may need to see where a block is — and nothing moves.
 */

interface Preset {
  name: string;
  type: BlockType;
  bays: number;
  rows: number;
  tiers: number;
}

/** The shapes a depot actually stacks. Same list as before the server had them. */
const PRESETS: Preset[] = [
  { name: 'Std Import',   type: 'IMPORT',  bays: 8,  rows: 4, tiers: 3 },
  { name: 'Std Export',   type: 'EXPORT',  bays: 8,  rows: 4, tiers: 3 },
  { name: 'Std Empty',    type: 'EMPTY',   bays: 10, rows: 3, tiers: 4 },
  { name: 'Std Reefer',   type: 'REEFER',  bays: 6,  rows: 3, tiers: 3 },
  { name: 'Damage stack', type: 'DAMAGE',  bays: 4,  rows: 2, tiers: 2 },
  { name: 'HAZ stack',    type: 'HAZ',     bays: 4,  rows: 2, tiers: 2 },
  { name: 'OOG bay',      type: 'OOG',     bays: 6,  rows: 2, tiers: 1 },
];

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5];

/**
 * How long a drag waits before it is saved.
 *
 * Nudging a block three times in a second is one decision, not three, and the
 * layout endpoint saves all or nothing — so the moves are collected and sent
 * together. Long enough to catch a correction, short enough that letting go of
 * the mouse and seeing "Saved 14:32" feel like the same moment.
 */
const SAVE_DELAY_MS = 400;

/** The next free single letter, as this screen has always named a new block. */
function nextBlockCode(blocks: YardBlock[]): string {
  const used = new Set(blocks.map(b => b.blockCode.toUpperCase()));
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(ch)) return ch;
  return `B${blocks.length + 1}`;
}

/** Somewhere to drop a new block: the middle, stepped so two in a row do not stack. */
function freeSpot(blocks: YardBlock[], p: Preset): { x: number; y: number } {
  const offset = (blocks.length % 8) * GRID_PX;
  return {
    x: snap(CANVAS_W / 2 - (p.bays * GRID_PX) / 2 + offset, CANVAS_W - p.bays * GRID_PX),
    y: snap(CANVAS_H / 2 - (p.rows * GRID_PX) / 2 + offset, CANVAS_H - p.rows * GRID_PX),
  };
}

const placementOf = (b: YardBlock): YardBlockPlacement => ({
  yardBlockId: b.yardBlockId,
  layoutX: b.layoutX,
  layoutY: b.layoutY,
  layoutWidth: b.layoutWidth,
  layoutHeight: b.layoutHeight,
  layoutRotationDeg: b.layoutRotationDeg,
  rowVersion: b.rowVersion,
});

const clock = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function YardZonesPage() {
  const { branch, yards, yard: headerYard } = useFacility();
  const { mapEnabled, loading: settingsLoading, denied } = useYardSettings();
  const { canAt } = useSession();
  const { toast } = useToast();
  const canManage = canAt('mdm.org.manage', branch?.branchId);

  // ── which yard ───────────────────────────────────────────────────────────
  // A yard belongs to one depot, so switching depot drops the pick (adjusted
  // during render, not in an effect: the canvas must never draw one depot's
  // blocks under another depot's name).
  // https://react.dev/learn/you-might-not-need-an-effect
  const [picked, setPicked] = useState<string | null>(null);
  const [pickedOwner, setPickedOwner] = useState<string | null>(branch?.branchId ?? null);
  const branchId = branch?.branchId ?? null;
  if (branchId !== pickedOwner) {
    setPickedOwner(branchId);
    setPicked(null);
  }
  const yardId = (picked && yards.some(y => y.yardId === picked) ? picked : null)
    ?? headerYard?.yardId ?? yards[0]?.yardId ?? null;
  const yard = yards.find(y => y.yardId === yardId) ?? null;

  const blocks = useApi<YardBlock[]>(mapEnabled && yardId ? yardBlocksPath(yardId) : null);

  /**
   * HOW MANY REEFER PLUGS A BLOCK HAS, which is not master data's to tell.
   *
   * A plug belongs to a SLOT, and slots are operational — the block record
   * holds no count. The live map counts them per block, so the panel reads it
   * from there and shows it read-only. This screen works without it: a clerk
   * with the master-data right but not `tos.gate.view` simply sees no number
   * rather than an error.
   */
  const live = useYardMap(mapEnabled ? yardId : null);
  const plugsOf = (blockId: string): number | null =>
    live.data?.blocks.find(b => b.yardBlockId === blockId)?.reeferPlugCount ?? null;

  // ── the blocks on the canvas ─────────────────────────────────────────────
  // The server's list, plus the drag that has not been saved yet. `from` is the
  // answer this came out of: a NEW answer replaces the canvas, the same answer
  // leaves the drag alone.
  //
  // `blocks.data` still holds the PREVIOUS yard's list while the new one is in
  // flight (useApi keeps the last answer on purpose, so paging a register does
  // not blink). Every block names its yard, so we can tell, and a list that is
  // not this yard's is not drawn.
  const [canvas, setCanvas] = useState<{ yardId: string | null; blocks: YardBlock[]; from: YardBlock[] | null }>(
    { yardId, blocks: [], from: null });
  const answer = blocks.data && (blocks.data.length === 0 || blocks.data[0].yardId === yardId) ? blocks.data : null;
  if (canvas.yardId !== yardId) setCanvas({ yardId, blocks: answer ?? [], from: answer });
  else if (answer && answer !== canvas.from) setCanvas({ yardId, blocks: answer, from: answer });

  const list = canvas.blocks;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [blockError, setBlockError] = useState<ApiError | null>(null);
  /** Blocks whose size changed since their slots were last generated. */
  const [resized, setResized] = useState<Set<string>>(new Set());

  /** The server's answer is the truth: a write replaces what is on the canvas. */
  const apply = useCallback((next: YardBlock[]) => {
    setCanvas({ yardId, blocks: next, from: next });
  }, [yardId]);

  const applyOne = useCallback((block: YardBlock) => {
    setCanvas(c => {
      const next = c.blocks.map(b => (b.yardBlockId === block.yardBlockId ? block : b));
      return { ...c, blocks: next, from: next };
    });
  }, []);

  // Coming back to this screen paints the yard as it was last SEEN, while the
  // read goes out again (stale-while-revalidate, the same as any register).
  // What a write returned counts as seen: it is the server's own answer.
  useEffect(() => {
    if (yardId && canvas.from) rememberAnswer(yardBlocksPath(yardId), canvas.from);
  }, [yardId, canvas.from]);

  const stale = useCallback(() => {
    toast({ variant: 'warning', title: 'The layout changed meanwhile — reloaded' });
    blocks.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks.reload, toast]);

  const failed = useCallback((e: unknown, title: string) => {
    const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
    if (err.status === 409) { stale(); return err; }
    toast({ variant: 'danger', title, message: err.explanation ?? err.message });
    return err;
  }, [stale, toast]);

  // ── saving a drag ────────────────────────────────────────────────────────
  // The timer fires after the drags have stopped, so it reads the blocks as
  // they are THEN — including the rowVersion a save a moment earlier returned.
  const latest = useRef<YardBlock[]>(list);
  useEffect(() => { latest.current = list; }, [list]);
  const moved = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    const ids = [...moved.current];
    moved.current.clear();
    if (!yardId || ids.length === 0) return;
    const placements = ids
      .map(id => latest.current.find(b => b.yardBlockId === id))
      .filter((b): b is YardBlock => b !== undefined)
      .map(placementOf);
    if (placements.length === 0) return;
    setSaving(true);
    try {
      apply(await saveYardLayout(yardId, placements));
      setSavedAt(new Date());
    } catch (e) {
      const err = failed(e, 'The layout was not saved');
      // Our positions are not the server's. Whatever went wrong, go back to
      // what IS saved rather than leaving a move on screen that is not.
      if (err.status !== 409) blocks.reload();
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yardId, apply, failed, blocks.reload]);

  // A drag in flight when the yard changes or the page closes is still a
  // decision the user made: send it rather than dropping it.
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); void flush(); } }, [flush]);

  /** Move it on screen now; save it when the dragging stops. */
  const place = useCallback((id: string, x: number, y: number, commit: boolean) => {
    setCanvas(c => ({
      ...c,
      blocks: c.blocks.map(b => (b.yardBlockId === id ? { ...b, layoutX: x, layoutY: y } : b)),
    }));
    if (!commit) return;
    moved.current.add(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, SAVE_DELAY_MS);
  }, [flush]);

  // ── the writes ───────────────────────────────────────────────────────────
  const addPreset = async (p: Preset) => {
    if (!yardId) return;
    const spot = freeSpot(list, p);
    const body: SaveYardBlock = {
      blockCode: nextBlockCode(list),
      blockType: p.type,
      maxRows: p.rows, maxBays: p.bays, maxTiers: p.tiers,
      allocatedToPartyCode: null, allocatedSizeFt: null,
      // A preset says what the block is for, and three of them mean something
      // to the gate as well as to the eye.
      isReeferBlock: p.type === 'REEFER', isDgBlock: p.type === 'HAZ', isOogBlock: p.type === 'OOG',
      layoutX: spot.x, layoutY: spot.y,
      // No stored size: the block is drawn from its bays × rows, so changing
      // either in the panel resizes it on the canvas.
      layoutWidth: null, layoutHeight: null, layoutRotationDeg: null,
      displayColorHex: null, isActive: true,
    };
    setBlockError(null);
    try {
      const created = await createYardBlock(yardId, body);
      // `from` moves with the list: it is what the cache remembers, and the
      // block does exist on the server now.
      setCanvas(c => { const next = [...c.blocks, created]; return { ...c, blocks: next, from: next }; });
      setSelectedId(created.yardBlockId);
      setSavedAt(new Date());
    } catch (e) {
      failed(e, 'The block was not added');
    }
  };

  const patch = async (block: YardBlock, body: Partial<SaveYardBlock>): Promise<boolean> => {
    setBlockError(null);
    try {
      const fresh = await updateYardBlock(block.yardBlockId, blockBody(block, body));
      applyOne(fresh);
      setSavedAt(new Date());
      const sizeChanged = (['maxRows', 'maxBays', 'maxTiers'] as const)
        .some(k => body[k] !== undefined && body[k] !== block[k]);
      if (sizeChanged && fresh.slotCount > 0) setResized(prev => new Set(prev).add(block.yardBlockId));
      return true;
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      if (err.status === 409) { stale(); return false; }
      // A field error belongs on the field; anything else is a toast.
      if (Object.keys(err.fieldErrors).length > 0) setBlockError(err);
      else toast({ variant: 'danger', title: 'The block was not saved', message: err.explanation ?? err.message });
      return false;
    }
  };

  const generate = async (block: YardBlock) => {
    try {
      const made = await generateYardSlots(block.yardBlockId);
      applyOne(made.block);
      // New slots in a reefer block are new plugs: re-read the live counts.
      live.reload();
      setResized(prev => { const next = new Set(prev); next.delete(block.yardBlockId); return next; });
      toast({
        variant: 'success',
        title: `Made ${made.rowsCreated} rows and ${made.slotsCreated} slots — ${made.slotCount} in all`,
        message: made.slotsOutsideLayout > 0
          ? `${made.slotsOutsideLayout} older slots are outside the new size and were kept.`
          : undefined,
      });
    } catch (e) {
      failed(e, `Block ${block.blockCode}: no slots were made`);
    }
  };

  const remove = async (block: YardBlock) => {
    try {
      await deleteYardBlock(block.yardBlockId, block.rowVersion);
      setCanvas(c => {
        const next = c.blocks.filter(b => b.yardBlockId !== block.yardBlockId);
        return { ...c, blocks: next, from: next };
      });
      if (selectedId === block.yardBlockId) setSelectedId(null);
      toast({ variant: 'success', title: `Block ${block.blockCode} removed` });
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      if (err.status === 409) {
        // It has rows or slots — and a box may be standing in one of them.
        toast({
          variant: 'warning',
          title: 'It has rows or slots — set it inactive instead',
          message: 'An inactive block keeps its slots and its history, and drops off the live map.',
          action: { label: 'Set inactive', onClick: () => { void patch(block, { isActive: false }); } },
        });
        return;
      }
      failed(e, `Block ${block.blockCode} was not removed`);
    }
  };

  // ── what the page shows ──────────────────────────────────────────────────
  const selected = useMemo(() => list.find(b => b.yardBlockId === selectedId) ?? null, [list, selectedId]);
  const unplaced = useMemo(() => list.filter(b => !isPlaced(b)), [list]);
  const summary = useMemo(() => {
    const byType = new Map<string, { blocks: number; slots: number }>();
    for (const b of list) {
      const key = b.blockType ?? '';
      const at = byType.get(key) ?? { blocks: 0, slots: 0 };
      at.blocks += 1;
      at.slots += b.slotCount;
      byType.set(key, at);
    }
    return { blocks: list.length, slots: list.reduce((s, b) => s + b.slotCount, 0), byType };
  }, [list]);

  if (settingsLoading) {
    return <div className="gecko-empty-card gecko-yard-loading">Checking what this depot records…</div>;
  }
  if (!mapEnabled) return <YardMapOff where={branch?.displayName} denied={denied} />;
  if (yards.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title="This depot has no yards yet"
        description={<>A block belongs to a yard, so the yard comes first. Master Data → Yards lists the depot&apos;s
          yards; the layout is drawn here once there is one.</>}
      />
    );
  }

  return (
    <div className="gecko-stack gecko-yard-page">

      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <div className="gecko-row gecko-row-wrap gecko-yard-title-row">
            <h1 className="gecko-page-title">Yard Zones &amp; Blocks</h1>
            <span className="gecko-pill gecko-pill-primary">
              {summary.blocks} {summary.blocks === 1 ? 'block' : 'blocks'} · {summary.slots} slots
            </span>
            {!canManage && <span className="gecko-pill gecko-pill-neutral">read-only</span>}
          </div>
          <p className="gecko-page-subtitle">
            Visual layout — {yard ? `${yard.yardCode} · ${yard.nameEn}` : 'pick a yard'}
            {' · '}
            {saving ? 'saving…' : savedAt ? `Saved ${clock(savedAt)}` : 'no changes yet'}
          </p>
        </div>

        <div className="gecko-page-header-actions">
          {yards.length > 1 && (
            <select
              className="gecko-input gecko-input-sm gecko-yard-select"
              value={yardId ?? ''}
              aria-label="Yard"
              onChange={e => { setPicked(e.target.value); setSelectedId(null); }}
            >
              {yards.map(y => <option key={y.yardId} value={y.yardId}>{y.yardCode} · {y.nameEn}</option>)}
            </select>
          )}
          <ZoomControl zoom={zoom} setZoom={setZoom} />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => blocks.reload()}>
            <Icon name="refresh" size={13} />Reload
          </button>
        </div>
      </div>

      <ErrorBanner error={blocks.error} className="gecko-yard-alert" />

      <div className="gecko-yard-workspace">
        <div className="gecko-stack gecko-stack-md">
          <BlockPalette presets={PRESETS} onAdd={addPreset} canManage={canManage} />
          <UnplacedTray blocks={unplaced} canManage={canManage} onSelect={setSelectedId} />
        </div>
        <Canvas
          blocks={list}
          yardLabel={yard ? `${yard.yardCode} · ${yard.nameEn.toUpperCase()}` : ''}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          place={place}
          zoom={zoom}
          canManage={canManage}
          loading={blocks.loading && list.length === 0}
        />
        <PropertiesPanel
          block={selected}
          error={blockError}
          canManage={canManage}
          needsSlots={selected ? resized.has(selected.yardBlockId) : false}
          reeferPlugs={selected ? plugsOf(selected.yardBlockId) : null}
          summary={summary}
          onPatch={patch}
          onPlace={place}
          onGenerate={generate}
          onRemove={remove}
        />
      </div>

      <div className="gecko-cell-meta gecko-yard-footnote">
        {canManage
          ? <>Click a preset to add a block · drag a block to position it · click to select &amp; edit · every change is saved on the server for this depot</>
          : <>Changing the layout needs the depot&apos;s master-data right (mdm.org.manage). Everything here is read-only for you.</>}
      </div>
    </div>
  );
}

// ─── Block palette ────────────────────────────────────────────────────────────

function BlockPalette({ presets, onAdd, canManage }: {
  presets: Preset[]; onAdd: (p: Preset) => void; canManage: boolean;
}) {
  return (
    <section className="gecko-card gecko-stack gecko-yard-side-card">
      {canManage && (
        <>
          <div>
            <div className="gecko-eyebrow">Add block</div>
            <div className="gecko-cell-meta">Click a preset to add</div>
          </div>
          <div className="gecko-stack gecko-yard-preset-list">
            {presets.map(p => {
              const meta = TYPE_STYLE[p.type];
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => onAdd(p)}
                  className="gecko-yard-preset"
                  style={{ borderColor: `${meta.stroke}33`, background: meta.fill, color: meta.text }}
                >
                  <span className="gecko-yard-preset-dot" style={{ background: meta.stroke }} />
                  <span className="gecko-stack gecko-yard-preset-text">
                    <span className="gecko-yard-preset-name">{p.name}</span>
                    <span className="gecko-yard-preset-size">
                      {p.bays}×{p.rows}×{p.tiers} · {p.bays * p.rows * p.tiers} slots
                    </span>
                  </span>
                  <Icon name="plus" size={12} />
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className={canManage ? 'gecko-yard-legend' : undefined}>
        <div className="gecko-eyebrow gecko-yard-legend-head">Legend</div>
        <div className="gecko-stack gecko-yard-legend-list">
          {BLOCK_TYPES.map(t => (
            <div key={t} className="gecko-row gecko-yard-legend-row">
              <span className="gecko-yard-legend-swatch"
                style={{ background: TYPE_STYLE[t].fill, borderColor: TYPE_STYLE[t].stroke }} />
              <span className="gecko-text-secondary">{TYPE_STYLE[t].label}</span>
            </div>
          ))}
          <div className="gecko-row gecko-yard-legend-row">
            <span className="gecko-yard-legend-swatch"
              style={{ background: UNTYPED_STYLE.fill, borderColor: UNTYPED_STYLE.stroke }} />
            <span className="gecko-text-secondary">{UNTYPED_STYLE.label}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Not on the map ───────────────────────────────────────────────────────────

/**
 * BLOCKS THAT EXIST BUT HAVE NO PLACE.
 *
 * A block added on Master Data → Yards, or imported with the depot's data, has
 * no layout_x / layout_y: it is a real block that has never been drawn. It
 * would otherwise sit silently at 0,0 under whatever is in the top-left corner.
 */
function UnplacedTray({ blocks, canManage, onSelect }: {
  blocks: YardBlock[]; canManage: boolean; onSelect: (id: string) => void;
}) {
  if (blocks.length === 0) return null;
  return (
    <section className="gecko-card gecko-stack gecko-yard-side-card">
      <div>
        <div className="gecko-eyebrow">Not on the map</div>
        <div className="gecko-cell-meta">
          {canManage ? 'Drag one onto the canvas to place it' : `${blocks.length} not placed`}
        </div>
      </div>
      <div className="gecko-row gecko-row-wrap gecko-yard-tray">
        {blocks.map(b => {
          const style = blockStyle(b);
          return (
            <button
              key={b.yardBlockId}
              type="button"
              className="gecko-yard-tray-chip"
              style={{ borderColor: style.stroke, background: style.fill, color: style.text }}
              draggable={canManage}
              onDragStart={e => { e.dataTransfer.setData('text/plain', b.yardBlockId); e.dataTransfer.effectAllowed = 'move'; }}
              onClick={() => onSelect(b.yardBlockId)}
              title={`${b.blockCode} · ${typeLabel(b.blockType)}`}
            >
              {b.blockCode}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Zoom control ─────────────────────────────────────────────────────────────

function ZoomControl({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  const idx = ZOOM_LEVELS.indexOf(zoom);
  return (
    <div className="gecko-row gecko-yard-zoom">
      <button
        className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm gecko-yard-zoom-btn"
        onClick={() => idx > 0 && setZoom(ZOOM_LEVELS[idx - 1])}
        disabled={idx <= 0}
        title="Zoom out"
      >−</button>
      <span className="gecko-yard-zoom-value">{Math.round(zoom * 100)}%</span>
      <button
        className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm gecko-yard-zoom-btn"
        onClick={() => idx < ZOOM_LEVELS.length - 1 && setZoom(ZOOM_LEVELS[idx + 1])}
        disabled={idx >= ZOOM_LEVELS.length - 1}
        title="Zoom in"
      >+</button>
    </div>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

interface DragState {
  id: string;
  startX: number;
  startY: number;
  mouseX: number;
  mouseY: number;
  moved: boolean;
}

function Canvas({ blocks, yardLabel, selectedId, setSelectedId, place, zoom, canManage, loading }: {
  blocks: YardBlock[];
  yardLabel: string;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  place: (id: string, x: number, y: number, commit: boolean) => void;
  zoom: number;
  canManage: boolean;
  loading: boolean;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const el = svg.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  }, [zoom]);

  const onBlockMouseDown = (e: React.MouseEvent, b: YardBlock) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canManage) { setSelectedId(b.yardBlockId); return; }
    const at = toSvg(e.clientX, e.clientY);
    const box = blockBox(b);
    setDrag({ id: b.yardBlockId, startX: box.x, startY: box.y, mouseX: at.x, mouseY: at.y, moved: false });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const at = toSvg(e.clientX, e.clientY);
    const dx = at.x - drag.mouseX;
    const dy = at.y - drag.mouseY;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    const b = blocks.find(x => x.yardBlockId === drag.id);
    if (!b) return;
    const box = blockBox(b);
    place(drag.id,
      Math.max(0, Math.min(CANVAS_W - box.w, drag.startX + dx)),
      Math.max(0, Math.min(CANVAS_H - box.h, drag.startY + dy)),
      false);
    if (!drag.moved) setDrag({ ...drag, moved: true });
  };

  const onMouseUp = () => {
    if (!drag) return;
    const b = blocks.find(x => x.yardBlockId === drag.id);
    if (drag.moved && b) {
      const box = blockBox(b);
      place(drag.id, snap(box.x, CANVAS_W - box.w), snap(box.y, CANVAS_H - box.h), true);
    } else {
      setSelectedId(drag.id);
    }
    setDrag(null);
  };

  /** A block from the "Not on the map" tray, dropped where the cursor is. */
  const onDrop = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const b = blocks.find(x => x.yardBlockId === id);
    if (!canManage || !b) return;
    const at = toSvg(e.clientX, e.clientY);
    const box = blockBox(b);
    place(id, snap(at.x - box.w / 2, CANVAS_W - box.w), snap(at.y - box.h / 2, CANVAS_H - box.h), true);
    setSelectedId(id);
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

  const placed = blocks.filter(isPlaced);

  return (
    <section className="gecko-card gecko-yard-canvas-card">
      <div className="gecko-yard-canvas-scroll">
        <svg
          ref={svg}
          width={CANVAS_W * zoom}
          height={CANVAS_H * zoom}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onMouseDown={e => { if (e.target === e.currentTarget || (e.target as Element).getAttribute('data-grid') === 'true') setSelectedId(null); }}
          onDragOver={e => { if (canManage) e.preventDefault(); }}
          onDrop={onDrop}
          className="gecko-yard-canvas-svg"
        >
          <rect data-grid="true" x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#fcfcfd" />
          {gridLines}
          <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="none" stroke="#d1d5db" strokeWidth={1.5} />
          <text x={14} y={28} fill="#9ca3af" fontSize={14} fontFamily="ui-monospace, monospace" fontWeight={600}>
            {yardLabel} · {CANVAS_W / GRID_PX} × {CANVAS_H / GRID_PX} ground slots
          </text>

          {placed.map(b => (
            <BlockNode
              key={b.yardBlockId}
              block={b}
              selected={selectedId === b.yardBlockId}
              draggable={canManage}
              onMouseDown={e => onBlockMouseDown(e, b)}
            />
          ))}

          {placed.length === 0 && (
            <g transform={`translate(${CANVAS_W / 2}, ${CANVAS_H / 2})`}>
              <text textAnchor="middle" y={-8} fill="#9ca3af" fontSize={20} fontWeight={700}>
                {loading ? 'Reading the yard…' : 'Nothing on the map yet'}
              </text>
              <text textAnchor="middle" y={18} fill="#9ca3af" fontSize={13}>
                {loading ? '' : canManage ? 'Click a preset on the left to add the first block' : 'This yard has no blocks drawn'}
              </text>
            </g>
          )}
        </svg>
      </div>
    </section>
  );
}

// ─── Block render ─────────────────────────────────────────────────────────────

function BlockNode({ block, selected, draggable, onMouseDown }: {
  block: YardBlock; selected: boolean; draggable: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const style = blockStyle(block);
  const { x, y, w, h } = blockBox(block);
  const stripe = 3;

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: draggable ? (selected ? 'grabbing' : 'grab') : 'pointer' }}
      // An inactive block is still drawn: a box may be standing in it, and the
      // supervisor who switched it off needs to see which one it was.
      opacity={block.isActive ? 1 : 0.45}
      onMouseDown={onMouseDown}
    >
      <rect
        x={0} y={0} width={w} height={h}
        fill={style.fill}
        stroke={selected ? '#0ea5e9' : style.stroke}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={block.isActive ? undefined : '5 4'}
      />
      <rect x={0} y={0} width={w} height={stripe} fill={style.stroke} opacity={0.6} />

      <text x={6} y={stripe + 14} fill={style.text} fontSize={Math.min(15, Math.max(10, w / 6))} fontWeight={700} fontFamily="ui-monospace, monospace">
        {block.blockCode}
      </text>

      {w >= 80 && (
        <text x={w - 6} y={stripe + 12} textAnchor="end" fill={style.text} fontSize={9} fontWeight={700} letterSpacing="0.06em">
          {typeLabel(block.blockType).toUpperCase()}
        </text>
      )}

      {h >= 50 && (
        <>
          <text x={w / 2} y={h - 14} textAnchor="middle" fill={style.text} fontSize={9} opacity={0.85} fontFamily="ui-monospace, monospace">
            {block.maxBays ?? '?'}×{block.maxRows ?? '?'}×{block.maxTiers ?? '?'}
          </text>
          <text x={w / 2} y={h - 4} textAnchor="middle" fill={style.text} fontSize={9} opacity={0.85} fontFamily="ui-monospace, monospace">
            {block.slotCount > 0 ? `${block.slotCount} slots` : 'no slots yet'}
          </text>
        </>
      )}

      {block.allocatedToPartyCode && h >= 60 && (
        <g transform={`translate(4, ${h - 28})`}>
          <rect x={0} y={0} width={6} height={6} rx={1.5} fill={style.stroke} />
          <text x={10} y={6} fill={style.text} fontSize={8} fontWeight={600}>{block.allocatedToPartyCode}</text>
        </g>
      )}

      {selected && (
        <rect x={-3} y={-3} width={w + 6} height={h + 6} fill="none" stroke="#0ea5e9" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
      )}
    </g>
  );
}

// ─── Properties panel ────────────────────────────────────────────────────────

const TYPE_OPTIONS = BLOCK_TYPES.map(t => ({ value: t, label: TYPE_STYLE[t].label }));

/**
 * WHAT THE GATE REFUSES BECAUSE OF THE TYPE (BLOCK_TYPE, Phase 3).
 *
 * The block's type is not decoration: it is a rule the lane enforces, and the
 * supervisor laying the yard out is the one who has to know which. Each line
 * names the rule code, because that is what the clerk will see refused.
 */
function typeRule(type: BlockType | null): string {
  switch (type) {
    case 'EMPTY': return 'The gate refuses a FULL box here (BLOCK_TYPE).';
    // Full boxes of any direction — a domestic customer's box belongs here.
    case 'FULL':
    case 'IMPORT':
    case 'EXPORT':
    case 'TRANSHIPMENT': return 'The gate refuses an EMPTY box here (BLOCK_TYPE).';
    case 'REEFER': return 'The gate refuses a box that is not a reefer (BLOCK_TYPE).';
    case 'DAMAGE': return 'The gate refuses a serviceable box here (BLOCK_TYPE).';
    case 'HAZ': return 'Dangerous goods may stand here; nothing else is refused for it.';
    case 'OOG': return 'Out-of-gauge boxes may stand here; nothing stands on one (OOG_ON_TOP).';
    default: return 'No type: the gate refuses nothing on the block’s kind.';
  }
}

/**
 * ONE BLOCK, SAVED AS IT IS EDITED.
 *
 * A select or a colour saves when it changes; a typed field saves when it
 * loses focus or on Enter, not on every keystroke. Each save returns a new
 * rowVersion, so a save per character would race itself and the second one
 * would answer 409 — and "409 Conflict" in the middle of typing a block code
 * is a lie about what happened.
 */
function PropertiesPanel({ block, error, canManage, needsSlots, reeferPlugs, summary, onPatch, onPlace, onGenerate, onRemove }: {
  block: YardBlock | null;
  error: ApiError | null;
  canManage: boolean;
  needsSlots: boolean;
  /** From the live map; null when it has not been read (or may not be). */
  reeferPlugs: number | null;
  summary: { blocks: number; slots: number; byType: Map<string, { blocks: number; slots: number }> };
  onPatch: (block: YardBlock, body: Partial<SaveYardBlock>) => Promise<boolean>;
  /** X and Y go the same way a drag does, through the layout endpoint. */
  onPlace: (id: string, x: number, y: number, commit: boolean) => void;
  onGenerate: (block: YardBlock) => void;
  onRemove: (block: YardBlock) => void;
}) {
  if (!block) {
    return (
      <section className="gecko-card gecko-stack gecko-yard-side-card">
        <div>
          <div className="gecko-eyebrow">Yard summary</div>
          <div className="gecko-cell-meta">Saved on the server for this depot</div>
        </div>
        <div className="gecko-stack gecko-yard-summary">
          <SummaryRow label="Blocks" value={summary.blocks} />
          <SummaryRow label="Slots made" value={summary.slots} />
        </div>

        {summary.blocks > 0 && (
          <div className="gecko-yard-summary-types">
            <div className="gecko-eyebrow gecko-yard-legend-head">By type</div>
            <div className="gecko-stack gecko-yard-legend-list">
              {[...summary.byType.entries()].map(([type, at]) => {
                const style = type ? TYPE_STYLE[type as BlockType] : UNTYPED_STYLE;
                return (
                  <div key={type || 'none'} className="gecko-row gecko-row-between gecko-yard-legend-row">
                    <span className="gecko-inline-row gecko-yard-legend-name">
                      <span className="gecko-yard-legend-dot" style={{ background: style.stroke }} />
                      {style.label}
                    </span>
                    <span className="gecko-text-mono gecko-text-secondary">{at.blocks} · {at.slots} slots</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="gecko-cell-meta gecko-yard-hint">
          Click any block on the canvas to edit it here.
        </div>
      </section>
    );
  }

  const style = blockStyle(block);
  const canGenerate = block.maxBays !== null && block.maxTiers !== null && block.isActive;

  return (
    <section className="gecko-card gecko-stack gecko-yard-side-card">
      <div className="gecko-row gecko-row-between gecko-yard-panel-head">
        <div>
          <div className="gecko-eyebrow">Block</div>
          <div className="gecko-row gecko-yard-panel-code">
            <span className="gecko-yard-legend-dot" style={{ background: style.stroke }} />
            {block.blockCode}
          </div>
        </div>
        {canManage && (
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-danger-text" onClick={() => onRemove(block)}>
            <Icon name="trash" size={13} />Remove
          </button>
        )}
      </div>

      {!block.isActive && (
        <div className="gecko-row gecko-yard-inactive-note">
          <Icon name="warning" size={13} />
          <span className="gecko-cell-meta gecko-flex-1">Inactive — off the live map, slots and history kept.</span>
          {canManage && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => void onPatch(block, { isActive: true })}>
              Reactivate
            </button>
          )}
        </div>
      )}

      <div className="gecko-grid-2 gecko-yard-fields">
        <TextField label="Code" value={block.blockCode} mono maxLength={20} disabled={!canManage}
          error={error?.forField('blockCode')}
          onCommit={v => onPatch(block, { blockCode: v.trim().toUpperCase() })} />
        <PropField label="Type" error={error?.forField('blockType')} hint={typeRule(block.blockType)}>
          <select className="gecko-input gecko-input-sm" value={block.blockType ?? ''} disabled={!canManage}
            onChange={e => void onPatch(block, { blockType: (e.target.value || null) as BlockType | null })}>
            <option value="">— no type —</option>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </PropField>
      </div>

      <div className="gecko-grid-3 gecko-yard-fields">
        <NumberField label="Bays" value={block.maxBays} min={1} max={40} disabled={!canManage}
          error={error?.forField('maxBays')} onCommit={v => onPatch(block, { maxBays: v })} />
        <NumberField label="Rows" value={block.maxRows} min={1} max={20} disabled={!canManage}
          error={error?.forField('maxRows')} onCommit={v => onPatch(block, { maxRows: v })} />
        <NumberField label="Tiers" value={block.maxTiers} min={1} max={6} disabled={!canManage}
          error={error?.forField('maxTiers')} onCommit={v => onPatch(block, { maxTiers: v })} />
      </div>

      <div className="gecko-stack gecko-yard-slots">
        <div className="gecko-row gecko-row-between">
          <span className="gecko-text-secondary">Rows made</span>
          <span className="gecko-text-mono gecko-yard-slots-value">{block.rowCount}</span>
        </div>
        <div className="gecko-row gecko-row-between">
          <span className="gecko-text-secondary">Slots made</span>
          <span className="gecko-text-mono gecko-yard-slots-value">{block.slotCount}</span>
        </div>
        <div className="gecko-row gecko-row-between">
          <span className="gecko-text-secondary">Reefer plugs</span>
          <span className="gecko-text-mono gecko-yard-slots-value" title="A plug belongs to a slot: slots in a reefer block get one when they are generated">
            {reeferPlugs ?? (block.isReeferBlock ? 'on every slot' : '—')}
          </span>
        </div>
        {canManage && (
          <>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => onGenerate(block)}
              disabled={!canGenerate}
              title={canGenerate ? 'Make the rows and slots this block holds' : 'Set bays and tiers first'}>
              <Icon name="grid" size={13} />{block.slotCount > 0 ? 'Generate missing slots' : 'Generate slots'}
            </button>
            {!canGenerate && block.isActive && <div className="gecko-cell-meta">Set bays and tiers first.</div>}
            {needsSlots && (
              <div className="gecko-cell-meta gecko-yard-warn">Size changed — generate slots again.</div>
            )}
          </>
        )}
      </div>

      <PropField label="Reserved for" error={error?.forField('allocatedToPartyCode')}
        hint={block.allocatedToPartyCode
          ? `The gate refuses another party's box here (RESERVED) unless a supervisor overrides it.`
          : 'A line, agent or customer this block is kept for. Leave empty for any.'}>
        {canManage
          ? <PartyPicker role="" value={block.allocatedToPartyCode} nameFirst
              placeholder="Search any party…" error={error?.forField('allocatedToPartyCode')}
              onChange={code => void onPatch(block, { allocatedToPartyCode: code })} />
          : <div className="gecko-readonly-value gecko-text-mono">{block.allocatedToPartyCode ?? '—'}</div>}
      </PropField>

      <div className="gecko-grid-2 gecko-yard-fields">
        <PropField label="Size" error={error?.forField('allocatedSizeFt')}
          hint={block.allocatedSizeFt
            ? `The gate refuses any box that is not ${block.allocatedSizeFt}' here (SIZE_BLOCK).`
            : 'Any length. A stack is still one length throughout (SIZE_STACK).'}>
          <select className="gecko-input gecko-input-sm" value={block.allocatedSizeFt ?? ''} disabled={!canManage}
            onChange={e => void onPatch(block, { allocatedSizeFt: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Any size</option>
            {BLOCK_SIZES.map(ft => <option key={ft} value={ft}>{ft}&apos;</option>)}
          </select>
        </PropField>
        <TextField label="Colour" value={block.displayColorHex ?? ''} mono maxLength={7} disabled={!canManage}
          placeholder="#RRGGBB" error={error?.forField('displayColorHex')}
          onCommit={v => onPatch(block, { displayColorHex: v.trim() ? v.trim().toUpperCase() : null })} />
      </div>

      <div className="gecko-stack gecko-yard-flagblock">
        <div className="gecko-row gecko-yard-flags">
          <Flag label="Reefer" on={block.isReeferBlock} disabled={!canManage}
            onChange={v => void onPatch(block, { isReeferBlock: v })} />
          <Flag label="DG" on={block.isDgBlock} disabled={!canManage}
            onChange={v => void onPatch(block, { isDgBlock: v })} />
          <Flag label="OOG" on={block.isOogBlock} disabled={!canManage}
            onChange={v => void onPatch(block, { isOogBlock: v })} />
        </div>
        {/* WHAT THE GATE WILL DO ABOUT EACH TICK. These are not labels on a
            form — each one is a refusal at the lane, and the supervisor setting
            the block up is the person who needs to know that. */}
        <div className="gecko-cell-meta gecko-yard-flaghint">
          {block.isReeferBlock
            ? 'Reefer: slots here get a plug when they are generated; a full reefer needs one (REEFER_PLUG).'
            : 'Reefer off: a full reefer is refused in a slot with no plug (REEFER_PLUG).'}
          <br />
          {block.isDgBlock
            ? 'DG: dangerous goods belong here. '
            : 'DG off: dangerous goods are refused here (DG_BLOCK). '}
          {block.isOogBlock
            ? 'OOG: out-of-gauge boxes belong here, and nothing stands on one (OOG_ON_TOP).'
            : 'OOG off: an out-of-gauge box is refused unless its ROW is marked OOG (OOG_BLOCK).'}
        </div>
      </div>

      <div className="gecko-grid-2 gecko-yard-fields gecko-yard-position">
        <NumberField label="X position" value={block.layoutX} min={0} max={CANVAS_W} disabled={!canManage}
          error={error?.forField('layoutX')}
          onCommit={async v => { onPlace(block.yardBlockId, snap(v ?? 0, CANVAS_W), block.layoutY ?? 0, true); return true; }} />
        <NumberField label="Y position" value={block.layoutY} min={0} max={CANVAS_H} disabled={!canManage}
          error={error?.forField('layoutY')}
          onCommit={async v => { onPlace(block.yardBlockId, block.layoutX ?? 0, snap(v ?? 0, CANVAS_H), true); return true; }} />
      </div>
    </section>
  );
}

function PropField({ label, children, error, hint }: {
  label: string; children: React.ReactNode; error?: string; hint?: string;
}) {
  return (
    <div className="gecko-field">
      <label className="gecko-field-label">{label}</label>
      {children}
      {hint && !error && <div className="gecko-field-hint">{hint}</div>}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}

/** A typed value, saved on blur or Enter — see the panel's note. */
function TextField({ label, value, onCommit, disabled, mono, maxLength, placeholder, error }: {
  label: string; value: string; onCommit: (v: string) => Promise<boolean>;
  disabled?: boolean; mono?: boolean; maxLength?: number; placeholder?: string; error?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  // Someone else's save, or our own answer, changes what is stored: show it
  // unless the clerk is typing into this very field.
  const [seen, setSeen] = useState(value);
  if (value !== seen && !editing) { setSeen(value); setDraft(value); }

  const commit = () => {
    setEditing(false);
    if (draft === value) return;
    void onCommit(draft).then(ok => { if (!ok) setDraft(value); });
  };

  return (
    <PropField label={label} error={error}>
      <input
        className={`gecko-input gecko-input-sm${mono ? ' gecko-text-mono' : ''}`}
        value={draft}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        onFocus={() => setEditing(true)}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
      />
    </PropField>
  );
}

function NumberField({ label, value, onCommit, disabled, min, max, error }: {
  label: string; value: number | null; onCommit: (v: number | null) => Promise<boolean>;
  disabled?: boolean; min?: number; max?: number; error?: string;
}) {
  const shown = value === null ? '' : String(value);
  const [draft, setDraft] = useState(shown);
  const [editing, setEditing] = useState(false);
  const [seen, setSeen] = useState(shown);
  if (shown !== seen && !editing) { setSeen(shown); setDraft(shown); }

  const commit = () => {
    setEditing(false);
    if (draft === shown) return;
    const next = draft.trim() === '' ? null : Math.max(min ?? 0, Math.min(max ?? 255, Number(draft)));
    if (next !== null && Number.isNaN(next)) { setDraft(shown); return; }
    void onCommit(next).then(ok => { if (!ok) setDraft(shown); });
  };

  return (
    <PropField label={label} error={error}>
      <input
        className="gecko-input gecko-input-sm gecko-num-tabular"
        type="number" value={draft} disabled={disabled} min={min} max={max}
        aria-label={label} aria-invalid={error ? true : undefined}
        onFocus={() => setEditing(true)}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') { setDraft(shown); setEditing(false); } }}
      />
    </PropField>
  );
}

function Flag({ label, on, onChange, disabled }: {
  label: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className="gecko-row gecko-yard-flag">
      <input type="checkbox" className="gecko-checkbox" checked={on} disabled={disabled}
        onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="gecko-row gecko-row-between gecko-yard-summary-row">
      <span className="gecko-text-secondary">{label}</span>
      <span className="gecko-text-mono gecko-yard-summary-value">{value}</span>
    </div>
  );
}
