import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ClubEvents } from '@/components/clubs/ClubEvents';
import { ClubHeader } from '@/components/clubs/ClubHeader';
import { IconBase } from '@/components/ui/layout/navIcons';
import { formatClubSince, getClubBySlug, getClubContact, getClubEvents } from '@/lib/clubs';
import { mockClubs, mockEvents } from '@/lib/mockData';
import { getEventSchedules } from '@/lib/time';

interface ClubPageProps {
  params: Promise<{ slug: string }>;
}

// One lookup per request, shared by generateMetadata and the page. Phase 7: GET /api/clubs/:slug here.
const loadClub = cache((slug: string) => getClubBySlug(mockClubs, slug));

// Mock auth: the session is always signed in (src/app/layout.tsx). Phase 5: read the real session here, on the
// server, so visitors never receive the president's contact details (DOCS.md §6.13).
const IS_SIGNED_IN = true;

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const club = loadClub((await params).slug);
  if (!club) return { title: 'Club not found | Campus Hub' };

  return {
    title: `${club.name} | Campus Hub`,
    description: club.description,
    openGraph: { title: club.name, description: club.description, type: 'profile' },
  };
}

// `/clubs/[slug]` (Phase 4). Server Component: looks the club up, splits its events at the request time,
// formats dates in campus time, decides whether to send contact details, then renders.
export default async function ClubPage({ params }: ClubPageProps) {
  // Render per request: upcoming vs past uses the request time (same reason as `/`, DOCS.md §5.5).
  await connection();

  const club = loadClub((await params).slug);
  if (!club) notFound(); // → ./not-found.tsx, HTTP 404

  // Phase 7: the club's events from the API instead of filtering mockEvents.
  const { upcoming, past } = getClubEvents(mockEvents, club.id, Date.now());

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link
        href="/clubs"
        className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-400 dark:hover:text-slate-100"
      >
        {/* Points "back" in reading direction: flipped in RTL. */}
        <IconBase className="h-4 w-4 rtl:-scale-x-100">
          <path d="m15 18-6-6 6-6" />
        </IconBase>
        All clubs
      </Link>

      <ClubHeader
        club={club}
        since={formatClubSince(club.created_at)}
        contact={IS_SIGNED_IN ? getClubContact(club) : null}
      />

      <ClubEvents
        className="mt-12"
        upcoming={upcoming}
        past={past}
        schedules={getEventSchedules([...upcoming, ...past])}
      />
    </div>
  );
}
