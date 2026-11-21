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
