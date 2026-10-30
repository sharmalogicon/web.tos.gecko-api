"use client";
import { usePartyName } from '@/lib/api/party-names';

/**
 * A PARTY BY NAME, with its code underneath — not a bare code.
 *
 * A generated party code ("20261955") means nothing to the clerk holding the
 * paper. The depot talks about CHENG LIE, and about the transporter by name,
 * so that is what the screen leads with; the code stays as the small second
 * line, because it is what gets quoted on the phone and typed into a search.
 *
 * TWO WAYS A NAME GETS HERE, and the first is always preferred:
 *
 *   1. THE READ CARRIED IT — pass it as `name`. Every gate read has sent the
 *      name beside the code since 2026-10-28 (`lineName`, `customerName`,
 *      `haulierName`; see docs/GATE_NAMES_AND_COUPON_FOR_API.md), and the
 *      container, charge and invoice reads send theirs. Nothing is fetched.
 *
 *   2. THE READ DID NOT — pass `resolve`. The container registry answers
 *      `ownerCode` with no owner name, and so do the booking, tariff and
 *      vessel-schedule reads; `resolve` looks the code up through the shared
 *      session cache in lib/api/party-names.ts. That costs ONE request per
 *      DISTINCT code for the whole session, not one per row, so a register
 *      quoting six lines across fifty rows asks six times and never again.
 *
 * Giving both is fine and costs nothing: `name` wins and no lookup is made.
 *
 * THE CODE IS THE FALLBACK, ALWAYS. A code MDM does not know has a null name
 * (never an empty string — verified across every KORAKIT party), a clerk
 * without `mdm.party.view` resolves nothing, and an unreachable API resolves
 * nothing. In every one of those cases the clerk sees the code, which is what
 * these screens showed before. A missing name must never blank out a fact that
 * is already on the EIR.
 */
export function PartyName({ code, name, empty = '—', resolve = false, mono = true, inline = false }: {
  /** The party code as the read returned it. */
  code: string | null | undefined;
  /** The name the same read sent beside it, where it sends one. */
  name?: string | null;
  /** What to show when there is no code at all. */
  empty?: string;
  /** Look the code up when the read carried no name. Ignored when `name` is set. */
  resolve?: boolean;
  /** Set the code line in the mono face. Off where a table column is already mono. */
  mono?: boolean;
  /**
   * NAME ONLY, on one line, for somewhere a second line cannot go — a row of
   * running text, a picker row. The code is still what shows when there is no
   * name; it is the code UNDER the name that is dropped, not the fact.
   */
  inline?: boolean;
}) {
  const given = name?.trim() || '';
  // Unconditional, as a hook must be: null asks nothing.
  const found = usePartyName(resolve && !given ? code : null);

  const shown = code?.trim();
  if (!shown) return <>{empty}</>;

  const named = given || found?.trim() || '';
  if (!named) return <span className={mono ? 'gecko-text-mono' : undefined}>{shown}</span>;
  if (inline) return <>{named}</>;

  // Plenty of parties ARE their code — a line keyed as APL is named APL. Two
  // identical lines stacked on each other reads as a rendering fault, so the
  // second one is dropped.
  if (named.toUpperCase() === shown.toUpperCase()) return <>{named}</>;

  return (
    <>
      {named}
      <div className={`gecko-cell-meta${mono ? ' gecko-text-mono' : ''}`}>{shown}</div>
    </>
  );
}
