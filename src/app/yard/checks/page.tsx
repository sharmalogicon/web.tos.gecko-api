"use client";
import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarcodeScanInput } from '@/components/ui/BarcodeDisplay';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { saveBlob } from '@/lib/api/client';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { formatContainerNo } from '@/lib/api/tos';
import { formatDateTime } from '@/lib/format';
import { YARD_MANAGE, useYardMap, useYardSettings, useYardStacks } from '@/lib/api/yard-map';
import {
  checkLineTone, closeYardCheck, scanYardCheck, startYardCheck, useYardCheck, useYardChecks,
  type YardCheck, type YardCheckLine, type YardCheckLineStatus,
} from '@/lib/api/yard-work';
import { YardMapOff } from '@/components/yard/YardMapOff';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

/**
 * YARD CHECK — walk the yard, scan what is standing there, and see how far the
 * records have drifted from the steel.
 *
 * Every depot's records drift: a box is shifted at night and nobody writes it
 * down, a slot is keyed one bay out, a box leaves on the wrong EIR. The check
 * is the only honest way to find out, and it is done ON FOOT with a handheld —
 * so the scanning half of this screen is one column, big targets, and the last
 * stack stays selected so a stack can be scanned tier by tier without picking
 * it again between boxes.
 *
 * WHAT THE FOUR ANSWERS MEAN (the API decides them, not this screen):
 *   MATCH    the records say it stands exactly there.
 *   MOVED    it is in the yard, but the records put it somewhere else.
 *   UNKNOWN  the records say it is not in this depot at all.
 *   MISSING  the records expect it here and nobody scanned it.
 *
 * CLOSING CAN PUT THE RECORDS RIGHT — only for MOVED, and only as real yard
 * moves, each checked like any other move, so some are refused and say why.
 * MISSING and UNKNOWN are never "fixed": a box nobody can find is not a typing
 * error, and quietly correcting the record would bury the one fact that
 * matters.
 */

export default function YardChecksPage() {
  return (
    <Suspense fallback={<div className="gecko-empty-card gecko-yard-loading">Loading…</div>}>
      <YardChecks />
    </Suspense>
  );
}

function YardChecks() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { branch, yards } = useFacility();
  const { mapEnabled, loading: settingsLoading, denied } = useYardSettings();
  const { canAt } = useSession();

  const branchId = branch?.branchId ?? null;
  const canWork = canAt(YARD_MANAGE, branchId);
  const openId = params.get('id');

  const checks = useYardChecks(mapEnabled ? branchId : null);
  const [starting, setStarting] = useState(false);

  const open = (id: string | null) =>
    router.replace(id ? `${pathname}?id=${encodeURIComponent(id)}` : pathname, { scroll: false });

  if (settingsLoading) {
    return <div className="gecko-empty-card gecko-yard-loading">Checking what this depot records…</div>;
  }
  if (!mapEnabled) return <YardMapOff where={branch?.displayName} denied={denied} />;

  if (openId) return <OpenCheck checkId={openId} canWork={canWork} onBack={() => open(null)} />;

  const rows = checks.data ?? [];
  const yardOf = (id: string) => yards.find(y => y.yardId === id);

  return (
    <div className="gecko-stack gecko-checks">
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Yard check</h1>
          <p className="gecko-page-subtitle">
            Scan a yard or a block and compare it with the records. {branch?.displayName ?? 'This depot'}.
          </p>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => checks.reload()}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
          {canWork && (
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setStarting(true)}>
              <Icon name="plus" size={14} /> Start a check
            </button>
          )}
        </div>
      </div>

      <ErrorBanner error={checks.error} className="gecko-yard-alert" />

      {!checks.error && rows.length === 0 && (
        <EmptyState icon="clipboardList" title="No checks yet"
          description="A check is a walk round a block with a scanner. Start one, scan what is there, and close it to put the records right." />
      )}

      {rows.length > 0 && (
        <div className="gecko-table-card">
          <div className="gecko-yard-table-scroll">
            <table className="gecko-table gecko-table-compact">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Yard</th>
                  <th>Block</th>
                  <th className="gecko-cell-right">Scanned</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.yardCheckId} className="gecko-row-clickable" onClick={() => open(c.yardCheckId)}>
                    <td>{formatDateTime(c.startedAt)}</td>
                    <td className="gecko-text-mono">{yardOf(c.yardId)?.yardCode ?? '—'}</td>
                    <td className="gecko-cell-meta">{c.yardBlockId ? 'one block' : 'whole yard'}</td>
                    <td className="gecko-num-tabular">{c.scanned}</td>
                    <td>
                      <span className={`gecko-pill gecko-pill-${c.status === 'OPEN' ? 'info' : 'neutral'}`}>
                        {c.status === 'OPEN' ? 'open' : 'closed'}
                      </span>
                    </td>
                    <td className="gecko-cell-meta">{c.remarks ?? '—'}</td>
                    <td className="gecko-cell-right">
                      <span className="gecko-btn gecko-btn-ghost gecko-btn-sm">
                        {c.status === 'OPEN' ? 'Carry on' : 'Open'} <Icon name="chevronRight" size={13} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {starting && (
        <StartCheck
          onClose={() => setStarting(false)}
          onStarted={check => { setStarting(false); checks.reload(); open(check.yardCheckId); }}
        />
      )}
    </div>
  );
}

// ─── starting one ─────────────────────────────────────────────────────────────

function StartCheck({ onClose, onStarted }: { onClose: () => void; onStarted: (check: YardCheck) => void }) {
  const { yards, yard: headerYard } = useFacility();
  const [yardId, setYardId] = useState(headerYard?.yardId ?? yards[0]?.yardId ?? '');
  const [blockId, setBlockId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const map = useYardMap(yardId || null);
  const blocks = map.data?.yardId === yardId ? map.data.blocks : [];

  const send = async () => {
    setSaving(true);
    setError(null);
    try {
      onStarted(await startYardCheck({ yardId, yardBlockId: blockId || null, remarks: remarks.trim() || null }));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen onClose={onClose} title="Start a yard check"
      subtitle="One block at a time is quicker to finish, and quicker to act on."
      footer={
        <div className="gecko-row gecko-row-between gecko-sheet-footer">
          <button className="gecko-btn gecko-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary" disabled={saving || !yardId} onClick={() => void send()}>
            <Icon name="check" size={14} /> {saving ? 'Starting…' : 'Start'}
          </button>
        </div>
      }
    >
      <div className="gecko-stack gecko-sheet">
        <div className="gecko-field">
          <label className="gecko-field-label">Yard *</label>
          <select className="gecko-input" value={yardId} disabled={saving}
            onChange={e => { setYardId(e.target.value); setBlockId(''); }}>
            {yards.map(y => <option key={y.yardId} value={y.yardId}>{y.yardCode} · {y.nameEn}</option>)}
          </select>
        </div>
        <div className="gecko-field">
          <label className="gecko-field-label">Block</label>
          <select className="gecko-input" value={blockId} disabled={saving || blocks.length === 0}
            onChange={e => setBlockId(e.target.value)}>
            <option value="">The whole yard</option>
            {blocks.map(b => <option key={b.yardBlockId} value={b.yardBlockId}>{b.blockCode}</option>)}
          </select>
          <div className="gecko-field-hint">
            The boxes the records put in the yard (or block) are what the check expects to find.
          </div>
        </div>
        <div className="gecko-field">
          <label className="gecko-field-label">Remarks</label>
          <input className="gecko-input" maxLength={500} value={remarks} disabled={saving}
            placeholder="e.g. Monthly check, east side" onChange={e => setRemarks(e.target.value)} />
        </div>
        {error && <div className="gecko-field-error">{error.forField('yardBlockId') ?? error.explanation ?? error.message}</div>}
      </div>
    </Modal>
  );
}

// ─── one check ────────────────────────────────────────────────────────────────

type LineTab = 'scanned' | 'missing' | 'all';

function OpenCheck({ checkId, canWork, onBack }: { checkId: string; canWork: boolean; onBack: () => void }) {
  const { toast } = useToast();
  const check = useYardCheck(checkId);
  const [tab, setTab] = useState<LineTab>('scanned');
  const [closing, setClosing] = useState(false);
  const [lastScan, setLastScan] = useState<YardCheckLine | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const data = check.data?.yardCheckId === checkId ? check.data : null;
  // Memoised because the tab filter below depends on it: `data?.lines ?? []`
  // mints a new empty array on every render while the check is still loading.
  const lines = useMemo(() => data?.lines ?? [], [data]);
  const shown = useMemo(() => {
    if (tab === 'missing') return lines.filter(l => l.status === 'MISSING');
    if (tab === 'scanned') return lines.filter(l => l.scannedAt);
    return lines;
  }, [lines, tab]);

  /** The lines as a file, for the walk-round sheet and for somebody's inbox. */
  const exportCsv = () => {
    if (!data) return;
    const head = ['containerNo', 'status', 'recordedPosition', 'seenPosition', 'seenTier', 'scannedAt'];
    const rows = lines.map(l => [l.containerNo, l.status, l.recordedPosition ?? '', l.seenPosition ?? '',
      l.seenTier ?? '', l.scannedAt ?? ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [head.join(','), ...rows].join('\r\n');
    saveBlob(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }),
      `yard-check-${data.yardCode ?? 'yard'}${data.blockCode ? `-${data.blockCode}` : ''}-${data.startedAt.slice(0, 10)}.csv`);
  };

  const scanned = async (raw: string, at: { yardSlotId?: string | null; positionText?: string | null }) => {
    setScanError(null);
    try {
      const line = await scanYardCheck(checkId, {
        containerNo: raw,
        yardSlotId: at.yardSlotId ?? null,
        positionText: at.positionText ?? null,
      });
      setLastScan(line);
      check.reload();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      setScanError(err.forField('containerNo') ?? err.forField('yardSlotId') ?? err.explanation ?? err.message);
    }
  };

  if (check.error) {
    return (
      <div className="gecko-stack gecko-checks">
        <BackLink onBack={onBack} />
        <ErrorBanner error={check.error} className="gecko-yard-alert" />
      </div>
    );
  }
  if (!data) return <div className="gecko-empty-card gecko-yard-loading">Reading the check…</div>;

  const isOpen = data.status === 'OPEN';

  return (
    <div className="gecko-stack gecko-checks">
      <BackLink onBack={onBack} />

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-yard-title-row">
            <h1 className="gecko-page-title">
              {data.yardCode ?? 'Yard'}{data.blockCode ? ` · block ${data.blockCode}` : ''}
            </h1>
            <span className={`gecko-pill gecko-pill-${isOpen ? 'info' : 'neutral'}`}>{isOpen ? 'open' : 'closed'}</span>
          </div>
          <p className="gecko-page-subtitle">
            Started {formatDateTime(data.startedAt)}
            {data.closedAt ? ` · closed ${formatDateTime(data.closedAt)}` : ''}
            {data.remarks ? ` · ${data.remarks}` : ''}
          </p>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => check.reload()}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportCsv} disabled={lines.length === 0}>
            <Icon name="download" size={14} /> Export CSV
          </button>
          {isOpen && canWork && (
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setClosing(true)}>
              <Icon name="check" size={14} /> Close the check
            </button>
          )}
        </div>
      </div>

      <div className="gecko-checks-summary">
        <Count label="Expected" value={data.expected} />
        <Count label="Scanned" value={data.scanned} />
        <Count label="Right" value={data.match} tone="success" />
        <Count label="Moved" value={data.moved} tone="warning" />
        <Count label="Missing" value={data.missing} tone="neutral" />
        <Count label="Not ours" value={data.unknown} tone="danger" />
        <Count label="Accuracy" value={data.accuracyPct === null ? '—' : `${data.accuracyPct}%`} />
      </div>

      {isOpen && canWork && (
        <ScanPanel check={data} lastScan={lastScan} error={scanError} onScan={scanned} />
      )}

      {data.movesApplied.length > 0 && (
        <div className="gecko-table-card">
          <div className="gecko-row gecko-yard-glance-head">
            <div className="gecko-flex-1">
              <div className="gecko-section-header-title">What the close put right</div>
              <div className="gecko-section-header-subtitle">
                {data.movesApplied.filter(m => m.applied).length} of {data.movesApplied.length} moved.
                A refusal needs a planner — a relocate job, or a move with an override.
              </div>
            </div>
          </div>
          <div className="gecko-yard-table-scroll">
            <table className="gecko-table gecko-table-compact">
              <thead><tr><th>Container</th><th>From</th><th>To</th><th>Done</th><th>Why not</th></tr></thead>
              <tbody>
                {data.movesApplied.map(m => (
                  <tr key={m.containerNo}>
                    <td className="gecko-text-mono">{formatContainerNo(m.containerNo)}</td>
                    <td className="gecko-text-mono">{m.from ?? '—'}</td>
                    <td className="gecko-text-mono">{m.to ?? '—'}</td>
                    <td>{m.applied
                      ? <Icon name="checkCircle" size={14} className="gecko-checks-ok" />
                      : <Icon name="x" size={14} className="gecko-checks-no" />}</td>
                    <td className="gecko-cell-meta">{m.problem ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="gecko-table-card">
        <div className="gecko-row gecko-row-wrap gecko-yard-glance-head">
          <div className="gecko-flex-1">
            <div className="gecko-section-header-title">What the check found</div>
            <div className="gecko-section-header-subtitle">
              {isOpen ? 'Worked out live against the yard as it is now.' : 'As it stood when the check was closed.'}
            </div>
          </div>
          <div className="gecko-segctrl">
            {([['scanned', `Scanned (${lines.filter(l => l.scannedAt).length})`],
               ['missing', `Missing (${data.missing})`],
               ['all', `All (${lines.length})`]] as const).map(([id, label]) => (
              <button key={id} className={`gecko-segctrl-btn${tab === id ? ' gecko-segctrl-btn-active' : ''}`}
                onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
        </div>
        {shown.length === 0
          ? <div className="gecko-cell-meta gecko-checks-none">
              {tab === 'missing' ? 'Nothing is missing.' : 'Nothing scanned yet.'}
            </div>
          : (
            <div className="gecko-yard-table-scroll">
              <table className="gecko-table gecko-table-compact">
                <thead>
                  <tr><th>Container</th><th>Found</th><th>Records say</th><th>Seen at</th><th>Scanned</th></tr>
                </thead>
                <tbody>
                  {shown.map(l => (
                    <tr key={`${l.containerNo}-${l.status}`}>
                      <td>
                        <Link href={`/units/unit-inquiry?no=${encodeURIComponent(l.containerNo)}`} className="gecko-text-mono">
                          {formatContainerNo(l.containerNo)}
                        </Link>
                      </td>
                      <td><StatusPill status={l.status} /></td>
                      <td className="gecko-text-mono">{l.recordedPosition ?? <span className="gecko-cell-meta">not in this depot</span>}</td>
                      <td className="gecko-text-mono">{l.seenPosition ?? <span className="gecko-cell-meta">—</span>}</td>
                      <td className="gecko-cell-meta">{l.scannedAt ? formatDateTime(l.scannedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {closing && (
        <CloseCheck
          check={data}
          onClose={() => setClosing(false)}
          onClosed={closed => {
            setClosing(false);
            check.reload();
            toast({
              variant: 'success',
              title: 'Check closed',
              message: closed.movesApplied.length > 0
                ? `${closed.movesApplied.filter(m => m.applied).length} of ${closed.movesApplied.length} boxes moved to where they were seen.`
                : undefined,
            });
          }}
        />
      )}
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-checks-back" onClick={onBack}>
      <Icon name="arrowLeft" size={14} /> All checks
    </button>
  );
}

function Count({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'success' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <div className={`gecko-checks-count${tone ? ` gecko-checks-count-${tone}` : ''}`}>
      <div className="gecko-checks-count-value">{value}</div>
      <div className="gecko-eyebrow">{label}</div>
    </div>
  );
}

function StatusPill({ status }: { status: YardCheckLineStatus }) {
  const label = status === 'MATCH' ? 'right' : status === 'MOVED' ? 'moved' : status === 'UNKNOWN' ? 'not ours' : 'missing';
  return <span className={`gecko-pill gecko-pill-${checkLineTone(status)}`}>{label}</span>;
}

// ─── scanning ─────────────────────────────────────────────────────────────────

/**
 * THE WALK: where I am, then box after box.
 *
 * The place is picked ONCE and stays picked — a stack holds up to five boxes
 * and the checker scans them bottom to top without touching the screen between
 * them. The tier moves on by itself after each scan, which is the order a
 * stack is actually read in, and it can be set back by hand when it is not.
 *
 * Any tier can be scanned, free or not: this is a record of what IS there, not
 * a decision about where something should go. That is why it is not the gate's
 * slot picker, which deliberately only offers the lowest free slot.
 */
function ScanPanel({ check, lastScan, error, onScan }: {
  check: YardCheck;
  lastScan: YardCheckLine | null;
  error: string | null;
  onScan: (containerNo: string, at: { yardSlotId?: string | null; positionText?: string | null }) => Promise<void>;
}) {
  const map = useYardMap(check.yardId);
  const blocks = useMemo(() => {
    const all = map.data?.yardId === check.yardId ? map.data.blocks : [];
    // A check of one block has one block to scan in.
    return check.yardBlockId ? all.filter(b => b.yardBlockId === check.yardBlockId) : all;
  }, [map.data, check.yardId, check.yardBlockId]);

  const [blockId, setBlockId] = useState<string | null>(check.yardBlockId ?? null);
  const [stack, setStack] = useState<{ row: string; bay: number } | null>(null);
  const [tier, setTier] = useState(1);
  const [area, setArea] = useState('');
  const [byArea, setByArea] = useState(false);

  const stacks = useYardStacks(byArea ? null : blockId);
  const block = stacks.data?.yardBlockId === blockId ? stacks.data : null;
  const bays = block?.rows.find(r => r.rowLabel === stack?.row)?.bays ?? [];
  const bay = bays.find(b => b.bayNumber === stack?.bay) ?? null;
  const slot = bay?.slots.find(s => s.tierNumber === tier) ?? null;

  const placed = byArea ? area.trim().length > 0 : !!slot;

  const send = async (raw: string) => {
    if (!placed) return;
    await onScan(raw, byArea
      ? { positionText: area.trim().toUpperCase() }
      : { yardSlotId: slot!.yardSlotId });
    // Up the stack, as the checker's eyes go. Beyond the top it stays put.
    if (!byArea && bay && tier < bay.slots.length) setTier(tier + 1);
  };

  return (
    <section className="gecko-card gecko-card-padded gecko-stack gecko-scan">
      <div className="gecko-row gecko-row-wrap gecko-scan-head">
        <div className="gecko-eyebrow">Where you are</div>
        <label className="gecko-row gecko-sheet-radio">
          <input type="checkbox" className="gecko-checkbox" checked={byArea} onChange={e => setByArea(e.target.checked)} />
          <span>An area, not a slot</span>
        </label>
      </div>

      {byArea ? (
        <input className="gecko-input gecko-text-mono" maxLength={30} value={area} aria-label="Area"
          placeholder="e.g. WASH BAY 2" onChange={e => setArea(e.target.value.toUpperCase())} />
      ) : (
        <>
          <div className="gecko-row gecko-row-wrap gecko-scan-pickers">
            <select className="gecko-input gecko-slotpick-block" value={blockId ?? ''} aria-label="Block"
              disabled={!!check.yardBlockId}
              onChange={e => { setBlockId(e.target.value || null); setStack(null); setTier(1); }}>
              <option value="">Pick a block…</option>
              {blocks.map(b => <option key={b.yardBlockId} value={b.yardBlockId}>{b.blockCode}</option>)}
            </select>
            {slot && <span className="gecko-slotpick-picked">{slot.label}</span>}
          </div>

          {block && block.rows.length > 0 && (
            <div className="gecko-slotpick-grid">
              {block.rows.map(row => (
                <div key={row.rowLabel} className="gecko-row gecko-slotpick-row">
                  <span className="gecko-slotpick-rowlabel">{row.rowLabel}</span>
                  {row.bays.map(b => {
                    const here = stack?.row === row.rowLabel && stack?.bay === b.bayNumber;
                    return (
                      <button key={b.bayNumber} type="button"
                        className={`gecko-slotpick-cell${here ? ' gecko-slotpick-cell-picked' : ''}`}
                        title={`Row ${row.rowLabel}, bay ${b.bayNumber} — ${b.height} box(es)`}
                        onClick={() => { setStack({ row: row.rowLabel, bay: b.bayNumber }); setTier(1); }}>
                        <span className="gecko-slotpick-bay">{String(b.bayNumber).padStart(2, '0')}</span>
                        <span className="gecko-slotpick-height">{b.height}/{block.maxTiers ?? b.slots.length}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {bay && (
            <div className="gecko-row gecko-row-wrap gecko-scan-tiers">
              <span className="gecko-eyebrow">Tier</span>
              {bay.slots.map(s => (
                <button key={s.yardSlotId} type="button"
                  className={`gecko-btn gecko-btn-sm${s.tierNumber === tier ? ' gecko-btn-primary' : ' gecko-btn-outline'}`}
                  onClick={() => setTier(s.tierNumber)}
                  title={s.box ? `Records: ${s.box.containerNo}` : 'The records show nothing here'}>
                  {s.tierNumber}
                  {s.box && <span className="gecko-scan-tier-box">{s.box.containerNo.slice(-4)}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="gecko-field">
        <label className="gecko-field-label">Scan the box</label>
        <BarcodeScanInput
          onScan={raw => void send(raw)}
          placeholder={placed ? 'Scan or type the container number + Enter…' : 'Pick where you are first…'}
          autoFocus
        />
        {!placed && <div className="gecko-field-hint">Pick the stack and tier (or type an area) before scanning.</div>}
        {error && <div className="gecko-field-error">{error}</div>}
        {lastScan && !error && (
          <div className={`gecko-row gecko-scan-last gecko-scan-last-${checkLineTone(lastScan.status)}`}>
            <StatusPill status={lastScan.status} />
            <span className="gecko-text-mono">{formatContainerNo(lastScan.containerNo)}</span>
            <span className="gecko-cell-meta">
              {lastScan.status === 'MOVED'
                ? `records: ${lastScan.recordedPosition ?? 'elsewhere'}`
                : lastScan.status === 'UNKNOWN'
                  ? 'the records say it is not in this depot'
                  : `at ${lastScan.seenPosition ?? ''}`}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── closing ──────────────────────────────────────────────────────────────────

function CloseCheck({ check, onClose, onClosed }: {
  check: YardCheck; onClose: () => void; onClosed: (closed: YardCheck) => void;
}) {
  const [saving, setSaving] = useState<'MOVE' | 'PLAIN' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const send = async (applyMoves: boolean) => {
    setSaving(applyMoves ? 'MOVE' : 'PLAIN');
    setError(null);
    try {
      onClosed(await closeYardCheck(check.yardCheckId, applyMoves));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal
      isOpen onClose={onClose} title="Close the check"
      subtitle={`${check.scanned} scanned of ${check.expected} expected`}
      footer={
        <div className="gecko-row gecko-row-between gecko-sheet-footer">
          <button className="gecko-btn gecko-btn-ghost" onClick={onClose} disabled={!!saving}>Not yet</button>
          <div className="gecko-row gecko-sheet-actions">
            <button className="gecko-btn gecko-btn-outline" disabled={!!saving} onClick={() => void send(false)}>
              {saving === 'PLAIN' ? 'Closing…' : 'Close without moving'}
            </button>
            <button className="gecko-btn gecko-btn-primary" disabled={!!saving || check.moved === 0} onClick={() => void send(true)}>
              {saving === 'MOVE' ? 'Moving…' : `Move ${check.moved} and close`}
            </button>
          </div>
        </div>
      }
    >
      <div className="gecko-stack gecko-sheet">
        <p>
          {check.moved > 0
            ? <>Move <strong>{check.moved}</strong> {check.moved === 1 ? 'box' : 'boxes'} to where they were seen? Each
              one is a real yard move and is checked like any other — one that is refused (a box on top of it, a
              stacking rule) is listed afterwards for a planner.</>
            : <>Nothing was found in the wrong place, so there is nothing to move.</>}
        </p>
        {(check.missing > 0 || check.unknown > 0) && (
          <div className="gecko-alert gecko-alert-info gecko-row gecko-sheet-error">
            <Icon name="info" size={16} />
            <span>
              {check.missing > 0 && <>{check.missing} not found{check.unknown > 0 ? ', ' : '. '}</>}
              {check.unknown > 0 && <>{check.unknown} not on the records. </>}
              Neither is changed by closing: somebody has to look into them.
            </span>
          </div>
        )}
        {error && <div className="gecko-field-error">{error.explanation ?? error.message}</div>}
      </div>
    </Modal>
  );
}
