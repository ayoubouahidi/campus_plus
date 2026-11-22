'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { connectRealtime } from '@/app/realtime/actions';
import { useSession } from '@/components/providers/SessionProvider';
import { CLOSE_AUTH, WS_PATH, parseLiveMessage, reconnectDelay, type LiveMessage } from '@/lib/realtime';

// 'off': signed out, or no Django (dev mocks). 'connecting': first attempt. 'live': Django acknowledged the
// subscription. 'reconnecting': lost, retrying. 'unavailable': couldn't get a credential, retrying slowly.
export type RealtimeStatus = 'off' | 'connecting' | 'live' | 'reconnecting' | 'unavailable';

// `resync` = (re)connected: live messages missed while offline are gone for good (no replay in Django), so
// listeners reload their data from the API (Step 15.2) and apply messages on top from then on.
export type RealtimeSignal = LiveMessage | { type: 'resync' };
type Listener = (signal: RealtimeSignal) => void;

interface RealtimeContextValue {
  status: RealtimeStatus;
  subscribe: (listener: Listener) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({ status: 'off', subscribe: () => () => {} });

// One WebSocket per tab for the signed-in student (Step 15.1, DOCS.md §15.1), opened on /ws/calendar/ of the
// site's own host (nginx sends /ws/ to Django). Flow, from Ahmed's handoff:
//  1. connectRealtime() (server action) sets the httpOnly ws_access cookie (5 min JWT);
//  2. open the socket; "live" only after Django's connection_established message;
//  3. close 4401 = credential missing or expired (every 5 min): new cookie, reconnect at once;
//     any other close = network or server: retry after 1 s, 2 s, 4 s… (max 30 s, with jitter);
//  4. signing out closes the socket (the effect's cleanup).
export const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useSession();
  const enabled = session.status === 'signed-in';
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0; // failures in a row, for the backoff
    let lastAuthRefresh = 0;

    const emit = (signal: RealtimeSignal) => listeners.current.forEach((listener) => listener(signal));

    const retryLater = (next: RealtimeStatus) => {
      setStatus(next);
      timer = setTimeout(open, reconnectDelay(attempt));
      attempt += 1;
    };

    async function open() {
      const access = await connectRealtime();
      if (stopped) return;
      if (!access.ok) {
        if (access.reason === 'unavailable') retryLater('unavailable');
        else setStatus('off'); // signed out meanwhile, or no realtime on this server
        return;
      }

      const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${WS_PATH}`);
      socket = ws;
      ws.onmessage = (message) => {
        const parsed = parseLiveMessage(String(message.data));
        if (parsed === 'established') {
          attempt = 0;
          setStatus('live');
          emit({ type: 'resync' });
        } else if (parsed) {
          emit(parsed);
        } else {
          console.warn('[realtime] ignored message', message.data);
        }
      };
      ws.onclose = (event) => {
        if (socket === ws) socket = null;
        if (stopped) return;
        // Expired credential: refresh and reconnect at once, but not in a loop if Django keeps refusing it.
        if (event.code === CLOSE_AUTH && Date.now() - lastAuthRefresh > 10_000) {
          lastAuthRefresh = Date.now();
          setStatus('reconnecting');
          void open();
          return;
        }
        retryLater('reconnecting');
      };
    }

    void open();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close(1000);
    };
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
