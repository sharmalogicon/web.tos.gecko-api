"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';

/** One slot the clerk may take, as the key-in box offers it. */
export interface SlotOption {
  yardSlotId: string;
  label: string;
  /** Why the yard likes this one, when it is a suggestion rather than a slot. */
  note?: string | null;
  score?: number | null;
}

/** Separators are noise: a-b-3-2, A B 3 2 and A/B/3/2 are the same slot. */
const key = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * KEY THE LOCATION, WITH THE YARD SUGGESTING AS YOU TYPE.
 *
 * A gate clerk with a truck at the barrier knows where the box is going — the
 * supervisor told them, or they have put forty boxes in that block this
 * morning. Making them hunt for it on a map is slower than letting them type
 * it, and a map is not always there to hunt on: a depot with no slots has
 * nothing to click at all.
 *
 * So the box is ALWAYS free text, and the dropdown is help, never a gate. What
 * is typed goes to the API as `positionText`, which reads it as a slot of that
 * yard and checks it exactly as a picked one — free, not floating, stacking
 * rules, reefer plug — and refuses it by name if it is no slot at all.
 * Choosing from the list sets the slot id outright, which is the same decision
 * made with one keystroke fewer.
 */
export function SlotKeyIn({
  value, onText, onPick, options, disabled, error, placeholder, emptyNote,
}: {
  /** What is in the box. The caller owns it — it is what gets sent. */
  value: string;
  onText: (text: string) => void;
  /** A slot taken from the list, not typed. */
  onPick: (slot: SlotOption) => void;
  /** What this yard can offer: its suggestions, and the slots of the open block. */
  options: SlotOption[];
  disabled?: boolean;
  /** The API's own refusal for this field, shown under the box. */
  error?: string | null;
  placeholder?: string;
  /** What to say when the yard offers nothing — never a reason to stop typing. */
  emptyNote?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const typed = key(value);
  /**
   * The list narrows as it is typed, and an empty box shows everything the
   * yard has to say — which is the suggestions, in its own order of preference.
   */
  const shown = useMemo(() => {
    const seen = new Set<string>();
    return options
      .filter(o => {
        if (seen.has(o.yardSlotId)) return false;
        seen.add(o.yardSlotId);
        return !typed || key(o.label).includes(typed);
      })
      .slice(0, 8);
  }, [options, typed]);

  // A click anywhere else is a clerk who has finished with the list.
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const take = (slot: SlotOption) => {
    onPick(slot);
    setOpen(false);
  };

  return (
    <div ref={box} className="gecko-slotkey">
      <input
        className={`gecko-input gecko-input-sm gecko-text-mono${error ? ' gecko-input-error' : ''}`}
        value={value}
        disabled={disabled}
        maxLength={40}
        aria-label="Location"
        aria-invalid={error ? true : undefined}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setActive(0); }}
        onChange={e => {
          onText(e.target.value.toUpperCase());
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActive(i => {
              const n = shown.length;
              if (n === 0) return 0;
              return e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n;
            });
            return;
          }
          if (e.key === 'Enter') {
            // Enter on an open list takes the highlighted slot; with the list
            // shut it belongs to the form, not to this box.
            if (open && shown[active]) { e.preventDefault(); take(shown[active]); }
            return;
          }
          if (e.key === 'Escape') setOpen(false);
        }}
      />

      {open && (
        <div className="gecko-card gecko-slotkey-menu" role="listbox">
          {shown.length === 0 ? (
            <div className="gecko-cell-meta gecko-slotkey-note">
              {emptyNote ?? (typed
                ? 'No slot of this yard matches — key it anyway and the yard will check it.'
                : 'Pick a block below, or key the location.')}
            </div>
          ) : shown.map((o, i) => (
            <button key={o.yardSlotId} type="button" role="option" aria-selected={i === active}
              className={`gecko-slotkey-row${i === active ? ' gecko-slotkey-row-on' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => take(o)}>
              <span className="gecko-mono-strong gecko-slotkey-row-label">{o.label}</span>
              {o.note && <span className="gecko-cell-meta gecko-slotkey-row-why">{o.note}</span>}
              {o.score !== null && o.score !== undefined && (
                <span className="gecko-slotkey-row-score">{o.score > 0 ? `+${o.score}` : o.score}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}
