"use client";
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export default function GateAppointmentsPage() {
  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', padding: '40px 0' }}>
      <EmptyState
        icon="clock"
        title="Gate Appointments — coming soon"
        description="Time-slot booking system for trucker visits. Reduce gate congestion and align gate windows with vessel cut-offs. Specification under review."
        action={
          <Link href="/gate/eir-in" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            ← Back to EIR-In
          </Link>
        }
      />
    </div>
  );
}
