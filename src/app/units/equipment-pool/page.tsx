"use client";
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export default function EquipmentPoolPage() {
  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', padding: '40px 0' }}>
      <EmptyState
        icon="box"
        title="Equipment Pool — coming soon"
        description="Empty container fleet by line, type, size, and grade. Available vs. damaged vs. survey-pending counts. Inter-depot transfers."
        action={
          <Link href="/masters/container-types" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            ← Back to Container Types
          </Link>
        }
      />
    </div>
  );
}
