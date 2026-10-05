"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { apiGet } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { formatDateTime } from '@/lib/format';

/**
 * The trucks standing in the yard — a gate-out's way in.
 *
 * A gate-out does not start with a container: it starts with a truck that is
 * already inside and wants to leave. Vector searches `TRUCKSINYARD`
 * (`btnSearchTruck_Click`, GateOut.cs line 371) and the clerk picks one, which
 * then fills the truck block and names the visit the move belongs to.
 *
 * `openOnly=true` is that list: a visit with a gate-in and no gate-out yet.
 * Everything about the truck — plate, haulier, category — is read off the visit
 * from then on, because it was recorded when the truck came in and a clerk
 * retyping it at the exit is how one arrival becomes two trucks.
 */

export interface OpenVisit {
  truckVisitId: string;
  visitNo: string;
  truckPlate: string;
  trailerPlate: string | null;
  haulierCode: string | null;
  driverName: string | null;
  truckCategoryCode: string | null;
  status: string;
  pickupDropoffMode: string | null;
  arrivedAt: string | null;
  gateInAt: string | null;
}

export function TruckInYardPicker({ branchId, value, disabled, error, onPick, onClear }: {
  branchId: string;
  /** The chosen truck's plate, or '' when none. */
  value: string;
  disabled?: boolean;
  error?: string;
  onPick: (visit: OpenVisit) => void;
  onClear: () => void;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<OpenVisit[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // Unlike the booking search this one lists on focus with no typing: a depot
  // has a dozen trucks inside, not thousands, and the clerk is often looking at
  // the truck rather than at a number they could type.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const q = text.trim();
    const timer = setTimeout(() => {
      setBusy(true);
      const params = new URLSearchParams({ branchId, openOnly: 'true', pageSize: '25' });
      if (q) params.set('Search', q);
      apiGet<{ items: OpenVisit[] }>(`/api/tos/gate/visits?${params}`)
        .then(page => {
          if (cancelled) return;
          setRows(page.items ?? []);
          setFailure(null);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setRows([]);
          setFailure(e instanceof ApiError ? e.message : 'Could not list the trucks in the yard.');
        })
        .finally(() => { if (!cancelled) setBusy(false); });
    }, q ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [text, open, branchId]);

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
            aria-label="Choose a different truck" onClick={() => { onClear(); setOpen(true); }}>
            <Icon name="x" size={13} />
          </button>
        )}
        {error && <div className="gecko-field-error">{error}</div>}
      </div>
    );
  }

  return (
    <div ref={wrap} className="gecko-booking-picker">
      <input
        className={`gecko-input gecko-text-mono${error ? ' gecko-input-error' : ''}`}
        value={text}
        disabled={disabled}
        placeholder="Registration no."
        aria-label="Truck registration number"
        onFocus={() => setOpen(true)}
        onChange={e => { setText(e.target.value.toUpperCase()); setOpen(true); }} />

      {open && !disabled && (
        <div className="gecko-card gecko-booking-drop" role="listbox">
          {busy && <div className="gecko-cell-meta gecko-booking-drop-note">Looking…</div>}
          {failure && <div className="gecko-field-error gecko-booking-drop-note">{failure}</div>}
          {!busy && !failure && rows.length === 0 && (
            <div className="gecko-cell-meta gecko-booking-drop-note">No truck is in the yard.</div>
          )}
          {rows.map(v => (
            <button key={v.truckVisitId} type="button" role="option" aria-selected={false}
              className="gecko-booking-row" onClick={() => { onPick(v); setOpen(false); setText(''); }}>
              <span className="gecko-text-mono gecko-booking-row-ref">{v.truckPlate}</span>
              <span className="gecko-flex-1 gecko-min-w-0 gecko-booking-row-bl">
                {v.visitNo}
                {v.haulierCode ? <span className="gecko-cell-meta"> · {v.haulierCode}</span> : null}
              </span>
              <span className="gecko-cell-meta">{v.truckCategoryCode}</span>
              <span className="gecko-cell-meta gecko-booking-row-step">
                in {formatDateTime(v.gateInAt ?? v.arrivedAt)}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}
