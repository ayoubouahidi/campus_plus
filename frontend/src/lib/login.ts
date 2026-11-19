// Pure login helpers (Phase 5). No Auth.js import here: the login page, the server action (Step 5.2) and
// the /profile guard all share these rules. Named login.ts so it can't be confused with src/auth.ts
// (the Auth.js config, Step 5.2).

// Where to go when ?next= is missing or unsafe.
export const DEFAULT_AFTER_LOGIN = '/';

const MAX_NEXT_LENGTH = 512;
// Any origin works: it only lets the URL parser resolve a relative path so we can check it stayed on it.
const PARSE_BASE = 'http://campus-hub.invalid';

// Turns the untrusted ?next= value into a same-site path, or DEFAULT_AFTER_LOGIN.
// Blocks open redirects: "//evil.com", "/\evil.com" (browsers read "\" as "/"), "https://evil.com",
// "javascript:…", control characters. Also refuses /auth/* so a login can't send you back to the login.
export const safeNextPath = (raw: string | string[] | undefined | null): string => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value.length > MAX_NEXT_LENGTH || !value.startsWith('/')) return DEFAULT_AFTER_LOGIN;
  if (/[\u0000-\u001f\u007f]/.test(value)) return DEFAULT_AFTER_LOGIN;

  let url: URL;
  try {
    url = new URL(value, PARSE_BASE);
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
  // "//evil.com" and "/\evil.com" parse to another host: the origin check catches both.
  if (url.origin !== PARSE_BASE) return DEFAULT_AFTER_LOGIN;
  if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) return DEFAULT_AFTER_LOGIN;

  return `${url.pathname}${url.search}${url.hash}`;
};

// Builds the login link a page sends signed-out visitors to (keeps them on that page after login).
export const loginHref = (next: string): `/auth/login?next=${string}` =>
  `/auth/login?next=${encodeURIComponent(safeNextPath(next))}`;

// Auth.js sends failed sign-ins back to the login page with ?error=<code>. Codes we treat specially:
//  - AccessDenied: our signIn callback refused (Django's /auth/sync said no, e.g. not a 1337/EMINES account).
//  - Configuration: server misconfigured (bad secret, 42 app keys, backend down). Not the student's fault.
// Everything else (OAuthCallbackError when the student cancels on 42, Verification, unknown) → generic.
export type LoginErrorKind = 'access-denied' | 'unavailable' | 'generic';

export const getLoginErrorKind = (code: string | string[] | undefined | null): LoginErrorKind | null => {
  const value = Array.isArray(code) ? code[0] : code;
  if (!value) return null;
  if (value === 'AccessDenied') return 'access-denied';
  if (value === 'Configuration') return 'unavailable';
  return 'generic';
};

export const LOGIN_ERROR_MESSAGES: Record<LoginErrorKind, { title: string; description: string }> = {
  'access-denied': {
    title: 'We couldn’t sign you in',
    description:
      'Your 42 account isn’t linked to a 1337 or EMINES campus we support. If you think this is a mistake, contact the Campus Hub team.',
  },
  unavailable: {
    title: 'Login is temporarily unavailable',
    description: 'Something is wrong on our side. Please try again in a few minutes.',
  },
  generic: {
    title: 'Sign-in didn’t finish',
    description: 'The 42 sign-in was cancelled or interrupted. Try again.',
  },
};
