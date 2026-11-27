import { toEventItem } from '@/lib/api/mappers';
import type { RawEvent } from '@/lib/api/raw';
import type { EventItem } from '@/types/api';

// The realtime protocol (Step 15.1, DOCS.md §15.1; Ahmed's REALTIME_FRONTEND_HANDOFF.md on branch Ahmed).
// Pure: parsing and mapping only, shared by the provider and its tests on /test.

export const WS_COOKIE = 'ws_access';
export const WS_PATH = '/ws/calendar/';

// Close code Django uses for "no valid credential" (missing, invalid or expired JWT): get a new cookie first.
export const CLOSE_AUTH = 4401;

// Broadcasts can include the public RSVP total. The viewer's RSVP state and attendee preview are
// neutral placeholders. Event pages refresh from the API for the latest count and their own state.
export type LiveMessage =
  | { type: 'created' | 'updated'; event: EventItem; rsvpUnknown: true }
  | { type: 'deleted'; id: string };

type RawMessage =
  | { type: 'connection_established'; message?: string }
  | { type: 'event_created' | 'event_updated'; data: RawEvent }
  | { type: 'event_deleted'; data: { id: number } };

// null for the handshake acknowledgment and for anything unknown (ignored, logged by the caller).
export const parseLiveMessage = (text: string): LiveMessage | 'established' | null => {
  let raw: RawMessage;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  switch (raw?.type) {
    case 'connection_established':
      return 'established';
    case 'event_created':
    case 'event_updated':
      return { type: raw.type === 'event_created' ? 'created' : 'updated', event: toEventItem(raw.data), rsvpUnknown: true };
    case 'event_deleted':
      return { type: 'deleted', id: String(raw.data.id) };
    default:
      return null;
  }
};

// Keeps what a broadcast doesn't know (RSVP state, attendee previews) from the copy we already have.
export const mergeLiveEvent = (current: EventItem | undefined, incoming: EventItem): EventItem =>
  current
    ? {
        ...incoming,
        rsvps_count: current.rsvps_count,
        has_user_rsvpd: current.has_user_rsvpd,
        attendees_preview: current.attendees_preview,
      }
    : incoming;

// Wait before reconnect attempt n (0, 1, 2…): 1 s, 2 s, 4 s … capped at 30 s, ±30 % jitter so a server restart
// doesn't see every browser come back in the same second.
export const reconnectDelay = (attempt: number): number => {
  const base = Math.min(30_000, 1_000 * 2 ** attempt);
  return Math.round(base * (0.7 + Math.random() * 0.6));
};
