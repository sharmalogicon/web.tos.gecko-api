/**
 * The API answers failures with RFC 7807 ProblemDetails, and validation
 * failures with the ValidationProblemDetails shape (an `errors` map keyed by
 * field). Parsing that in one place is what stops every screen inventing its
 * own "something went wrong".
 */

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;
  /** Application code when the API sends one, e.g. "password_change_required". */
  readonly code?: string;

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.code = code;
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
  let message = FALLBACK[response.status] ?? `Request failed (${response.status}).`;
  let fieldErrors: FieldErrors = {};
  let code: string | undefined;

  try {
    const body = await response.json();
    if (body && typeof body === "object") {
      const problem = body as Record<string, unknown>;
      if (typeof problem.detail === "string" && problem.detail) message = problem.detail;
      else if (typeof problem.title === "string" && problem.title) message = problem.title;
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

  return new ApiError(response.status, message, fieldErrors, code);
}
