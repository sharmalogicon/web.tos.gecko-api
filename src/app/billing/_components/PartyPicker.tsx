"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { searchParties, getParty, type PartyDetail, type PartyRole, type PartySummary } from '@/lib/api/parties';
import { addressText, type CashBillPayer } from '@/lib/api/cash-bills';

/**
 * WHO A RECEIPT IS MADE OUT TO. Shared by the Customer Cash Bill and by
 * splitting a gate receipt between payers.
 *
 * Two steps, because they are two different questions. WHICH PARTY is a
 * master-data code, and on the cash bill it decides which charges are open.
 * WHAT GETS PRINTED is the payer: the name, tax id, tax branch and address on
 * the receipt, which a cash customer very often wants addressed to a branch
 * rather than to the head office the party record holds.
 *
 * So the party supplies the defaults and the clerk may change any of them. The
 * party code sent to the API never changes with them: the money is still owed
 * by that party.
 */

export interface PickedCustomer {
  party: PartyDetail;
  payer: CashBillPayer;
}

/** The addresses this party can be billed at: its own, then each contact's. */
export interface AddressChoice {
  id: string;
  label: string;
  text: string;
}

export function addressChoices(p: PartyDetail): AddressChoice[] {
  const own = addressText([p.address, p.address2, [p.city, p.state, p.postcode].filter(Boolean).join(' ')]);
  const out: AddressChoice[] = own ? [{ id: 'party', label: 'Registered address', text: own }] : [];
  for (const c of p.contacts ?? []) {
    const text = addressText([c.address1, c.address2, [c.city, c.state, c.postcode].filter(Boolean).join(' ')]);
    if (!text) continue;
    const who = c.name?.trim() || c.role.toLowerCase();
    out.push({ id: c.contactId, label: `${who}${c.isDefault ? ' — default' : ''}`, text });
  }
  return out;
}

/** The contact marked default, else the party's own address, else nothing. */
export function defaultAddress(p: PartyDetail): AddressChoice | null {
  const all = addressChoices(p);
  const dflt = (p.contacts ?? []).find(c => c.isDefault);
  return (dflt && all.find(a => a.id === dflt.contactId)) ?? all[0] ?? null;
}

export function payerFrom(p: PartyDetail, address: AddressChoice | null): CashBillPayer {
  return {
    name: p.nameLocal?.trim() || p.nameEn,
    taxId: p.taxId,
    branchNo: p.branchNo,
    address: address?.text ?? null,
  };
}

/** Customers only, unless a screen says otherwise — a gate receipt is split between a customer and a haulier. */
const CUSTOMER_ONLY: PartyRole[] = ['CUSTOMER'];

export function CustomerPicker({ picked, disabled, roles = CUSTOMER_ONLY, label = 'Customer', id = 'customerSearch', onPick, onPayerChange }: {
  picked: PickedCustomer | null;
  disabled?: boolean;
  /**
   * Which master-data roles may be picked. The API filters by ONE role, so
   * several mean several searches merged — a haulier and a customer are
   * different lists, and the clerk should not have to know which they want.
   */
  roles?: PartyRole[];
  label?: string;
  /** Unique per picker: the split dialog shows one per part on the same page. */
  id?: string;
  onPick: (c: PickedCustomer | null) => void;
  onPayerChange: (payer: CashBillPayer) => void;
}) {
  const [typed, setTyped] = useState('');
  const [rows, setRows] = useState<{ q: string; hits: PartySummary[] }>({ q: '', hits: [] });
  const [open, setOpen] = useState(false);
  const [looking, setLooking] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [reading, setReading] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const text = typed.trim();
  const short = text.length < 2;

  const roleKey = roles.join(',');
  const look = useCallback(async (q: string) => {
    try {
      // One request per role, merged and deduped: /parties takes a single role,
      // and a haulier must not be hidden behind ten customers of the same name.
      const pages = await Promise.all(
        roles.map(role => searchParties({ search: q, role, pageSize: 10 }).catch(() => ({ items: [] as PartySummary[] }))));
      const seen = new Set<string>();
      return pages.flatMap(p => p.items ?? []).filter(h => !seen.has(h.partyCode) && seen.add(h.partyCode));
    } catch {
      // Nothing found and nothing offered read the same at a counter: the clerk
      // types on, and the list says so rather than an error covering the box.
      return [];
    }
  }, [roleKey]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (short) return;
    let alive = true;
    const t = setTimeout(() => {
      setLooking(true);
      void look(text).then(hits => {
        if (!alive) return;
        // Carried with the query it answers, so a slow broad search cannot
        // replace the narrower list that came after it.
        setRows({ q: text, hits });
        setCursor(-1);
        setLooking(false);
        setOpen(true);
      });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [text, short, look]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const shown = useMemo(() => (rows.q === text ? rows.hits : []), [rows, text]);

  const choose = useCallback(async (code: string) => {
    setOpen(false);
    setReading(true);
    try {
      const party = await getParty(code);
      onPick({ party, payer: payerFrom(party, defaultAddress(party)) });
      setTyped('');
    } catch {
      onPick(null);
    } finally {
      setReading(false);
    }
  }, [onPick]);

  const key = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (shown.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setCursor(c => {
        const next = e.key === 'ArrowDown' ? c + 1 : c - 1;
        return next < 0 ? shown.length - 1 : next >= shown.length ? 0 : next;
      });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const hit = cursor >= 0 ? shown[cursor] : shown.length === 1 ? shown[0] : null;
      if (hit) void choose(hit.partyCode);
    }
  };

  if (picked) {
    return (
      <ChosenCustomer picked={picked} disabled={disabled} label={label} id={id}
        onClear={() => onPick(null)} onPayerChange={onPayerChange} />
    );
  }

  return (
    <div className="gecko-form-group gecko-statement-search" ref={wrap}>
      <label className="gecko-form-label gecko-form-label-required" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="gecko-input gecko-statement-search-input"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls={`${id}-list`}
        disabled={disabled || reading}
        value={typed}
        placeholder={reading ? 'Reading…' : `${label} name, code or tax id…`}
        onChange={e => { setTyped(e.target.value); setOpen(true); }}
        onFocus={() => { if (shown.length > 0) setOpen(true); }}
        onKeyDown={key}
      />
      {/* Compact, like the booking header's customer picker: one line per party,
          code first. The two-line layout this had was fine for three bookings
          and unreadable for forty companies called "… (Thailand) Co.,Ltd." */}
      {open && !short && (
        <div className="gecko-search-menu gecko-search-compact" id={`${id}-list`} role="listbox">
          {looking && <div className="gecko-search-empty">Searching…</div>}
          {!looking && shown.length === 0 && (
            <div className="gecko-search-empty">Nothing matches &ldquo;{text}&rdquo;</div>
          )}
          {!looking && shown.map((h, i) => (
            <button key={h.partyId} type="button" role="option" aria-selected={i === cursor}
              className={`gecko-search-row${i === cursor ? ' gecko-search-row-on' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => void choose(h.partyCode)}>
              <span className="gecko-mono-strong">{h.partyCode}</span>
              <span className="gecko-flex-1 gecko-min-w-0 gecko-party-row-name">
                {h.nameLocal?.trim() || h.nameEn}
                {!h.isActive && <span className="gecko-badge gecko-badge-xs gecko-badge-gray">inactive</span>}
              </span>
              {h.taxId && (
                <span className="gecko-cell-meta gecko-mono">{h.taxId}{h.branchNo ? `/${h.branchNo}` : ''}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The customer, chosen — and the four things that will be printed, each of them
 * still editable. The party code underneath is shown but never typed over.
 */
function ChosenCustomer({ picked, disabled, label, id, onClear, onPayerChange }: {
  picked: PickedCustomer;
  disabled?: boolean;
  label: string;
  id: string;
  onClear: () => void;
  onPayerChange: (p: CashBillPayer) => void;
}) {
  const { party, payer } = picked;
  const choices = useMemo(() => addressChoices(party), [party]);
  const set = (patch: Partial<CashBillPayer>) => onPayerChange({ ...payer, ...patch });

  // Which address is in the box, matched on its text: a clerk who has edited it
  // by hand is no longer on any of them, and the list must not claim otherwise.
  const chosen = choices.find(c => c.text === (payer.address ?? ''))?.id ?? '';

  return (
    <div className="gecko-stack gecko-stack-sm">
      <div className="gecko-row gecko-row-between gecko-row-baseline">
        <div>
          <div className="gecko-kv-label">{label}</div>
          <div className="gecko-bill-party-name">{party.nameLocal?.trim() || party.nameEn}</div>
          <div className="gecko-cell-meta">
            <span className="gecko-mono">{party.partyCode}</span>
            {party.nameLocal?.trim() && party.nameEn !== party.nameLocal && <> · {party.nameEn}</>}
          </div>
        </div>
        {!disabled && (
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClear}>
            <Icon name="x" size={13} /> Change
          </button>
        )}
      </div>

      <div className="gecko-grid-2">
        <div className="gecko-form-group">
          <label className="gecko-form-label gecko-form-label-required" htmlFor={`${id}-name`}>Bill to (printed name)</label>
          <input id={`${id}-name`} className="gecko-input" maxLength={200} disabled={disabled}
            value={payer.name} onChange={e => set({ name: e.target.value })} />
        </div>
        <div className="gecko-grid-2">
          <div className="gecko-form-group">
            <label className="gecko-form-label" htmlFor={`${id}-taxId`}>Tax ID</label>
            <input id={`${id}-taxId`} className="gecko-input gecko-text-mono" maxLength={13} disabled={disabled}
              value={payer.taxId ?? ''} onChange={e => set({ taxId: e.target.value || null })} />
          </div>
          <div className="gecko-form-group">
            <label className="gecko-form-label" htmlFor={`${id}-branchNo`} title="00000 is head office">Tax branch</label>
            <input id={`${id}-branchNo`} className="gecko-input gecko-text-mono" maxLength={5} disabled={disabled}
              value={payer.branchNo ?? ''} onChange={e => set({ branchNo: e.target.value || null })} />
          </div>
        </div>
      </div>

      <div className="gecko-form-group">
        <label className="gecko-form-label" htmlFor={`${id}-address`}>Address</label>
        {choices.length > 0 && (
          <select className="gecko-select gecko-mb-2" aria-label="Choose address" disabled={disabled}
            value={chosen}
            onChange={e => {
              const c = choices.find(x => x.id === e.target.value);
              set({ address: c ? c.text : null });
            }}>
            <option value="">{chosen ? 'Choose address…' : 'Typed by hand'}</option>
            {choices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        )}
        <textarea id={`${id}-address`} className="gecko-input gecko-textarea" rows={3} maxLength={500} disabled={disabled}
          placeholder={choices.length === 0 ? 'This customer has no address on file — type the one to print.' : undefined}
          value={payer.address ?? ''} onChange={e => set({ address: e.target.value || null })} />
      </div>
    </div>
  );
}
