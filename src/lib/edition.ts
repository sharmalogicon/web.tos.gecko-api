/**
 * WHICH SCREENS GECKO SERVES. One answer, everywhere.
 *
 * There used to be two editions — a `pilot` build for KORAKIT and a `full` one
 * for development — chosen from NODE_ENV. That meant `npm run dev` showed every
 * screen while production showed a subset, so what a developer saw was never
 * what the customer saw. It is how the June reports sat inside every production
 * build for days with nobody able to reach them.
 *
 * KORAKIT is switching their desktop OFF. There is no pilot and no second
 * edition: these lists apply in development exactly as they apply in
 * production, so the local copy IS the live copy.
 *
 * A screen is served when it is on LIVE_PATHS (or EXACT_PATHS) and not on
 * BLOCKED_PATHS. Bind a screen to the API, then add it here — in that order.
 *
 * One list drives three things: the sidebar (AppShell), the route guard
 * (src/proxy.ts), and the page a user lands on after signing in.
 */

/**
 * Live screens. A path and everything under it (detail pages, /new) is served.
 *
 * `/compare/june` is deliberately NOT here. Those are the June 2026 screens on
 * MOCK data — invented bookings, invented amounts — kept as the reference the
 * rebuilds are read against. KORAKIT is live, and a screen full of invented
 * numbers that nobody can tell are invented is worse than no screen. Add
 * '/compare' here for a local review session, and take it out again before the
 * next deploy.
 */
export const LIVE_PATHS: readonly string[] = [
  // The two dashboards that survived 2026-09-29, both bound since: every number
  // on them is counted by the server. Listed one by one rather than as
  // '/dashboard', which would also serve the ten retired fixture dashboards.
  '/dashboard/overview',
  '/dashboard/gate-traffic',
  '/bookings',                   // register, /bookings/new, /bookings/[id]
  // Off the menu since 2026-10-01 — the depot has no barrier, so EIR-In
  // replaced it — but kept reachable as a fallback.
  '/gate/desk',
  '/gate/stock',
  '/gate/eir-in',                // the gate-in form: one truck, every box on it
  '/gate/eir-in-register',       // the register of past gate-ins
  '/gate/eir-in-sept',           // the plainer bound gate-in, kept as a fallback
  '/bookings/new-sept',
  '/gate/eir-out',               // the gate-out form, /gate/eir-out/[id] detail
  '/gate/eir-out-register',      // the register of past gate-outs
  '/gate/holds',                 // holds board: active, released history, release
  '/gate/reefer-ops',            // reefer plug log, /new plug-in
  '/gate/yard-view',             // yard fill, areas, stock by type / customer / dwell
  '/units/unit-inquiry',         // one box's story (?no=); /gate/container-status redirects here
  '/units/equipment-pool',       // stock pools: type × line × grade × condition
  '/billing/cash-window',
  '/billing/service-orders',     // the charge register, /api/revenue/charges
  '/billing/statement',          // one booking's charge lines and receipts (?orderNo=)
  '/billing/invoices',           // credit invoices: the register and one document
  '/billing/unbilled',           // the billing worklist: orders, then their charge lines
  '/reports/operational',        // the report catalogue; each card says if it can run
  '/reports/accounts',
  '/reports/operational-api',    // the two reports that have real queries behind them
  '/reports/accounts-api',
  '/tariff/plans',               // schedules, /tariff/plans/new, /tariff/plans/[id]
  '/masters/customers',
  '/masters/vessels',            // list, /new, /[code], and the schedule
  '/masters/container-types',
  '/masters/order-types',
  '/masters/charge-codes',
  '/masters/haulier-charge-terms',
  '/masters/holds',
  '/masters/lines',
  '/masters/lookups',
  '/masters/yards',
  '/config/system-params',
  '/masters/ports',
  '/masters/commodities',
  '/masters/locations',
  '/masters/seal-series',
  '/masters/countries',
  '/masters/public-holidays',
  '/config/gate-hours',          // weekly windows, one-off dates, holidays read-only
];

/**
 * Screens that sit UNDER a live prefix but must not be served.
 *
 * These still render fixture data — invented customers, invented amounts — and
 * save nothing. KORAKIT is live, so an invented number is worse than a missing
 * screen: nobody can tell it is invented until they have acted on it. Take an
 * entry out the day its page is bound.
 */
export const BLOCKED_PATHS: readonly string[] = [
  // Still a hardcoded array of invented credit notes. The API gained invoices
  // on 2026-10-07 (GET /api/revenue/invoices, /{id}, POST /invoices/send) and
  // '/billing/invoices' was unblocked with them — but there is still no
  // credit-note endpoint, and on a LIVE cutover an invented credit note is
  // worse than a missing screen. Take this out the day it is bound.
  '/billing/credit-notes',
];

/**
 * Served EXACTLY — not their children. The masters hub is live, but some pages
 * under /masters are not, so '/masters' cannot go in the prefix list above.
 */
export const EXACT_PATHS: readonly string[] = [
  '/masters',                    // hub: link-only tiles to the live masters
];

/** Pages always served: sign-in, the root redirect, and the guard's own page. */
const ALWAYS_ALLOWED: readonly string[] = ['/login', '/not-available'];

function underAny(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some(p => path === p || path.startsWith(p + '/'));
}

/** Is this page path served? The guard and the menu both ask this, and only this. */
export function isPathAvailable(path: string): boolean {
  if (path === '/' || path === '') return true;
  if (underAny(path, ALWAYS_ALLOWED)) return true;
  if (EXACT_PATHS.includes(path)) return true;
  if (underAny(path, BLOCKED_PATHS)) return false;
  return underAny(path, LIVE_PATHS);
}

/** Where a signed-in user lands: the screen the depot works in all day. */
export const LANDING_PATH = '/gate/eir-in';
