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

/** A date-only value (yyyy-MM-dd or an ISO instant) as dd-MM-yyyy. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  // Date-only strings are read as local, not UTC: `new Date('2026-10-03')` is
  // midnight UTC, which is the 2nd in some zones and would print a day early.
  const at = value.length >= 10 && value[4] === '-'
    ? new Date(`${value.slice(0, 10)}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(at.getTime())) return '—';
  return `${pad(at.getDate())}-${pad(at.getMonth() + 1)}-${at.getFullYear()}`;
}

/** An instant as dd-MM-yyyy HH:mm, 24-hour. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return '—';
  return `${formatDate(value)} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** Just the clock part, HH:mm. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? '—' : `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** dd-MM-yyyy with the weekday in front, for a day that is being planned. */
export function formatDayDate(value: string | null | undefined): string {
  if (!value) return '—';
  const at = value.length >= 10 && value[4] === '-'
    ? new Date(`${value.slice(0, 10)}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(at.getTime())) return '—';
  const day = at.toLocaleDateString('en-GB', { weekday: 'short' });
  return `${day} ${formatDate(value)}`;
}
