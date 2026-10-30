'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import { SessionState } from '@/types/session';

interface SessionContextValue {
  session: SessionState;
  // Mock-only until Phase 5: lets the bench flip between states. Real auth replaces it with login/logout.
  setSession: (session: SessionState) => void;
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
  // Must be serializable: the root layout (a Server Component) passes it in.
  initialSession: SessionState;
  children: React.ReactNode;
}

// Phase 5 swaps the internals for the real auth client; consumers keep calling useSession().
export const SessionProvider = ({ initialSession, children }: SessionProviderProps) => {
  const [session, setSession] = useState<SessionState>(initialSession);
  const value = useMemo(() => ({ session, setSession }), [session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
