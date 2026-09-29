/**
 * EDITION SWITCH — which menu this build ships.
 *
 *   NEXT_PUBLIC_GECKO_MENU=full   every screen, including the ~50 mock-data ones (demos, dev)
 *   NEXT_PUBLIC_GECKO_MENU=pilot  ONLY the screens bound to Gecko.Api (the KORAKIT pilot)
 *
 * Unset: `pilot` in a production build (`next build` / `next start`), `full` in `next dev`.
 * An unset variable must never leak mock screens to a paying customer.
 *
 * NEXT_PUBLIC_* is inlined at BUILD time (client bundle and src/proxy.ts alike),
 * so changing the mode means rebuilding, not restarting.
 *
 * One list drives three things: the sidebar (AppShell), the route guard (src/proxy.ts),
 * and the post-login landing page (login). Bind a new screen to the API → add its path here.
 */
export type MenuMode = 'pilot' | 'full';

function resolveMode(): MenuMode {
  const raw = (process.env.NEXT_PUBLIC_GECKO_MENU ?? '').trim().toLowerCase();
  if (raw === 'pilot' || raw === 'full') return raw;
  return process.env.NODE_ENV === 'production' ? 'pilot' : 'full';
}

export const MENU_MODE: MenuMode = resolveMode();
export const IS_PILOT = MENU_MODE === 'pilot';

/** Live (API-bound) screens. A path and everything under it (detail pages, /new) is allowed. */
export const PILOT_PATHS: readonly string[] = [
  '/bookings',                  // register, /bookings/new, /bookings/[id]
  '/gate/desk',
  '/gate/stock',
  '/billing/cash-window',
  '/tariff/plans',              // schedules, /tariff/plans/new, /tariff/plans/[id]
  '/masters/customers',
  '/masters/vessels/schedule',
  '/masters/container-types',
  '/masters/order-types',
  '/masters/charge-codes',
  '/masters/holds',
];

/**
 * Mock pages that sit UNDER a live prefix above. They show fixture data and fake
 * saves ("Charge code cloned" writes nothing), so the pilot must not serve them
 * even though their parent list page is live. Remove an entry when its page is
 * bound to the API.
 */
export const PILOT_BLOCKED: readonly string[] = [
  '/bookings/EGLV149602390729',
];

/** Pages every edition serves: sign-in, the root redirect, and the guard's own page. */
const ALWAYS_ALLOWED: readonly string[] = ['/login', '/not-available'];

function underAny(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some(p => path === p || path.startsWith(p + '/'));
}

/** Is this page path served in the current edition? */
export function isPathAvailable(path: string): boolean {
  if (!IS_PILOT) return true;
  if (path === '/' || path === '') return true;
  if (underAny(path, ALWAYS_ALLOWED)) return true;
  if (PILOT_BLOCKED.some(b => b.endsWith('/*') ? path.startsWith(b.slice(0, -1)) : path === b || path.startsWith(b + '/'))) return false;
  return underAny(path, PILOT_PATHS);
}

/** Where a signed-in user lands. Pilot: a live screen, never a mock dashboard. */
export const LANDING_PATH = IS_PILOT ? '/gate/desk' : '/dashboard/overview';
