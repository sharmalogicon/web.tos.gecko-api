"use client";
import React, { useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useYardStacks, type YardStack, type YardStackSlot } from '@/lib/api/yard-map';
import { TYPE_STYLE, UNTYPED_STYLE, typeLabel } from './block-style';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

/**
 * ONE BLOCK, THE WAY IT IS ACTUALLY STACKED.
 *
 * The map above colours a block by how full it is; this is the thing a clerk
 * asks for next — WHICH box is where in it, and what is standing on what. One
 * section per row, the bays left to right, and in each bay the tiers drawn
 * BOTTOM-UP: tier 1 at the bottom, because that is where the box is.
 *
 * A cell is one slot, and it is one of four things:
 *   a box        full or empty, held marked, a plug marked
 *   empty        a slot a box could go in
 *   blocked      hatched, with the depot's reason in the tooltip
 *   not in use   faded; the slot exists but the depot has switched it off
 *
 * Clicking a box opens its container master. Moving one needs
 * `tos.yard.manage`, so `onMove` is simply not passed for a clerk without it
 * and no Move appears — never a button that answers 403.
 */
export function StackView({ blockId, highlightSlotId, tick, onMove, onOrder, onClose }: {
  blockId: string;
  /** A slot to ring, e.g. the box a search just found. */
  highlightSlotId?: string | null;
  /** Bump to re-read: the dashboard's 30-second tick, and after a move. */
  tick?: number;
  /** Offered per box when the user may move one. */
  onMove?: (box: { containerNo: string; slot: YardStackSlot }) => void;
  /**
   * ORDER THE WORK INSTEAD OF DOING IT (Phase 4). A planner looking at the
   * stack is the person who knows a box should be relocated, or pulled for the
   * truck coming at four $d so the order is given from here rather than from a
   * form where the box has to be typed again.
   */
  onOrder?: (containerNo: string, kind: 'RELOCATE' | 'PULL') => void;
  onClose?: () => void;
}) {
  const stacks = useYardStacks(blockId);

  useEffect(() => { if (tick) stacks.reload(); }, [tick, stacks.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const block = stacks.data?.yardBlockId === blockId ? stacks.data : null;
  const style = block?.blockType ? TYPE_STYLE[block.blockType] ?? UNTYPED_STYLE : UNTYPED_STYLE;

  return (
    <div className="gecko-table-card gecko-stackview">
      <div className="gecko-row gecko-row-wrap gecko-stackview-head">
        <div className="gecko-flex-1">
          <div className="gecko-section-header-title gecko-row gecko-stackview-title">
            <span className="gecko-yard-legend-dot" style={{ background: style.stroke }} />
            {block ? `Block ${block.blockCode}` : 'Block'}
            {block?.blockType && <span className="gecko-eyebrow">{typeLabel(block.blockType)}</span>}
            {block && !block.isActive && <span className="gecko-pill gecko-pill-neutral">inactive</span>}
          </div>
          <div className="gecko-section-header-subtitle">
            {block
              ? <>{block.occupied} of {block.slotCount} slots in use · {block.canTake} can take a box now
                  {block.maxTiers ? <> · up to {block.maxTiers} high</> : null}</>
              : stacks.loading ? 'Reading the block…' : ''}
          </div>
        </div>
        {onClose && (
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={onClose}>
            <Icon name="x" size={14} /> Close
          </button>
        )}
      </div>

      <ErrorBanner error={stacks.error} className="gecko-stackview-alert" />

      {block && block.rows.length === 0 && (
        <div className="gecko-cell-meta gecko-stackview-empty">
          Block {block.blockCode} has no slots yet — generate them in Configuration → Yard Zones &amp; Blocks.
        </div>
      )}

      {block && block.rows.length > 0 && (
        <div className="gecko-stackview-body">
          {block.rows.map(row => (
            <div key={row.rowLabel} className="gecko-stackview-rowgroup">
              <div className="gecko-eyebrow gecko-stackview-rowlabel">Row {row.rowLabel}</div>
              <div className="gecko-row gecko-stackview-bays">
                {row.bays.map(bay => (
                  <div key={bay.bayNumber} className="gecko-stackview-bay">
                    {/* Tier 1 is at the BOTTOM, so the list is drawn in reverse. */}
                    {[...bay.slots].reverse().map(slot => (
                      <Cell key={slot.yardSlotId} slot={slot}
                        above={boxesAbove(bay, slot)}
                        highlight={highlightSlotId === slot.yardSlotId}
                        onMove={onMove} onOrder={onOrder} />
                    ))}
                    <div className="gecko-stackview-baylabel">{String(bay.bayNumber).padStart(2, '0')}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="gecko-row gecko-row-wrap gecko-stackview-legend gecko-cell-meta">
            <span className="gecko-inline-row"><span className="gecko-stackview-key gecko-stackview-cell-full" /> full</span>
            <span className="gecko-inline-row"><span className="gecko-stackview-key gecko-stackview-cell-empty" /> empty box</span>
            <span className="gecko-inline-row"><span className="gecko-stackview-key gecko-stackview-cell-held" /> held</span>
            <span className="gecko-inline-row"><span className="gecko-stackview-key" /> free slot</span>
            <span className="gecko-inline-row"><span className="gecko-stackview-key gecko-stackview-cell-blocked" /> blocked</span>
            <span className="gecko-inline-row"><span className="gecko-stackview-key gecko-stackview-cell-off" /> not in use</span>
            <span className="gecko-inline-row"><Icon name="zap" size={10} /> reefer plug</span>
            {(onMove || onOrder) && (
              <span className="gecko-inline-row">
                {onMove && <><Icon name="transferH" size={10} /> move now</>}
                {onOrder && <>{onMove ? ' · ' : ''}<Icon name="arrowRight" size={10} /> order a relocate{' '}
                  <Icon name="arrowUp" size={10} /> order a pull</>}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * THE DIG for one slot: the boxes standing on it, lowest first.
 *
 * Worked out from the stack on screen rather than asked for — the stack IS the
 * answer, and `/yard/locate` would be a request per box. It stops at the first
 * gap, because nothing above a gap is standing on this box.
 */
function boxesAbove(bay: YardStack, slot: YardStackSlot): string[] {
  const above: string[] = [];
  for (const s of bay.slots) {
    if (s.tierNumber <= slot.tierNumber) continue;
    if (!s.box) break;
    above.push(s.box.containerNo);
  }
  return above;
}

function Cell({ slot, above, highlight, onMove, onOrder }: {
  slot: YardStackSlot;
  /** The boxes on top of this one; it cannot be lifted until they move. */
  above: string[];
  highlight: boolean;
  onMove?: (box: { containerNo: string; slot: YardStackSlot }) => void;
  onOrder?: (containerNo: string, kind: 'RELOCATE' | 'PULL') => void;
}) {
  const box = slot.box;
  const classes = ['gecko-stackview-cell'];
  if (!slot.isActive) classes.push('gecko-stackview-cell-off');
  else if (slot.isBlocked) classes.push('gecko-stackview-cell-blocked');
  else if (box) classes.push(box.isHeld ? 'gecko-stackview-cell-held'
    : box.fullEmpty === 'FULL' ? 'gecko-stackview-cell-full' : 'gecko-stackview-cell-empty');
  if (highlight) classes.push('gecko-stackview-cell-found');

  const why = !slot.isActive ? 'Not in use'
    : slot.isBlocked ? `Blocked${slot.blockReason ? `: ${slot.blockReason}` : ''}`
    : box ? [
        box.containerNo, box.equipmentTypeCode, box.lineCode,
        box.fullEmpty === 'FULL' ? 'full' : 'empty',
        `${box.daysInYard} days`, box.isHeld ? 'HELD' : null,
        // What has to be lifted before this box can be: the reason a
        // collection that looks ready still waits for the yard.
        above.length > 0 ? `under: ${above.join(', ')}` : null,
      ].filter(Boolean).join(' · ')
    : 'Free';

  return (
    <div className={classes.join(' ')} title={`${slot.label} — ${why}`}>
      <span className="gecko-stackview-tier">{slot.tierNumber}</span>
      {box ? (
        <>
          {/* The box number is a link, because the next question is always
              "what is that box?" — which is the container master. */}
          <Link href={`/units/unit-inquiry?no=${encodeURIComponent(box.containerNo)}`}
            className="gecko-stackview-box" title={`Open ${box.containerNo}`}>
            {box.containerNo}
          </Link>
          <span className="gecko-stackview-marks">
            {above.length > 0 && (
              <span className="gecko-stackview-under" title={`Under ${above.length} box(es): ${above.join(', ')}`}>
                {above.length}&#8593;
              </span>
            )}
            {box.isHeld && <Icon name="lock" size={10} />}
            {slot.hasReeferPlug && <Icon name="zap" size={10} />}
            {onMove && (
              <button type="button" className="gecko-stackview-move" title={`Move ${box.containerNo} now`}
                onClick={() => onMove({ containerNo: box.containerNo, slot })}>
                <Icon name="transferH" size={11} />
              </button>
            )}
            {onOrder && (
              <>
                <button type="button" className="gecko-stackview-move" title={`Order a relocate of ${box.containerNo}`}
                  onClick={() => onOrder(box.containerNo, 'RELOCATE')}>
                  <Icon name="arrowRight" size={11} />
                </button>
                <button type="button" className="gecko-stackview-move" title={`Order a pull of ${box.containerNo} for a truck`}
                  onClick={() => onOrder(box.containerNo, 'PULL')}>
                  <Icon name="arrowUp" size={11} />
                </button>
              </>
            )}
          </span>
        </>
      ) : (
        <span className="gecko-stackview-free">
          {slot.isBlocked ? 'blocked' : !slot.isActive ? 'off' : slot.canTake ? 'free' : '—'}
          {slot.hasReeferPlug && <Icon name="zap" size={10} />}
        </span>
      )}
    </div>
  );
}
