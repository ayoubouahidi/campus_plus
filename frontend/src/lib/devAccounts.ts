// SERVER ONLY, DEV ONLY (Step 11.2, DOCS.md §11.2). Stand-in for Django's accounts while BACKEND_URL is
// empty on a developer machine: sign-up stores the account here, email login reads it back, so the whole
// flow (sign up → logged in, log out → log in again) can be tried without the backend. Kept in memory on
// globalThis (survives hot reload, gone when the container restarts). Never used in production: both
// callers check NODE_ENV first. Passwords here are plain text: test values only, never a real password.

import { mockCurrentUser } from '@/lib/mockData';

export interface DevAccount {
  id: string;
  email: string;
  password: string;
  full_name: string;
}

const store = globalThis as unknown as { __campusHubDevAccounts?: Map<string, DevAccount> };

const accounts = (): Map<string, DevAccount> => {
  // The mock student exists from the start (same account as the Dev login), so "email already taken" can be tried.
  store.__campusHubDevAccounts ??= new Map([
    [
      mockCurrentUser.email,
      { id: mockCurrentUser.id, email: mockCurrentUser.email, password: 'campushub-dev', full_name: mockCurrentUser.full_name },
    ],
  ]);
  return store.__campusHubDevAccounts;
};

export const findDevAccount = (email: string): DevAccount | undefined => accounts().get(email.trim().toLowerCase());

// false = the email is already used (like the unique check we asked Django for, TEAM_NEEDS §1.3).
export const addDevAccount = (account: Omit<DevAccount, 'id'>): boolean => {
  const key = account.email.trim().toLowerCase();
  if (accounts().has(key)) return false;
  accounts().set(key, { ...account, email: key, id: `usr_dev_${accounts().size + 1}` });
  return true;
};

// Step 28 (DOCS.md §28): the sign-up code, dev version. Django keeps the pending sign-up until the emailed code is
// typed; here the code is always DEV_SIGNUP_CODE (printed in `docker compose logs frontend`, like Django's console
// email backend) and the account is only created when it's confirmed.
export const DEV_SIGNUP_CODE = '123456';

const pendingStore = globalThis as unknown as { __campusHubDevPending?: Map<string, Omit<DevAccount, 'id'>> };
const pending = (): Map<string, Omit<DevAccount, 'id'>> => (pendingStore.__campusHubDevPending ??= new Map());

// false = the email already has an account.
export const addPendingDevAccount = (account: Omit<DevAccount, 'id'>): boolean => {
  const key = account.email.trim().toLowerCase();
  if (accounts().has(key)) return false;
  pending().set(key, { ...account, email: key });
  console.info(`[dev] sign-up code for ${key}: ${DEV_SIGNUP_CODE}`);
  return true;
};

// The right code for a pending sign-up → the new account (and the pending one is gone). Anything else → null.
export const confirmDevAccount = (email: string, code: string): DevAccount | null => {
  const key = email.trim().toLowerCase();
  const waiting = pending().get(key);
  if (!waiting || code !== DEV_SIGNUP_CODE) return null;
  pending().delete(key);
  if (!addDevAccount(waiting)) return null;
  return findDevAccount(key) ?? null;
};

export const hasPendingDevAccount = (email: string): boolean => pending().has(email.trim().toLowerCase());
