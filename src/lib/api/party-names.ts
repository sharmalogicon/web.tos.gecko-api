"use client";
/**
 * CODE → NAME for parties, resolved once per code and shared by every screen.
 *
 * WHY THIS EXISTS. Most reads carry a bare party code and no name: the
 * container registry answers `ownerCode` and `lessorCode` and nothing else,
 * and so do the booking, tariff, cash-window and vessel-schedule reads. A
 * generated code ("20261955") means nothing to the clerk holding the paper —
 * the depot talks about the line and the transporter by name.
 *
 * THE OLD RULE WAS "GET THE API TO SEND IT", and for a gate read that is still
 * the better answer — the gate sends `lineName`, `customerName` and
 * `haulierName` beside the codes, and nothing here is asked. That rule was
 * written against resolving INSIDE a row component, where a register of fifty
 * rows meant fifty round-trips. It does not any more:
 *
 *   - ONE REQUEST PER DISTINCT CODE, for the whole session. Fifty rows quoting
 *     six shipping lines cost six reads, and the seventh screen to quote them
 *     costs none.
 *   - CONCURRENT ASKS SHARE ONE REQUEST (`inflight`), so a table painting
 *     twenty cells of the same line in the same tick still asks once.
 *   - A CODE THAT CANNOT BE READ IS REMEMBERED AS UNKNOWN, so a 403 or a
 *     missing party is not retried on every repaint.
 *
 * IT NEVER BLANKS ANYTHING OUT. Until a name arrives — and forever, if the
 * clerk lacks `mdm.party.view`, or MDM does not know the party, or the API is
 * unreachable — the caller shows the code, which is what these screens showed
 * before. A name is an improvement on a code, never a precondition for it.
 *
 * Where a read DOES carry the name, pass it straight to PartyName (or seed it
 * here) rather than asking again.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { getParty } from './parties';

/** code → the name to show, or null for "asked, and there is none". */
const names = new Map<string, string | null>();
/** code → the read in flight, so concurrent askers share one request. */
const inflight = new Map<string, Promise<void>>();
const watchers = new Set<() => void>();

const key = (code: string | null | undefined) => code?.trim().toUpperCase() ?? '';

function announce(): void {
  for (const w of watchers) w();
}

/**
 * Record a name a read already supplied — the gate's `lineName`, a picker's
 * chosen party. Free, and it spares every other screen the lookup.
 */
export function seedPartyName(code: string | null | undefined, name: string | null | undefined): void {
  const k = key(code);
  if (!k) return;
  const value = name?.trim() || null;
  if (!value || names.get(k) === value) return;
  names.set(k, value);
  announce();
}

/** Signed out, or a different tenant: one tenant's names must never show for the next. */
export function clearPartyNames(): void {
  names.clear();
  inflight.clear();
  announce();
}

/**
 * Ask for a code's name if it is not already known or already being asked.
 *
 * Exported so code outside a render can warm the cache — and so the sharing
 * can be tested: calling it twenty times for one code must make ONE request.
 */
export function ensurePartyName(code: string | null | undefined): void {
  const k = key(code);
  if (k) resolveCode(k);
}

function resolveCode(k: string): void {
  if (names.has(k) || inflight.has(k)) return;
  const run = getParty(k)
    .then(party => {
      // The LOCAL name is what the depot says out loud where MDM has one; the
      // English name is the fallback. Same choice the gate's reads make, so a
      // party reads the same whichever screen names it.
      names.set(k, party.nameLocal?.trim() || party.nameEn?.trim() || null);
    })
    .catch(() => {
      // No permission, no such party, no API. The code stands on its own and
      // the question is not asked again this session.
      names.set(k, null);
    })
    .finally(() => {
      inflight.delete(k);
      announce();
    });
  inflight.set(k, run);
}

function subscribe(cb: () => void): () => void {
  watchers.add(cb);
  return () => { watchers.delete(cb); };
}

/**
 * The name for one party code, or null until there is one.
 *
 * Pass null to ask nothing — which is what a caller does when the read it came
 * from already carried the name.
 */
export function usePartyName(code: string | null | undefined): string | null {
  const k = key(code);
  const name = useSyncExternalStore(
    subscribe,
    () => (k ? names.get(k) ?? null : null),
    () => null, // nothing is resolved during a server render
  );
  useEffect(() => { if (k) resolveCode(k); }, [k]);
  return name;
}
