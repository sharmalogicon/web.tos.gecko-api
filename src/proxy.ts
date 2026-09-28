import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isPathAvailable } from '@/lib/edition';

/**
 * EDITION ROUTE GUARD (Next 16 "proxy", formerly middleware).
 *
 * In the pilot edition a direct URL to a mock-data screen (e.g. /dashboard/overview,
 * /cfs/stuffing) is rewritten to /not-available — the address bar keeps the URL the
 * user typed, the page says "not in this edition", and no mock data is rendered.
 * In the full edition every path passes through untouched.
 *
 * Same list as the sidebar: src/lib/edition.ts.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPathAvailable(pathname)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/not-available';
  return NextResponse.rewrite(url);
}

export const config = {
  // Pages only: skip the API/auth proxy, Next internals and static files (anything with a dot).
  matcher: ['/((?!api/|auth/|_next/|.*\\..*).*)'],
};
