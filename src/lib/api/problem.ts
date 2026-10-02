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

  /** First message for a field, matched case-insensitively (the API sends PascalCase). */
  forField(name: string): string | undefined {
    const key = Object.keys(this.fieldErrors).find(k => k.toLowerCase() === name.toLowerCase());
    return key ? this.fieldErrors[key][0] : undefined;
  }
}

const FALLBACK: Record<number, string> = {
  401: "Your session has ended. Sign in again.",
  403: "You do not have permission to do that.",
  404: "Not found.",
  409: "Someone else changed this first. Reload and try again.",
  429: "Too many attempts. Wait a moment and try again.",
};

export async function toApiError(response: Response): Promise<ApiError> {
  const fallback = FALLBACK[response.status] ?? `Request failed (${response.status}).`;
  let message = fallback;
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

  return new ApiError(response.status, message, fieldErrors, code, title ?? fallback, detail, raw);
}
