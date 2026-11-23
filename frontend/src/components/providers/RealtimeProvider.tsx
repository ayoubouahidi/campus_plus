'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/components/providers/SessionProvider';
import { openLiveSocket, type RealtimeStatus } from '@/lib/liveSocket';
import { WS_PATH, parseLiveMessage, type LiveMessage } from '@/lib/realtime';

export type { RealtimeStatus };

// `resync` = (re)connected: live messages missed while offline are gone for good (no replay in Django), so
// listeners reload their data from the API (Step 15.2) and apply messages on top from then on.
export type RealtimeSignal = LiveMessage | { type: 'resync' };
type Listener = (signal: RealtimeSignal) => void;

interface RealtimeContextValue {
  status: RealtimeStatus;
  subscribe: (listener: Listener) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({ status: 'off', subscribe: () => () => {} });

// One calendar WebSocket per tab for the signed-in student (Step 15.1, DOCS.md §15.1), on /ws/calendar/. The
// connection itself (cookie, 4401 renewal, backoff) is lib/liveSocket.ts, shared with the notification socket
// (Step 15.3). Signing out closes it (the effect's cleanup).
export const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useSession();
  const enabled = session.status === 'signed-in';
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    if (!enabled) return;
    const emit = (signal: RealtimeSignal) => listeners.current.forEach((listener) => listener(signal));
    return openLiveSocket({
      path: WS_PATH,
      onStatus: setStatus,
      onEstablished: () => emit({ type: 'resync' }),
      onMessage: (text) => {
        const parsed = parseLiveMessage(text);
        if (parsed && parsed !== 'established') emit(parsed);
        else console.warn('[realtime] ignored message', text);
      },
    });
  }, [enabled]);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(() => ({ status: enabled ? status : 'off', subscribe }), [enabled, status, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => useContext(RealtimeContext);

// Subscribe a component to live messages. The latest `listener` is always called (no stale closure), and the
// subscription lives as long as the component.
export const useLiveMessages = (listener: Listener) => {
  const { subscribe } = useRealtime();
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => subscribe((signal) => latest.current(signal)), [subscribe]);
};
