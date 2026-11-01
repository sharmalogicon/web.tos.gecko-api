"use client";
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApiError } from '@/lib/api/problem';
import { useFacility } from '@/lib/api/facility';
import { formatContainerNo } from '@/lib/api/tos';
import { isWellFormedContainerNo, normaliseContainerNo } from '@/lib/api/container-story';
import { locateContainer, useWholeYard, useYardSettings, type YardLocation } from '@/lib/api/yard-map';
import { YardMapOff } from '@/components/yard/YardMapOff';
import type { HoveredBox, Lens } from './_components/YardScene';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

/**
 * THE YARD IN 3D — what the place actually looks like.
 *
 * three.js is ~600 KB, and most of this depot's screens are a gate clerk's.
 * So the scene is a SEPARATE CHUNK, loaded only when somebody opens this page
 * (`next/dynamic`, `ssr: false`): nothing to download for anyone else, and
 * nothing to run on the server, which has no WebGL and no window.
 *
 * WHAT IT IS FOR, and what it is not. It is for seeing the yard — which stacks
 * are high, where the empties are, which block is nearly full, where a
 * particular box is standing and what is on top of it. It is NOT where work is
 * done: clicking a box opens its container master, and the yard's own screens
 * (Yard at a Glance, Yard Jobs) are where things are moved and ordered.
 *
 * A BROWSER WITHOUT WEBGL gets a link to the 2D map rather than a blank canvas
 * or a stack trace — an old handheld in a cab is exactly the device that would
 * find this out the hard way.
 */

const YardScene = dynamic(() => import('./_components/YardScene').then(m => m.YardScene), {
  ssr: false,
  loading: () => <div className="gecko-empty-card gecko-yard-loading">Loading the yard…</div>,
});

const LENSES: { id: Lens; label: string; icon: string }[] = [
  { id: 'line', label: 'Line', icon: 'ship' },
  { id: 'fullEmpty', label: 'Full / empty', icon: 'box' },
  { id: 'dwell', label: 'Dwell', icon: 'clock' },
  { id: 'held', label: 'Holds', icon: 'lock' },
];

/** Every 60 s: a yard changes while somebody is looking at it, but not fast. */
const REFRESH_MS = 60_000;

export default function Yard3dPage() {
  return (
    <Suspense fallback={<div className="gecko-empty-card gecko-yard-loading">Loading…</div>}>
      <Yard3d />
    </Suspense>
  );
}

function Yard3d() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { branch, yards, yard: headerYard } = useFacility();
  const { mapEnabled, loading: settingsLoading, denied } = useYardSettings();

  const [picked, setPicked] = useState<string | null>(params.get('yard'));
  const [pickedOwner, setPickedOwner] = useState<string | null>(branch?.branchId ?? null);
  const branchId = branch?.branchId ?? null;
  if (branchId !== pickedOwner) { setPickedOwner(branchId); setPicked(null); }
  const yardId = (picked && yards.some(y => y.yardId === picked) ? picked : null)
    ?? headerYard?.yardId ?? yards[0]?.yardId ?? null;

  const [lens, setLens] = useState<Lens>('fullEmpty');
  const [showFree, setShowFree] = useState(false);
  const [hovered, setHovered] = useState<HoveredBox | null>(null);
  /** WebGL said yes and then failed anyway: same fallback as saying no. */
  const [sceneFailed, setSceneFailed] = useState<string | null>(null);
  const [findText, setFindText] = useState(params.get('find') ?? '');
  const [found, setFound] = useState<YardLocation | null>(null);
  const [findNote, setFindNote] = useState<string | null>(null);

  const stacks = useWholeYard(mapEnabled ? yardId : null);
  const data = stacks.data?.yardId === yardId ? stacks.data : null;

  useEffect(() => {
    const t = setInterval(() => stacks.reload(), REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stacks.reload]);

  /**
   * CAN THIS BROWSER DRAW IT AT ALL? Asked before the chunk is fetched, so a
   * device without WebGL is sent to the 2D map instead of downloading 600 KB
   * to find out it cannot use it.
   */
  const webgl = useMemo(() => {
    if (typeof document === 'undefined') return true;
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    } catch {
      return false;
    }
  }, []);

  const find = useCallback(async (raw: string) => {
    const no = normaliseContainerNo(raw);
    if (!no) { setFound(null); setFindNote(null); return; }
    if (!isWellFormedContainerNo(no)) {
      setFound(null);
      setFindNote(`${no} is not a container number.`);
      return;
    }
    setFindNote(null);
    try {
      const here = (await locateContainer(no))[0];
      if (!here) { setFound(null); setFindNote(`${no} is not in the yard.`); return; }
      setFound(here);
      if (here.yardId && here.yardId !== yardId) setPicked(here.yardId);
      if (!here.yardSlotId) setFindNote(`${formatContainerNo(no)} is at ${here.positionText ?? 'no recorded position'} — it stands in no slot, so there is nothing to show.`);
      router.replace(`${pathname}?yard=${encodeURIComponent(here.yardId ?? yardId ?? '')}&find=${encodeURIComponent(no)}`, { scroll: false });
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      setFound(null);
      setFindNote(err.status === 404 ? `${formatContainerNo(no)} is not in the yard.` : err.explanation ?? err.message);
    }
  }, [yardId, router, pathname]);

  // A ?find= in the URL is searched once, on arrival (a shared link).
  const searched = React.useRef<string | null>(null);
  const urlFind = params.get('find');
  useEffect(() => {
    if (!urlFind || searched.current === urlFind) return;
    searched.current = urlFind;
    void find(urlFind);
  }, [urlFind, find]);

  const onHover = useCallback((box: HoveredBox | null) => setHovered(box), []);
  const onPick = useCallback((containerNo: string) => {
    router.push(`/units/unit-inquiry?no=${encodeURIComponent(containerNo)}`);
  }, [router]);
  const onFailed = useCallback((message: string) => setSceneFailed(message), []);

  if (settingsLoading) {
    return <div className="gecko-empty-card gecko-yard-loading">Checking what this depot records…</div>;
  }
  if (!mapEnabled) return <YardMapOff where={branch?.displayName} denied={denied} />;

  if (!webgl || sceneFailed) {
    return (
      <EmptyState
        icon="layers"
        title="This browser cannot draw the 3D yard"
        description={`${sceneFailed ?? 'It has no WebGL.'} The 2D map shows the same yard, block by block, and works everywhere.`}
        action={
          <Link href="/dashboard/yard-glance" className="gecko-btn gecko-btn-primary gecko-btn-sm">
            <Icon name="grid" size={14} /> Open Yard at a Glance
          </Link>
        }
      />
    );
  }

  const boxes = data?.blocks.reduce((n, b) => n + b.block.occupied, 0) ?? 0;

  return (
    <div className="gecko-stack gecko-yard3d">
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Yard 3D</h1>
          <p className="gecko-page-subtitle">
            {data
              ? <>{data.yardCode} · {data.yardName} · {data.blocks.length} blocks · {boxes} boxes · drag to orbit, scroll to zoom</>
              : 'Drag to orbit, scroll to zoom, click a box to open it.'}
          </p>
        </div>
        <div className="gecko-toolbar">
          {yards.length > 1 && (
            <select className="gecko-input gecko-input-sm gecko-yard-select" value={yardId ?? ''} aria-label="Yard"
              onChange={e => { setPicked(e.target.value); setFound(null); }}>
              {yards.map(y => <option key={y.yardId} value={y.yardId}>{y.yardCode} · {y.nameEn}</option>)}
            </select>
          )}
          <div className="gecko-segctrl">
            {LENSES.map(l => (
              <button key={l.id} className={`gecko-segctrl-btn${lens === l.id ? ' gecko-segctrl-btn-active' : ''} gecko-inline-row`}
                onClick={() => setLens(l.id)}>
                <Icon name={l.icon} size={11} /> {l.label}
              </button>
            ))}
          </div>
          <label className="gecko-row gecko-yard3d-free">
            <input type="checkbox" className="gecko-checkbox" checked={showFree} onChange={e => setShowFree(e.target.checked)} />
            <span>Show free slots</span>
          </label>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => stacks.reload()}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
          <Link href="/dashboard/yard-glance" className="gecko-btn gecko-btn-ghost gecko-btn-sm">
            <Icon name="grid" size={14} /> 2D map
          </Link>
        </div>
      </div>

      <div className="gecko-card gecko-card-padded gecko-row gecko-row-wrap gecko-yard-find">
        <Icon name="search" size={16} className="gecko-text-secondary" />
        <input
          className="gecko-input gecko-text-mono gecko-yard-find-input"
          value={findText}
          placeholder="Find a box and fly to it · container number + Enter"
          aria-label="Find a container in the yard"
          onChange={e => setFindText(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') void find(findText); }}
        />
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => void find(findText)}>Find</button>
        {(found || findNote) && (
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"
            onClick={() => { setFindText(''); setFound(null); setFindNote(null); }}>
            <Icon name="x" size={13} /> Clear
          </button>
        )}
        {found && (
          <span className="gecko-row gecko-row-wrap gecko-yard-find-hit">
            <strong className="gecko-text-mono">{formatContainerNo(found.containerNo)}</strong>
            <span>{found.positionText ?? 'no slot'}{found.isHeld ? ' · held' : ''}</span>
            <Link href={`/units/unit-inquiry?no=${encodeURIComponent(found.containerNo)}`}
              className="gecko-btn gecko-btn-outline gecko-btn-sm">Open box</Link>
          </span>
        )}
        {findNote && <span className="gecko-cell-meta gecko-yard-find-note">{findNote}</span>}
      </div>

      <ErrorBanner error={stacks.error} className="gecko-yard-alert" />

      {!stacks.error && !data && <div className="gecko-empty-card gecko-yard-loading">Reading the yard…</div>}

      {data && data.blocks.length === 0 && (
        <EmptyState icon="layers" title={`${data.yardName} has no blocks`}
          description="Lay the yard out in Configuration → Yard Zones & Blocks and it will appear here." />
      )}

      {data && data.blocks.length > 0 && (
        <div className="gecko-card gecko-yard3d-stage">
          <YardScene
            yard={data}
            lens={lens}
            showFree={showFree}
            focusContainerNo={found?.containerNo ?? null}
            onHover={onHover}
            onPick={onPick}
            onFailed={onFailed}
          />
          {/* The tooltip follows the pointer in page coordinates, which is why
              it is a plain div over the canvas rather than anything in the scene. */}
          {hovered && (
            <div className="gecko-yard3d-tip" style={{ left: hovered.x + 14, top: hovered.y + 14 }}>
              <div className="gecko-yard3d-tip-box">{formatContainerNo(hovered.containerNo)}</div>
              <div className="gecko-cell-meta">
                {[hovered.label, hovered.equipmentTypeCode, hovered.lineCode,
                  hovered.fullEmpty === 'FULL' ? 'full' : 'empty',
                  `${hovered.daysInYard} days`, hovered.isHeld ? 'HELD' : null].filter(Boolean).join(' · ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
