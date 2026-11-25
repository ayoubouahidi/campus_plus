'use client';

import React, { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EventGrid } from '@/components/events/EventGrid';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SearchIcon } from '@/components/ui/layout/navIcons';
import { useRsvp, type UpdateEvent } from '@/hooks/useRsvp';
import { useSyncedState } from '@/hooks/useSyncedState';
import {
  SEARCH_SORTS,
  SEARCH_WHENS,
  buildSearchHref,
  effectiveSort,
  isDefaultSearch,
  withFilter,
  type SearchPage,
  type SearchState,
} from '@/lib/advancedSearch';
import { EVENT_CATEGORIES } from '@/lib/events';
import type { EventSchedule } from '@/lib/time';
import type { EventItem } from '@/types/api';

// The interactive part of /search (Step 18.1, DOCS.md §18.1): the filter form and the results grid.
// The server page decided everything from the URL (which events, in which order, which page); this component
// only turns a change of filter into a new URL, and keeps RSVP on the cards working.
//
//  - Every control is a real field of a GET form (name="q", "category"…), so before JavaScript loads the
//    "Search" button still submits /search?q=…&category=… and the server answers.
//  - With JavaScript: a select applies at once, typing applies after a short pause (DEBOUNCE_MS), Enter at once.
//    Each change starts again at page 1 (withFilter) and keeps the scroll position.
//  - While the server prepares the new results (useTransition), the old ones stay visible but dimmed and
//    marked aria-busy, and "Updating results…" is announced.

export interface ClubOption {
  slug: string;
  name: string;
}

export interface SearchViewProps {
  state: SearchState; // parsed from the URL on the server
  result: SearchPage; // this page's events and the totals
  schedules: Record<string, EventSchedule>; // server-formatted dates for this page's events (DOCS.md §5.2)
  clubs: ClubOption[]; // for the club filter
  matchingClubs?: React.ReactNode; // clubs strip, rendered by the server page (page 1 with words only)
  pagination?: React.ReactNode; // <Pagination>, rendered by the server page (it takes a function prop)
}

const DEBOUNCE_MS = 400;

export const SearchView = ({ state, result, schedules, clubs, matchingClubs, pagination }: SearchViewProps) => {
  const t = useTranslations('SearchPage');
  const tCategory = useTranslations('Categories');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // The text field follows the URL (back/forward, "Clear all") but is edited locally while typing. It is only
  // overwritten when the URL's words really differ from the field's: after the debounced update the URL holds
  // the trimmed words, and resetting then would eat the space you just typed ("leet " → "leet").
  const [query, setQuery] = useState(state.q);
  const [syncedQuery, setSyncedQuery] = useState(state.q);
  if (state.q !== syncedQuery) {
    // React's "adjust state when a prop changes" pattern (no effect, no extra render pass on screen).
    setSyncedQuery(state.q);
    if (state.q !== query.trim()) setQuery(state.q);
  }
  // The cards' RSVP state follows the server's events, like the feed (Step 15.2).
  const [events, setEvents] = useSyncedState<EventItem[]>(result.events);

  const go = useCallback(
    (next: SearchState, mode: 'push' | 'replace' = 'push') => {
      const href = buildSearchHref(next);
      startTransition(() => {
        // replace while typing (one history entry per search, not per letter); push for deliberate choices.
        if (mode === 'push') router.push(href, { scroll: false });
        else router.replace(href, { scroll: false });
      });
    },
    [router]
  );

  // Typing: apply after a pause. Nothing to do when the field already matches the URL.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === state.q) return;
    const timer = setTimeout(() => go(withFilter(state, { q: trimmed }), 'replace'), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, state, go]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // with JavaScript: same URL as the native GET submit, without a full reload
    go(withFilter(state, { q: query.trim() }));
  };

  const handleRsvpToggle = useRsvp(
    useCallback<UpdateEvent>(
      (id, change) => setEvents((current) => current.map((item) => (item.id === id ? change(item) : item))),
      [setEvents]
    )
  );

  const sortIsByDate = state.sort === 'relevance' && effectiveSort(state) !== 'relevance';
  const clearLink = (
    <Link
      href="/search"
      className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-400 dark:hover:bg-violet-500/10"
    >
      {t('clearAll')}
    </Link>
  );

  return (
    <div className="space-y-8">
      {/* <search> landmark + a GET form: works without JavaScript, and screen readers list it as "search". */}
      <search aria-label={t('filters')} className="block rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <form action="/search" method="get" onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              name="q"
              type="search"
              label={t('query')}
              placeholder={t('placeholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={200}
              autoComplete="off"
              leftIcon={<SearchIcon className="h-4 w-4" />}
              className="w-full"
            />
            <Button type="submit" className="shrink-0">
              {t('submit')}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              name="category"
              label={t('category')}
              value={state.category}
              onChange={(event) => go(withFilter(state, { category: event.target.value as SearchState['category'] }))}
              options={[
                { value: 'all', label: t('allCategories') },
                ...EVENT_CATEGORIES.map((category) => ({ value: category, label: tCategory(category) })),
              ]}
            />
            <Select
              name="when"
              label={t('when')}
              value={state.when}
              onChange={(event) => go(withFilter(state, { when: event.target.value as SearchState['when'] }))}
              options={SEARCH_WHENS.map((when) => ({ value: when, label: t(`whenOptions.${when}`) }))}
            />
            <Select
              name="club"
              label={t('club')}
              value={state.club}
              onChange={(event) => go(withFilter(state, { club: event.target.value }))}
              options={[{ value: '', label: t('allClubs') }, ...clubs.map((club) => ({ value: club.slug, label: club.name }))]}
            />
            <Select
              name="sort"
              label={t('sort')}
              value={state.sort}
              onChange={(event) => go(withFilter(state, { sort: event.target.value as SearchState['sort'] }))}
              options={SEARCH_SORTS.map((sort) => ({ value: sort, label: t(`sortOptions.${sort}`) }))}
              helperText={sortIsByDate ? t('sortByDate') : undefined}
            />
          </div>

          {!isDefaultSearch(state) && <div className="flex justify-end">{clearLink}</div>}
        </form>
      </search>

      {/* Announced once the new results are on screen (and "Updating…" while they load). */}
      <p aria-live="polite" className="sr-only">
        {isPending ? t('updating') : null}
      </p>

      <div aria-busy={isPending} className={`space-y-8 transition-opacity ${isPending ? 'opacity-60' : ''}`}>
        {matchingClubs}

        <section aria-labelledby="search-events" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="search-events" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('events')}
            </h2>
            <p aria-live="polite" className="text-sm text-slate-500 dark:text-slate-400">
              {t('summary', { total: result.total, from: result.from, to: result.to })}
              {result.pageCount > 1 && (
                <span className="ms-2 text-slate-400">· {t('pageOf', { page: result.page, pageCount: result.pageCount })}</span>
              )}
            </p>
          </div>

          <EventGrid
            events={events}
            schedules={schedules}
            onRsvpToggle={handleRsvpToggle}
            cardHeadingLevel="h3"
            eagerFirstRow={false}
            emptyState={
              <EmptyState
                icon={<SearchIcon className="h-6 w-6" />}
                title={t('emptyTitle')}
                description={t('emptyBody')}
                action={isDefaultSearch(state) ? undefined : clearLink}
              />
            }
          />

          {pagination}
        </section>
      </div>
    </div>
  );
};
