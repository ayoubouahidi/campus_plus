'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/components/providers/SessionProvider';
import { mockCurrentUser } from '@/lib/mockData';
import type { SessionState } from '@/types/session';

// TEST ONLY: shows the UI in another session state (also changes the navbar). It doesn't log in or out:
// "Real" goes back to the actual Auth.js session (Step 5.3).
const SESSIONS: { label: string; value: SessionState | null }[] = [
  { label: 'Real', value: null },
  { label: 'Signed in (mock)', value: { status: 'signed-in', user: mockCurrentUser } },
  { label: 'Signed out', value: { status: 'signed-out' } },
  { label: 'Loading', value: { status: 'loading' } },
];

export const SessionSwitcher = () => {
  const { setSession } = useSession();
  const [picked, setPicked] = useState('Real');

  // The override lives in the root layout and survives client-side navigation. Leaving /test drops it,
  // so the rest of the app shows the real session again (otherwise "Loading" stayed on everywhere).
  useEffect(() => () => setSession(null), [setSession]);

  return (
    <div role="group" aria-label="Session" className="mt-3 flex flex-wrap items-center gap-2">
      <span>UI session:</span>
      {SESSIONS.map(({ label, value }) => (
        <button
          key={label}
          type="button"
          aria-pressed={picked === label}
          onClick={() => {
            setPicked(label);
            setSession(value);
          }}
          className="rounded-full border border-amber-400 px-3 py-1 font-medium aria-pressed:bg-amber-400 aria-pressed:text-amber-950 dark:border-amber-500/50"
        >
          {label}
        </button>
      ))}
    </div>
  );
};
