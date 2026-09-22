import { ApiError, toApiError } from "./problem";

/**
 * THE ONLY PLACE THAT TALKS TO Gecko.Api.
 *
 * ADR-006: the access token lives in a JavaScript variable for its 15 minutes
 * and is never written to localStorage or a readable cookie — a stored token is
 * one XSS away from being someone else's. The refresh token is an HttpOnly
 * cookie this code cannot see and never handles; the browser attaches it to
 * /auth/refresh by itself.
 *
 * Requests are same-origin: next.config.ts proxies /api and /auth to the API.
 */

export interface AccessToken {
  token: string;
  expiresAt: number; // epoch ms
}

export interface Me {
  userId: string;
  tenantId: string;
  userType: string | null;
  branches: string[];
  modules: string[];
  roles: string[];
  permissions: string[];
}

let accessToken: AccessToken | null = null;
let refreshInFlight: Promise<AccessToken | null> | null = null;

/** Refresh a little early, so a request never leaves with a token that expires mid-flight. */
const EXPIRY_SKEW_MS = 30_000;

function isUsable(token: AccessToken | null): token is AccessToken {
  return token !== null && token.expiresAt - EXPIRY_SKEW_MS > Date.now();
}

function store(payload: { accessToken: string; expiresAt: string }): AccessToken {
  accessToken = { token: payload.accessToken, expiresAt: new Date(payload.expiresAt).getTime() };
  return accessToken;
}

export function currentToken(): AccessToken | null {
  return accessToken;
}

export function forgetToken(): void {
  accessToken = null;
}

async function send(path: string, init: RequestInit, token?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  return fetch(path, { ...init, headers, credentials: "same-origin" });
}

/**
 * Swaps the refresh cookie for a new access token. Concurrent callers share one
 * request: two tabs racing is a handled case in the API (RotationGraceSeconds),
 * but two requests from the SAME page racing would burn a rotation for nothing.
 */
export function refresh(): Promise<AccessToken | null> {
  refreshInFlight ??= (async () => {
    try {
      let response: Response;
      try {
        response = await send("/auth/refresh", { method: "POST" });
      } catch {
        // The API is not running. That is NOT "signed out": the caller shows the
        // mock screens rather than bouncing a developer to the login page.
        accessToken = null;
        throw new ApiError(0, "The Gecko API is not reachable. Start Gecko.Api (http://localhost:5100).");
      }
      if (!response.ok) {
        accessToken = null;
        return null;
      }
      return store(await response.json());
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function tokenForRequest(): Promise<string | null> {
  if (isUsable(accessToken)) return accessToken.token;
  const renewed = await refresh();
  return renewed?.token ?? null;
}

/**
 * Calls the API with a valid access token, refreshing first when the one in
 * hand has expired and once more if the API still says 401 (a role change, or a
 * token issued before a redeploy).
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenForRequest();
  let response = await send(path, init, token ?? undefined);

  if (response.status === 401 && token) {
    const renewed = await refresh();
    if (renewed) response = await send(path, init, renewed.token);
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiSend = <T>(method: string, path: string, body?: unknown) =>
  api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Email + password for an access token; the refresh cookie is set by the response. */
export async function login(email: string, password: string): Promise<AccessToken> {
  const response = await send("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  if (!response.ok) throw await toApiError(response);
  return store(await response.json());
}

/** Ends the session server-side and clears the cookie; the local token goes either way. */
export async function logout(): Promise<void> {
  try {
    await send("/auth/logout", { method: "POST" });
  } finally {
    accessToken = null;
  }
}

export const me = () => apiGet<Me>("/auth/me");

export { ApiError };
