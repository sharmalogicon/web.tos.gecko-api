"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

/**
 * Send the ticked charges on — Vector's "Send To" button.
 *
 * In Thailand the receipt IS the tax invoice, so a clerk asking for a "cash
 * invoice" is asking for the thing the cash window prints. The words are the
 * depot's and they stay; where they LEAD changed on 2026-10-08, on the API
 * owner's instruction:
 *
 *   New cash invoice      → the Customer Cash Bill screen, which takes the
 *                           money and issues the receipt (POST /cash-bills).
 *                           It must NOT call POST /invoices/send, which is
 *                           credit only and answers 400 on CASH.
 *   Existing cash invoice → GONE. A receipt is final: to change one it is
 *                           voided and re-issued, never appended to.
 *   Existing credit invoice → GONE too (2026-10-08). The API refuses any
 *                           invoiceNo outright — InvoiceEndpoints.cs:51,
 *                           "… is issued and final." An invoice is raised once
 *                           and never added to, exactly as a receipt is.
 *   New credit invoice    → POST /api/revenue/invoices/send, the one path that
 *                           still goes through here.
 */

export type InvoiceTerm = 'CASH' | 'CREDIT';
/**
 * `cash-bill` goes nowhere near an invoice: it hands the ticked CASH lines to
 * the Customer Cash Bill screen, where the money is taken and the receipt — the
 * Thai tax invoice — is issued.
 */
export type SendAction =
  | { kind: 'new' | 'existing'; term: InvoiceTerm }
  | { kind: 'cash-bill'; term: 'CASH' };
export type InvoiceSendAction = Extract<SendAction, { kind: 'new' | 'existing' }>;

export function SendToMenu({ counts, disabled, allowInvoice, allowCashBill, onPick }: {
  /** How many ticked lines carry each term, so the menu can say so. */
  counts: Record<InvoiceTerm, number>;
  disabled: boolean;
  /** revenue.invoice.issue — without it the four invoice choices answer 403. */
  allowInvoice: boolean;
  /** revenue.cash.collect — the permission the cash bill itself needs. */
  allowCashBill: boolean;
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
          {allowCashBill && (
            <>
              <div className="gecko-sendto-label">Cash — taken at the window</div>
              {/* The depot's words, the cash bill's destination. */}
              <Item term="CASH" count={counts.CASH} icon="print" label="New cash invoice"
                onClick={() => pick({ kind: 'cash-bill', term: 'CASH' })} />
            </>
          )}
          {allowCashBill && allowInvoice && <div className="gecko-filter-divider" />}
          {allowInvoice && (
            <>
              <div className="gecko-sendto-label">Credit — invoiced</div>
              <Item term="CREDIT" count={counts.CREDIT} icon="plus" label="New credit invoice"
                onClick={() => pick({ kind: 'new', term: 'CREDIT' })} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Item({ term, count, icon, label, onClick }: {
  term: InvoiceTerm; count: number; icon: 'plus' | 'fileText' | 'print'; label: string; onClick: () => void;
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
