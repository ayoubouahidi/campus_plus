import type { Club, EventItem } from '@/types/api';
import { CATEGORY_LABELS, getUpcomingEvents, normalizeText } from '@/lib/events';

// Search rules shared by the ⌘K palette and the /search page (Step 18.1, DOCS.md §18): how a query is split into
// terms, what text an event or a club is matched against, and how well a name matches. Pure (data and `now` are
// passed in), so the palette (browser) and the results page (server) can never disagree on what matches.

export interface SearchResults {
  events: EventItem[];
  clubs: Club[];
}

export const SEARCH_LIMIT = 5; // per group: the palette is for jumping somewhere, not browsing

// "  Leet  JAM " → ['leet', 'jam']: lower case, accents and Arabic vowel marks removed (normalizeText).
export const toTerms = (query: string): string[] => normalizeText(query).split(/\s+/).filter(Boolean);

// 0 = name starts with the query, 1 = name contains it, 2 = only other fields match. Lower ranks first.
// `query` is the normalized terms joined by one space (toTerms(...).join(' ')).
export const rankName = (name: string, query: string): number => {
  const normalizedName = normalizeText(name);
  if (normalizedName.startsWith(query)) return 0;
  return normalizedName.includes(query) ? 1 : 2;
};

// Every term must appear somewhere ("leet jam" narrows), as on the feed.
const matchesAll = (haystack: string, terms: string[]): boolean => {
  const normalized = normalizeText(haystack);
  return terms.every((term) => normalized.includes(term));
};

export type CategoryLabel = (category: EventItem['category']) => string;
const englishLabel: CategoryLabel = (category) => CATEGORY_LABELS[category];

// An event matches when every term appears in its title, club, place, description or category name (English
// and the visitor's language: "sports", "رياضة" and "musique" all work).
export const eventMatches = (event: EventItem, terms: string[], categoryLabel: CategoryLabel = englishLabel): boolean =>
  terms.length === 0 ||
  matchesAll(
    `${event.title} ${event.club_name} ${event.location} ${event.description} ${CATEGORY_LABELS[event.category]} ${categoryLabel(event.category)}`,
    terms
  );

// A club matches on its name, department and description.
export const clubMatches = (club: Club, terms: string[]): boolean =>
  terms.length === 0 || matchesAll(`${club.name} ${club.department_name} ${club.description}`, terms);

// Clubs for a query, best name match first, then alphabetical. [] for an empty query.
export const searchClubs = (rawQuery: string, clubs: Club[], limit: number): Club[] => {
  const terms = toTerms(rawQuery);
  if (terms.length === 0) return [];
  const query = terms.join(' ');
  return clubs
    .filter((club) => clubMatches(club, terms))
    .sort((a, b) => rankName(a.name, query) - rankName(b.name, query) || a.name.localeCompare(b.name))
    .slice(0, limit);
};

// `categoryLabel` = the category's name in the visitor's language (Categories messages): a query matches the
// English name ("sports") and the translated one ("رياضة") alike. Defaults to English only.
export const searchCampus = (
  rawQuery: string,
  data: { events: EventItem[]; clubs: Club[] },
  now: number,
  categoryLabel: CategoryLabel = englishLabel
): SearchResults => {
  const terms = toTerms(rawQuery);
  if (terms.length === 0) return { events: [], clubs: [] };
  const query = terms.join(' ');

  const events = data.events
    .filter((event) => eventMatches(event, terms, categoryLabel))
    .map((event) => ({ event, ended: Date.parse(event.end_time) <= now, rank: rankName(event.title, query) }))
    // Upcoming before past, then best match, then soonest.
    .sort(
      (a, b) =>
        Number(a.ended) - Number(b.ended) ||
        a.rank - b.rank ||
        Date.parse(a.event.start_time) - Date.parse(b.event.start_time)
    )
    .slice(0, SEARCH_LIMIT)
    .map(({ event }) => event);

  return { events, clubs: searchClubs(rawQuery, data.clubs, SEARCH_LIMIT) };
};

// Shown before the user types: the next few events, so the palette is useful from the first second.
export const getSearchSuggestions = (events: EventItem[], now: number): EventItem[] =>
  getUpcomingEvents(events, now).slice(0, 4);
