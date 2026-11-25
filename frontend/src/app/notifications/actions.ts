'use server';

import { getSessionState } from '@/auth';
import { ApiError, ApiUnavailable } from '@/lib/api/client';
import { getBackendToken } from '@/lib/api/token';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/data';
import type { NotificationFeed } from '@/types/notification';

// The bell's server side (Step 15.3, DOCS.md §15.3), for the useNotifications hook. Like rsvpAction: the Django
// token stays in the encrypted cookie, expected failures are returned (never thrown) so the bell can keep or roll
// back what it shows.

export type NotificationError = 'signed-out' | 'unavailable';
export type NotificationResult<T> = { ok: true; value: T } | { ok: false; error: NotificationError };

async function withToken<T>(run: (token: string) => Promise<T>): Promise<NotificationResult<T>> {
  if ((await getSessionState()).status !== 'signed-in') return { ok: false, error: 'signed-out' };
  // A dev login with a backend set has no Django token ('dev-token'). Mocks need none.
  const token = (await getBackendToken()) ?? (process.env.BACKEND_URL ? null : 'mocks');
  if (!token) return { ok: false, error: 'signed-out' };
  try {
    return { ok: true, value: await run(token) };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return { ok: false, error: 'signed-out' };
    if (error instanceof ApiError || error instanceof ApiUnavailable) {
      console.error(error);
      return { ok: false, error: 'unavailable' };
    }
    throw error;
  }
}

export async function loadNotificationsAction(): Promise<NotificationResult<NotificationFeed>> {
  return withToken(listNotifications);
}

export async function markNotificationReadAction(id: string): Promise<NotificationResult<null>> {
  return withToken(async (token) => {
    await markNotificationRead(id, token);
    return null;
  });
}

export async function markAllNotificationsReadAction(): Promise<NotificationResult<null>> {
  return withToken(async (token) => {
    await markAllNotificationsRead(token);
    return null;
  });
}
