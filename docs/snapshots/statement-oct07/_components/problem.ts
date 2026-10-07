import { ApiError } from '@/lib/api/problem';

/**
 * A failure in words a clerk can act on.
 *
 * Most of the statement's writes have no endpoint behind them yet, so a 404 is
 * the COMMON case rather than the odd one. A bare "Not Found" would read as a
 * missing booking; it is a missing feature, and saying which one — and that the
 * work is specified and waiting on the API — is the difference between a clerk
 * retrying all afternoon and a clerk going to the cash window instead.
 */
const MISSING: Record<string, { title: string; detail: string }> = {
  price: {
    title: 'Changing a price is not built yet',
    detail: 'The API has no POST /api/revenue/charges/{id}/price. Specified in '
      + 'docs/STATEMENT_CHARGE_EDIT_FOR_API.md and waiting on the API side.',
  },
  waive: {
    title: 'Waiving by line is not built yet',
    detail: 'The API waives per box and charge code, which cannot tell two lines of the same code apart. '
      + 'The by-id endpoint is specified and waiting.',
  },
  lock: {
    title: 'Locking a rate is not built yet',
    detail: 'Without it, Regenerate would undo every correction — which is why both are specified together.',
  },
  manual: {
    title: 'Adding a charge by hand is not built yet',
    detail: 'The charge model already has a MANUAL source, but there is no endpoint that creates one.',
  },
  bulk: {
    title: 'Applying a charge to every box is not built yet',
    detail: 'It needs the manual-charge endpoint first; both are in the same spec.',
  },
  regenerate: {
    title: 'Regenerate is not built yet',
    detail: 'Re-pricing a booking from the current tariff needs an endpoint, and the rate lock that keeps '
      + 'corrections safe from it.',
  },
  invoice: {
    title: 'Invoicing is not built yet',
    detail: 'The API has no invoice endpoint of any kind — that is why the Invoices screen is blocked. '
      + 'Cash is taken at the cash window today; nothing can raise a credit invoice.',
  },
};

export function apiProblem(e: unknown, what: string): { title: string; detail: string } {
  const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
  if ((err.status === 404 || err.status === 405) && MISSING[what]) return MISSING[what];
  if (err.status === 409) {
    return { title: 'Someone else changed this first', detail: `${err.title} Reload the statement and try again.` };
  }
  if (err.status === 403) {
    return { title: 'Not your decision to make', detail: 'This needs the right that prices or waives a charge. Ask a supervisor.' };
  }
  if (err.status === 0) {
    return { title: 'The Gecko API did not answer', detail: 'Nothing was changed. Check the connection and try again.' };
  }
  return { title: err.title || 'That did not work', detail: err.explanation ?? err.message };
}
