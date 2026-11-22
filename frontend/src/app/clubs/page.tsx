import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ClubDirectory } from '@/components/clubs/ClubDirectory';
import { getUpcomingEventCounts, sortClubsByName } from '@/lib/clubs';
import { mockClubs, mockEvents } from '@/lib/mockData';
import { getRequestTime } from '@/lib/requestTime';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Meta');
  return {
    title: t('clubs'),
    description: t('clubsDescription'),
  };
}

// `/clubs` (Phase 4). Server Component: sorts the clubs and counts upcoming events at request time,
// then hands plain data to the interactive <ClubDirectory> (campus filter).
export default async function ClubsPage() {
  // Render per request: "upcoming" counts use the request time (same reason as `/`, DOCS.md §5.5).
  const now = await getRequestTime();

  // Phase 7: GET /api/clubs (and the counts from the API) instead of mocks.
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <ClubDirectory
        clubs={sortClubsByName(mockClubs)}
        upcomingCounts={getUpcomingEventCounts(mockEvents, now)}
      />
    </div>
  );
}
