import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import NextAuth, { CredentialsSignin, type User as AuthUser } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import FortyTwoSchool from 'next-auth/providers/42-school';
import { confirmDevAccount, findDevAccount } from '@/lib/devAccounts';
import { mockCurrentUser } from '@/lib/mockData';
import { BACKEND_UNAVAILABLE_CODE, EMAIL_PATTERN, hasFieldErrors, validateEmailLogin } from '@/lib/login';
import { normalizeSignupCode } from '@/lib/register';
import { toSessionState } from '@/lib/session';
import type { SessionState } from '@/types/session';
import type { UserRole } from '@/types/api';

// Auth.js config (Step 5.2), adapted from Ayoub's dashboard (branch Ayoub, dashboard_campus/auth.ts) so both
// apps log in the same way: 42 Intra → Django POST /auth/sync → our session. Server only: never import this
// from a 'use client' file. Env: AUTH_SECRET, AUTH_42_SCHOOL_ID/SECRET, BACKEND_URL, BACKEND_INTERNAL_KEY,
// AUTH_DEV_LOGIN (DOCS.md §7.5). Providers: 42, email + password (§11.1), sign-up code (§28), dev login.

// The 42 /v2/me fields we send to Django (the full type is huge; we only need these).
type FortyTwoProfile = {
  id: number;
  login: string;
  email: string;
  first_name: string;
  last_name: string;
  image?: { link?: string | null };
  campus?: { name: string }[];
};

// Django sends a numeric id (accounts.UserSerializer); the session stores it as a string (Step 14.1).
// avatar_url is Django's picture: a photo uploaded on either site is kept over the 42 one (DOCS.md §32).
type BackendSyncResponse = { token: string; user: { id: number | string; role: UserRole; avatar_url?: string | null } };

const ROLES: readonly UserRole[] = ['STUDENT', 'BOARD_MEMBER', 'SUPERADMIN'];
const isRole = (value: unknown): value is UserRole => ROLES.includes(value as UserRole);

// "Dev login": a button on /auth/login that signs you in as the mock student without 42, so the team can
// work on signed-in pages before the 42 keys and /auth/sync exist. Off unless AUTH_DEV_LOGIN=true, and
// never in a production build. The container runs `next dev` even in `make up`, so the flag is the real guard.
export const DEV_LOGIN_ENABLED =
  process.env.AUTH_DEV_LOGIN === 'true' && process.env.NODE_ENV !== 'production';

// Ask Django to create/update the user and give us its own token (TEAM_NEEDS §1b.1, owner Ayoub).
// null = refuse the login (→ /auth/login?error=AccessDenied).
async function syncWithBackend(profile: FortyTwoProfile): Promise<BackendSyncResponse | null> {
  // Same dev fallback as Ayoub's: without BACKEND_URL, skip Django and log in as a STUDENT (dev only).
  if (!process.env.BACKEND_URL) {
    if (process.env.NODE_ENV !== 'production') {
      return { token: 'dev-token', user: { id: `42-${profile.id}`, role: 'STUDENT' } };
    }
    return null;
  }

  try {
    const res = await fetch(`${process.env.BACKEND_URL}/auth/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.BACKEND_INTERNAL_KEY ?? '',
      },
      body: JSON.stringify({
        fortyTwoId: profile.id,
        login: profile.login,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        imageUrl: profile.image?.link ?? null,
        campus: profile.campus?.[0]?.name ?? null,
      }),
      cache: 'no-store',
    });
    if (!res.ok) return null; // e.g. 403 = not a 1337 account
    const data = (await res.json()) as BackendSyncResponse;
    return data?.token && data.user?.id && isRole(data.user.role) ? data : null;
  } catch {
    return null; // Django down: refuse rather than log in without a backend account
  }
}

// Email + password login (Step 11.1, DOCS.md §11.1): Django POST /api/auth/login/ (Ayoub, accounts app)
// checks the hashed password and answers { token, user } or 401. Django is the only place passwords live.
type BackendLoginResponse = {
  token: string;
  user: { id: number | string; email: string; full_name: string; avatar_url: string | null; campus: string | null; role: string };
};

// Django unreachable or answering nonsense: a CredentialsSignin with its own code, so the login form can say
// "try again later" instead of "wrong password". The code ends up in a URL: it must not hint at anything secret.
class BackendUnavailable extends CredentialsSignin {
  code = BACKEND_UNAVAILABLE_CODE;
}

// Dev fallback, like syncWithBackend's: without BACKEND_URL (and never in production) the mock student logs in
// with the password below, and so does any account created on the sign-up form (lib/devAccounts.ts), so the
// forms can be tried before Django has the endpoints. Same value as the mock student's in devAccounts.ts.
export const DEV_EMAIL_PASSWORD = 'campushub-dev';

// null = wrong email or password (→ CredentialsSignin). Throws BackendUnavailable when Django can't answer.
async function loginWithBackend(email: string, password: string): Promise<AuthUser | null> {
  if (!process.env.BACKEND_URL) {
    if (process.env.NODE_ENV === 'production') throw new BackendUnavailable();
    // Dev fallback: the mock student (DEV_EMAIL_PASSWORD) and any account made on the sign-up form (devAccounts).
    const account = findDevAccount(email);
    if (!account || account.password !== password) return null;
    return {
      id: account.id,
      name: account.full_name,
      email: account.email,
      image: null,
      role: 'STUDENT',
      login: null,
      campus: null,
      backendToken: 'dev-token',
      backendUserId: account.id,
    };
  }

  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    throw new BackendUnavailable(); // network error, Django down
  }
  // 400 = Django's own validation refused the fields (we validate first, so rare): same answer as 401.
  if (res.status === 401 || res.status === 400) return null;
  if (!res.ok) throw new BackendUnavailable();

  const data = (await res.json().catch(() => null)) as BackendLoginResponse | null;
  if (!data?.token || data.user?.id === undefined || !isRole(data.user.role)) throw new BackendUnavailable();
  return {
    id: String(data.user.id),
    name: data.user.full_name,
    email: data.user.email,
    image: data.user.avatar_url,
    role: data.user.role,
    login: null, // email accounts have no 42 login (Django's username is a random user_… id)
    campus: data.user.campus,
    backendToken: data.token,
    backendUserId: String(data.user.id),
  };
}

// Sign-up code (Step 28, DOCS.md §28): Django keeps the sign-up pending until the emailed code is confirmed.
// POST /api/signup/verify/ { email, code } → 201 { token, member } (the account now exists), or 400 (wrong code,
// expired, 5 wrong tries, or no pending sign-up: one answer for all, on purpose). The token then reads /api/me/,
// the same user shape as the email login. null = wrong code (→ CredentialsSignin).
async function confirmSignupWithBackend(email: string, code: string): Promise<AuthUser | null> {
  if (!process.env.BACKEND_URL) {
    if (process.env.NODE_ENV === 'production') throw new BackendUnavailable();
    const account = confirmDevAccount(email, code); // dev fallback: the code is DEV_SIGNUP_CODE
    if (!account) return null;
    return {
      id: account.id,
      name: account.full_name,
      email: account.email,
      image: null,
      role: 'STUDENT',
      login: null,
      campus: null,
      backendToken: 'dev-token',
      backendUserId: account.id,
    };
  }

  const base = process.env.BACKEND_URL;
  let token: string | undefined;
  try {
    const res = await fetch(`${base}/api/signup/verify/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, code }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 400) return null;
    if (!res.ok) throw new BackendUnavailable();
    token = ((await res.json().catch(() => null)) as { token?: unknown } | null)?.token as string | undefined;
  } catch (error) {
    if (error instanceof BackendUnavailable) throw error;
    throw new BackendUnavailable(); // network error, timeout
  }
  if (typeof token !== 'string' || !token) throw new BackendUnavailable();

  let me: BackendLoginResponse['user'] | null = null;
  try {
    const res = await fetch(`${base}/api/me/`, {
      headers: { Accept: 'application/json', Authorization: `Token ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) me = (await res.json().catch(() => null)) as BackendLoginResponse['user'] | null;
  } catch {
    me = null;
  }
  // The account exists now; only reading it failed. The sign-up action then sends the student to the login page.
  if (!me || me.id === undefined || !isRole(me.role)) throw new BackendUnavailable();
  return {
    id: String(me.id),
    name: me.full_name,
    email: me.email,
    image: me.avatar_url,
    role: me.role,
    login: null,
    campus: me.campus,
    backendToken: token,
    backendUserId: String(me.id),
  };
}

const providers: Provider[] = [
  FortyTwoSchool,
  Credentials({
    id: 'email',
    name: 'Email',
    credentials: { email: {}, password: {} },
    // The server action already validated; check again here because this endpoint can be posted to directly.
    authorize: async (credentials) => {
      const email = typeof credentials.email === 'string' ? credentials.email.trim() : '';
      const password = typeof credentials.password === 'string' ? credentials.password : '';
      if (hasFieldErrors(validateEmailLogin(email, password))) return null;
      return loginWithBackend(email, password);
    },
  }),
  Credentials({
    id: 'signup-code',
    name: 'Sign-up code',
    credentials: { email: {}, code: {} },
    // Posted by the sign-up page's code step (app/auth/register/actions.ts); checked again here because this
    // endpoint can be posted to directly. Django limits the tries (5 per code).
    authorize: async (credentials) => {
      const email = typeof credentials.email === 'string' ? credentials.email.trim() : '';
      const code = normalizeSignupCode(typeof credentials.code === 'string' ? credentials.code : '');
      if (!EMAIL_PATTERN.test(email) || !code) return null;
      return confirmSignupWithBackend(email, code);
    },
  }),
];

if (DEV_LOGIN_ENABLED) {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Dev login',
      credentials: {},
      // No password: the flag above is the gate. Returns the mock user the rest of the app already uses.
      authorize: () => ({
        id: mockCurrentUser.id,
        name: mockCurrentUser.full_name,
        email: mockCurrentUser.email,
        image: mockCurrentUser.avatar_url,
        role: 'STUDENT',
        login: null,
        campus: 'Benguerir',
        backendToken: 'dev-token',
        backendUserId: mockCurrentUser.id,
      }),
    })
  );
}

// After a profile change (a new photo, Step 26), the cookie still holds the picture from login time, and the
// navbar reads the cookie. `updateSession()` re-runs the jwt callback with trigger 'update', which asks Django.
// What the caller passes is ignored on purpose: Auth.js also accepts POST /api/auth/session from the browser,
// so the cookie must only ever take values Django confirms (otherwise a student could put any URL there).
const refreshFromBackend = async (backendToken: unknown): Promise<{ name: string; picture: string | null } | null> => {
  const base = process.env.BACKEND_URL;
  if (!base || typeof backendToken !== 'string' || !backendToken || backendToken === 'dev-token') return null;
  try {
    const res = await fetch(`${base}/api/me/`, {
      headers: { Accept: 'application/json', Authorization: `Token ${backendToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const me = (await res.json()) as { full_name?: unknown; avatar_url?: unknown };
    if (typeof me.full_name !== 'string') return null;
    return { name: me.full_name, picture: typeof me.avatar_url === 'string' && me.avatar_url ? me.avatar_url : null };
  } catch {
    return null; // Django down: keep the cookie as it is
  }
};

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  providers,
  session: { strategy: 'jwt' }, // encrypted cookie, no database on the Next.js side
  // Our page handles both sign-in and errors (?error=AccessDenied | Configuration | …, see lib/login.ts)
  pages: { signIn: '/auth/login', error: '/auth/login' },
  callbacks: {
    // Runs once, right after 42 (or the dev login) approves the user. false → /auth/login?error=AccessDenied
    async signIn({ user, account, profile }) {
      if (account?.provider === 'dev') return DEV_LOGIN_ENABLED;
      // authorize() already asked Django and filled `user`
      if (account?.provider === 'email' || account?.provider === 'signup-code') return true;
      if (account?.provider !== '42-school' || !profile) return false;

      const fortyTwo = profile as unknown as FortyTwoProfile;
      const data = await syncWithBackend(fortyTwo);
      if (!data) return false;

      // Handed to the jwt callback below (same request)
      user.backendToken = data.token;
      user.backendUserId = String(data.user.id); // was copied as a number, which the session callback dropped
      user.role = data.user.role;
      // Django's picture, not 42's: Auth.js fills user.image from the 42 profile, which would hide a photo
      // uploaded in the dashboard or on /profile (and shows initials when the 42 link is empty).
      user.image = data.user.avatar_url || fortyTwo.image?.link || null;
      user.login = fortyTwo.login;
      user.campus = fortyTwo.campus?.[0]?.name ?? null;
      return true;
    },

    // Builds the encrypted cookie. `user` is only there on the sign-in request; 'update' comes from updateSession().
    async jwt({ token, user, trigger }) {
      if (trigger === 'update') {
        const fresh = await refreshFromBackend(token.backendToken);
        if (fresh) {
          token.name = fresh.name;
          token.picture = fresh.picture;
        }
        return token;
      }
      if (user) {
        token.backendToken = user.backendToken;
        token.userId = user.backendUserId ?? user.id;
        token.role = user.role ?? 'STUDENT';
        token.picture = user.image ?? null; // set by signIn (42) or authorize (email): always Django's avatar_url
        token.login = user.login ?? null;
        token.campus = user.campus ?? null;
      }
      return token;
    },

    // What auth() and /api/auth/session return. No backendToken (see types/next-auth.d.ts).
    // The cookie's fields are typed `unknown` by Auth.js v5 (its next-auth/jwt type extension doesn't apply),
    // so each one is checked before use.
    session({ session, token }) {
      session.user.id = typeof token.userId === 'string' ? token.userId : '';
      session.user.role = isRole(token.role) ? token.role : 'STUDENT';
      session.user.login = typeof token.login === 'string' ? token.login : null;
      session.user.campus = typeof token.campus === 'string' ? token.campus : null;
      return session;
    },
  },
});

// The current visitor as the app's SessionState (Step 5.3), for the root layout and server pages.
// cache(): one cookie decode per request, shared by the layout and the page that both ask.
// Never throws: a broken config (e.g. missing AUTH_SECRET) shows the site signed out instead of an error page.
export const getSessionState = cache(async (): Promise<SessionState> => {
  try {
    return toSessionState(await auth());
  } catch (error) {
    // Let Next.js's own control-flow errors through (e.g. the "this page reads cookies, render it per request"
    // signal during the build). Swallowing them could cache a page as signed out for everyone.
    unstable_rethrow(error);
    console.error('[auth] could not read the session, treating the visitor as signed out', error);
    return { status: 'signed-out' };
  }
});
