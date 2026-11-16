import type { Club, EventItem } from '@/types/api';
import { CATEGORY_LABELS, getUpcomingEvents, normalizeText } from '@/lib/events';

// Search for the ⌘K palette: events and clubs. Pure (data and `now` are passed in), so the mock source today
// and the API in Phase 7 share the same ranking rules in tests.

export interface SearchResults {
  events: EventItem[];
  clubs: Club[];
}

export const SEARCH_LIMIT = 5; // per group: the palette is for jumping somewhere, not browsing

const toTerms = (query: string): string[] => normalizeText(query).split(/\s+/).filter(Boolean);

// 0 = name starts with the query, 1 = name contains it, 2 = only other fields match. Lower ranks first.
const rank = (name: string, query: string): number => {
  const normalizedName = normalizeText(name);
  if (normalizedName.startsWith(query)) return 0;
  return normalizedName.includes(query) ? 1 : 2;
};

// Every term must appear somewhere ("leet jam" narrows), as on the feed.
const matchesAll = (haystack: string, terms: string[]): boolean => {
  const normalized = normalizeText(haystack);
  return terms.every((term) => normalized.includes(term));
};

export const searchCampus = (
  rawQuery: string,
  data: { events: EventItem[]; clubs: Club[] },
  now: number
): SearchResults => {
  const terms = toTerms(rawQuery);
  if (terms.length === 0) return { events: [], clubs: [] };
  const query = terms.join(' ');

  const events = data.events
    .filter((event) =>
      matchesAll(`${event.title} ${event.club_name} ${event.location} ${CATEGORY_LABELS[event.category]}`, terms)
    )
    .map((event) => ({ event, ended: Date.parse(event.end_time) <= now, rank: rank(event.title, query) }))
    // Upcoming before past, then best match, then soonest.
    .sort(
      (a, b) =>
        Number(a.ended) - Number(b.ended) ||
        a.rank - b.rank ||
        Date.parse(a.event.start_time) - Date.parse(b.event.start_time)
    )
    .slice(0, SEARCH_LIMIT)
    .map(({ event }) => event);

  const clubs = data.clubs
    .filter((club) => matchesAll(`${club.name} ${club.department_name} ${club.description}`, terms))
    .sort((a, b) => rank(a.name, query) - rank(b.name, query) || a.name.localeCompare(b.name))
    .slice(0, SEARCH_LIMIT);

  return { events, clubs };
};

// Shown before the user types: the next few events, so the palette is useful from the first second.
export const getSearchSuggestions = (events: EventItem[], now: number): EventItem[] =>
  getUpcomingEvents(events, now).slice(0, 4);
