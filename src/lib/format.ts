/**
 * HOW A DATE IS WRITTEN IN THIS APP: dd-MM-yyyy.
 *
 * His call, 2026-10-03, and the right one for a Thai depot: the clerks read
 * 03-10-2026, and "03 Oct 2026" / "Oct 03, 2026" / "3/10/2026" all appeared on
 * different screens before this existed. A date that reads differently from one
 * table to the next is a date someone eventually misreads.
 *
 * Everything that prints a date in a table comes through here. Prose dates in a
 * page heading may still spell the month out — that is a sentence, not a column.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A DATE-ONLY value, meaning yyyy-MM-dd and nothing after it.
 *
 * The distinction matters more than it looks. `new Date('2026-10-03')` is
 * midnight UTC, which is still the 2nd in the Americas, so a date-only string
 * has to be read as local midnight. An ISO INSTANT must not be treated that
 * way: its own date characters are in UTC, and slicing them off throws the
 * offset away.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** The instant a value names, read the way its own shape requires. */
function instantOf(value: string): Date {
  return DATE_ONLY.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}

/** A date-only value (yyyy-MM-dd or an ISO instant) as dd-MM-yyyy. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const at = instantOf(value);
  if (Number.isNaN(at.getTime())) return '—';
  return `${pad(at.getDate())}-${pad(at.getMonth() + 1)}-${at.getFullYear()}`;
}

/**
 * An instant as dd-MM-yyyy HH:mm, 24-hour, in the reader's own zone.
 *
 * THE DAY AND THE CLOCK COME FROM ONE Date. They used not to: the date was
 * taken by slicing the first ten characters of the ISO string — which are UTC —
 * while the time came from the real local Date. Between midnight and 07:00 in
 * Bangkok the UTC date is still the day before, so every gate move of the early
 * shift printed the right time against the previous day's date: a box gated in
 * at 06:50 on the 15th read "14-10-2026 06:50".
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const at = instantOf(value);
  if (Number.isNaN(at.getTime())) return '—';
  return `${pad(at.getDate())}-${pad(at.getMonth() + 1)}-${at.getFullYear()} `
    + `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** Just the clock part, HH:mm. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const at = instantOf(value);
  return Number.isNaN(at.getTime()) ? '—' : `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** dd-MM-yyyy with the weekday in front, for a day that is being planned. */
export function formatDayDate(value: string | null | undefined): string {
  if (!value) return '—';
  const at = instantOf(value);
  if (Number.isNaN(at.getTime())) return '—';
  const day = at.toLocaleDateString('en-GB', { weekday: 'short' });
  return `${day} ${formatDate(value)}`;
}

/**
 * A `<input type="datetime-local">` VALUE — yyyy-MM-ddTHH:mm, in LOCAL time.
 *
 * `toISOString().slice(0, 16)` is the obvious one-liner and it is wrong: that
 * string is UTC, so in Bangkok (+07) the box opens seven hours behind the
 * clock on the wall. The same mistake printed the wrong gate-in day across the
 * app until 2026-10-18; it is not repeated here.
 */
export function localInputValue(at: Date = new Date()): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
    + `T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/**
 * The reverse: what the clerk sees in the box, as the instant to send.
 *
 * A datetime-local value carries NO zone, and `new Date('2026-10-27T08:30')`
 * reads it in the browser's own zone — which is what the clerk meant, because
 * they read it off the gate clock beside them. Null when the box is empty or
 * half-typed, so a caller can tell "not set" from "set to something odd".
 */
export function instantFromLocalInput(value: string): string | null {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/**
 * A RECORD STATUS AS THE SCREEN SAYS IT.
 *
 * The API calls a cancelled EIR or receipt VOIDED, and it is right to: the
 * number is kept and never reused, and the row stays readable for ever. But
 * nobody at this depot says "void" — the clerks say DELETE, and that is the
 * word on every button now (owner, 2026-10-28). So the stored value stays
 * VOIDED everywhere it is compared, filtered or sent, and only what reaches
 * the eye is translated. Do not rename the status itself.
 *
 * Anything it does not know is passed through unchanged, so a new status added
 * by the API shows up as itself rather than vanishing.
 */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return '';
  return status === 'VOIDED' || status === 'VOID' ? 'DELETED' : status;
}
