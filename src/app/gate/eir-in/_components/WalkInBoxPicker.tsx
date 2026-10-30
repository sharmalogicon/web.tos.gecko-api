"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PartyName } from '@/components/ui/PartyName';
import { useApi } from '@/lib/api/use-api';
import { formatContainerNo } from '@/lib/api/tos';
import { dwellLabel } from '@/lib/api/tos';
import { walkInBoxesPath, type WalkInBox, type WalkInBoxPage } from '@/lib/api/walk-in';

/**
 * THE WALK-IN PICK-UP PICKER — which box in the yard is the truck taking?
 *
 * A walk-in pick-up cannot have the number typed: the box has to be one that is
 * actually standing here, on no open order, not held by another lane's clerk,
 * and of a grade this order type releases. The endpoint applies all four, so
 * what it lists IS what may go, and the clerk chooses rather than guesses.
 *
 * `draftId` and the boxes already on this truck are both sent, so the list
 * never offers a box this very screen is holding — the commonest way to be
 * refused by your own earlier row.
 *
 * A held box IS offered, tagged HOLD. The barrier decides whether it leaves;
 * hiding it would leave the clerk searching for a box they can plainly see.
 */

const DEBOUNCE_MS = 250;

export function WalkInBoxPicker({ branchId, fullEmpty, draftId, exclude, value, onPick, disabled }: {
  branchId: string;
  fullEmpty: 'FULL' | 'EMPTY' | null;
  draftId: string | null;
  /** Boxes already on this truck — never offered twice. */
  exclude: string[];
  value: string;
  onPick: (box: WalkInBox) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(text), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text]);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const ready = Boolean(branchId && fullEmpty && open);
  const { data, error, loading } = useApi<WalkInBoxPage>(
    ready ? walkInBoxesPath({ branchId, fullEmpty: fullEmpty!, search, draftId, exclude, pageSize: 25 }) : null,
  );
  const rows = data?.items ?? [];

  const choose = (row: WalkInBox) => {
    onPick(row);
    setOpen(false);
    setText('');
  };

  return (
    <div ref={box} className="gecko-walkin-pick">
      <div className="gecko-walkin-pick-row">
        <input
          className="gecko-input gecko-mono"
          value={open ? text : (value ? formatContainerNo(value) : '')}
          placeholder={fullEmpty ? 'Search the yard…' : 'Answer Empty / Full first'}
          disabled={disabled || !fullEmpty}
          onFocus={() => setOpen(true)}
          onChange={e => { setText(e.target.value); setOpen(true); }}
        />
        <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm"
          disabled={disabled || !fullEmpty} onClick={() => setOpen(o => !o)}>
          <Icon name="search" size={13} /> Yard
        </button>
      </div>

      {open && (
        <div className="gecko-walkin-pick-menu">
          {!fullEmpty && <div className="gecko-walkin-pick-note">Choose Empty or Full first.</div>}
          {fullEmpty && loading && <div className="gecko-walkin-pick-note">Reading the yard…</div>}
          {fullEmpty && error && (
            <div className="gecko-walkin-pick-note gecko-field-error">
              {error.forField('fullEmpty') ?? error.explanation ?? error.title}
            </div>
          )}
          {fullEmpty && !loading && !error && rows.length === 0 && (
            <div className="gecko-walkin-pick-note">
              {search
                ? `Nothing in the yard matches “${search}”.`
                : 'No box here is free to go as a walk-in: every one is on an order, held by another lane, or of a grade this order type does not release.'}
            </div>
          )}
          {rows.map(row => (
            <button key={row.containerNo} type="button" className="gecko-walkin-pick-item"
              onClick={() => choose(row)}>
              <span className="gecko-walkin-pick-no">{formatContainerNo(row.containerNo)}</span>
              {/* The type and grade are codes by nature; the LINE is a company,
                  so it is named here as it is everywhere else. */}
              <span className="gecko-walkin-pick-facts">
                {row.equipmentTypeCode ? `${row.equipmentTypeCode} · ` : ''}
                <PartyName code={row.lineCode} resolve inline />
                {[row.gradeCode && `grade ${row.gradeCode}`, row.conditionCode]
                  .filter(Boolean).map(x => ` · ${x}`).join('')}
              </span>
              <span className="gecko-walkin-pick-where">
                {row.positionText ?? 'no slot'}
                {row.daysInYard !== null && <span className="gecko-cell-meta"> · {dwellLabel(row.daysInYard)}</span>}
              </span>
              {row.isHeld && <span className="gecko-badge gecko-badge-xs gecko-badge-error">HOLD</span>}
            </button>
          ))}
          {data && data.totalCount > rows.length && (
            <div className="gecko-walkin-pick-note">
              {rows.length} of {data.totalCount}. Type part of a container number or a yard position to narrow it.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
