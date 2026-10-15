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
