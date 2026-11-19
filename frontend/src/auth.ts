import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import FortyTwoSchool from 'next-auth/providers/42-school';
import { mockCurrentUser } from '@/lib/mockData';
import { toSessionState } from '@/lib/session';
import type { SessionState } from '@/types/session';
import type { UserRole } from '@/types/api';

// Auth.js config (Step 5.2), adapted from Ayoub's dashboard (branch Ayoub, dashboard_campus/auth.ts) so both
// apps log in the same way: 42 Intra → Django POST /auth/sync → our session. Server only: never import this
// from a 'use client' file. Env: AUTH_SECRET, AUTH_42_SCHOOL_ID/SECRET, BACKEND_URL, BACKEND_INTERNAL_KEY,
// AUTH_DEV_LOGIN (DOCS.md §7.5).

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

type BackendSyncResponse = { token: string; user: { id: string; role: UserRole } };

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
    if (!res.ok) return null; // e.g. 403 = not a 1337/EMINES account
    const data = (await res.json()) as BackendSyncResponse;
    return data?.token && data.user?.id && isRole(data.user.role) ? data : null;
  } catch {
    return null; // Django down: refuse rather than log in without a backend account
  }
}

const providers: Provider[] = [FortyTwoSchool];

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: 'jwt' }, // encrypted cookie, no database on the Next.js side
  // Our page handles both sign-in and errors (?error=AccessDenied | Configuration | …, see lib/login.ts)
  pages: { signIn: '/auth/login', error: '/auth/login' },
  callbacks: {
    // Runs once, right after 42 (or the dev login) approves the user. false → /auth/login?error=AccessDenied
    async signIn({ user, account, profile }) {
      if (account?.provider === 'dev') return DEV_LOGIN_ENABLED;
      if (account?.provider !== '42-school' || !profile) return false;

      const fortyTwo = profile as unknown as FortyTwoProfile;
      const data = await syncWithBackend(fortyTwo);
      if (!data) return false;

      // Handed to the jwt callback below (same request)
      user.backendToken = data.token;
      user.backendUserId = data.user.id;
      user.role = data.user.role;
      user.login = fortyTwo.login;
      user.campus = fortyTwo.campus?.[0]?.name ?? null;
      return true;
    },

    // Builds the encrypted cookie. `user` is only there on the sign-in request.
    jwt({ token, user }) {
      if (user) {
        token.backendToken = user.backendToken;
        token.userId = user.backendUserId ?? user.id;
        token.role = user.role ?? 'STUDENT';
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
