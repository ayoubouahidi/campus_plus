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

// Same for the sign-up page (Step 11.3): the student lands back on the page they came from after signing up.
export const registerHref = (next: string): `/auth/register?next=${string}` =>
  `/auth/register?next=${encodeURIComponent(safeNextPath(next))}`;

// Auth.js sends failed sign-ins back to the login page with ?error=<code>. Codes we treat specially:
//  - AccessDenied: our signIn callback refused (Django's /auth/sync said no, e.g. not a 1337 account).
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

// The words for each kind are the Auth.loginErrors.<kind>.title / description messages (Step 12.6).

/* ------------------------- Email + password login (Step 11.1) ------------------------- */

// A field's error (Step 12.6): a key of the Validation messages, translated by the form in the visitor's
// language, with the numbers it needs; or `text`, a message as the backend wrote it (Django's own words,
// shown as is). Plain data, so it crosses the server action → form boundary.
export type ValidationKey =
  | 'emailRequired'
  | 'emailInvalid'
  | 'emailTaken'
  | 'passwordRequired'
  | 'passwordChoose'
  | 'passwordTooShort'
  | 'passwordTooLong'
  | 'passwordAllDigits'
  | 'passwordTooSimilar'
  | 'passwordConfirmRequired'
  | 'passwordMismatch'
  | 'firstNameRequired'
  | 'lastNameRequired'
  | 'nameTooLong'
  | 'yearRequired'
  | 'phoneInvalid'
  | 'codeRequired'
  | 'codeInvalid';

export type FieldError = { key: ValidationKey; values?: { min?: number; max?: number; length?: number } } | { text: string };

// The form's fields, checked the same way in the browser (before posting) and in the server action
// (the browser check can be skipped). Messages say what to do, not what went wrong.
export interface EmailLoginFieldErrors {
  email?: FieldError;
  password?: FieldError;
}

// Loose on purpose: "something@something.tld". The real check is Django's (EmailField) and the login itself.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmailLogin = (email: string, password: string): EmailLoginFieldErrors => {
  const errors: EmailLoginFieldErrors = {};
  if (!email.trim()) errors.email = { key: 'emailRequired' };
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = { key: 'emailInvalid' };
  if (!password) errors.password = { key: 'passwordRequired' };
  return errors;
};

export const hasFieldErrors = (errors: EmailLoginFieldErrors): boolean => Object.keys(errors).length > 0;

// What the server action hands back to the form (useActionState). Success never comes back: it redirects.
//  - invalid: wrong email or password (one message for both, so the form doesn't reveal which emails exist);
//  - unavailable: Django didn't answer properly. Not the student's fault, so a different message.
export type EmailLoginError = 'invalid' | 'unavailable';

export interface EmailLoginState {
  error: EmailLoginError | null;
  fieldErrors: EmailLoginFieldErrors;
  email: string; // kept so the student doesn't retype it; the password is never sent back
}

export const EMAIL_LOGIN_INITIAL_STATE: EmailLoginState = { error: null, fieldErrors: {}, email: '' };

// Words: Auth.emailErrors.<error>.title / description (Step 12.6).

// CredentialsSignin `code` that src/auth.ts uses when Django can't be reached (vs. a wrong password).
export const BACKEND_UNAVAILABLE_CODE = 'backend_unavailable';
