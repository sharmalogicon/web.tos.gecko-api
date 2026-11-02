"use client";
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { PartyName } from '@/components/ui/PartyName';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/problem';
import { formatContainerNo } from '@/lib/api/tos';
import { isWellFormedContainerNo, normaliseContainerNo } from '@/lib/api/container-story';
import {
  YARD_MANAGE, locateContainer, useYardMap, useYardSettings,
  type YardLocation, type YardMapBlock, type YardMapTally,
} from '@/lib/api/yard-map';
import { StackView } from '@/components/yard/StackView';
import { MoveBoxDialog } from '@/components/yard/MoveBoxDialog';
import { OrderJobDialog } from '@/components/yard/OrderJobDialog';
import {
  CANVAS_H, CANVAS_W, GRID_PX, TYPE_STYLE, UNTYPED_STYLE,
  blockBox, blockStyle, isPlaced, typeLabel,
} from '@/components/yard/block-style';
import { YardMapOff } from '@/components/yard/YardMapOff';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

/**
 * YARD AT A GLANCE — the yard as it stands, counted by the server.
 *
 * Every number on this screen used to be INVENTED. The blocks came from the
 * browser's own localStorage copy of the layout, and the occupancy, dwell,
 * holds, reefer and damage figures came from `hashKey(block.id)` — a hash of
 * the block's id, biased per block type so it looked plausible. It looked
 * exactly like a working dashboard, which is the worst thing a screen full of
 * made-up numbers can look like.
 *
 * It is one read now: `GET /api/tos/yard/map?yardId=`, which answers the
 * depot's blocks where the layout editor put them, each with the boxes standing
 * in it — boxes, TEU, full / empty, reefers, holds, damaged, average and
 * longest dwell — plus the yard's totals and `unplaced`.
 *
 * UNPLACED IS NOT A GAP, IT IS THE NORMAL CASE TODAY. A box counts in a block
 * only when its visit names one of that block's slots. A depot that records an
 * area code at the gate has every box unplaced, and the API never guesses one
 * into a block. The card says so, with the number, rather than quietly leaving
 * those boxes out of the map.
 *
 * Nothing on the map is editable, and nothing is drawn differently from the
 * editor: both read the same rules from components/yard/block-style.
 *
 * PHASE 2 added the three things a clerk does with a map once they have one:
 * open a block and see it stack by stack, FIND a box (`/yard/locate`), and
 * MOVE one (`/yard/moves`, which needs `tos.yard.manage` $d a clerk without it
 * is shown no Move at all). The yard, the open block and a search all travel in
 * the URL, so "show me where TTNU3535354 is" is a link somebody can send.
 */

type Lens = 'occupancy' | 'dwell' | 'holds' | 'reefer' | 'type';

interface Band { fill: string; stroke: string; label: string }

/**
 * How full a block is: the BOXES in it against the slots it can use.
 *
 * One slot holds one box of any length (a stack is one length, Phase 3), so
 * occupancy is boxes over usable slots — not TEU over slots, which counted a
 * 40' box as two and read over 100% in a yard that was merely full.
 */
function occupancyBand(pct: number | null): Band {
  if (pct === null) return { fill: '#f9fafb', stroke: '#9ca3af', label: 'No slots' };
  if (pct >= 85) return { fill: '#fee2e2', stroke: '#dc2626', label: 'Critical (>85%)' };
  if (pct >= 60) return { fill: '#fef3c7', stroke: '#d97706', label: 'High (60–85%)' };
  if (pct >= 30) return { fill: '#d1fae5', stroke: '#059669', label: 'Moderate (30–60%)' };
  if (pct > 0)   return { fill: '#e0f2fe', stroke: '#0284c7', label: 'Low (<30%)' };
  return { fill: '#f9fafb', stroke: '#9ca3af', label: 'Empty' };
}

function dwellBand(days: number): Band {
  if (days >= 14) return { fill: '#fee2e2', stroke: '#dc2626', label: '14+ days' };
  if (days >= 7)  return { fill: '#fef3c7', stroke: '#d97706', label: '7–13 days' };
  if (days >= 4)  return { fill: '#d1fae5', stroke: '#059669', label: '4–6 days' };
  if (days > 0)   return { fill: '#e0f2fe', stroke: '#0284c7', label: '1–3 days' };
  return { fill: '#f9fafb', stroke: '#9ca3af', label: 'No boxes' };
}

function holdsBand(held: number): Band {
  if (held >= 10) return { fill: '#fee2e2', stroke: '#dc2626', label: '10+ holds' };
  if (held >= 3)  return { fill: '#fef3c7', stroke: '#d97706', label: '3–9 holds' };
  if (held > 0)   return { fill: '#fed7aa', stroke: '#ea580c', label: '1–2 holds' };
  return { fill: '#d1fae5', stroke: '#059669', label: 'No holds' };
}

/** Reefers standing against the plugs the block's slots have. */
function reeferBand(reefer: number, plugs: number): Band {
  if (plugs === 0) return { fill: '#f9fafb', stroke: '#9ca3af', label: 'Not reefer' };
  const pct = reefer / plugs;
  if (pct >= 0.85) return { fill: '#fee2e2', stroke: '#dc2626', label: 'Plugs critical (>85%)' };
  if (pct >= 0.60) return { fill: '#fef3c7', stroke: '#d97706', label: 'Plugs high (60–85%)' };
  if (pct >= 0.30) return { fill: '#cffafe', stroke: '#0891b2', label: 'Plugs moderate' };
  if (pct > 0)     return { fill: '#e0f2fe', stroke: '#0284c7', label: 'Plugs low' };
  return { fill: '#f9fafb', stroke: '#9ca3af', label: 'No reefers plugged' };
}

function bandOf(b: YardMapBlock, lens: Lens): Band {
  switch (lens) {
    case 'occupancy': return occupancyBand(b.occupancyPct);
    case 'dwell':     return dwellBand(b.tally.averageDays);
    case 'holds':     return holdsBand(b.tally.held);
    case 'reefer':    return reeferBand(b.tally.reefer, b.reeferPlugCount);
    case 'type':      { const s = blockStyle(b); return { fill: s.fill, stroke: s.stroke, label: s.label }; }
  }
}

function lensLabel(b: YardMapBlock, lens: Lens): string {
  switch (lens) {
    case 'occupancy': return b.occupancyPct === null ? '—' : `${Math.round(b.occupancyPct)}%`;
    case 'dwell':     return b.tally.boxes === 0 ? '—' : `${b.tally.averageDays}d`;
    case 'holds':     return b.tally.held > 0 ? `${b.tally.held} hold${b.tally.held === 1 ? '' : 's'}` : 'clear';
    case 'reefer':    return b.reeferPlugCount > 0 ? `${b.tally.reefer}/${b.reeferPlugCount}` : '—';
    case 'type':      return typeLabel(b.blockType);
  }
}

/** What a block's colour means, for the legend under the map. */
const LENS_LEGEND: Record<Lens, { label: string; bands: Band[] }> = {
  occupancy: {
    label: 'Block occupancy — boxes against usable slots',
    bands: [occupancyBand(90), occupancyBand(70), occupancyBand(40), occupancyBand(10), occupancyBand(0), occupancyBand(null)],
  },
  dwell: { label: 'Average dwell', bands: [dwellBand(20), dwellBand(10), dwellBand(5), dwellBand(2), dwellBand(0)] },
  holds: { label: 'Holds in the block', bands: [holdsBand(12), holdsBand(5), holdsBand(1), holdsBand(0)] },
  reefer: {
    label: 'Reefers against reefer plugs',
    bands: [reeferBand(9, 10), reeferBand(7, 10), reeferBand(4, 10), reeferBand(1, 10), reeferBand(0, 10), reeferBand(0, 0)],
  },
  type: {
    label: 'Block type',
    bands: [
      ...Object.values(TYPE_STYLE).map(s => ({ fill: s.fill, stroke: s.stroke, label: s.label })),
      { fill: UNTYPED_STYLE.fill, stroke: UNTYPED_STYLE.stroke, label: UNTYPED_STYLE.label },
    ],
  },
};

const LENS_OPTIONS: { value: Lens; label: string; icon: string }[] = [
  { value: 'occupancy', label: 'Occupancy', icon: 'layers' },
  { value: 'dwell',     label: 'Dwell time', icon: 'clock' },
  { value: 'holds',     label: 'Holds',     icon: 'warning' },
  { value: 'reefer',    label: 'Reefer plugs', icon: 'activity' },
  { value: 'type',      label: 'Block type', icon: 'tag' },
];

/** TEU comes back as a decimal: 1.5 for a 20' + a 40', and 12 flat for twelve 20s. */
const teu = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function YardGlancePage() {
  // useSearchParams needs a boundary: the yard, the block and a search are all
  // in the URL so a clerk can send one.
  return (
    <Suspense fallback={<div className="gecko-empty-card gecko-yard-loading">Loading…</div>}>
      <YardGlance />
    </Suspense>
  );
}

function YardGlance() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { canAt } = useSession();
  const { branch, yards, yard: headerYard } = useFacility();
  const { mapEnabled, loading: settingsLoading, denied } = useYardSettings();

  // A yard belongs to one depot: switching depot drops the pick (during render,
  // so the map is never drawn for the depot the user just left). The URL's yard
  // is where it starts, so a link opens on the yard it names.
  const [picked, setPicked] = useState<string | null>(params.get('yard'));
  const [pickedOwner, setPickedOwner] = useState<string | null>(branch?.branchId ?? null);
  const branchId = branch?.branchId ?? null;
  if (branchId !== pickedOwner) { setPickedOwner(branchId); setPicked(null); }
  const yardId = (picked && yards.some(y => y.yardId === picked) ? picked : null)
    ?? headerYard?.yardId ?? yards[0]?.yardId ?? null;

  const map = useYardMap(mapEnabled ? yardId : null);
  const [lens, setLens] = useState<Lens>('occupancy');
  const [hovered, setHovered] = useState<string | null>(null);

  // ── the block that is open, the box that was found, the box being moved ──
  const [openBlockId, setOpenBlockId] = useState<string | null>(params.get('block'));
  const [found, setFound] = useState<YardLocation | null>(null);
  const [findText, setFindText] = useState(params.get('find') ?? '');
  const [finding, setFinding] = useState(false);
  const [findNote, setFindNote] = useState<string | null>(null);
  const [moving, setMoving] = useState<YardLocation | null>(null);
  /** A planner ordering work on a box they are looking at (Phase 4). */
  const [ordering, setOrdering] = useState<{ containerNo: string; kind: 'RELOCATE' | 'PULL' } | null>(null);
  /** Bumped to re-read the open block: the 30-second tick, and after a move. */
  const [tick, setTick] = useState(0);
  const canMove = canAt(YARD_MANAGE, branchId);

  // The yard, the open block and a search live in the URL, so this screen is
  // linkable — the container master's "Show on map" is exactly such a link.
  const remember = useCallback((next: { yard?: string | null; block?: string | null; find?: string | null }) => {
    const q = new URLSearchParams();
    // The yard SHOWN, not the one explicitly picked: a link has to open on the
    // yard the sender was looking at, even if they never touched the select.
    const yard = next.yard === undefined ? yardId : next.yard;
    const block = next.block === undefined ? openBlockId : next.block;
    const find = next.find === undefined ? null : next.find;
    if (yard) q.set('yard', yard);
    if (block) q.set('block', block);
    if (find) q.set('find', find);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, yardId, openBlockId]);

  /**
   * WHERE IS THIS BOX? `/yard/locate` answers, and a 404 is an ANSWER — the
   * box is not in a yard this user covers — not a failure to report as one.
   *
   * A box standing in a slot switches the map to its yard, opens its block and
   * rings its cell. A box located by an area code has no cell to ring, so it is
   * said in words instead of pretending the map knows.
   */
  const find = useCallback(async (raw: string) => {
    const no = normaliseContainerNo(raw);
    if (!no) { setFound(null); setFindNote(null); return; }
    if (!isWellFormedContainerNo(no)) {
      setFound(null);
      setFindNote(`${no} is not a container number (4 to 11 letters or digits).`);
      return;
    }
    setFinding(true);
    setFindNote(null);
    try {
      const here = (await locateContainer(no))[0];
      if (!here) { setFound(null); setFindNote(`${no} is not in the yard.`); return; }
      setFound(here);
      if (here.yardId && here.yardId !== yardId) setPicked(here.yardId);
      if (here.yardBlockId) {
        setOpenBlockId(here.yardBlockId);
        setFindNote(null);
      } else {
        setOpenBlockId(null);
        setFindNote(`${formatContainerNo(no)} is in ${here.yardCode ?? 'this depot'} at ${here.positionText ?? 'no recorded position'} (no slot).`);
      }
      remember({ yard: here.yardId ?? null, block: here.yardBlockId ?? null, find: no });
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      setFound(null);
      setFindNote(err.status === 404 ? `${formatContainerNo(no)} is not in the yard.` : err.explanation ?? err.message);
    } finally {
      setFinding(false);
    }
  }, [yardId, remember]);

  // A ?find= in the URL is searched once, on arrival. The number already
  // searched is a ref, not state: nothing renders it, and setting state in an
  // effect only to stop the effect running again is a re-render for nothing.
  const searched = useRef<string | null>(null);
  const urlFind = params.get('find');
  useEffect(() => {
    if (!urlFind || searched.current === urlFind) return;
    searched.current = urlFind;
    void find(urlFind);
  }, [urlFind, find]);

  // The yard changes while the clerk watches it, so it is re-read every 30
  // seconds. `reload()` keeps the figures on screen until the new ones land,
  // and the tick re-reads the open block with them.
  useEffect(() => {
    const t = setInterval(() => { map.reload(); setTick(n => n + 1); }, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.reload]);

  const openBlock = (blockId: string | null) => {
    setOpenBlockId(blockId);
    remember({ block: blockId, find: found?.containerNo ?? null });
  };

  /** A box has moved: the map, the open block and the found box are all stale. */
  const moved = async (to: YardLocation) => {
    map.reload();
    setTick(n => n + 1);
    if (to.yardId && to.yardId !== yardId) setPicked(to.yardId);
    setFound(to);
    if (to.yardBlockId) setOpenBlockId(to.yardBlockId);
    remember({ yard: to.yardId ?? null, block: to.yardBlockId ?? null, find: to.containerNo });
  };

  /**
   * Open Move on a box. The dig (`boxesOnTop`) only comes with a locate, so it
   * is read here rather than guessed from the stack on screen — which may be a
   * few seconds old, and a box that cannot be lifted must say so before the
   * clerk fills the form in.
   */
  const askToMove = async (containerNo: string) => {
    try {
      const here = (await locateContainer(containerNo))[0];
      if (here) setMoving(here);
      else setFindNote(`${formatContainerNo(containerNo)} is not in the yard any more.`);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      setFindNote(err.explanation ?? err.message);
    }
  };

  const data = map.data && map.data.yardId === yardId ? map.data : null;
  const blocks = useMemo(() => (data?.blocks ?? []).filter(isPlaced), [data]);

  /** Worth a look first: full, held, and standing a long time. */
  const hotspots = useMemo(() => [...blocks]
    .map(b => ({ b, score: (b.occupancyPct ?? 0) + b.tally.held * 4 + b.tally.maxDays / 2 }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 5), [blocks]);

  if (settingsLoading) {
    return <div className="gecko-empty-card gecko-yard-loading">Checking what this depot records…</div>;
  }
  if (!mapEnabled) return <YardMapOff where={branch?.displayName} denied={denied} />;

  if (yards.length === 0) {
    return <EmptyState icon="layers" title="This depot has no yards yet"
      description="A block belongs to a yard. Master Data → Yards lists the depot’s yards." />;
  }

  if (map.error) {
    return <ErrorBanner error={map.error} className="gecko-yard-alert" />;
  }

  if (!data) {
    return <div className="gecko-empty-card gecko-yard-loading">Reading the yard…</div>;
  }

  if (data.blocks.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title={`${data.yardName} has no blocks yet`}
        description="Lay the yard out first: drop blocks on the canvas, give each its bays, rows and tiers, then generate its slots. The map fills itself from the boxes standing in them."
        action={
          <Link href="/config/yard-zones" className="gecko-btn gecko-btn-primary gecko-btn-sm">
            <Icon name="settings" size={14} /> Open Yard Zones &amp; Blocks
          </Link>
        }
      />
    );
  }

  const total = data.total;
  // Boxes over usable slots, the same sum the API does per block.
  const occupancy = data.usableSlotCount > 0 ? (total.boxes / data.usableSlotCount) * 100 : null;
  const hoveredBlock = blocks.find(b => b.yardBlockId === hovered) ?? null;
  /**
   * Where the hover card points. Above the block normally; below it when the
   * block sits near the top of the canvas and the card would be drawn off it.
   *
   * Plain arithmetic, not a useMemo: this line sits after an early return, and
   * a hook here would be called on some renders and not others.
   */
  const hoverTip = hoverTipAt(hoveredBlock);

  return (
    <div className="gecko-stack gecko-stack-lg gecko-yard-glance">

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-yard-title-row">
            <h1 className="gecko-page-title">Yard at a Glance</h1>
            <span className="gecko-pill gecko-pill-success gecko-inline-row">
              <span className="gecko-pulse-dot gecko-yard-live-dot" />
              Live
            </span>
            {data.locationMode === 'AREA' && (
              <span className="gecko-pill gecko-pill-neutral" title="Boxes are located by an area code, so none of them stands in a slot yet">
                located by area
              </span>
            )}
          </div>
          <p className="gecko-page-subtitle">
            {data.yardCode} · {data.yardName} — {data.blocks.length} blocks · read {clock(data.asAt)}
          </p>
        </div>
        <div className="gecko-toolbar">
          {yards.length > 1 && (
            <select className="gecko-input gecko-input-sm gecko-yard-select" value={yardId ?? ''} aria-label="Yard"
              onChange={e => {
                // A block belongs to one yard, so the open one closes with it.
                setPicked(e.target.value); setHovered(null); setOpenBlockId(null); setFound(null);
                remember({ yard: e.target.value, block: null, find: null });
              }}>
              {yards.map(y => <option key={y.yardId} value={y.yardId}>{y.yardCode} · {y.nameEn}</option>)}
            </select>
          )}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => map.reload()}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
          <Link href="/gate/stock" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            <Icon name="grid" size={14} /> Yard stock
          </Link>
          <Link href="/config/yard-zones" className="gecko-btn gecko-btn-ghost gecko-btn-sm">
            <Icon name="settings" size={14} /> Configure
          </Link>
        </div>
      </div>

      {/* FIND A BOX. The number is all a clerk has when the radio asks where
          something is, and the answer has to be a place on this map. */}
      <div className="gecko-card gecko-card-padded gecko-row gecko-row-wrap gecko-yard-find">
        <Icon name="search" size={16} className="gecko-text-secondary" />
        <input
          className="gecko-input gecko-text-mono gecko-yard-find-input"
          value={findText}
          placeholder="Find a box in the yard · container number + Enter"
          aria-label="Find a container in the yard"
          onChange={e => setFindText(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') void find(findText); }}
        />
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={finding} onClick={() => void find(findText)}>
          {finding ? 'Looking…' : 'Find'}
        </button>
        {(found || findNote) && (
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"
            onClick={() => { setFindText(''); setFound(null); setFindNote(null); remember({ find: null }); }}>
            <Icon name="x" size={13} /> Clear
          </button>
        )}
        {found && (
          <span className="gecko-row gecko-row-wrap gecko-yard-find-hit">
            <strong className="gecko-text-mono">{formatContainerNo(found.containerNo)}</strong>
            <span>
              {found.yardCode}
              {found.positionText ? <> · <span className="gecko-text-mono">{found.positionText}</span></> : null}
              {` · ${found.daysInYard} days`}
            </span>
            {found.isHeld && <span className="gecko-pill gecko-pill-warning">held</span>}
            {found.boxesOnTop.length > 0 && (
              <span className="gecko-pill gecko-pill-neutral" title="These have to be moved before it can be lifted">
                {found.boxesOnTop.length} on top
              </span>
            )}
            <Link href={`/units/unit-inquiry?no=${encodeURIComponent(found.containerNo)}`}
              className="gecko-btn gecko-btn-outline gecko-btn-sm">Open box</Link>
            {canMove && (
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => void askToMove(found.containerNo)}>
                <Icon name="transferH" size={13} /> Move
              </button>
            )}
          </span>
        )}
        {findNote && <span className="gecko-cell-meta gecko-yard-find-note">{findNote}</span>}
      </div>

      {/* KPI strip — every figure is the server's count */}
      <div className="gecko-yard-kpis">
        <KpiTile icon="layers" tone="primary" label="Yard occupancy"
          value={occupancy === null ? '—' : `${occupancy.toFixed(1)}%`}
          sub={data.usableSlotCount > 0
            ? `${total.boxes.toLocaleString()} boxes in ${data.usableSlotCount.toLocaleString()} slots`
            : 'no usable slots yet'} />
        <KpiTile icon="box" tone="info" label="Boxes in yard"
          value={total.boxes.toLocaleString()} sub={`${teu(total.teu)} TEU`} />
        <KpiTile icon="packageOpen" tone="neutral" label="Full / empty"
          value={`${total.full} / ${total.empty}`} sub="as the gate recorded them" />
        <KpiTile icon="clock" tone={total.averageDays >= 7 ? 'warning' : 'success'} label="Average dwell"
          value={`${total.averageDays}`} sub={`days · longest ${total.maxDays}`} />
        <KpiTile icon="warning" tone={total.held > 10 ? 'danger' : total.held > 0 ? 'warning' : 'success'}
          label="Holds" value={total.held.toLocaleString()} sub="boxes that may not leave" />
        <KpiTile icon="tool" tone={total.damaged > 0 ? 'danger' : 'neutral'} label="Damaged"
          value={total.damaged.toLocaleString()} sub={`${total.reefer} reefers in yard`} />
      </div>

      {data.unplaced.boxes > 0 && (
        <div className="gecko-alert gecko-alert-info gecko-row gecko-yard-unplaced">
          <Icon name="info" size={16} />
          <div className="gecko-flex-1">
            <strong>{data.unplaced.boxes.toLocaleString()} boxes in {data.yardName} have no slot</strong>
            {' — located by area code. '}
            They are counted in the totals above and in no block below.
          </div>
          <Link href="/gate/stock" className="gecko-btn gecko-btn-outline gecko-btn-sm">See the list</Link>
        </div>
      )}

      <div className="gecko-yard-glance-main">

        <div className="gecko-table-card">
          <div className="gecko-row gecko-row-wrap gecko-yard-glance-head">
            <div className="gecko-flex-1">
              <div className="gecko-section-header-title">Yard map · {LENS_LEGEND[lens].label}</div>
              <div className="gecko-section-header-subtitle">
                Hover a block for what stands in it, click it to see it stack by stack · the layout is drawn exactly
                as Yard Zones &amp; Blocks saved it
              </div>
            </div>
            <div className="gecko-segctrl">
              {LENS_OPTIONS.map(o => (
                <button key={o.value}
                  className={`gecko-segctrl-btn ${lens === o.value ? 'gecko-segctrl-btn-active' : ''} gecko-inline-row`}
                  onClick={() => setLens(o.value)}>
                  <Icon name={o.icon} size={11} /> {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="gecko-yard-glance-canvas">
            {/* WHAT IS IN THE BLOCK UNDER THE POINTER.
                Positioned from the block's own place on the canvas: the SVG
                keeps its aspect ratio and fills the width, so a percentage of
                the viewBox is a percentage of the drawing. Those two numbers
                are the only thing this passes inline — everything it looks
                like is §56 of the design system. */}
            {hoveredBlock && hoverTip && (
              <div
                className={`gecko-yard-tip${hoverTip.below ? ' gecko-yard-tip-below' : ''}`}
                style={{ '--gecko-tip-x': `${hoverTip.x}%`, '--gecko-tip-y': `${hoverTip.y}%` } as React.CSSProperties}>
                <div className="gecko-yard-tip-head">
                  <span className="gecko-yard-tip-code">{hoveredBlock.blockCode}</span>
                  <span className="gecko-yard-tip-type">{typeLabel(hoveredBlock.blockType)}</span>
                </div>
                <dl className="gecko-yard-tip-facts">
                  <TipFact label="Boxes" value={`${hoveredBlock.tally.boxes} · ${teu(hoveredBlock.tally.teu)} TEU`} />
                  <TipFact label="Occupied" value={hoveredBlock.occupancyPct === null
                    ? 'no slots yet'
                    : `${Math.round(hoveredBlock.occupancyPct)}%`} />
                  <TipFact label="Dwell" value={hoveredBlock.tally.boxes === 0
                    ? '—'
                    : `${hoveredBlock.tally.averageDays}d avg · ${hoveredBlock.tally.maxDays}d longest`} />
                  {hoveredBlock.tally.held > 0 && (
                    <TipFact label="Held" value={`${hoveredBlock.tally.held} may not leave`} warn />
                  )}
                </dl>
                <div className="gecko-yard-tip-foot">Click to see it stack by stack</div>
              </div>
            )}
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="gecko-yard-glance-svg" preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="yardGrid" width={GRID_PX * 5} height={GRID_PX * 5} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID_PX * 5} 0 L 0 0 0 ${GRID_PX * 5}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width={CANVAS_W} height={CANVAS_H} fill="url(#yardGrid)" />

              {blocks.map(b => {
                const band = bandOf(b, lens);
                const { x, y, w, h } = blockBox(b);
                const on = hovered === b.yardBlockId;
                const isOpen = openBlockId === b.yardBlockId;
                const hasFound = found?.yardBlockId === b.yardBlockId;
                return (
                  <g key={b.yardBlockId}
                    onMouseEnter={() => setHovered(b.yardBlockId)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => openBlock(isOpen ? null : b.yardBlockId)}
                    className="gecko-yard-glance-block"
                    /* The name a screen reader announces. It used to be a
                       <title>, which also made the browser draw its own grey
                       tooltip — unstyleable, and nothing like the rest of the
                       app. The card below replaces the drawing; this keeps
                       what the title was actually for. */
                    aria-label={blockSummary(b)}>
                    <rect x={x} y={y} width={w} height={h} fill={band.fill}
                      stroke={on || isOpen ? '#0f172a' : band.stroke} strokeWidth={on || isOpen ? 3 : 1.5} rx={3} />
                    {/* The block a search landed in, ringed until it is cleared. */}
                    {hasFound && (
                      <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={5} fill="none"
                        stroke="#0ea5e9" strokeWidth={2.5} className="gecko-yard-glance-found" />
                    )}
                    <text x={x + w / 2} y={y + h / 2 - 2} textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(28, Math.max(14, Math.min(w, h) / 6))} fontWeight="700" fill={band.stroke}
                      fontFamily="ui-monospace, SF Mono, Menlo, monospace" className="gecko-yard-glance-label">
                      {b.blockCode}
                    </text>
                    <text x={x + w / 2} y={y + h / 2 + 22} textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(18, Math.max(10, Math.min(w, h) / 10))} fontWeight="600" fill={band.stroke}
                      opacity={0.85} className="gecko-yard-glance-label">
                      {lensLabel(b, lens)}
                    </text>
                  </g>
                );
              })}

              {/* The yard HAS blocks (the table below lists them) but nobody
                  has put them on the map. Drawing nothing without saying so
                  reads as a broken screen. */}
              {blocks.length === 0 && (
                <g transform={`translate(${CANVAS_W / 2}, ${CANVAS_H / 2})`}>
                  <text textAnchor="middle" y={-8} fill="#9ca3af" fontSize={20} fontWeight={700}>
                    No block is on the map yet
                  </text>
                  <text textAnchor="middle" y={18} fill="#9ca3af" fontSize={13}>
                    {data.blocks.length} blocks exist — place them in Yard Zones &amp; Blocks
                  </text>
                </g>
              )}
            </svg>

            <div className="gecko-row gecko-row-wrap gecko-yard-glance-legend">
              {LENS_LEGEND[lens].bands.map(band => (
                <span key={band.label} className="gecko-inline-row gecko-cell-meta">
                  <span className="gecko-yard-legend-swatch" style={{ background: band.fill, borderColor: band.stroke }} />
                  {band.label}
                </span>
              ))}
            </div>
          </div>

          {hoveredBlock && <BlockStrip block={hoveredBlock} />}
        </div>

        <div className="gecko-table-card">
          <div className="gecko-row gecko-yard-glance-head">
            <Icon name="warning" size={14} className="gecko-yard-hot-icon" />
            <div className="gecko-section-header-title gecko-flex-1">Hotspots</div>
            <span className="gecko-cell-meta gecko-yard-hot-count">top 5</span>
          </div>
          <div>
            {hotspots.map(({ b }, idx) => {
              const style = blockStyle(b);
              return (
                <div key={b.yardBlockId}
                  onMouseEnter={() => setHovered(b.yardBlockId)}
                  onMouseLeave={() => setHovered(null)}
                  className={`gecko-yard-hot${hovered === b.yardBlockId ? ' gecko-yard-hot-on' : ''}`}>
                  <div className="gecko-row gecko-yard-hot-head">
                    <div className="gecko-yard-hot-rank"
                      style={{ background: style.fill, color: style.stroke, borderColor: `${style.stroke}40` }}>
                      {idx + 1}
                    </div>
                    <span className="gecko-yard-hot-code" style={{ color: style.stroke }}>{b.blockCode}</span>
                    <span className="gecko-eyebrow">{typeLabel(b.blockType)}</span>
                  </div>
                  <div className="gecko-row gecko-row-wrap gecko-cell-meta">
                    <span><strong className="gecko-yard-hot-strong">{b.occupancyPct === null ? '—' : `${Math.round(b.occupancyPct)}%`}</strong> full</span>
                    <span>·</span>
                    <span><strong className="gecko-yard-hot-strong">{b.tally.boxes}</strong> boxes</span>
                    <span>·</span>
                    <span><strong className="gecko-yard-hot-strong">{b.tally.averageDays}d</strong> dwell</span>
                    {b.tally.held > 0 && <><span>·</span><span className="gecko-yard-hot-warn"><strong>{b.tally.held}</strong> holds</span></>}
                    {b.tally.damaged > 0 && <><span>·</span><span className="gecko-yard-hot-bad"><strong>{b.tally.damaged}</strong> DM</span></>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ONE BLOCK, STACK BY STACK. The map says which block is full; this says
          which box is where in it — and it is where a move starts. */}
      {openBlockId && (
        <StackView
          blockId={openBlockId}
          highlightSlotId={found?.yardSlotId ?? null}
          tick={tick}
          onClose={() => openBlock(null)}
          onMove={canMove ? box => void askToMove(box.containerNo) : undefined}
          onOrder={canMove ? (containerNo, kind) => setOrdering({ containerNo, kind }) : undefined}
        />
      )}

      {/* Block by block */}
      <div className="gecko-table-card">
        <div className="gecko-row gecko-yard-glance-head">
          <div className="gecko-flex-1">
            <div className="gecko-section-header-title">Block by block</div>
            <div className="gecko-section-header-subtitle">
              {data.blocks.length} blocks · {data.slotCount.toLocaleString()} slots, {data.usableSlotCount.toLocaleString()} usable
            </div>
          </div>
        </div>
        <div className="gecko-yard-table-scroll">
          <table className="gecko-table gecko-table-compact gecko-yard-glance-table">
            <thead>
              <tr>
                <th>Block</th>
                <th>Type</th>
                <th>Reserved for</th>
                <th className="gecko-cell-right">Slots</th>
                <th className="gecko-cell-right">Boxes</th>
                <th className="gecko-cell-right">TEU</th>
                <th>Occupancy</th>
                <th className="gecko-cell-right">Full / empty</th>
                <th className="gecko-cell-right">Avg dwell</th>
                <th className="gecko-cell-right">Longest</th>
                <th className="gecko-cell-right">Holds</th>
                <th className="gecko-cell-right">Reefer plugs</th>
              </tr>
            </thead>
            <tbody>
              {data.blocks.map(b => {
                const style = blockStyle(b);
                const pct = b.occupancyPct;
                return (
                  <tr key={b.yardBlockId} className="gecko-row-clickable"
                    onMouseEnter={() => setHovered(b.yardBlockId)} onMouseLeave={() => setHovered(null)}
                    onClick={() => openBlock(openBlockId === b.yardBlockId ? null : b.yardBlockId)}>
                    <td className="gecko-text-mono gecko-yard-hot-code" style={{ color: style.stroke }}>{b.blockCode}</td>
                    <td>
                      <span className="gecko-pill gecko-yard-type-pill"
                        style={{ background: style.fill, color: style.stroke, borderColor: `${style.stroke}40` }}>
                        {typeLabel(b.blockType)}
                      </span>
                    </td>
                    <td>
                      {b.allocatedToPartyCode
                        ? <PartyName code={b.allocatedToPartyCode} resolve />
                        : <span className="gecko-cell-meta">Open to all</span>}
                      {b.allocatedSizeFt && <div className="gecko-cell-meta">{b.allocatedSizeFt}&apos; only</div>}
                    </td>
                    <td className="gecko-num-tabular">
                      {b.slotCount === 0
                        ? <span className="gecko-cell-meta">none</span>
                        : <>{b.slotCount - b.blockedSlotCount}<span className="gecko-cell-meta"> / {b.slotCount}</span></>}
                    </td>
                    <td className="gecko-num-tabular">{b.tally.boxes}</td>
                    <td className="gecko-num-tabular">{teu(b.tally.teu)}</td>
                    <td>
                      {pct === null
                        ? <span className="gecko-cell-meta" title="No usable slots — generate them in Yard Zones &amp; Blocks">no slots</span>
                        : <div className="gecko-row gecko-yard-bar-row">
                            <div className="gecko-progress gecko-progress-sm gecko-yard-bar">
                              <div className="gecko-progress-bar gecko-yard-bar-fill"
                                style={{ width: `${Math.min(100, pct)}%`, background: occupancyBand(pct).stroke }} />
                            </div>
                            <span className="gecko-num-tabular gecko-yard-bar-value">{Math.round(pct)}%</span>
                          </div>}
                    </td>
                    <td className="gecko-num-tabular">{b.tally.full} / {b.tally.empty}</td>
                    <td className="gecko-num-tabular">{b.tally.averageDays}d</td>
                    <td className="gecko-num-tabular">{b.tally.maxDays}d</td>
                    <td className="gecko-cell-right">
                      {b.tally.held > 0
                        ? <span className="gecko-pill gecko-pill-warning gecko-yard-type-pill">{b.tally.held}</span>
                        : <span className="gecko-cell-meta">—</span>}
                    </td>
                    <td className="gecko-num-tabular">
                      {b.reeferPlugCount > 0
                        ? `${b.tally.reefer}/${b.reeferPlugCount}`
                        : <span className="gecko-cell-meta">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {ordering && branchId && (
        <OrderJobDialog
          branchId={branchId}
          containerNo={ordering.containerNo}
          kind={ordering.kind}
          onClose={() => setOrdering(null)}
        />
      )}

      {moving && (
        <MoveBoxDialog
          location={moving}
          onClose={() => setMoving(null)}
          onMoved={to => void moved(to)}
          onMoveInstead={no => void askToMove(no)}
        />
      )}
    </div>
  );
}

/** The hovered block, spelled out: everything the map could only colour. */
function BlockStrip({ block }: { block: YardMapBlock }) {
  const style = blockStyle(block);
  const t: YardMapTally = block.tally;
  return (
    <div className="gecko-row gecko-row-wrap gecko-yard-strip">
      <span className="gecko-yard-hot-code" style={{ color: style.stroke }}>{block.blockCode}</span>
      <span className="gecko-pill gecko-yard-type-pill"
        style={{ background: style.fill, color: style.stroke, borderColor: `${style.stroke}40` }}>
        {typeLabel(block.blockType)}
      </span>
      <Metric label="Boxes" value={t.boxes} />
      <Metric label="TEU" value={teu(t.teu)} />
      <Metric label="Full / empty" value={`${t.full} / ${t.empty}`} />
      <Metric label="Reefers" value={block.reeferPlugCount > 0 ? `${t.reefer} of ${block.reeferPlugCount} plugs` : String(t.reefer)} />
      <Metric label="Holds" value={t.held} tone={t.held > 0 ? 'warning' : 'neutral'} />
      <Metric label="Damaged" value={t.damaged} tone={t.damaged > 0 ? 'warning' : 'neutral'} />
      <Metric label="Dwell" value={`${t.averageDays}d avg · ${t.maxDays}d longest`} />
      <Metric label="Slots" value={block.slotCount === 0 ? 'none yet' : `${block.slotCount - block.blockedSlotCount} usable of ${block.slotCount}`} />
      {block.allocatedToPartyCode && (
        <span className="gecko-inline-row gecko-yard-metric">
          <span className="gecko-eyebrow">Reserved</span>
          <span className="gecko-yard-metric-value">
            <PartyName code={block.allocatedToPartyCode} resolve inline />
            {block.allocatedSizeFt ? ` · ${block.allocatedSizeFt}'` : ''}
          </span>
        </span>
      )}
    </div>
  );
}

function KpiTile({ icon, tone, label, value, sub }: {
  icon: string; tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  label: string; value: string | number; sub: string;
}) {
  /**
   * STACKED, not strung out in a line (owner, 2026-11-02).
   *
   * Six tiles across a dashboard leave each one about 180px, and a row of
   * icon + figure + name + note inside that width broke the note into columns
   * two words wide: "35 boxe / in 858 / slot". The name is the tile's heading
   * now, the figure sits under it with its icon, and the note runs along the
   * bottom with the full width to do it in.
   */
  return (
    <div className="gecko-kpi-tile gecko-kpi-tile-stacked">
      <div className="gecko-eyebrow gecko-kpi-tile-head">{label}</div>
      <div className="gecko-kpi-tile-main">
        <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${tone}`}><Icon name={icon} size={16} /></div>
        <div className="gecko-kpi-tile-value">{value}</div>
      </div>
      <div className="gecko-cell-sub gecko-kpi-tile-foot">{sub}</div>
    </div>
  );
}

/** The hover card's place on the canvas, as a share of the drawing. */
function hoverTipAt(block: YardMapBlock | null): { x: number; y: number; below: boolean } | null {
  if (!block) return null;
  const { x, y, w, h } = blockBox(block);
  const topPct = (y / CANVAS_H) * 100;
  // No room above a block near the top: the card goes under it instead.
  const below = topPct < 22;
  return {
    x: ((x + w / 2) / CANVAS_W) * 100,
    y: below ? ((y + h) / CANVAS_H) * 100 : topPct,
    below,
  };
}

/** One line of the hover card: what it is, and what it says. */
function TipFact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <>
      <dt className="gecko-yard-tip-key">{label}</dt>
      <dd className={`gecko-yard-tip-val${warn ? ' gecko-yard-tip-val-warn' : ''}`}>{value}</dd>
    </>
  );
}

/**
 * The block in one sentence, for a screen reader — the same facts the hover
 * card shows, which is what the old <title> element used to carry.
 */
function blockSummary(b: YardMapBlock): string {
  const full = b.occupancyPct === null
    ? 'no slots yet — generate them in Yard Zones & Blocks'
    : `${Math.round(b.occupancyPct)}% full`;
  return [
    `${b.blockCode} · ${typeLabel(b.blockType)}`,
    `${b.tally.boxes} boxes, ${teu(b.tally.teu)} TEU`,
    full,
    `${b.tally.averageDays}d average, ${b.tally.maxDays}d longest`,
    b.tally.held > 0 ? `${b.tally.held} held` : '',
  ].filter(Boolean).join(' · ');
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <span className="gecko-inline-row gecko-yard-metric">
      <span className="gecko-eyebrow">{label}</span>
      <span className={`gecko-yard-metric-value${tone === 'warning' ? ' gecko-yard-hot-warn' : ''}`}>{value}</span>
    </span>
  );
}
