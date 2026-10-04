"use client";
import { use } from 'react';
import { BookingWorkspace } from '../_components/BookingWorkspace';

/**
 * A booking, opened from the register.
 *
 * It is the SAME screen as /bookings/new — same fields, same tabs, same
 * container drawer — loaded from the API instead of started empty. There used
 * to be a separate detail page here with its own header editor, its own
 * requirement editor and its own box grid; a clerk raising a booking and a
 * clerk opening one saw two different screens for the same data, and every
 * change had to be made twice.
 *
 * The old page is kept at docs/snapshots/booking-detail.bound-2026-10-04.tsx —
 * it still holds the cancel / close / submit calls this screen has yet to grow.
 */
export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BookingWorkspace bookingId={id} />;
}
