"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { apiGet } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import type { GateDirection } from '@/lib/api/tos';

/**
 * The Booking / B-L No — the first thing a gate clerk keys.
 *
 * On the desktop this is the centre of the screen: the clerk reads the B/L off
 * the driver's paperwork, types it, and the whole trip block fills from the
 * booking (`LoadBookingDetails`, GateIn.cs line 668). The container number is a
 * RESULT of choosing the booking's line, not the way in. Box first, booking
 * inferred, is how a clerk gates a box against the wrong order.
 *
 * It asks `/api/tos/gate/bookable-boxes`, which answers the clerk's actual
 * question — "what can go OUT today, matching this reference?" — as ONE ROW PER
 * BOX. That matters because one B/L carries many containers: on the desktop
 * search the same B/L appears once per box. A list of bookings would make the
 * clerk pick twice.
 *
 * `Search` matches the B/L (`carrierRef`), the order number and the container
 * number, and the server filters by direction, so a pick-up never offers a box
 * waiting to come in.
 */

export interface BookableBox {
  bookingContainerId: string;
  bookingId: string;
  orderNo: string;
  carrierRef: string | null;
  bookingTypeCode: string;
  orderTypeCode: string;
  lineCode: string;
  agentCode: string | null;
  customerCode: string | null;
  containerNo: string | null;
  equipmentTypeCode: string | null;
  nextStep: {
    movementPlanId: string;
    sequenceNo: number;
    movementCode: string;
    direction: GateDirection;
    fullEmpty: 'FULL' | 'EMPTY';
  } | null;
}

export function BookingPicker({ branchId, value, direction, exclude, disabled, error, onPick, onClear }: {
  branchId: string;
  /** The chosen box's B/L, or the order number when it has none. */
  value: string;
  direction: GateDirection;
  /** Boxes already on this truck — the same box must not go on twice. */
  exclude: string[];
  disabled?: boolean;
  error?: string;
  onPick: (box: BookableBox) => void;
  onClear: () => void;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BookableBox[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // What matters to the search is the CONTENT of the exclusion list, not the
  // array identity — it is rebuilt on every render of the page above.
  const excluded = exclude.join(',');

  useEffect(() => {
    if (!open) return;
    const q = text.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setBusy(true);
      const params = new URLSearchParams({ branchId, direction, Search: q, pageSize: '25' });
      for (const id of excluded.split(',').filter(Boolean)) {
        params.append('excludeBookingContainerIds', id);
      }
      apiGet<{ items: BookableBox[] }>(`/api/tos/gate/bookable-boxes?${params}`)
        .then(page => {
          if (cancelled) return;
          setRows(page.items ?? []);
          setFailure(null);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setRows([]);
          setFailure(e instanceof ApiError ? e.message : 'Could not search bookings.');
        })
        .finally(() => { if (!cancelled) setBusy(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [text, open, branchId, direction, excluded]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  if (value && !open) {
    return (
      <div className="gecko-row gecko-gap-1">
        <span className="gecko-readonly-value gecko-flex-1 gecko-text-mono">{value}</span>
        {!disabled && (
          <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
            aria-label="Choose a different booking" onClick={() => { onClear(); setOpen(true); }}>
            <Icon name="x" size={13} />
          </button>
        )}
        {error && <div className="gecko-field-error">{error}</div>}
      </div>
    );
  }

  const tooShort = text.trim().length < 2;

  return (
    <div ref={wrap} className="gecko-booking-picker">
      <input
        className={`gecko-input gecko-text-mono${error ? ' gecko-input-error' : ''}`}
        value={text}
        disabled={disabled}
        placeholder="B/L, booking or container no."
        aria-label="Booking or B/L number"
        onFocus={() => setOpen(true)}
        onChange={e => { setText(e.target.value.toUpperCase()); setOpen(true); }} />

      {open && !disabled && (
        <div className="gecko-card gecko-booking-drop" role="listbox">
          {tooShort && (
            <div className="gecko-cell-meta gecko-booking-drop-note">
              Type two characters of the B/L, the booking number or the box.
            </div>
          )}
          {busy && <div className="gecko-cell-meta gecko-booking-drop-note">Searching…</div>}
          {failure && <div className="gecko-field-error gecko-booking-drop-note">{failure}</div>}
          {!busy && !failure && !tooShort && rows.length === 0 && (
            <div className="gecko-cell-meta gecko-booking-drop-note">
              Nothing matching is waiting to go {direction === 'IN' ? 'in' : 'out'}.
            </div>
          )}
          {!tooShort && rows.map(r => (
            <button key={r.bookingContainerId} type="button" role="option" aria-selected={false}
              className="gecko-booking-row" onClick={() => { onPick(r); setOpen(false); setText(''); }}>
              <span className="gecko-text-mono gecko-booking-row-ref">{r.containerNo || '(no box yet)'}</span>
              <span className="gecko-flex-1 gecko-min-w-0 gecko-booking-row-bl">
                {r.carrierRef || r.orderNo}
                <span className="gecko-cell-meta"> · {r.orderTypeCode}</span>
              </span>
              <span className="gecko-cell-meta">{r.equipmentTypeCode}</span>
              <span className="gecko-cell-meta gecko-booking-row-step">
                {r.nextStep?.movementCode} · {r.nextStep?.fullEmpty}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}
