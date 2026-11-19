import type { DefaultSession } from 'next-auth';
import type { UserRole } from '@/types/api';

// Auth.js type extensions (Step 5.2). What we add to the session and to the encrypted session cookie (JWT).
declare module 'next-auth' {
  interface Session {
    // Deliberately NO backendToken here: the session is also readable from the browser (/api/auth/session),
    // so the Django token stays in the encrypted cookie and is read on the server only (DOCS.md §7.5).
    user: {
      id: string;
      role: UserRole;
      login: string | null; // 42 login (e.g. "mnajjar"); null for the dev login
    } & DefaultSession['user']; // name, email, image
  }

  // What signIn() leaves on `user` for the jwt callback (set in the signIn callback).
  interface User {
    backendToken?: string;
    backendUserId?: string;
    role?: UserRole;
    login?: string | null;
  }
}

// The encrypted cookie (JWT) carries backendToken, userId, role, login (set in src/auth.ts jwt callback).
// Not declared here: in Auth.js v5 a `next-auth/jwt` extension doesn't reach the callbacks' `token`
// type, so src/auth.ts checks those fields at runtime instead.
