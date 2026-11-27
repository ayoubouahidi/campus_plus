import type { EventCategory, EventItem } from '@/types/api';
import { EVENT_CATEGORIES, type CategoryFilter } from '@/lib/events';
import { eventMatches, rankName, toTerms, type CategoryLabel } from '@/lib/search';

// The /search page's rules (Step 18.1, DOCS.md §18): what the URL means, which events match, in which order,
// and which slice is on the current page. Pure (no fetch, no Next.js, `now` passed in), so the server page and
// any test give the same answer for the same URL.
//
// The URL is the single source of truth: /search?q=jam&category=Music&when=past&club=leet-music&sort=popular&page=2
// Every value is optional; a missing or invalid one falls back to its default, so a hand-edited or old link
// never breaks the page.

/* ---------------------------------- Types --------------------------------- */

export type SearchWhen = 'upcoming' | 'past' | 'all';
export type SearchSort = 'relevance' | 'soonest' | 'latest' | 'popular';

export interface SearchState {
  q: string; // the words typed, as typed (trimmed, at most 200 characters, Django's limit)
  category: CategoryFilter; // 'all' or one EventCategory
  when: SearchWhen; // upcoming (default) / past / any time
  club: string; // a club slug, '' = every club
  sort: SearchSort; // 'relevance' (default) needs words; without them it sorts by date (effectiveSort)
  page: number; // 1-based
}

export interface SearchPage {
  events: EventItem[]; // this page's events, in order
  total: number; // every matching event
  page: number; // the page shown (the requested one, kept between 1 and pageCount)
  pageCount: number; // at least 1, even with 0 results, so "page 1 of 1" stays true
  from: number; // 1-based position of the first event on the page (0 when total is 0)
  to: number; // position of the last one
  sort: SearchSort; // the order actually used (see effectiveSort)
}

/* -------------------------------- Constants ------------------------------- */

export const SEARCH_PAGE_SIZE = 12; // 4 rows of 3 cards on a desktop, 6 rows of 2 on a tablet
export const SEARCH_QUERY_MAX = 200; // same limit as Django's `search` parameter

export const SEARCH_WHENS: SearchWhen[] = ['upcoming', 'past', 'all'];
export const SEARCH_SORTS: SearchSort[] = ['relevance', 'soonest', 'latest', 'popular'];

export const DEFAULT_SEARCH: SearchState = { q: '', category: 'all', when: 'upcoming', club: '', sort: 'relevance', page: 1 };

/* ----------------------------- Reading the URL ---------------------------- */

type RawParams = Record<string, string | string[] | undefined>;

// ?a=1&a=2 arrives as ['1', '2'] (Next.js): the first value wins, like most sites.
const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? '';

const oneOf = <T extends string>(value: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

// Club slugs are Django slugs (letters, digits, - and _). Anything else is ignored rather than sent to Django.
const SLUG = /^[a-z0-9_-]{1,100}$/i;

export const parseSearchParams = (raw: RawParams): SearchState => {
  const pageNumber = Number.parseInt(first(raw.page), 10);
  return {
    q: first(raw.q).trim().slice(0, SEARCH_QUERY_MAX),
    category: oneOf<CategoryFilter>(first(raw.category), ['all', ...EVENT_CATEGORIES], 'all'),
    when: oneOf(first(raw.when), SEARCH_WHENS, DEFAULT_SEARCH.when),
    club: SLUG.test(first(raw.club)) ? first(raw.club) : '',
    sort: oneOf(first(raw.sort), SEARCH_SORTS, DEFAULT_SEARCH.sort),
    page: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
  };
};

/* ----------------------------- Writing the URL ---------------------------- */

// The link for a state. Defaults are left out, so the plain page is /search and links stay short and readable.
// Keys always come in the same order, so the same state always gives the same URL (back/forward, caching).
export const buildSearchHref = (state: SearchState): `/search${string}` => {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category !== DEFAULT_SEARCH.category) params.set('category', state.category);
  if (state.when !== DEFAULT_SEARCH.when) params.set('when', state.when);
  if (state.club) params.set('club', state.club);
  if (state.sort !== DEFAULT_SEARCH.sort) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  const query = params.toString();
  return query ? `/search?${query}` : '/search';
};

// A changed filter starts again at page 1: page 3 of the old results means nothing for the new ones.
export const withFilter = (state: SearchState, change: Partial<Omit<SearchState, 'page'>>): SearchState => ({
  ...state,
  ...change,
  page: 1,
});

// "Clear all" keeps nothing but the defaults.
export const isDefaultSearch = (state: SearchState): boolean =>
  buildSearchHref({ ...state, page: 1 }) === '/search';

/* --------------------------------- Sorting -------------------------------- */

// "Best match" only means something with words to match. Without them it would be an arbitrary order, so the
// page sorts by date instead: soonest first for upcoming / any time, most recent first for past events.
export const effectiveSort = (state: Pick<SearchState, 'q' | 'sort' | 'when'>): SearchSort => {
  if (state.sort !== 'relevance' || toTerms(state.q).length > 0) return state.sort;
  return state.when === 'past' ? 'latest' : 'soonest';
};

const start = (event: EventItem) => Date.parse(event.start_time);

// Ties always fall back to start time, then id, so the order is stable: the same URL gives the same pages, and
// an event never appears on two pages or on none.
const byStart = (a: EventItem, b: EventItem) => start(a) - start(b) || a.id.localeCompare(b.id, 'en', { numeric: true });

// Exhaustive: a new sort without a comparator is a compile error. `query` = normalized terms (relevance only).
const COMPARATORS: Record<SearchSort, (query: string, now: number) => (a: EventItem, b: EventItem) => number> = {
  // Title starts with the words, then contains them, then matches elsewhere; then upcoming before ended; then date.
  relevance: (query, now) => (a, b) =>
    rankName(a.title, query) - rankName(b.title, query) ||
    Number(Date.parse(a.end_time) <= now) - Number(Date.parse(b.end_time) <= now) ||
    byStart(a, b),
  soonest: () => byStart,
  latest: () => (a, b) => byStart(b, a),
  // Most RSVPs first (Django's public count); equal counts by date.
  popular: () => (a, b) => b.rsvps_count - a.rsvps_count || byStart(a, b),
};

/* --------------------------------- Running -------------------------------- */

// Ongoing events (started, not ended) count as upcoming: you can still go.
const WHEN_FILTERS: Record<SearchWhen, (event: EventItem, now: number) => boolean> = {
  upcoming: (event, now) => Date.parse(event.end_time) > now,
  past: (event, now) => Date.parse(event.end_time) <= now,
  all: () => true,
};

// The whole search on a list of events: filter → sort → slice. The caller may have filtered already (Django
// applies category, club and "upcoming"); filtering again is cheap and keeps the mocks and Django identical.
export interface RunOptions {
  categoryLabel?: CategoryLabel; // category names in the visitor's language, so "musique" matches
  clubId?: string; // the selected club's id: mock events carry only club_id (Django sends club_slug too)
  pageSize?: number;
}

export const runEventSearch = (
  events: EventItem[],
  state: SearchState,
  now: number,
  { categoryLabel, clubId, pageSize = SEARCH_PAGE_SIZE }: RunOptions = {}
): SearchPage => {
  const terms = toTerms(state.q);
  const sort = effectiveSort(state);
  const matching = events
    .filter(
      (event) =>
        (state.category === 'all' || event.category === (state.category as EventCategory)) &&
        (!state.club || event.club_slug === state.club || (clubId !== undefined && event.club_id === clubId)) &&
        WHEN_FILTERS[state.when](event, now) &&
        eventMatches(event, terms, categoryLabel)
    )
    .sort(COMPARATORS[sort](terms.join(' '), now));

  const total = matching.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Past the last page (an old link after events were deleted): show the last page rather than an empty one.
  const page = Math.min(state.page, pageCount);
  const offset = (page - 1) * pageSize;
  const events_ = matching.slice(offset, offset + pageSize);
  return {
    events: events_,
    total,
    page,
    pageCount,
    from: total === 0 ? 0 : offset + 1,
    to: offset + events_.length,
    sort,
  };
};

/* ------------------------------- Page numbers ------------------------------ */

export type PageItem = number | 'gap';

// The page numbers to show: always the first and last, the current one with one neighbour on each side, and a
// gap (…) where pages are skipped. A gap is only used when it hides at least 2 pages ("1 … 3" would hide one
// number behind a symbol that takes the same room, so 2 is shown instead).
//   page 1 of 3   → 1 2 3
//   page 5 of 10  → 1 … 4 5 6 … 10
//   page 2 of 10  → 1 2 3 … 10
//   page 3 of 7   → 1 2 3 4 … 7
export const getPageItems = (page: number, pageCount: number): PageItem[] => {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const kept = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const items: PageItem[] = [];
  kept.forEach((value, index) => {
    const previous = kept[index - 1];
    if (previous !== undefined && value - previous === 2) items.push(previous + 1);
    else if (previous !== undefined && value - previous > 2) items.push('gap');
    items.push(value);
  });
  return items;
};
