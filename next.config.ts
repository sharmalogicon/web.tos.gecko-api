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
const API_ORIGIN = process.env.GECKO_API_ORIGIN ?? "http://localhost:5100";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
      { source: "/auth/:path*", destination: `${API_ORIGIN}/auth/:path*` },
    ];
  },
};

export default nextConfig;
