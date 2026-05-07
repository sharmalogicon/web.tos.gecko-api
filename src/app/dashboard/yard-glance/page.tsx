"use client";
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export default function YardGlancePage() {
  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', padding: '40px 0' }}>
      <EmptyState
        icon="layers"
        title="Yard at a Glance — coming soon"
        description="A live aerial view of every block, bay, row, and slot — with colour-coded dwell time, hold flags, and reefer plug status. In active design."
        action={
          <Link href="/dashboard/overview" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            ← Back to Overview
          </Link>
        }
      />
    </div>
  );
}
