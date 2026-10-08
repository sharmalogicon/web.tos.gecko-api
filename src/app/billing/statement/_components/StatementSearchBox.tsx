"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '@/lib/api/client';

/**
 * Find a booking by its order number OR its Booking / B/L number.
 *
 * The box used to take an order number and nothing else, which is not how
 * anyone arrives at a statement: the paper on the counter carries the carrier's
 * B/L, and the order number is Gecko's own. So it searches
 * `/api/revenue/charges/statement/search` as the clerk types and offers what it
 * finds, with the matched part of the number marked so a near-miss is visible
 * rather than merely unselected.
 *
 * The request is debounced and the previous one is abandoned: at a counter the
 * answers to "BK-KTC-26" and "BK-KTC-2610" can land out of order, and the older,
 * broader list arriving last would quietly replace the better one.
 */

export interface StatementSearchHit {
  bookingId: string;
  orderNo: string;
  carrierRef: string | null;
  subBlNo: string | null;
  bookedAt: string;
  status: string;
  orderTypeCode: string;
  customerCode: string | null;
  customerName: string | null;
  vesselCode: string | null;
  voyage: string | null;
}

export function StatementSearchBox({ value, onChange, onOpen, branchId, disabled }: {
  value: string;
  onChange: (v: string) => void;
  /** Open this booking's statement. */
  onOpen: (orderNo: string) => void;
  branchId: string;
  disabled?: boolean;
}) {
  // The rows AND the query they answer, together. Keeping "what was asked" in
  // a ref meant reading it during render; carrying it with the rows makes the
  // pairing a fact of the state instead of something to remember.
  const [result, setResult] = useState<{ q: string; rows: StatementSearchHit[] }>({ q: '', rows: [] });
  const [open, setOpen] = useState(false);
  const [looking, setLooking] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  const text = value.trim();
  const short = text.length < 2;

  const search = useCallback(async (q: string) => {
    const p = new URLSearchParams({ q });
    if (branchId) p.set('branchId', branchId);
    try {
      const r = await apiGet<StatementSearchHit[]>(`/api/revenue/charges/statement/search?${p.toString()}`);
      return Array.isArray(r) ? r : [];
    } catch {
      // Under two characters the API answers 400 by design; anything else that
      // fails simply offers nothing, and the typed text still works on Open.
      return [];
    }
  }, [branchId]);

  useEffect(() => {
    if (short) return;
    let alive = true;
    const t = setTimeout(() => {
      if (!alive) return;
      setLooking(true);
      void search(text).then(r => {
        // An older request resolving late must not replace a newer list: the
        // rows are stored with the query they answer, and only the current
        // query's rows are shown.
        if (!alive) return;
        setResult({ q: text, rows: r });
        setCursor(-1);
        setLooking(false);
        setOpen(true);
      });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [text, short, search]);

  // Close on a click elsewhere; the box keeps what was typed.
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const shown = useMemo(() => (result.q === text ? result.rows : []), [result, text]);

  /**
   * Enter with nothing highlighted. One hit is unambiguous, so open it; with
   * none or many, send what was typed — the statement endpoint also accepts a
   * B/L that names exactly one booking, and answers 409 naming the orders when
   * it names several.
   */
  const submit = useCallback(() => {
    if (cursor >= 0 && shown[cursor]) {
      onChange(shown[cursor].orderNo);
      setOpen(false);
      onOpen(shown[cursor].orderNo);
      return;
    }
    if (shown.length === 1) {
      onChange(shown[0].orderNo);
      setOpen(false);
      onOpen(shown[0].orderNo);
      return;
    }
    setOpen(false);
    onOpen(text);
  }, [cursor, shown, onChange, onOpen, text]);

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
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  };

  return (
    <div className="gecko-form-group gecko-statement-search" ref={wrap}>
      <label className="gecko-form-label" htmlFor="orderNo">Order / Booking-B/L number</label>
      <input
        id="orderNo"
        className="gecko-input gecko-text-mono gecko-statement-search-input"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls="statement-search-list"
        disabled={disabled}
        value={value}
        placeholder="Type an order no or Booking/B/L no…"
        onChange={e => { onChange(e.target.value.toUpperCase()); setOpen(true); }}
        onFocus={() => { if (shown.length > 0) setOpen(true); }}
        onKeyDown={key}
      />

      {open && !short && (
        <div className="gecko-search-menu" id="statement-search-list" role="listbox">
          {looking && <div className="gecko-search-empty">Searching…</div>}
          {!looking && shown.length === 0 && (
            <div className="gecko-search-empty">No booking matches &ldquo;{text}&rdquo;</div>
          )}
          {!looking && shown.map((h, i) => (
            <button
              key={h.bookingId}
              type="button"
              role="option"
              aria-selected={i === cursor}
              className={`gecko-search-row${i === cursor ? ' gecko-search-row-on' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => { onChange(h.orderNo); setOpen(false); onOpen(h.orderNo); }}
            >
              <span className="gecko-search-row-main">
                <span className="gecko-search-row-top">
                  <span className="gecko-mono-strong"><Mark text={h.orderNo} q={text} /></span>
                  {h.status !== 'OPEN' && (
                    <span className="gecko-badge gecko-badge-xs gecko-badge-gray">{h.status.toLowerCase()}</span>
                  )}
                </span>
                <span className="gecko-cell-meta">
                  {h.carrierRef && <span className="gecko-mono"><Mark text={h.carrierRef} q={text} /></span>}
                  {h.subBlNo && <span className="gecko-mono"> · <Mark text={h.subBlNo} q={text} /></span>}
                  {h.customerName ? `${h.carrierRef || h.subBlNo ? ' · ' : ''}${h.customerName}` : ''}
                </span>
              </span>
              <span className="gecko-search-row-side">
                <span className="gecko-cell-meta">{h.orderTypeCode}</span>
                <span className="gecko-cell-meta">{(h.bookedAt ?? '').slice(0, 10)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The matched run, marked — so a near-miss is visible, not merely unselected. */
function Mark({ text, q }: { text: string; q: string }) {
  const at = useMemo(() => text.toUpperCase().indexOf(q.toUpperCase()), [text, q]);
  if (!q || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="gecko-search-mark">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}
