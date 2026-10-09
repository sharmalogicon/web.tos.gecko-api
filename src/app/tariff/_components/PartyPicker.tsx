"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/lib/api/problem';
import { searchParties, type PartySummary, type PartyRole } from '@/lib/api/parties';

/**
 * Debounced search over GET /api/master/parties. Shows code + name; the value
 * is the PARTY CODE, which is what a tariff stores (ScheduleEndpoints resolves
 * it to the party and checks it plays the role).
 */
export function PartyPicker({ role, value, onChange, placeholder, error, disabled, nameFirst }: {
  role: PartyRole;
  value: string | null;
  onChange: (code: string | null, party?: PartySummary) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  /**
   * Show the NAME and put the code in brackets behind it.
   *
   * Opt-in, not the default: the tariff and booking screens have read
   * code-first for months and nobody asked for those to move. The gate asked
   * (owner, 2026-10-09) — a clerk there knows the haulier by name.
   */
  nameFirst?: boolean;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PartySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      searchParties({ search: text, role, pageSize: 20 })
        .then(page => {
          if (cancelled) return;
          setItems(page.items);
          setTotal(page.totalCount);
          setFailure(null);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setItems([]);
          setFailure(e instanceof ApiError && e.status === 404
            ? 'Party search is not available on this API yet — type the party code.'
            : e instanceof ApiError ? e.message : 'Could not search parties.');
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [text, role, open]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (value) {
    return (
      <div>
        <div className="gecko-input gecko-row gecko-party-chosen">
          {nameFirst ? (
            <>
              {/* The NAME is what a clerk recognises; the code is filing. The
                  name takes the width and ellipsises rather than spilling out
                  of the box, which a long Thai company name did. */}
              <span className="gecko-party-chosen-name">{label ?? value}</span>
              <span className="gecko-cell-meta gecko-mono gecko-party-chosen-code">({value})</span>
            </>
          ) : (
            <>
              <span className="gecko-mono-strong">{value}</span>
              <span className="gecko-flex-1 gecko-cell-meta gecko-party-chosen-name">{label ?? ''}</span>
            </>
          )}
          {!disabled && (
            <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Clear"
              onClick={() => { onChange(null); setLabel(null); setText(''); }}>
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
        {error && <div className="gecko-field-error">{error}</div>}
      </div>
    );
  }

  const takeTypedCode = () => {
    const code = text.trim().toUpperCase();
    if (code) { onChange(code); setLabel('typed code — checked on save'); setOpen(false); }
  };

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <input
        className="gecko-input"
        value={text}
        disabled={disabled}
        placeholder={placeholder ?? 'Search code, name or tax id…'}
        onFocus={() => setOpen(true)}
        onChange={e => { setText(e.target.value); setOpen(true); }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (items[0]) { onChange(items[0].partyCode, items[0]); setLabel(items[0].nameEn); setOpen(false); }
            else takeTypedCode();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-invalid={error ? true : undefined}
      />
      {error && <div className="gecko-field-error">{error}</div>}
      {/* The panel's z-index was 30 — the APP HEADER's level — so the list
          fought with the chrome. It sits at the ladder's menu level now: above
          every card on the page, below a modal. */}
      {open && (
        <div className="gecko-card gecko-party-pick-menu" role="listbox">
          {loading && <div className="gecko-cell-meta" style={{ padding: 8 }}>Searching…</div>}
          {!loading && failure && (
            <div style={{ padding: 8 }}>
              <div className="gecko-cell-meta">{failure}</div>
              {text.trim() && (
                <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-mt-1" onClick={takeTypedCode}>
                  Use code “{text.trim().toUpperCase()}”
                </button>
              )}
            </div>
          )}
          {!loading && !failure && items.length === 0 && <div className="gecko-cell-meta" style={{ padding: 8 }}>No matching {role.toLowerCase().replace('_', ' ')}.</div>}
          {!loading && items.map(p => (
            // NOT a .gecko-btn any more: that is one line tall and nowrap, so a
            // Thai company name overran its row and printed over the next one.
            <button key={p.partyId} type="button" role="option" aria-selected={false}
              className={`gecko-party-pick-row${p.isActive ? '' : ' gecko-party-pick-row-off'}`}
              disabled={!p.isActive}
              onClick={() => {
                onChange(p.partyCode, p);
                setLabel(nameFirst ? (p.nameLocal?.trim() || p.nameEn) : p.nameEn);
                setOpen(false);
              }}>
              {nameFirst ? (
                <>
                  <span className="gecko-party-pick-name">
                    {p.nameLocal?.trim() || p.nameEn}
                  </span>
                  <span className="gecko-cell-meta gecko-mono gecko-party-pick-tax">({p.partyCode})</span>
                </>
              ) : (
                <>
                  <span className="gecko-mono-strong gecko-party-pick-code">{p.partyCode}</span>
                  <span className="gecko-party-pick-name">
                    {p.nameEn}{p.nameLocal ? <span className="gecko-cell-meta"> · {p.nameLocal}</span> : null}
                  </span>
                  {p.taxId && (
                    <span className="gecko-cell-meta gecko-party-pick-tax">{p.taxId}{p.branchNo ? `/${p.branchNo}` : ''}</span>
                  )}
                </>
              )}
              {!p.isActive && <span className="gecko-pill gecko-pill-neutral">inactive</span>}
            </button>
          ))}
          {!loading && total > items.length && <div className="gecko-cell-meta" style={{ padding: 8 }}>{total - items.length} more — keep typing to narrow.</div>}
        </div>
      )}
    </div>
  );
}
