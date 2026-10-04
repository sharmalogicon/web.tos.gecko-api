import Link from 'next/link';
import type { Metadata } from 'next';
import { LANDING_PATH } from '@/lib/edition';

export const metadata: Metadata = { title: 'Not available' };

// Served (via src/proxy.ts rewrite) for any screen that is not part of this edition.
export default function NotAvailablePage() {
  return (
    <div style={{ maxWidth: 520, margin: '64px auto', textAlign: 'center' }}>
      <h1 className="gecko-page-title" style={{ marginBottom: 12 }}>Not available in this edition</h1>
      <p style={{ color: 'var(--gecko-text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
        This screen is not part of your GECKO edition yet. Everything you can use is listed in the
        menu on the left. If you need this screen, please contact your GECKO administrator.
      </p>
      <Link href={LANDING_PATH} className="gecko-btn gecko-btn-primary">
        Go to the start page
      </Link>
    </div>
  );
}
