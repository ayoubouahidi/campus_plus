// The one place the student site calls Django (Step 14.1, DOCS.md §14). Server only: BACKEND_URL is an internal
// Docker address (http://web:8000) and the token is a secret; never import this from a 'use client' file.
//
// Errors are split in two, because pages react differently:
//  - ApiError: Django answered with a 4xx (404 not found, 401 not signed in, 409 event full…). The caller
//    decides (notFound(), a message, a rollback). `status` and `body` are kept for that.
//  - ApiUnavailable: Django didn't answer properly (network error, timeout, 5xx, not JSON). Not the visitor's
//    fault: pages let it reach the error page ("Something went wrong, try again").

import type { RawPage } from './raw';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    path: string
  ) {
    super(`[api] ${status} on ${path}`);
    this.name = 'ApiError';
  }
}

export class ApiUnavailable extends Error {
  constructor(path: string, cause?: unknown) {
    super(`[api] backend unavailable on ${path}`, { cause });
    this.name = 'ApiUnavailable';
  }
}

// 8 s: long enough for a cold Django, short enough that a dead one shows the error page instead of hanging.
const TIMEOUT_MS = 8_000;

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string | null; // Django's DRF token (getBackendToken); omitted = anonymous request
  body?: unknown;
}

export const hasBackend = (): boolean => Boolean(process.env.BACKEND_URL);

export async function apiFetch<T>(path: string, { method = 'GET', token, body }: ApiRequest = {}): Promise<T> {
  const base = process.env.BACKEND_URL;
  if (!base) throw new ApiUnavailable(path, new Error('BACKEND_URL is not set'));

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        // DRF TokenAuthentication expects "Token <key>", not "Bearer".
        ...(token ? { Authorization: `Token ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', // per-visitor data (RSVP state, attendee names): never shared through Next's cache
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new ApiUnavailable(path, error);
  }

  if (res.status >= 500) throw new ApiUnavailable(path, new Error(`HTTP ${res.status}`));
  if (res.status === 204) return undefined as T;

  let data: unknown;
  try {
    data = await res.json();
  } catch (error) {
    throw new ApiUnavailable(path, error);
  }
  if (!res.ok) throw new ApiError(res.status, data, path);
  return data as T;
}

// Follows DRF pagination. `next` carries Django's own host (http://web:8000/…?page=2), so only its query string
// is reused on our base URL. `maxPages` caps a runaway list (200 per page × 10 = 2,000 items).
export async function apiFetchAll<T>(path: string, request: ApiRequest = {}, maxPages = 10): Promise<T[]> {
  const results: T[] = [];
  let next: string | null = path;
  for (let page = 0; next && page < maxPages; page += 1) {
    const data: RawPage<T> = await apiFetch<RawPage<T>>(next, request);
    results.push(...data.results);
    next = data.next ? `${path.split('?')[0]}${new URL(data.next).search}` : null;
  }
  return results;
}
