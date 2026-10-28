/**
 * A PARTY BY NAME, with its code underneath — not a bare code.
 *
 * A generated party code ("20261955") means nothing to the clerk holding the
 * paper. The depot talks about CHENG LIE, and about the transporter by name,
 * so that is what the screen leads with; the code stays as the small second
 * line, because it is what gets quoted on the phone and typed into a search.
 *
 * PURELY PRESENTATIONAL — IT NEVER READS. The API sends the name beside the
 * code on every gate read since 2026-10-28 (`lineName`, `customerName`,
 * `haulierName`; see docs/GATE_NAMES_AND_COUPON_FOR_API.md), chosen there as
 * the party's local name where MDM has one and its English name otherwise.
 * Resolving it here instead would be one round-trip per code and, on a
 * register, one per row. If a name is ever wanted on a screen that has none,
 * get the API to send it rather than fetching it from this component.
 *
 * THE CODE IS THE FALLBACK, ALWAYS. A code MDM does not know has a null name
 * (never an empty string — verified across every KORAKIT party), and then the
 * clerk sees the code, which is what this screen showed before. A missing name
 * must never blank out a fact that is already on the EIR.
 */
export function PartyName({ code, name, empty = '—' }: {
  /** The party code as the gate read returned it. */
  code: string | null | undefined;
  /** The name the same read sent beside it, where MDM knows the party. */
  name?: string | null;
  /** What to show when there is no code at all. */
  empty?: string;
}) {
  const shown = code?.trim();
  if (!shown) return <>{empty}</>;
  if (!name?.trim()) return <span className="gecko-text-mono">{shown}</span>;

  const named = name.trim();
  // Plenty of parties ARE their code — a line keyed as APL is named APL. Two
  // identical lines stacked on each other reads as a rendering fault, so the
  // second one is dropped.
  if (named.toUpperCase() === shown.toUpperCase()) return <>{named}</>;

  return (
    <>
      {named}
      <div className="gecko-cell-meta gecko-text-mono">{shown}</div>
    </>
  );
}
