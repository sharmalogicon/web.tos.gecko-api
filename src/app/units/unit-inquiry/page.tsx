"use client";
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export default function UnitInquiryPage() {
  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', padding: '40px 0' }}>
      <EmptyState
        icon="search"
        title="Unit Inquiry — coming soon"
        description="Quick lookup by container number — full lifecycle, all movements, current location, holds, charges, EDI events. Build queued."
        action={
          <Link href="/bookings" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            ← Back to Bookings
          </Link>
        }
      />
    </div>
  );
}
