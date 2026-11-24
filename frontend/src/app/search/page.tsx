import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { getSessionState } from '@/auth';
import { SearchView } from '@/components/search/SearchView';
import { Avatar } from '@/components/ui/Avatar';
import { Pagination } from '@/components/ui/Pagination';
import { buildSearchHref, parseSearchParams, runEventSearch } from '@/lib/advancedSearch';
import { getBackendToken } from '@/lib/api/token';
import { listClubs, listEvents } from '@/lib/data';
import { eventsForVisitor } from '@/lib/events';
import { getRequestTime } from '@/lib/requestTime';
import { searchClubs } from '@/lib/search';
import { getEventSchedules } from '@/lib/time';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Meta');
  return { title: t('search'), description: t('searchDescription') };
}

const MATCHING_CLUBS = 4; // a short strip above the events: the club page is one click away

// `/search` (Step 18.1, DOCS.md §18): advanced event search with filters, sorting and pagination. Server
// Component: the URL decides everything (lib/advancedSearch.ts), so every result page has its own link, works
// without JavaScript, and renders the same for everyone with the same URL. SearchView only changes the URL.
//
// Who does what:
//  - Django filters what it can: category, club and "upcoming" (?category=&club=&upcoming=true), so fewer events
//    travel. Its order is fixed (start date) and other orders are refused (400), and its text search knows
//    neither our accent rules nor translated category names;
//  - this page then applies the words, the time filter, the sort and the page (runEventSearch), with the same
//    matching rules as the ⌘K palette (lib/search.ts).
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = parseSearchParams(await searchParams);
  const now = await getRequestTime();
  const locale = await getLocale();
  const t = await getTranslations('SearchPage');
  const tCategory = await getTranslations('Categories');
  const isSignedIn = (await getSessionState()).status === 'signed-in';

  // The club filter only accepts a club that exists: an unknown slug (old link, typo) means "all clubs" rather
  // than an error from Django or an empty page.
  const clubs = await listClubs();
  const club = clubs.find((item) => item.slug === parsed.club);
  const state = { ...parsed, club: club?.slug ?? '' };

  const events = await listEvents(
    {
      upcoming: state.when === 'upcoming',
      category: state.category === 'all' ? undefined : state.category,
      club: club?.slug,
    },
    await getBackendToken()
  );
  const result = runEventSearch(eventsForVisitor(events, isSignedIn), state, now, {
    categoryLabel: (category) => tCategory(category),
    clubId: club?.id,
  });

  // Clubs whose name or description matches the words: only on page 1, the events are what's being paged.
  const matchingClubs = state.q && result.page === 1 ? searchClubs(state.q, clubs, MATCHING_CLUBS) : [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('title')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('intro')}</p>
      </header>

      <SearchView
        state={state}
        result={result}
        schedules={getEventSchedules(result.events, locale)}
        clubs={clubs.map(({ slug, name }) => ({ slug, name }))}
        matchingClubs={
          matchingClubs.length > 0 && (
            <section aria-labelledby="search-clubs" className="space-y-3">
              <h2 id="search-clubs" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t('clubs')}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {matchingClubs.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/clubs/${item.slug}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white py-1 pe-3 ps-1 text-sm font-medium text-slate-700 transition-colors hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-violet-300"
                    >
                      <Avatar size="xs" src={item.logo_url || null} name={item.name} aria-hidden="true" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        }
        pagination={
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(page) => buildSearchHref({ ...state, page })}
            className="pt-2"
          />
        }
      />
    </div>
  );
}
