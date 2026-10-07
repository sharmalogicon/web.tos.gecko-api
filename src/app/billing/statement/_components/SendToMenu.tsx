"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

/**
 * Send the ticked charges to an invoice — Vector's "Send To" button.
 *
 * June offered four choices: new or existing, cash or credit. The API that
 * shipped on 2026-10-07 supports exactly ONE of them, and the other three are
 * not missing features but wrong ideas:
 *
 *  - CASH never becomes an invoice. It is collected at the window and its
 *    RECEIPT is the tax invoice. Sending cash lines answers 400.
 *  - There is no EXISTING invoice to add to. An invoice is issued at once and
 *    is final — passing an invoiceNo answers 409. More credit lines make
 *    another invoice.
 *
 * So the menu offers the one real action and says why the others are gone,
 * which is more use to a clerk than three buttons that always refuse.
 */

export type InvoiceTerm = 'CASH' | 'CREDIT';
export interface SendAction { kind: 'new'; term: 'CREDIT' }

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
          <div className="gecko-sendto-label">Raise an invoice</div>
          <Item term="CREDIT" count={counts.CREDIT} icon="plus" label="New credit invoice"
            onClick={() => pick({ kind: 'new', term: 'CREDIT' })} />
          {counts.CASH > 0 && (
            <div className="gecko-sendto-note">
              {counts.CASH} cash line{counts.CASH === 1 ? ' is' : 's are'} ticked and will not be sent — cash is
              taken at the cash window, and its receipt is the tax invoice.
            </div>
          )}
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
