'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import { SessionState } from '@/types/session';

interface SessionContextValue {
  session: SessionState;
  // TEST ONLY (/test SessionSwitcher): show the UI in another state. null = back to the real session.
  // Real login/logout go through Auth.js (src/auth.ts), never through this.
  setSession: (session: SessionState | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession() must be used within a <SessionProvider>. It is set up in the root layout.');
  }
  return context;
};

export interface SessionProviderProps {
  // The real session, read on the server by the root layout (getSessionState in src/auth.ts). Serializable.
  initialSession: SessionState;
  children: React.ReactNode;
}

// Hands the server-read session to client components (navbar, RSVP card, ...) through useSession().
// The prop is used directly, not copied into state: after a login or logout in a server action, Next.js
// re-renders the layout with the new session and this prop changes. useState(initialSession) would keep
// showing the old one. The optional override exists only for the /test session switcher.
export const SessionProvider = ({ initialSession, children }: SessionProviderProps) => {
  const [override, setOverride] = useState<SessionState | null>(null);
  const session = override ?? initialSession;
  const value = useMemo(() => ({ session, setSession: setOverride }), [session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
