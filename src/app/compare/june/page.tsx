"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

/**
 * TEMPORARY — the June 2026 screens, kept beside today's so the two can be
 * looked at together while the booking and gate pages are redesigned.
 *
 * Each page under /compare/june is the file as it stood at commit 5f82606
 * (2026-06-02), copied VERBATIM and not edited. They run on mock data, exactly
 * as they did then: nothing here talks to Gecko.Api, and nothing here can
 * change a booking, a box or a baht.
 *
 * They render faithfully because the design system barely moved since: the CSS
 * has 363 added lines and 2 removed, and every component they import
 * (OpsPrimitives, Icon, Toast, GatePrint, BarcodeDisplay…) still exports the
 * same names.
 *
 * NOT in PILOT_PATHS, so the pilot build never serves any of it — the whole
 * folder disappears from a production menu on its own. Delete
 * src/app/compare/ and the one NAV entry when the redesign is settled.
 */

interface Pair {
  what: string;
  then: string;
  thenLines: number;
  now: string | null;
  nowLines: number | null;
  note: string;
}

const PAIRS: Pair[] = [
  {
    what: 'Gate In',
    then: '/compare/june/gate-in', thenLines: 1127,
    now: '/gate/eir-in', nowLines: 562,
    note: 'The one worth studying. Truck captured once, then N moves per visit — drop-offs and pickups together — with TEU capacity per leg and one consolidated gate pass. Today\'s screen does one box at a time.',
  },
  {
    what: 'Gate In — fast HUD',
    then: '/compare/june/gate-in-v2', thenLines: 245,
    now: null, nowLines: null,
    note: 'A second idea that was never finished: one truck, several boxes, exception-based. Read-only over hardcoded rows. No equivalent today.',
  },
  {
    what: 'Gate Out — detail',
    then: '/compare/june/gate-out-detail', thenLines: 1153,
    now: '/gate/eir-out', nowLines: 7,
    note: 'The richest screen of the lot. Today this is a 7-line wrapper around the shared EIR register and detail view.',
  },
  {
    what: 'Gate Out — register',
    then: '/compare/june/gate-out', thenLines: 340,
    now: '/gate/eir-out', nowLines: 7,
    note: 'Both the old register and the old detail now resolve to the same shared components.',
  },
  {
    what: 'Bookings — register',
    then: '/compare/june/bookings', thenLines: 414,
    now: '/bookings', nowLines: 259,
    note: 'Today\'s is bound to the API and shorter; the old one carried more on-screen summary.',
  },
  {
    what: 'Booking — detail (Container Details)',
    then: '/compare/june/booking-detail', thenLines: 2192,
    now: null, nowLines: 710,
    note: 'RECOVERED 2026-10-04 from commit 83d19af, where it was deleted as a blocked mock. It is Vector’s Booking Entry screen almost field for field: the container table with multi-select, a drawer per box carrying grade, P/U mode, IMO/UN, temperature / vent / humidity with their units, seals and stowage, plus the Movements and VAS Charges panels. It also has an “add multiple containers” paste. Today’s booking page has none of the last three.',
  },
  {
    what: 'Bookings — new',
    then: '/compare/june/bookings-new', thenLines: 255,
    now: '/bookings/new', nowLines: 448,
    note: 'The one place today\'s is bigger — it writes real bookings, with requirements and container assignment.',
  },
];

export default function CompareJunePage() {
  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">June 2026 screens, side by side</h1>
          <div className="gecko-page-subtitle gecko-mt-1">
            The booking and gate pages as they stood on 2 June (commit 5f82606), next to what they are now.
          </div>
        </div>
      </div>

      <div className="gecko-alert gecko-alert-info gecko-row" style={{ gap: 10 }}>
        <Icon name="info" size={18} />
        <div>
          <strong>These are mock screens, copied unedited.</strong>
          <div className="gecko-cell-meta">
            Nothing here reaches the API; every number on them is a fixture. They are for looking at,
            not for working in — and the pilot build never serves them.
          </div>
        </div>
      </div>

      <div className="gecko-stack gecko-stack-md">
        {PAIRS.map(pair => (
          <div key={pair.what} className="gecko-card gecko-card-padded">
            <div className="gecko-row gecko-row-between gecko-row-baseline">
              <h2 className="gecko-card-title" style={{ margin: 0 }}>{pair.what}</h2>
              <div className="gecko-row" style={{ gap: 8 }}>
                <Link href={pair.then} className="gecko-btn gecko-btn-outline gecko-btn-sm">
                  <Icon name="arrowLeft" size={13} /> June ({pair.thenLines} lines)
                </Link>
                {pair.now
                  ? <Link href={pair.now} className="gecko-btn gecko-btn-primary gecko-btn-sm">
                      Today ({pair.nowLines} lines) <Icon name="arrowRight" size={13} />
                    </Link>
                  : <span className="gecko-badge gecko-badge-gray">no equivalent today</span>}
              </div>
            </div>
            <div className="gecko-cell-meta" style={{ marginTop: 8, lineHeight: 1.5 }}>{pair.note}</div>
          </div>
        ))}
      </div>

      <div className="gecko-card gecko-card-padded">
        <div className="gecko-card-title">What the old gate screens did that today&apos;s do not</div>
        <ul className="gecko-cell-meta" style={{ margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
          <li>One truck visit carrying several boxes, captured on one screen — the API supports it today; the UI does not use it.</li>
          <li>Drop-offs and pickups in the same visit, with TEU capacity shown per leg.</li>
          <li>A consolidated gate pass for the whole visit rather than an EIR per box.</li>
          <li>Damage panels (IICL) captured inline with the move.</li>
          <li>VAS and the payment grid on the gate screen itself, which Vector also does.</li>
        </ul>
        <div className="gecko-cell-meta" style={{ marginTop: 10 }}>
          The first three need no API work. The last two are specced in
          <code> docs/gate-in-vector-parity.md</code>.
        </div>
      </div>
    </div>
  );
}
