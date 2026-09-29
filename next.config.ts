import type { NextConfig } from "next";

/**
 * ONE ORIGIN IN DEVELOPMENT.
 *
 * The browser talks only to this app; /api and /auth are proxied to Gecko.Api.
 * That buys three things the alternative (calling https://localhost:7100
 * directly from the browser) does not:
 *
 *   1. No CORS configuration, and none of the credentialed-CORS rules that come
 *      with sending cookies cross-origin.
 *   2. The refresh cookie keeps its PRODUCTION settings — __Secure- prefix,
 *      HttpOnly, SameSite=Strict, Path=/auth. Run the app with
 *      `npm run dev` (which passes --experimental-https), or the browser will
 *      refuse a __Secure- cookie over plain http and login will appear to work
 *      while every refresh fails.
 *   3. The same URLs work in production behind one hostname.
 *
 * The upstream hop is http://localhost:5100 (Gecko.Api's http profile) on
 * purpose: Node would reject the API's self-signed https certificate, and the
 * Secure attribute is about the BROWSER's connection to this app, which is
 * https either way.
 */
const API_ORIGIN = resolveApiOrigin();

/**
 * Production must name the API explicitly. A silent localhost fallback on Vercel
 * builds fine and then fails every sign-in with "service not reachable". It must
 * also be https: Gecko.Api redirects http to https, and the browser would follow
 * that 307 cross-origin, losing the one-origin cookie setup described above.
 */
function resolveApiOrigin(): string {
  const configured = process.env.GECKO_API_ORIGIN?.trim().replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return configured || "http://localhost:5100";
  if (!configured) throw new Error("GECKO_API_ORIGIN is not set. Set it for this build (Vercel: Production and Preview env vars).");
  if (!configured.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(configured))
    throw new Error(`GECKO_API_ORIGIN must be https:// in production (got ${configured}).`);
  return configured;
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
      { source: "/auth/:path*", destination: `${API_ORIGIN}/auth/:path*` },
    ];
  },
};

export default nextConfig;
