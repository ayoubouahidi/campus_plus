'use client';

import { useEffect } from 'react';
import { useSession } from '@/components/providers/SessionProvider';
import { mockCurrentUser } from '@/lib/mockData';
import type { SessionState } from '@/types/session';

// TEST ONLY: flips the mock session (also changes the navbar). Phase 5 replaces the mock session entirely.
const SESSIONS: { label: string; value: SessionState }[] = [
  { label: 'Signed in', value: { status: 'signed-in', user: mockCurrentUser } },
  { label: 'Signed out', value: { status: 'signed-out' } },
  { label: 'Loading', value: { status: 'loading' } },
];

export const SessionSwitcher = () => {
  const { session, setSession } = useSession();

  // The session lives in the root layout and survives client-side navigation. Without this, picking
  // "Loading" here and then following a link left the whole app stuck loading (RSVP spinner forever).
  // Leaving /test restores the app's default mock session (signed in, as in src/app/layout.tsx).
  useEffect(() => () => setSession(SESSIONS[0].value), [setSession]);
  return (
    <div role="group" aria-label="Session" className="mt-3 flex flex-wrap items-center gap-2">
      <span>Session:</span>
      {SESSIONS.map(({ label, value }) => (
        <button
          key={label}
          type="button"
          aria-pressed={session.status === value.status}
          onClick={() => setSession(value)}
          className="rounded-full border border-amber-400 px-3 py-1 font-medium aria-pressed:bg-amber-400 aria-pressed:text-amber-950 dark:border-amber-500/50"
        >
          {label}
        </button>
      ))}
    </div>
  );
};
