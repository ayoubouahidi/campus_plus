'use server';

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from './config';

// Language switcher (Step 12.1). Saves the choice in a cookie. Called as a Server Action, Next.js sends the
// re-rendered page back in the same round trip, so the new language (and <html dir>) shows without a reload.
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return; // anything else is ignored: the cookie only ever holds a known locale
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
}
