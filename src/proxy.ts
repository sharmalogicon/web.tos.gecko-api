import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isPathAvailable } from '@/lib/edition';

/**
 * Two jobs (Next 16 "proxy", formerly middleware).
 *
 * 1. ROUTE GUARD. A direct URL to a screen Gecko does not serve (e.g.
 *    /cfs/stuffing, /billing/invoices) is rewritten to /not-available — the
 *    address bar keeps the URL the user typed, and no fixture data is rendered.
 *    One list, applied in development exactly as in production, and the same
 *    one the sidebar reads: src/lib/edition.ts.
 *
 * 2. CLIENT IP FOR /auth ON VERCEL. Gecko.Api rate-limits sign-in per client IP,
 *    but through Vercel it only sees Vercel's rotating egress IPs, so every user
 *    would share a handful of partitions. When GECKO_PROXY_KEY is set, /auth/* is
 *    forwarded from here with the caller's IP and the shared key; the API believes
 *    the IP only when the key matches (Gecko.Api TrustedProxyClientIp). Unset (local
 *    dev), /auth falls through to the plain rewrite in next.config.ts.
 */
const PROXY_KEY = process.env.GECKO_PROXY_KEY?.trim();
const API_ORIGIN = process.env.GECKO_API_ORIGIN?.trim().replace(/\/+$/, '');

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/auth/')) {
    if (!PROXY_KEY || !API_ORIGIN) return NextResponse.next();
    const headers = new Headers(request.headers);
    // Vercel sets x-real-ip / x-forwarded-for from the edge connection itself,
    // replacing whatever the browser sent, so a caller cannot choose its own IP.
    const clientIp = request.headers.get('x-real-ip')
      ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    headers.set('x-gecko-proxy-key', PROXY_KEY);
    if (clientIp) headers.set('x-gecko-client-ip', clientIp);
    else headers.delete('x-gecko-client-ip');
    return NextResponse.rewrite(new URL(pathname + search, API_ORIGIN), { request: { headers } });
  }

  if (isPathAvailable(pathname)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/not-available';
  return NextResponse.rewrite(url);
}

export const config = {
  // Pages (skipping the /api proxy, Next internals and static files — anything
  // with a dot), plus /auth for the client-IP forwarding above.
  matcher: ['/((?!api/|auth/|_next/|.*\\..*).*)', '/auth/:path*'],
};
