import type { EventItem } from '@/types/api';

// RSVP rules shared by the cards, the event page and the server action (Step 14.3, DOCS.md §14.3). Pure.

export type RsvpError = 'full' | 'signed-out' | 'not-found' | 'unavailable';

// What rsvpAction answers. `state: null` = nothing to correct (dev mocks): the screen keeps its own guess.
export type RsvpResult =
  | { ok: true; state: { rsvps_count: number; has_user_rsvpd: boolean } | null }
  | { ok: false; error: RsvpError; rsvps_count?: number };

export const isCancelled = (event: EventItem): boolean => event.status === 'cancelled';

// Full for someone who isn't going yet. Someone already going can still cancel.
export const isFull = (event: EventItem): boolean =>
  typeof event.capacity === 'number' && !event.has_user_rsvpd && event.rsvps_count >= event.capacity;

// Places left, or null without a limit.
export const spotsLeft = (event: EventItem): number | null =>
  typeof event.capacity === 'number' ? Math.max(0, event.capacity - event.rsvps_count) : null;
