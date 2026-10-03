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
  /** `bpm`: permissions held only at named branches, as "p1,p2@branchId,branchId". */
  branchPermissions: string[];
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

/**
 * One HTTP call. JSON unless told otherwise: a FormData body must leave
 * Content-Type to the browser (it writes the multipart boundary), and a file
 * download asks for whatever the server sends.
 */
async function send(path: string, init: RequestInit, token?: string, binary = false): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body !== undefined && !isForm && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!headers.has("Accept")) headers.set("Accept", binary ? "*/*" : "application/json");
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
        throw new ApiError(0, process.env.NODE_ENV === "development"
          ? "The Gecko API is not reachable. Start Gecko.Api (http://localhost:5100)."
          : "The Gecko service is not reachable right now.");
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
  const response = await authorised(path, init, false);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Sends with the bearer token, refreshing once on 401; throws an ApiError for any failure. */
async function authorised(path: string, init: RequestInit, binary: boolean): Promise<Response> {
  const token = await tokenForRequest();
  let response = await send(path, init, token ?? undefined, binary);

  if (response.status === 401 && token) {
    const renewed = await refresh();
    if (renewed) response = await send(path, init, renewed.token, binary);
  }

  if (!response.ok) throw await toApiError(response);
  return response;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiSend = <T>(method: string, path: string, body?: unknown, idempotencyKey?: string) =>
  api<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });

/**
 * One key per USER ACTION, reused for every retry of that action.
 *
 * It is what lets a create be retried safely. Without it the caller cannot tell
 * "the request failed" from "it succeeded and I lost the answer", so it cannot
 * retry at all — and a user who presses Save twice gets two bookings, or pays
 * twice.
 *
 * Replaying a key returns the SAME 201 with whatever that booking or receipt
 * looks like now. A key used with a DIFFERENT body answers 422, so a new
 * action must take a new key — see `newIdempotencyKey`.
 *
 * A request that FAILED (400 / 409) did not spend its key: fix the input and
 * send the same key again.
 */
export const newIdempotencyKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

/** multipart/form-data POST (a file upload); the answer is JSON. */
export async function apiUpload<T>(path: string, form: FormData, method = "POST"): Promise<T> {
  const response = await authorised(path, { method, body: form }, false);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface Download {
  blob: Blob;
  /** From Content-Disposition (RFC 5987 filename* first); null when the server named none. */
  filename: string | null;
  contentType: string | null;
}

/** GET a file (a PDF, a workbook) as a Blob with the name the server gave it. */
export async function apiDownload(path: string): Promise<Download> {
  const response = await authorised(path, { method: "GET" }, true);
  return {
    blob: await response.blob(),
    filename: filenameOf(response.headers.get("Content-Disposition")),
    contentType: response.headers.get("Content-Type"),
  };
}

export function filenameOf(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // A malformed escape falls through to the plain name.
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : null;
}

/** Hands a Blob to the browser as a download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
