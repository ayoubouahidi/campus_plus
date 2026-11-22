'use server';

import { getSessionState } from '@/auth';
import { ApiError, ApiUnavailable } from '@/lib/api/client';
import { getBackendToken } from '@/lib/api/token';
import { mocksOnly, setRsvp } from '@/lib/data';
import type { RsvpError, RsvpResult } from '@/lib/rsvp';

// RSVP from any card or the event page (Step 14.3, DOCS.md §14.3), for the useRsvp hook. Runs on the server: the
// Django token never leaves the encrypted cookie. Never throws for an expected failure: it returns what the
// screen needs (the real count after success; an error kind, plus the real count when Django sent one).
export async function rsvpAction(eventId: string, going: boolean): Promise<RsvpResult> {
  if ((await getSessionState()).status !== 'signed-in') return { ok: false, error: 'signed-out' };

  // Dev without BACKEND_URL: nothing to save, the screen keeps its optimistic state (as before Step 14.3).
  if (mocksOnly()) return { ok: true, state: null };

  const token = await getBackendToken();
  if (!token) return { ok: false, error: 'signed-out' }; // e.g. a dev login while a backend is set

  try {
    return { ok: true, state: await setRsvp(eventId, going, token) };
  } catch (error) {
    if (error instanceof ApiError) {
      const kinds: Partial<Record<number, RsvpError>> = { 401: 'signed-out', 403: 'signed-out', 404: 'not-found', 409: 'full' };
      const body = error.body as { rsvps_count?: unknown } | null;
      const count = typeof body?.rsvps_count === 'number' ? body.rsvps_count : undefined;
      return { ok: false, error: kinds[error.status] ?? 'unavailable', rsvps_count: count };
    }
    if (error instanceof ApiUnavailable) {
      console.error(error);
      return { ok: false, error: 'unavailable' };
    }
    throw error;
  }
}
