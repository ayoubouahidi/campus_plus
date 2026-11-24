'use server';

import { cookies } from 'next/headers';
import { getSessionState } from '@/auth';
import { ApiError, apiFetch } from '@/lib/api/client';
import { getBackendToken } from '@/lib/api/token';
import { mocksOnly } from '@/lib/data';
import { WS_COOKIE } from '@/lib/realtime';

export type RealtimeAccess =
  | { ok: true; expiresIn: number }
  | { ok: false; reason: 'signed-out' | 'disabled' | 'unavailable' };

// Gives the browser a short-lived WebSocket credential (Step 15.1, DOCS.md §15.1). Django issues a SimpleJWT
// for the student's DRF token (POST /api/realtime/token/, 5 min); we store it as the httpOnly `ws_access`
// cookie, scoped to /ws/ and expiring with the token, so the browser sends it on the WebSocket handshake and no
// JavaScript ever reads it (REALTIME_FRONTEND_HANDOFF.md on branch Ahmed). Called again after every 4401 close.
export async function connectRealtime(): Promise<RealtimeAccess> {
  if ((await getSessionState()).status !== 'signed-in') return { ok: false, reason: 'signed-out' };
  if (mocksOnly()) return { ok: false, reason: 'disabled' }; // no Django: no live updates in dev
  const token = await getBackendToken();
  if (!token) return { ok: false, reason: 'signed-out' };

  try {
    const { access, expires_in } = await apiFetch<{ access: string; expires_in: number }>('/api/realtime/token/', {
      method: 'POST',
      token,
    });
    (await cookies()).set(WS_COOKIE, access, {
      path: '/ws/',
      httpOnly: true,
      secure: true, // the site runs over HTTPS (nginx); browsers also accept Secure on https://localhost
      sameSite: 'strict', // the WebSocket is same-site: never needed on requests from other sites
      maxAge: Math.max(1, expires_in - 5), // gone a little before Django's expiry, never after
    });
    return { ok: true, expiresIn: expires_in };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return { ok: false, reason: 'signed-out' };
    if (error instanceof ApiError && error.status === 503) return { ok: false, reason: 'disabled' }; // JWT mode off
    console.error('[realtime] could not get a WebSocket token', error);
    return { ok: false, reason: 'unavailable' };
  }
}

// Logout: the socket stays valid until its JWT expires (no revocation in Django today), but the cookie goes now.
export async function clearRealtimeCookie(): Promise<void> {
  (await cookies()).delete({ name: WS_COOKIE, path: '/ws/' });
}
