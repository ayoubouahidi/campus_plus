import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { loadSearchData } from '@/app/search/actions';
import { getSearchSuggestions, searchCampus, type SearchResults } from '@/lib/search';
import type { Club, EventItem } from '@/types/api';

type SearchData = { events: EventItem[]; clubs: Club[] };

// One shared load for the whole tab, reused for a minute: reopening the palette is instant, and a new event
// published meanwhile shows up at the next open after that. A failed load is forgotten, so the next open
// retries instead of keeping an empty palette.
const FRESH_FOR_MS = 60_000;
let cached: { at: number; promise: Promise<SearchData> } | null = null;

const getSearchData = (): Promise<SearchData> => {
  if (!cached || Date.now() - cached.at > FRESH_FOR_MS) {
    const promise = loadSearchData();
    cached = { at: Date.now(), promise };
    promise.catch(() => {
      if (cached?.promise === promise) cached = null;
    });
  }
  return cached.promise;
};

const EMPTY: SearchData = { events: [], clubs: [] };

// The palette's data source (Step 14.4): events and clubs from Django (or the mocks in dev) through the
// loadSearchData server action, ranked here with lib/search.ts. Runs in the browser only (the palette mounts
// after it opens). "Now" for the ranking is when the data arrived (Step 20.1), not read during render.
// Categories also match in the active language (Step 12.3): "musique" finds Music events in French.
export const useCampusSearch = (
  query: string
): { results: SearchResults; suggestions: EventItem[]; status: 'loading' | 'ready' | 'error' } => {
  const tCategory = useTranslations('Categories');
  // `at`: when the data arrived. The ranking needs "now" (upcoming before past); it is read in the load callback,
  // never during render (a render must be pure: same input, same output).
  const [data, setData] = useState<(SearchData & { at: number }) | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getSearchData().then(
      (loaded) => active && setData({ ...loaded, at: Date.now() }),
      () => active && setFailed(true)
    );
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    const now = data?.at ?? 0;
    const source = data ?? EMPTY;
    return {
      results: searchCampus(query, source, now, (category) => tCategory(category)),
      suggestions: getSearchSuggestions(source.events, now),
      status: data ? 'ready' : failed ? 'error' : 'loading',
    };
  }, [query, tCategory, data, failed]);
};
