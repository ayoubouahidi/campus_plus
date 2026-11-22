// Languages (Step 12.1, DOCS.md §12.1). Pure: no Next.js import, so the server config, the server action and
// client components can all read it. Adding a locale = a line in LOCALES + LOCALE_INFO + a messages file
// (the Record types and `satisfies Messages` fail the build until all three exist).

export const LOCALES = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export type Direction = 'ltr' | 'rtl';

export const DEFAULT_LOCALE: Locale = 'en';

// The student's choice, set by the language switcher (setLocale). NEXT_LOCALE = next-intl's usual name.
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, in seconds

// `name` is written in its own language (a French speaker looks for "Français", not "French"); `short` is the
// navbar code. `dir` drives <html dir>: everything that uses logical classes (ms-, ps-, text-start…) mirrors.
// `intl` is the tag given to Intl formatters (dates, times, lists; Step 12.3): Arabic uses Morocco's
// month names ("نونبر", not the Middle-East "نوفمبر"), which only the ar-MA data has.
export const LOCALE_INFO: Record<Locale, { name: string; short: string; dir: Direction; intl: string }> = {
  en: { name: 'English', short: 'EN', dir: 'ltr', intl: 'en' },
  fr: { name: 'Français', short: 'FR', dir: 'ltr', intl: 'fr' },
  ar: { name: 'العربية', short: 'ع', dir: 'rtl', intl: 'ar-MA' },
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

// The Intl tag for a locale (see `intl` above). Anything else is passed through unchanged.
export const intlLocale = (locale: string): string => (isLocale(locale) ? LOCALE_INFO[locale].intl : locale);

// First visit (no cookie): the browser's Accept-Language, e.g. "fr-FR,fr;q=0.9,en;q=0.8" → 'fr'. Only the
// language part counts (fr-CA, ar-MA → fr, ar). Entries are tried by q weight; nothing usable → English.
export const matchLocale = (acceptLanguage: string | null | undefined): Locale => {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { language: tag.split('-')[0].toLowerCase(), weight: q ? Number(q.slice(2)) : 1 };
    })
    .filter((entry) => entry.language && !Number.isNaN(entry.weight) && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  return ranked.map((entry) => entry.language).find(isLocale) ?? DEFAULT_LOCALE;
};
