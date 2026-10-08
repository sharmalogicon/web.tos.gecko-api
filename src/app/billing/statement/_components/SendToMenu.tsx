"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

/**
 * Send the ticked charges to an invoice — Vector's "Send To" button, with the
 * four choices the desktop has and the owner wants (2026-10-07): new or
 * existing, cash or credit.
 *
 * In Thailand the receipt IS the tax invoice, so a clerk asking for a "cash
 * invoice" is asking for the thing the cash window prints — the words are the
 * depot's, not a mistake.
 *
 * WHAT THE API TAKES TODAY: `POST /api/revenue/invoices/send` accepts CREDIT
 * with no invoice number. CASH answers 400 and an invoiceNo answers 409, so
 * those three paths surface the server's own refusal rather than a message
 * invented here — see docs/STATEMENT_CHARGE_EDIT_FOR_API.md §7 for what is
 * still needed.
 */

export type InvoiceTerm = 'CASH' | 'CREDIT';
export interface SendAction { kind: 'new' | 'existing'; term: InvoiceTerm }

export function SendToMenu({ counts, disabled, onPick }: {
  /** How many ticked lines carry each term, so the menu can say so. */
  counts: Record<InvoiceTerm, number>;
  disabled: boolean;
  onPick: (a: SendAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, []);

  const pick = (a: SendAction) => { setOpen(false); onPick(a); };

  return (
    <div ref={ref} className="gecko-sendto">
      <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={disabled} onClick={() => setOpen(o => !o)}>
        <Icon name="send" size={13} /> Send to <Icon name="chevronDown" size={11} />
      </button>
      {open && (
        <div className="gecko-sendto-menu" role="menu">
          <div className="gecko-sendto-label">Create new invoice</div>
          <Item term="CASH" count={counts.CASH} icon="plus" label="New cash invoice"
            onClick={() => pick({ kind: 'new', term: 'CASH' })} />
          <Item term="CREDIT" count={counts.CREDIT} icon="plus" label="New credit invoice"
            onClick={() => pick({ kind: 'new', term: 'CREDIT' })} />
          <div className="gecko-filter-divider" />
          <div className="gecko-sendto-label">Add to an existing invoice</div>
          <Item term="CASH" count={counts.CASH} icon="fileText" label="Existing cash invoice"
            onClick={() => pick({ kind: 'existing', term: 'CASH' })} />
          <Item term="CREDIT" count={counts.CREDIT} icon="fileText" label="Existing credit invoice"
            onClick={() => pick({ kind: 'existing', term: 'CREDIT' })} />
        </div>
      )}
    </div>
  );
}

function Item({ term, count, icon, label, onClick }: {
  term: InvoiceTerm; count: number; icon: 'plus' | 'fileText'; label: string; onClick: () => void;
}) {
  return (
    <button className="gecko-sendto-item" role="menuitem" disabled={count === 0} onClick={onClick}>
      <Icon name={icon} size={13} />
      <span className="gecko-sendto-item-label">{label}</span>
      <span className="gecko-sendto-item-count">
        {count === 0 ? `no ${term.toLowerCase()} lines ticked` : `${count} line${count === 1 ? '' : 's'}`}
      </span>
    </button>
  );
}
