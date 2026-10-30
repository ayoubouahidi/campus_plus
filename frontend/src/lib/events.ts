import { EventCategory, EventItem } from '@/types/api';

export type Campus = '1337' | 'emines';
export type CampusFilter = 'all' | Campus;
export type CategoryFilter = 'all' | EventCategory;

export interface EventFilters {
  campus: CampusFilter;
  category: CategoryFilter;
  query: string;
}

export const DEFAULT_EVENT_FILTERS: EventFilters = { campus: 'all', category: 'all', query: '' };

// Tab order in the feed toolbar.
export const CAMPUS_FILTERS: { value: CampusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '1337', label: '1337' },
  { value: 'emines', label: 'EMINES' },
];

// Events don't carry a department slug yet, so campus is matched on department_name.
// Phase 7: switch to a slug once the API sends one.
const CAMPUS_DEPARTMENT: Record<Campus, string> = {
  '1337': '1337 Coding School',
  emines: 'EMINES',
};

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

const normalizeText = (text: string): string => text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();

// Every word must appear somewhere in the title, club or location: "leet jam" narrows, it doesn't widen.
const matchesTerms = (event: EventItem, terms: string[]): boolean => {
  if (terms.length === 0) return true;
  const haystack = normalizeText(`${event.title} ${event.club_name} ${event.location}`);
  return terms.every((term) => haystack.includes(term));
};

// Pure: keeps the input order and never mutates it.
export const filterEvents = (events: EventItem[], { campus, category, query }: EventFilters): EventItem[] => {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);

  return events.filter(
    (event) =>
      (campus === 'all' || event.department_name === CAMPUS_DEPARTMENT[campus]) &&
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

// The hero needs an image, so it shows the soonest upcoming event that has a flyer.
export const getFeaturedEvent = (events: EventItem[], now: number): EventItem | null =>
  getUpcomingEvents(events, now).find((event) => event.flyer_url !== '') ?? null;

// Optimistic RSVP: flips the flag and keeps the count in step, so the card updates on click.
// Phase 7 sends the request alongside and rolls back with the previous object if it fails.
export const toggleRsvp = (event: EventItem): EventItem => ({
  ...event,
  has_user_rsvpd: !event.has_user_rsvpd,
  rsvps_count: Math.max(0, event.rsvps_count + (event.has_user_rsvpd ? -1 : 1)),
});
