import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { mockClubs, mockEvents } from '@/lib/mockData';
import { getSearchSuggestions, searchCampus, type SearchResults } from '@/lib/search';
import type { EventItem } from '@/types/api';

// The palette's only data source. Today: synchronous filtering of the mocks. Phase 7: debounce the query
// (useDebouncedValue) and fetch GET /api/search?q=…, keeping this return shape so the palette doesn't change.
// Runs in the browser only (the palette mounts after it opens), so Date.now() here never meets hydration.
// Categories also match in the active language (Step 12.3): "musique" finds Music events in French.
export const useCampusSearch = (query: string): { results: SearchResults; suggestions: EventItem[] } => {
  const tCategory = useTranslations('Categories');
  return useMemo(() => {
    const now = Date.now();
    return {
      results: searchCampus(query, { events: mockEvents, clubs: mockClubs }, now, (category) => tCategory(category)),
      suggestions: getSearchSuggestions(mockEvents, now),
    };
  }, [query, tCategory]);
};
