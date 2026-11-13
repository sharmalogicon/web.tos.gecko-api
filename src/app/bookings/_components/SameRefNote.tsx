"use client";
import React, { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api/client';
import { Icon } from '@/components/ui/Icon';

/**
 * THE SAME BOOKING / B/L NO ON OTHER BOOKINGS — information only (owner 2026-11-13).
 *
 * A repeated booking / B/L no is allowed: a line splits one booking across
 * several of ours, and a D/O can come back. So this is never a warning and
 * never blocks Save. It only says, in a neutral line under the field, which
 * other live bookings at this depot already carry the number, each one a link
 * that opens in a new tab so the form being typed is not lost.
 */

export interface SameRefBooking {
  bookingId: string;
  orderNo: string;
  status: string;
  orderTypeCode: string;
  customerCode: string | null;
  createdAt: string;
}

const SHOWN = 3;
const DEBOUNCE_MS = 400;

/**
 * Asks the API, 400 ms after the clerk stops typing, which other bookings at
 * the depot carry this number. Nothing is asked until both the depot and the
 * number are there. A failed lookup shows nothing — it is information, and its
 * absence must not read as an error on a form that saves fine.
 */
export function useSameRefBookings(
  branchId: string | null | undefined, carrierRef: string, exceptBookingId: string | null | undefined,
): SameRefBooking[] {
  const reference = carrierRef.trim();
  const [answer, setAnswer] = useState<{ key: string; rows: SameRefBooking[] } | null>(null);
  const key = branchId && reference ? `${branchId}|${reference}|${exceptBookingId ?? ''}` : null;

  useEffect(() => {
    if (!key || !branchId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ branchId, carrierRef: reference });
      if (exceptBookingId) query.set('exceptBookingId', exceptBookingId);
      apiGet<SameRefBooking[]>(`/api/tos/bookings/same-ref?${query}`)
        .then(rows => { if (!cancelled) setAnswer({ key, rows: rows ?? [] }); })
        .catch(() => { if (!cancelled) setAnswer({ key, rows: [] }); });
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, branchId, reference, exceptBookingId]);

  // An answer for what WAS typed is not an answer for what is typed now.
  return answer && answer.key === key ? answer.rows : [];
}

export function SameRefNote({ bookings }: { bookings: SameRefBooking[] | null | undefined }) {
  if (!bookings || bookings.length === 0) return null;
  const shown = bookings.slice(0, SHOWN);
  const more = bookings.length - shown.length;

  return (
    <div className="gecko-same-ref-note" role="note">
      <Icon name="info" size={13} className="gecko-same-ref-note-icon" />
      <span>
        This number is also on{' '}
        {shown.map((b, i) => (
          <React.Fragment key={b.bookingId}>
            {i > 0 && ', '}
            <a href={`/bookings/${b.bookingId}`} target="_blank" rel="noopener noreferrer"
              className="gecko-same-ref-note-link">{b.orderNo}</a>
            {' '}({b.status})
          </React.Fragment>
        ))}
        {more > 0 && <> +{more} more</>}
      </span>
    </div>
  );
}
