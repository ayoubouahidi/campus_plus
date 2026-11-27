"use client";

/** Field name → first error message, from a Django REST Framework 400 body. */
export type FieldErrors = Record<string, string>;

/**
 * A failed dashboard request. `message` is the general error ("detail", or every
 * field message joined); `fieldErrors` lets forms put each message under its own
 * field, with the red border, instead of only in a banner.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;

  constructor(message: string, status: number, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function firstMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstMessage(item);
      if (message) return message;
    }
  }
  return null;
}

function toApiError(data: unknown, status: number): ApiError {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const body = data as Record<string, unknown>;
    const fieldErrors: FieldErrors = {};
    for (const [key, value] of Object.entries(body)) {
      if (key === "detail" || key === "non_field_errors") continue;
      const message = firstMessage(value);
      if (message) fieldErrors[key] = message;
    }
    const general = firstMessage(body.detail) ?? firstMessage(body.non_field_errors);
    const message = general ?? (Object.values(fieldErrors)[0] || `Request failed (${status}).`);
    return new ApiError(message, status, fieldErrors);
  }
  return new ApiError(`Request failed (${status}).`, status);
}

export async function dashboardApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    // No trailing slash: Next.js would answer "/x/" with a 308 to "/x" first.
    // The proxy adds Django's trailing slash back.
    const [route, query = ""] = path.replace(/^\/+/, "").split("?");
    const url = `/api/backend/${route.replace(/\/+$/, "")}${query ? `?${query}` : ""}`;
    response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("The server could not be reached. Check your connection and try again.", 0);
  }
  if (response.status === 401) {
    // Session expired: full page load to /login so the stale session cookie is re-read
    // (a client-side push would keep rendering the signed-in layout).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }
  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(data, response.status);
  return data as T;
}

/** Message for a caught error, with a fallback for unexpected values. */
export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Field errors for a caught error ({} when it isn't an ApiError). */
export function fieldErrorsOf(error: unknown): FieldErrors {
  return error instanceof ApiError ? error.fieldErrors : {};
}

/** Rows of a list endpoint that may or may not be paginated. */
export function listRows<T>(response: T[] | { results: T[] }): T[] {
  return Array.isArray(response) ? response : response.results;
}
