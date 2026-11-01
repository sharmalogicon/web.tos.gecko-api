"use client";
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/lib/api/problem';
import { searchParties, type PartySummary, type PartyRole } from '@/lib/api/parties';
import { seedPartyName, usePartyName } from '@/lib/api/party-names';
import type { Paged } from '@/lib/api/use-api';

/** What `commit()` made of the text left in the box. */
export type PartyCommit =
  /** Nothing typed, or a party is already picked: there is nothing to resolve. */
  | { kind: 'empty' }
  /** One company it can only have meant. It is now the value. */
  | { kind: 'taken'; code: string; party: PartySummary }
  /** Several — the field is untouched and the list is open for the clerk to pick. */
  | { kind: 'many'; text: string; count: number }
  /** Nothing active matches. `inactive` counts the retired companies that do. */
  | { kind: 'none'; text: string; inactive: number }
  /** The search itself failed; the typed text is still the clerk's. */
  | { kind: 'failed'; text: string; message: string };

/**
 * WHAT THE CLERK TYPED AND NEVER PICKED.
 *
 * On 2026-11-01 a GECKO clerk typed one company into Unbilled Orders' Billing
 * customer box, pressed Search, and was shown every company in the depot: a
 * party is set only by clicking a suggestion or pressing Enter, and text left
 * in the box was dropped in silence. A screen whose Search can quietly ignore
 * a filter must be able to ask about it first, so the picker answers on demand.
 *
 * Pass a ref only where that matters — a filter panel with its own Search
 * button. Everywhere the picker sits in a form, picking and Enter are enough.
 */
/**
 * WHICH COMPANY A TYPED PHRASE MEANS, given what the search answered.
 *
 * All of `commit()`'s judgement and none of its plumbing, so the rule that
 * decides whether a clerk's Search goes through can be read — and tested —
 * on its own.
 */
export function companyMeant(typed: string, items: PartySummary[], totalCount: number): PartyCommit {
  // An inactive party cannot be clicked in the list, so it is not taken here either.
  const live = items.filter(p => p.isActive);
  // A code typed in full wins over the companies that merely contain it.
  const exact = live.find(p => p.partyCode.toUpperCase() === typed.toUpperCase());
  const only = exact ?? (live.length === 1 ? live[0] : null);
  if (only) return { kind: 'taken', code: only.partyCode, party: only };
  if (live.length === 0) return { kind: 'none', text: typed, inactive: items.length };
  return { kind: 'many', text: typed, count: Math.max(live.length, totalCount) };
}

export interface PartyPickerHandle {
  /** The text typed with nothing picked. '' when the field is empty or settled. */
  pendingText: () => string;
  /**
   * Resolve that text against the server NOW and take the one company it can
   * only mean — one match, or an exact code among several. Anything else leaves
   * the field as the clerk left it, opens the list, and names the case so the
   * caller can refuse to search on a filter it would have thrown away.
   */
  commit: () => Promise<PartyCommit>;
}

/**
 * Debounced search over GET /api/master/parties. Shows code + name; the value
 * is the PARTY CODE, which is what a tariff stores (ScheduleEndpoints resolves
 * it to the party and checks it plays the role).
 */
export function PartyPicker({ role, value, onChange, placeholder, error, disabled, nameFirst, ref }: {
  /**
   * Which role the search is over, or '' for ANY PARTY.
   *
   * Nearly every caller wants one role — a haulier field must not offer a
   * shipping line. A yard block is the exception: it is "reserved for" whoever
   * the depot keeps it for, and the API accepts any party there
   * (LogisticsSupport.PartyAsync with lineOnly: false), so narrowing the search
   * to a role would hide the party the supervisor is looking for.
   */
  role: PartyRole | '';
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
  /** See {@link PartyPickerHandle} — for a filter panel that searches on a button. */
  ref?: React.Ref<PartyPickerHandle>;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PartySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  /**
   * THE NAME OF A VALUE THAT WAS ALREADY STORED.
   *
   * `label` is only set when the clerk picks from the list, so a form
   * OPENED on a saved party had none and the field printed the code as its
   * own name — "20261955 (20261955)". The code is looked up instead, once
   * per code per session; until it answers the code still shows, as before.
   */
  const stored = usePartyName(label ? null : value);

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
          // Every row names a party: remember them, so the same codes shown
          // elsewhere on this screen cost no further reads.
          for (const party of page.items) seedPartyName(party.partyCode, party.nameLocal?.trim() || party.nameEn);
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

  /** Taking a company: the same act whether it was clicked, Entered or committed. */
  const take = (p: PartySummary) => {
    onChange(p.partyCode, p);
    setLabel(nameFirst ? (p.nameLocal?.trim() || p.nameEn) : p.nameEn);
    setOpen(false);
  };

  /**
   * One authoritative read, not whatever the debounce last left in `items`:
   * Search can be pressed inside the 250 ms, and the list is only searched
   * while it is open — so a clerk who typed, clicked away and then pressed
   * Search would otherwise be judged on a stale list.
   */
  const commit = async (): Promise<PartyCommit> => {
    const typed = text.trim();
    if (value || !typed) return { kind: 'empty' };
    let page: Paged<PartySummary>;
    try {
      page = await searchParties({ search: typed, role, pageSize: 20 });
    } catch (e) {
      const message = e instanceof ApiError && e.status === 404
        ? 'Party search is not available on this API yet — type the party code.'
        : e instanceof ApiError ? e.message : 'Could not search parties.';
      setFailure(message);
      setOpen(true);
      return { kind: 'failed', text: typed, message };
    }
    for (const p of page.items) seedPartyName(p.partyCode, p.nameLocal?.trim() || p.nameEn);
    setItems(page.items);
    setTotal(page.totalCount);
    setFailure(null);
    const meant = companyMeant(typed, page.items, page.totalCount);
    if (meant.kind === 'taken') take(meant.party);
    // Nothing was taken, so the clerk finishes the job: the list stays open on
    // what the server just answered.
    else setOpen(true);
    return meant;
  };

  // No dependency list on purpose: the handle closes over this render's text
  // and value, and a stale one would resolve the wrong search.
  useImperativeHandle(ref, () => ({
    pendingText: () => (value ? '' : text.trim()),
    commit,
  }));

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
              <span className="gecko-party-chosen-name">{label ?? stored ?? value}</span>
              <span className="gecko-cell-meta gecko-mono gecko-party-chosen-code">({value})</span>
            </>
          ) : (
            <>
              <span className="gecko-mono-strong">{value}</span>
              <span className="gecko-flex-1 gecko-cell-meta gecko-party-chosen-name">{label ?? stored ?? ''}</span>
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
    <div ref={box} className="gecko-party-pick">
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
            if (items[0]) take(items[0]);
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
          {loading && <div className="gecko-cell-meta gecko-party-pick-note">Searching…</div>}
          {!loading && failure && (
            <div className="gecko-party-pick-note">
              <div className="gecko-cell-meta">{failure}</div>
              {text.trim() && (
                <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-mt-1" onClick={takeTypedCode}>
                  Use code “{text.trim().toUpperCase()}”
                </button>
              )}
            </div>
          )}
          {!loading && !failure && items.length === 0 && (
            <div className="gecko-cell-meta gecko-party-pick-note">No matching {role ? role.toLowerCase().replace('_', ' ') : 'party'}.</div>
          )}
          {!loading && items.map(p => (
            // NOT a .gecko-btn any more: that is one line tall and nowrap, so a
            // Thai company name overran its row and printed over the next one.
            <button key={p.partyId} type="button" role="option" aria-selected={false}
              className={`gecko-party-pick-row${p.isActive ? '' : ' gecko-party-pick-row-off'}`}
              disabled={!p.isActive}
              onClick={() => take(p)}>
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
          {!loading && total > items.length && (
            <div className="gecko-cell-meta gecko-party-pick-note">{total - items.length} more — keep typing to narrow.</div>
          )}
        </div>
      )}
    </div>
  );
}
