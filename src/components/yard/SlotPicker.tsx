"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  lowestFreeSlot, stackRefusal, useYardMap, useYardStacks, useYardSuggestions,
  type YardBlockStacks, type YardStack, type YardStackSlot, type YardSuggestionQuery,
} from '@/lib/api/yard-map';
import { formatDate } from '@/lib/format';
import { departureSourceLabel } from '@/lib/api/yard-work';
import { TYPE_STYLE, UNTYPED_STYLE, typeLabel } from './block-style';

/**
 * WHERE THIS BOX IS GOING TO STAND — a block, then a stack.
 *
 * The clerk picks a STACK, never a tier. A box goes on the ground or on the box
 * already there, which is the lowest free slot of that stack and the only one
 * the API accepts: a higher tier with nothing under it is refused as floating.
 * So one click is one decision, and the tier follows from the yard as it is.
 *
 * A stack nothing can go in is disabled AND SAYS WHY — full, blocked, not in
 * use. A cell that refuses a click without a word is a screen that looks
 * broken, and a gate clerk with a truck waiting will not go hunting.
 *
 * Two screens use this: the gate (a drop-off at a SLOT depot) and the yard
 * desk's Move box. It is the same decision, so it is the same control.
 *
 * WHAT IT READS. The block list comes from the yard map — one read the screen
 * may already have — and the stacks of the CHOSEN block from `/stacks`. It
 * does not read the stacks of every block to count free slots: that is one
 * request per block for a number on a dropdown. The map's own usable-minus-
 * occupied is shown there instead, and the exact `canTake` appears under the
 * grid once a block is open.
 *
 * SUGGESTIONS (Phase 3). Given enough to describe the box, `/yard/suggestions`
 * answers the best legal slots for it, each with its reasons, and the top three
 * sit above the grid as chips. A suggested stack is ringed in the grid, and
 * every other stack stays clickable: the clerk may know something the yard does
 * not, and the API checks whatever they pick either way. The chips are an
 * opinion, not a gate.
 */
export function SlotPicker({
  yardId, value, valueLabel, onChange, excludeSlotIds = [], disabled, reloadKey, suggestFor,
}: {
  /** The yard the block list comes from. Null shows nothing to pick. */
  yardId: string | null;
  /** The slot picked, or null. */
  value: string | null;
  /** Its label, kept by the caller so it still reads after a remount. */
  valueLabel?: string | null;
  onChange: (slot: { yardSlotId: string; label: string } | null) => void;
  /** Slots another row of the same truck has already picked — the API refuses a repeat. */
  excludeSlotIds?: string[];
  disabled?: boolean;
  /** Bump to re-read the stacks: a 409 means somebody else just took a slot. */
  reloadKey?: number;
  /**
   * The box, so the yard can suggest slots for it. Null asks nothing — which
   * is right until the clerk has keyed enough to describe the box.
   */
  suggestFor?: YardSuggestionQuery | null;
}) {
  const map = useYardMap(yardId);
  const blocks = useMemo(() => map.data?.yardId === yardId ? map.data.blocks : [], [map.data, yardId]);

  /**
   * WHICH BLOCK IS OPEN: the one the clerk chose, else the one the picked slot
   * is in — "A-B-03-2" names its block — so a card collapsed and reopened on a
   * saved slot shows the stack it is in rather than an empty select.
   *
   * DERIVED, not synchronised. Keeping the clerk's choice in state and working
   * the rest out from the props means there is nothing to keep in step: no
   * effect, no stale copy of the label, and the right block is open on the
   * FIRST render instead of the second.
   * https://react.dev/learn/you-might-not-need-an-effect
   */
  const [chosen, setChosen] = useState<string | null>(null);
  const slotBlockCode = valueLabel?.split('-')[0]?.toUpperCase() ?? null;
  const slotBlockId = slotBlockCode
    ? blocks.find(b => b.blockCode.toUpperCase() === slotBlockCode)?.yardBlockId ?? null
    : null;
  // A block the clerk chose in ANOTHER yard is not in this list; the picked
  // slot, or nothing, is then what is open.
  const blockId = (chosen && blocks.some(b => b.yardBlockId === chosen) ? chosen : null) ?? slotBlockId;
  const setBlockId = setChosen;
  const stacks = useYardStacks(blockId);

  const advice = useYardSuggestions(suggestFor ?? null);

  // A refusal means the yard moved on: both the grid and the advice are stale.
  useEffect(() => {
    if (!reloadKey) return;
    stacks.reload();
    advice.reload();
  }, [reloadKey, stacks.reload, advice.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const taken = useMemo(() => new Set(excludeSlotIds.filter(id => id !== value)), [excludeSlotIds, value]);
  const block = stacks.data?.yardBlockId === blockId ? stacks.data : null;

  const suggested = advice.data?.yardId === yardId ? advice.data : null;
  const best = suggested?.suggestions.slice(0, 3) ?? [];
  const suggestedIds = useMemo(
    () => new Set((suggested?.suggestions ?? []).map(x => x.yardSlotId)),
    [suggested],
  );

  const pick = (stack: YardStack) => {
    const slot = lowestFreeSlot(stack);
    if (!slot || taken.has(slot.yardSlotId)) return;
    onChange({ yardSlotId: slot.yardSlotId, label: slot.label });
  };

  if (!yardId) {
    return <div className="gecko-cell-meta">Pick the yard first.</div>;
  }

  return (
    <div className="gecko-stack gecko-slotpick">
      <div className="gecko-row gecko-slotpick-head">
        <select
          className="gecko-input gecko-input-sm gecko-slotpick-block"
          value={blockId ?? ''}
          disabled={disabled || blocks.length === 0}
          aria-label="Block"
          onChange={e => setBlockId(e.target.value || null)}
        >
          <option value="">{blocks.length === 0 ? 'No blocks in this yard' : 'Pick a block…'}</option>
          {blocks.map(b => {
            const free = Math.max(0, (b.slotCount - b.blockedSlotCount) - b.tally.boxes);
            return (
              <option key={b.yardBlockId} value={b.yardBlockId}>
                {b.blockCode} · {typeLabel(b.blockType)} · {free} free
              </option>
            );
          })}
        </select>

        {value && valueLabel
          ? <span className="gecko-slotpick-picked" title="The slot this box will stand in">
              {valueLabel}
              {!disabled && (
                <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
                  aria-label="Clear the slot" onClick={() => onChange(null)}>
                  <Icon name="x" size={12} />
                </button>
              )}
            </span>
          : <span className="gecko-cell-meta">No slot picked</span>}
      </div>

      {map.error && <div className="gecko-field-error">{map.error.explanation ?? map.error.message}</div>}

      {/* THE YARD'S OWN ADVICE. Best first, with the reason it scored highest;
          the rest of the reasons are on the chip's tooltip. Clicking one is the
          same decision as clicking its stack, made in one go. */}
      {/* WHAT THE YARD THINKS IT IS STOWING (Phase 5). The suggestions are
          scored partly on when this box leaves — a slot on top of a box
          leaving sooner is marked down — so the date it used is shown, with
          where it came from. A clerk who knows better can set it on the box. */}
      {suggested?.expectedDepartureAt && (
        <div className="gecko-cell-meta gecko-slotpick-leaves">
          Leaves ~{formatDate(suggested.expectedDepartureAt)} ({departureSourceLabel(suggested.departureSource)})
        </div>
      )}

      {best.length > 0 && (
        <div className="gecko-row gecko-row-wrap gecko-slotpick-advice">
          <span className="gecko-eyebrow gecko-slotpick-advice-head">Suggested</span>
          {best.map(x => (
            <button
              key={x.yardSlotId}
              type="button"
              disabled={disabled || taken.has(x.yardSlotId)}
              className={`gecko-slotpick-chip${value === x.yardSlotId ? ' gecko-slotpick-chip-picked' : ''}`}
              title={x.reasons.join(' ') || `Score ${x.score}`}
              onClick={() => { setBlockId(x.yardBlockId); onChange({ yardSlotId: x.yardSlotId, label: x.label }); }}
            >
              <span className="gecko-slotpick-chip-label">{x.label}</span>
              <span className="gecko-slotpick-chip-score">{x.score > 0 ? `+${x.score}` : x.score}</span>
              {x.reasons[0] && <span className="gecko-slotpick-chip-why">{x.reasons[0]}</span>}
            </button>
          ))}
        </div>
      )}

      {/* NOTHING IN THIS YARD FITS. Said plainly, with what can be done about
          it, rather than an empty row of chips the clerk has to interpret. */}
      {suggested && suggested.candidates === 0 && (
        <div className="gecko-cell-meta gecko-slotpick-nofit">
          No slot in {suggested.yardCode} fits this box — try another yard, or a supervisor can override a slot
          that breaks the yard&apos;s rules.
        </div>
      )}
      {advice.error && advice.error.status !== 400 && (
        <div className="gecko-cell-meta">The yard could not be asked for a suggestion; pick a stack below.</div>
      )}

      {blockId && (
        <>
          {stacks.loading && !block && <div className="gecko-cell-meta">Reading the block…</div>}
          {stacks.error && <div className="gecko-field-error">{stacks.error.explanation ?? stacks.error.message}</div>}
          {block && (
            <>
              <StackGrid block={block} value={value} taken={taken} suggested={suggestedIds}
                disabled={disabled} onPick={pick} />
              <div className="gecko-cell-meta">
                {block.occupied} of {block.slotCount} slots in use · {block.canTake} can take a box now
                {block.maxTiers ? ` · stacks up to ${block.maxTiers} high` : ''}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The block as a grid: a row of stacks per yard row, one cell per bay.
 *
 * The cell says how high the stack is out of the block's tiers, because that is
 * what decides whether a box fits. The tier itself is never chosen here.
 */
function StackGrid({ block, value, taken, suggested, disabled, onPick }: {
  block: YardBlockStacks;
  value: string | null;
  taken: Set<string>;
  /** Slots the yard suggested: their stacks are ringed, not forced. */
  suggested: Set<string>;
  disabled?: boolean;
  onPick: (stack: YardStack) => void;
}) {
  const style = block.blockType ? TYPE_STYLE[block.blockType] ?? UNTYPED_STYLE : UNTYPED_STYLE;
  if (block.rows.length === 0) {
    return (
      <div className="gecko-cell-meta gecko-slotpick-none">
        Block {block.blockCode} has no slots yet — generate them in Configuration → Yard Zones &amp; Blocks.
      </div>
    );
  }
  return (
    <div className="gecko-slotpick-grid">
      {block.rows.map(row => (
        <div key={row.rowLabel} className="gecko-row gecko-slotpick-row">
          <span className="gecko-slotpick-rowlabel" style={{ color: style.text }}>{row.rowLabel}</span>
          {row.bays.map(bay => {
            const free: YardStackSlot | null = lowestFreeSlot(bay);
            const isTaken = !!free && taken.has(free.yardSlotId);
            const mine = bay.slots.some(s => s.yardSlotId === value);
            const tip = !!free && suggested.has(free.yardSlotId);
            const why = stackRefusal(bay, block.maxTiers) ?? (isTaken ? 'Another box on this truck is going here.' : null);
            const plug = bay.slots.some(s => s.hasReeferPlug);
            return (
              <button
                key={bay.bayNumber}
                type="button"
                disabled={disabled || !free || isTaken}
                className={`gecko-slotpick-cell${mine ? ' gecko-slotpick-cell-picked' : ''}${why ? ' gecko-slotpick-cell-off' : ''}${tip ? ' gecko-slotpick-cell-tip' : ''}`}
                style={mine ? undefined : { borderColor: `${style.stroke}66` }}
                title={why ?? `${free!.label} — bay ${bay.bayNumber}, ${bay.height} of ${block.maxTiers ?? bay.slots.length} high${tip ? ' — the yard suggests this one' : ''}`}
                onClick={() => onPick(bay)}
              >
                <span className="gecko-slotpick-bay">{String(bay.bayNumber).padStart(2, '0')}</span>
                <span className="gecko-slotpick-height">
                  {bay.height}/{block.maxTiers ?? bay.slots.length}
                  {plug && <Icon name="zap" size={9} />}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      <div className="gecko-row gecko-slotpick-legend gecko-cell-meta">
        <span className="gecko-inline-row"><span className="gecko-slotpick-key" style={{ borderColor: `${style.stroke}66` }} /> can take a box</span>
        <span className="gecko-inline-row"><span className="gecko-slotpick-key gecko-slotpick-cell-off" /> full, blocked or not in use</span>
        <span className="gecko-inline-row"><span className="gecko-slotpick-key gecko-slotpick-cell-tip" /> suggested</span>
        <span className="gecko-inline-row"><Icon name="zap" size={10} /> reefer plug</span>
      </div>
    </div>
  );
}
