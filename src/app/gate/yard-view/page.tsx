"use client";
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export default function YardPlanPage() {
  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', padding: '40px 0' }}>
      <EmptyState
        icon="grid"
        title="Yard Plan — coming soon"
        description="Interactive yard map with drag-and-drop slot assignment, IMDG segregation rules, and reefer plug allocation. Design phase."
        action={
          <Link href="/gate/eir-in" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            ← Back to EIR-In
          </Link>
        }
      />
    </div>
  );
}
