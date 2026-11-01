"use client";
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * THIS DEPOT HAS NO YARD MAP.
 *
 * `yard.map_enabled` is a BRANCH setting, so the two yard-map screens are
 * served for every depot and shown by only some: the menu hides them where the
 * map is off, and a URL typed in by hand lands here. It says so rather than
 * drawing an empty canvas — a depot that locates boxes by area code has no
 * blocks, and a blank map reads as a fault.
 *
 * It never shows invented blocks. That is the whole point of the switch.
 */
export function YardMapOff({ where, denied }: { where?: string | null; denied?: boolean }) {
  // The settings ride on a gate endpoint: an account without tos.gate.view
  // cannot read them, and must not be told the depot turned the map off.
  if (denied) {
    return (
      <EmptyState
        icon="lock"
        title="This screen needs the gate right"
        description={<>The yard map follows the depot&apos;s gate settings, and reading them needs
          <span className="gecko-text-mono"> tos.gate.view</span>. Ask for it at Configuration &rarr; Users &amp; Roles.</>}
      />
    );
  }
  return (
    <EmptyState
      icon="layers"
      title="The yard map is not turned on for this depot"
      description={<>
        {where ? <><strong>{where}</strong> locates boxes by area code, not by block, row, bay and tier. </> : null}
        Turn the map on at Configuration → System parameters → <span className="gecko-text-mono">yard.map_enabled</span>,
        then lay the blocks out in Yard Zones &amp; Blocks.
      </>}
      action={
        <Link href="/config/system-params" className="gecko-btn gecko-btn-outline gecko-btn-sm">
          <Icon name="settings" size={14} /> Open System parameters
        </Link>
      }
    />
  );
}
