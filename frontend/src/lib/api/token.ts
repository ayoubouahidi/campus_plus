import { cache } from 'react';
import { headers } from 'next/headers';
import { getToken } from 'next-auth/jwt';

// The signed-in student's Django token, read from the encrypted Auth.js cookie (Step 14.1, DOCS.md §14).
// Server only. It is never put in the session object (types/next-auth.d.ts): /api/auth/session is readable
// from the browser, the cookie is not (httpOnly), so the token never reaches client JavaScript.
//
// The cookie is named "__Secure-authjs.session-token" over HTTPS (nginx) and "authjs.session-token" over plain
// HTTP (dev without nginx); both are tried. The dev logins store 'dev-token', which Django doesn't know: null.
// cache(): one cookie decode per request, shared by every data call on the page.
export const getBackendToken = cache(async (): Promise<string | null> => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const req = { headers: await headers() };
  for (const secureCookie of [true, false]) {
    const jwt = await getToken({ req, secret, secureCookie });
    const token = jwt?.backendToken;
    if (typeof token === 'string' && token && token !== 'dev-token') return token;
  }
  return null;
});
