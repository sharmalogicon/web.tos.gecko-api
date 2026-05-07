"use client";
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export default function EdiInquiryPage() {
  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', padding: '40px 0' }}>
      <EmptyState
        icon="zap"
        title="EDI Event Inquiry — coming soon"
        description="Audit trail of every COPARN, CODECO, COARRI, BAPLIE, MOVINS message — by partner, message type, status, and timestamp."
        action={
          <Link href="/dashboard/edi" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            ← Back to EDI Dashboard
          </Link>
        }
      />
    </div>
  );
}
