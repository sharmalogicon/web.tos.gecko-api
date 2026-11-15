"use client";
import React from 'react';
import { AuditLog } from '@/components/audit/AuditLog';

/**
 * THE BOOKING'S AUDIT LOG — read-only (owner 2026-11-14: anyone who can open
 * the booking may read it). GET /api/tos/bookings/{id}/audit, newest first,
 * shown in the shared audit table.
 */
export function BookingAuditTab({ bookingId, refreshKey, onCount }: {
  /** Null on /bookings/new before the first save: nothing to ask for yet. */
  bookingId: string | null;
  /** Changes after every successful save on the page; the log is read again. */
  refreshKey: unknown;
  /** The number of entries, once known — for the tab's count chip. */
  onCount: (n: number) => void;
}) {
  return (
    <div className="gecko-audit-tab">
      {bookingId
        ? <AuditLog path={`/api/tos/bookings/${bookingId}/audit`} refreshKey={refreshKey} onCount={onCount} />
        : <div className="gecko-audit-empty">The audit log starts when the booking is saved.</div>}
    </div>
  );
}
