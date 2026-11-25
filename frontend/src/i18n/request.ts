import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, isLocale, matchLocale, type Locale } from './config';
import type { Messages } from './messages/en';

// next-intl's per-request setup (Step 12.1, DOCS.md §12.1), registered in next.config.ts. No locale in the
// URL: the language is the NEXT_LOCALE cookie, or the browser's language on a first visit. Every Server
// Component (getTranslations) and Client Component (useTranslations, via the provider in layout.tsx) reads it.

// Lazy imports: a request only loads its own language's file.
const MESSAGES: Record<Locale, () => Promise<{ default: Messages }>> = {
  en: () => import('./messages/en'),
  fr: () => import('./messages/fr'),
  ar: () => import('./messages/ar'),
};

export const getRequestLocale = async (): Promise<Locale> => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return matchLocale((await headers()).get('accept-language'));
};

export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  return {
    locale,
    messages: (await MESSAGES[locale]()).default,
    // Campus time (Morocco). Same zone on the server and in the browser, so dates never differ at hydration.
    timeZone: 'Africa/Casablanca',
  };
});
