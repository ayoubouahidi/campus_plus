import { Club, EventCategory, EventItem } from '@/types/api';

export type CategoryFilter = 'all' | EventCategory;

export interface EventFilters {
  category: CategoryFilter;
  query: string;
}

export const DEFAULT_EVENT_FILTERS: EventFilters = { category: 'all', query: '' };

// No campus filter: Campus Hub serves 1337 only (2026-11-22, EMINES and UM6P are not partners). The All / 1337 /
// EMINES toggle and its helpers were removed; see DOCS.md §13.

// Chip order in the category row.
export const EVENT_CATEGORIES: EventCategory[] = [
  'Tech',
  'Media',
  'Music',
  'Sports',
  'Business',
  'Gaming',
  'EventsOrganization',
];

// English labels, used by the ⌘K search so "sports" finds Sports events in every language (lib/search.ts).
// What the screen shows comes from the Categories messages instead (Steps 12.3–12.4).
export const CATEGORY_LABELS: Record<EventCategory, string> = {
  Tech: 'Tech',
  Media: 'Media',
  Music: 'Music',
  Sports: 'Sports',
  Business: 'Business',
  Gaming: 'Gaming',
  EventsOrganization: 'Events',
};

// Latin accents (é → e) and Arabic harakat, so "cinematic" finds "Cinématic" and Phase 7 search ignores vowel marks.
const COMBINING_MARKS = /[̀-ًͯ-ٰٟ]/g;

export const normalizeText = (text: string): string => text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();

// Every word must appear somewhere in the title, club or location: "leet jam" narrows, it doesn't widen.
const matchesTerms = (event: EventItem, terms: string[]): boolean => {
  if (terms.length === 0) return true;
  const haystack = normalizeText(`${event.title} ${event.club_name} ${event.location}`);
  return terms.every((term) => haystack.includes(term));
};

// Pure: keeps the input order and never mutates it.
export const filterEvents = (events: EventItem[], { category, query }: EventFilters): EventItem[] => {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);

  return events.filter(
    (event) =>
      (category === 'all' || event.category === category) &&
      matchesTerms(event, terms),
  );
};

// Events that haven't ended yet (ongoing ones stay listed), soonest first. `now` is passed in so the
// caller decides when time "moves", the same reason as formatRelativeTime.
export const getUpcomingEvents = (events: EventItem[], now: number): EventItem[] =>
  events
    .filter((event) => Date.parse(event.end_time) > now)
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));

// Optimistic RSVP: flips the flag and keeps the count in step, so the card updates on click.
// Phase 7 sends the request alongside and rolls back with the previous object if it fails.
// Splits events at `now`: upcoming (not yet ended, soonest first) and past (most recent first).
// Server side: it depends on the request time. Used by club pages and /profile.
export const splitEventsByTime = (events: EventItem[], now: number): { upcoming: EventItem[]; past: EventItem[] } => {
  const byStart = (a: EventItem, b: EventItem) => Date.parse(a.start_time) - Date.parse(b.start_time);
  return {
    upcoming: events.filter((event) => Date.parse(event.end_time) > now).sort(byStart),
    past: events.filter((event) => Date.parse(event.end_time) <= now).sort((a, b) => byStart(b, a)),
  };
};

// The events the signed-in student RSVP'd to, split at `now` (/profile). Phase 7: GET /api/me/rsvps/ instead.
export const getMyEvents = (events: EventItem[], now: number) =>
  splitEventsByTime(events.filter((event) => event.has_user_rsvpd), now);

export const toggleRsvp = (event: EventItem): EventItem => ({
  ...event,
  has_user_rsvpd: !event.has_user_rsvpd,
  rsvps_count: Math.max(0, event.rsvps_count + (event.has_user_rsvpd ? -1 : 1)),
});

// Lookups for /events/[id]. Phase 7 replaces them with GET /api/events/:id (and the club embedded or fetched).
export const getEventById = (events: EventItem[], id: string): EventItem | undefined =>
  events.find((event) => event.id === id);

export const getClubById = (clubs: Club[], id: string): Club | undefined => clubs.find((club) => club.id === id);

// What a signed-out visitor may receive about an event (DOCS.md §9.3, §9.4). Server pages run this before
// handing events to the browser, so the data itself is safe, not only the screen:
//  - attendee names are for signed-in students only (Privacy Policy "Who can see it"): only rsvps_count;
//  - "you're going" means nothing without an account (mock data and cached responses can say true).
// Phase 7: the API already answers anonymous requests this way (TEAM_NEEDS §1.1); this stays as a second guard.
export const forSignedOutVisitor = (event: EventItem): EventItem =>
  event.attendees_preview.length === 0 && !event.has_user_rsvpd
    ? event
    : { ...event, attendees_preview: [], has_user_rsvpd: false };

export const eventsForVisitor = (events: EventItem[], isSignedIn: boolean): EventItem[] =>
  isSignedIn ? events : events.map(forSignedOutVisitor);
