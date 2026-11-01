/**
 * The API answers failures with RFC 7807 ProblemDetails, and validation
 * failures with the ValidationProblemDetails shape (an `errors` map keyed by
 * field). Parsing that in one place is what stops every screen inventing its
 * own "something went wrong".
 */

export type FieldErrors = Record<string, string[]>;

/**
 * `message` stays what every caller has always shown: the one best sentence
 * (detail, else title, else the first field error of a 400). Screens that
 * have room for two lines use `title` as the heading and `detail` as the
 * explanation — both as the server wrote them.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;
  /** Application code when the API sends one, e.g. "password_change_required". */
  readonly code?: string;
  /** The ProblemDetails title — the heading. Falls back to a status-based sentence. */
  readonly title: string;
  /** The ProblemDetails detail — the explanation; null when the server sent none. */
  readonly detail: string | null;
  /**
   * The whole problem body as the server sent it, for the extensions RFC 7807
   * allows beyond title/detail/errors. The gate refusal is the one that matters
   * today: a 409 from /api/tos/gate/transactions carries `decision` and a
   * `findings[]` array naming every reason, and a clerk who cannot see those
   * cannot act on the refusal.
   */
  readonly body: Record<string, unknown> | null;
  /**
   * THE ID SUPPORT NEEDS TO FIND THE FAILURE IN THE LOG, on a 5xx.
   *
   * The API writes `reference` on every unexpected failure — the same id its
   * log line carries — so a clerk reading it down the phone is enough to find
   * the one request that broke. Null on anything a clerk can act on themselves
   * (a 400, a refusal), where an id would be noise.
   *
   * Derived here rather than passed in, so every `new ApiError(...)` already
   * in the codebase keeps compiling and still gets the reference.
   */
  readonly reference: string | null;

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}, code?: string,
    title?: string, detail?: string | null, body?: Record<string, unknown> | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.code = code;
    this.title = title ?? message;
    this.detail = detail ?? null;
    this.body = body ?? null;
    this.reference = referenceOf(this.body, status);
  }

  /** A typed extension off the problem body, or undefined when absent. */
  extension<T>(name: string): T | undefined {
    const value = this.body?.[name];
    return value === undefined ? undefined : (value as T);
  }

  /**
   * Heading + explanation for a two-line alert. The explanation is the detail,
   * or — for a validation failure, whose title is generic — the field messages.
   */
  get explanation(): string | null {
    if (this.detail) return this.detail;
    const fields = Object.values(this.fieldErrors).flat().filter(m => typeof m === "string");
    if (fields.length) return fields.join(" ");
    return this.message !== this.title ? this.message : null;
  }

  /**
   * The message for a field, matched case-insensitively (the API sends PascalCase).
   *
   * AN EXACT MATCH WINS. A field can carry two messages: the framework's
   * `rows[0].move.ContainerNo` — "The ContainerNo field is required." — and the
   * endpoint's own `rows[0].move.containerNo` — "A walk-in pick-up names the
   * box it collects." Taking whichever came first in the JSON gave the clerk
   * the generic one, which says nothing they can act on. Our callers ask in
   * camelCase, which is the hand-written one.
   */
  forField(name: string): string | undefined {
    const keys = Object.keys(this.fieldErrors);
    const key = keys.find(k => k === name) ?? keys.find(k => k.toLowerCase() === name.toLowerCase());
    return key ? this.fieldErrors[key][0] : undefined;
  }
}

/**
 * The 32-hex trace id, from `reference` or — on a 5xx that sent only the W3C
 * `traceId` ("00-<32 hex>-<16 hex>-01") — from the middle of that.
 */
function referenceOf(body: Record<string, unknown> | null, status: number): string | null {
  const direct = body?.reference;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (status < 500) return null;
  const traceId = body?.traceId;
  const hex = typeof traceId === "string" ? /[0-9a-f]{32}/i.exec(traceId) : null;
  return hex ? hex[0] : null;
}

/** A heading and, where there is one, the line under it. */
interface Fallback { title: string; detail: string | null }

/**
 * WHAT TO SAY WHEN THE SERVER SAID NOTHING USEFUL.
 *
 * `Request failed (500).` was true and useless: a clerk could not tell whether
 * to retry, wait, or call someone. Every line here says what to do next. The
 * 4xx wording is unchanged — screens and tests depend on it.
 */
const FALLBACK: Record<number, Fallback> = {
  0: { title: "No connection to the server.", detail: "Check the network, then try again." },
  401: { title: "Your session has ended. Sign in again.", detail: null },
  403: { title: "You do not have permission to do that.", detail: null },
  404: { title: "Not found.", detail: null },
  409: { title: "Someone else changed this first. Reload and try again.", detail: null },
  429: { title: "Too many attempts. Wait a moment and try again.", detail: null },
  500: { title: "The server could not finish this request.", detail: "Something failed on our side. Try again in a moment." },
  502: { title: "The server is not answering.", detail: "It may be restarting. Try again in a minute." },
};

/**
 * A 502 / 503 / 504 is the proxy talking — Azure or Vercel, with no JSON body
 * at all — so they share one sentence. Any other 5xx is the API's own crash.
 */
export function fallbackFor(status: number): Fallback {
  if (FALLBACK[status]) return FALLBACK[status];
  if (status >= 502) return FALLBACK[502];
  if (status >= 500) return FALLBACK[500];
  return { title: `Request failed (${status}).`, detail: null };
}

/**
 * An ApiError from whatever a catch block was handed. The API's own words win;
 * `fallback` is the heading only when the throw was not an ApiError at all,
 * which means a bug in this app rather than an answer from the server.
 */
export function problemOf(err: unknown, fallback: string): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, fallback);
}

/** A request that never reached the server: one wording for every screen. */
export function offlineError(): ApiError {
  const f = fallbackFor(0);
  return new ApiError(0, f.detail ?? f.title, {}, undefined, f.title, f.detail);
}

export async function toApiError(response: Response): Promise<ApiError> {
  const { title: fallbackTitle, detail: fallbackDetail } = fallbackFor(response.status);
  const fallback = fallbackTitle;
  let message = fallbackDetail ?? fallbackTitle;
  let fieldErrors: FieldErrors = {};
  let code: string | undefined;
  let title: string | undefined;
  let detail: string | null = null;
  let raw: Record<string, unknown> | null = null;

  try {
    const body = await response.json();
    if (body && typeof body === "object") {
      const problem = body as Record<string, unknown>;
      raw = problem;
      if (typeof problem.detail === "string" && problem.detail) message = problem.detail;
      else if (typeof problem.title === "string" && problem.title) message = problem.title;
      if (typeof problem.title === "string" && problem.title) title = problem.title;
      if (typeof problem.detail === "string" && problem.detail) detail = problem.detail;
      if (typeof problem.code === "string") code = problem.code;
      if (problem.errors && typeof problem.errors === "object") {
        fieldErrors = problem.errors as FieldErrors;
        const first = Object.values(fieldErrors)[0];
        if (Array.isArray(first) && typeof first[0] === "string" && response.status === 400) message = first[0];
      }
    }
  } catch {
    // A non-JSON body (a proxy error page, say) leaves the fallback message.
  }

  /**
   * A gateway's 502 / 503 / 504 has no JSON body at all — Azure and Vercel send
   * an HTML page — so both lines come from the fallback. When the API DID write
   * a problem, its own words stand alone: a server that said something is not
   * second-guessed here.
   */
  const explain = title === undefined && detail === null ? fallbackDetail : detail;
  return new ApiError(response.status, message, fieldErrors, code, title ?? fallback, explain, raw);
}
