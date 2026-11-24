'use client';

import { connectRealtime, type RealtimeAccess } from '@/app/realtime/actions';
import { CLOSE_AUTH, reconnectDelay } from '@/lib/realtime';

// One live connection to Django (Steps 15.1 and 15.3, DOCS.md §15.1 and §15.3), used for /ws/calendar/
// (RealtimeProvider) and /ws/notifications/ (useNotifications). Both share the httpOnly ws_access cookie (path
// /ws/) and the same lifecycle, from Ahmed's REALTIME_FRONTEND_HANDOFF.md:
//  1. get the cookie (connectRealtime server action), open the socket;
//  2. "live" only after Django's connection_established message → onEstablished (reload the data);
//  3. close 4401 = credential missing or expired (every 5 min): new cookie, reconnect at once;
//     any other close = network or server: retry after 1 s, 2 s, 4 s… (max 30 s, with jitter);
//  4. stop() closes the socket for good (sign-out, unmount).

// 'off': signed out, or no Django (dev mocks). 'connecting': first attempt. 'live': Django acknowledged the
// subscription. 'reconnecting': lost, retrying. 'unavailable': couldn't get a credential, retrying slowly.
export type RealtimeStatus = 'off' | 'connecting' | 'live' | 'reconnecting' | 'unavailable';

// One credential request at a time for the tab: both sockets start together and expire together, and they share
// one cookie, so the second caller reuses the first call's answer instead of asking Django twice.
let pendingAccess: Promise<RealtimeAccess> | null = null;
// A thrown call (network down, or a tab older than the server: "Server Action not found" after a deploy or a dev
// restart) counts as 'unavailable': the socket retries later instead of an unhandled rejection.
const getAccess = (): Promise<RealtimeAccess> => {
  pendingAccess ??= connectRealtime()
    .catch((): RealtimeAccess => ({ ok: false, reason: 'unavailable' }))
    .finally(() => {
      pendingAccess = null;
    });
  return pendingAccess;
};

const isEstablished = (text: string): boolean => {
  try {
    return JSON.parse(text)?.type === 'connection_established';
  } catch {
    return false;
  }
};

export interface LiveSocketOptions {
  path: string; // e.g. '/ws/calendar/', on the site's own host (nginx sends /ws/ to Django)
  onStatus: (status: RealtimeStatus) => void;
  onEstablished: () => void; // after every (re)connect: messages sent while offline are gone for good
  onMessage: (text: string) => void; // every message except the handshake acknowledgment
}

// Starts at once; returns stop().
export function openLiveSocket({ path, onStatus, onEstablished, onMessage }: LiveSocketOptions): () => void {
  let stopped = false;
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0; // failures in a row, for the backoff
  let lastAuthRefresh = 0;

  const retryLater = (next: RealtimeStatus) => {
    onStatus(next);
    timer = setTimeout(open, reconnectDelay(attempt));
    attempt += 1;
  };

  async function open() {
    const access = await getAccess();
    if (stopped) return;
    if (!access.ok) {
      if (access.reason === 'unavailable') retryLater('unavailable');
      else onStatus('off'); // signed out meanwhile, or no realtime on this server
      return;
    }

    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${path}`);
    socket = ws;
    ws.onmessage = (message) => {
      const text = String(message.data);
      if (isEstablished(text)) {
        attempt = 0;
        onStatus('live');
        onEstablished();
      } else {
        onMessage(text);
      }
    };
    ws.onclose = (event) => {
      if (socket === ws) socket = null;
      if (stopped) return;
      // Expired credential: refresh and reconnect at once, but not in a loop if Django keeps refusing it.
      if (event.code === CLOSE_AUTH && Date.now() - lastAuthRefresh > 10_000) {
        lastAuthRefresh = Date.now();
        onStatus('reconnecting');
        void open();
        return;
      }
      retryLater('reconnecting');
    };
  }

  onStatus('connecting');
  void open();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket?.close(1000);
  };
}
