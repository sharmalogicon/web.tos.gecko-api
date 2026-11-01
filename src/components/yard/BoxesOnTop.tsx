"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { formatContainerNo } from '@/lib/api/tos';
import { locateContainer, useYardLocation, type YardLocation } from '@/lib/api/yard-map';
import { ApiError } from '@/lib/api/problem';
import { MoveBoxDialog } from './MoveBoxDialog';

/**
 * THE DIG: the boxes standing on top of one that is being collected.
 *
 * A gate-out preflight warns about it (`BOXES_ON_TOP`, WARN — the decision
 * stays ALLOWED, because the truck is not turned away for it), and the warning
 * is worth more than a sentence: each box above has to be moved, by somebody,
 * before the one underneath can be lifted. So this lists them, each a link to
 * its container master, and offers Move to whoever may move them
 * (`tos.yard.manage`) — the top one first, which is the only order the API
 * allows anyway.
 *
 * It reads `/yard/locate` rather than parsing the warning's text. The message
 * is the server's sentence for a human; `boxesOnTop` is the list, in order,
 * for a screen. Parsing the sentence would break the day its wording improves.
 */
export function BoxesOnTop({ containerNo, canMove, onMoved }: {
  /** The box being collected. */
  containerNo: string;
  /** Does this user hold `tos.yard.manage` at the depot? */
  canMove: boolean;
  /** One of the boxes above has moved: whatever is showing this is now stale. */
  onMoved?: () => void;
}) {
  const located = useYardLocation(containerNo || null);
  const [moving, setMoving] = useState<YardLocation | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const spot = located.data?.find(l => l.containerNo === containerNo) ?? null;
  const onTop = spot?.boxesOnTop ?? [];
  if (!spot || onTop.length === 0) return null;

  /** The box on top is moved by its own place, so it is looked up on its own. */
  const ask = async (box: string) => {
    setFailed(null);
    try {
      const here = (await locateContainer(box))[0];
      if (here) setMoving(here);
      else setFailed(`${formatContainerNo(box)} is not in the yard any more.`);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      setFailed(err.explanation ?? err.message);
    }
  };

  return (
    <div className="gecko-ontop">
      <div className="gecko-row gecko-ontop-head">
        <Icon name="warning" size={13} />
        <span>
          <strong>{onTop.length} {onTop.length === 1 ? 'box stands' : 'boxes stand'} on top of {formatContainerNo(spot.containerNo)}</strong>
          {spot.positionText ? <> at <span className="gecko-text-mono">{spot.positionText}</span></> : null}
          {'. The yard moves '}{onTop.length === 1 ? 'it first.' : 'them first, the top one first.'}
        </span>
      </div>

      {/* Reversed: the LAST of the list is the highest box, and the only one
          that can be lifted now. */}
      <div className="gecko-row gecko-row-wrap gecko-ontop-list">
        {[...onTop].reverse().map((box, i) => (
          <span key={box} className="gecko-row gecko-ontop-box">
            <span className="gecko-ontop-rank" title={i === 0 ? 'On top: move this one first' : `${i} box(es) above it`}>
              {onTop.length - i}
            </span>
            <Link href={`/units/unit-inquiry?no=${encodeURIComponent(box)}`} className="gecko-ontop-no">
              {formatContainerNo(box)}
            </Link>
            {canMove && (
              <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm"
                onClick={() => void ask(box)}>
                <Icon name="transferH" size={12} /> Move
              </button>
            )}
          </span>
        ))}
      </div>

      {failed && <div className="gecko-field-error">{failed}</div>}

      {moving && (
        <MoveBoxDialog
          location={moving}
          onClose={() => setMoving(null)}
          onMoved={() => {
            located.reload();
            onMoved?.();
            setMoving(null);
          }}
          onMoveInstead={no => void ask(no)}
        />
      )}
    </div>
  );
}
