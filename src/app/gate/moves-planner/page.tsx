"use client";
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export default function MovesPlannerPage() {
  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', padding: '40px 0' }}>
      <EmptyState
        icon="transferH"
        title="Moves Planner — coming soon"
        description="Crane and RTG move sequencing for stevedoring efficiency. Optimises vessel discharge / load order against yard slot availability."
        action={
          <Link href="/gate/eir-in" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            ← Back to EIR-In
          </Link>
        }
      />
    </div>
  );
}
