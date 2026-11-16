import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { EventDetails } from '@/components/events/EventDetails';
import { EventPageShell } from '@/components/events/EventPageShell';
import { IconBase } from '@/components/ui/layout/navIcons';
import { getEventDateDetails } from '@/lib/calendar';
import { getClubById, getEventById } from '@/lib/events';
import { getMockAttendees, mockClubs, mockEvents } from '@/lib/mockData';

interface EventPageProps {
  params: Promise<{ id: string }>;
}

// One lookup per request, shared by generateMetadata and the page. Phase 7: fetch GET /api/events/:id here.
const loadEvent = cache((id: string) => getEventById(mockEvents, id));

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const event = loadEvent((await params).id);
  if (!event) return { title: 'Event not found | Campus Hub' };

  const description = event.description.length > 160 ? `${event.description.slice(0, 157)}…` : event.description;
  return {
    title: `${event.title} | Campus Hub`,
    description,
    // Link previews (WhatsApp, Slack…). The flyer image needs an absolute URL: add it with metadataBase in Phase 7.
    openGraph: { title: event.title, description, type: 'article' },
  };
}

// `/events/[id]` (Phase 4). Server Component: looks the event up, decides everything that depends on time or
// the campus time zone, renders the static content, and hands the RSVP state to <EventPageShell>.
export default async function EventPage({ params }: EventPageProps) {
  // Render per request: "has it ended?" uses the request time (same reason as `/`, DOCS.md §5.5).
  await connection();

  const event = loadEvent((await params).id);
  if (!event) notFound(); // → ./not-found.tsx, HTTP 404

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-400 dark:hover:text-slate-100"
      >
        {/* Points "back" in reading direction: flipped in RTL. */}
        <IconBase className="h-4 w-4 rtl:-scale-x-100">
          <path d="m15 18-6-6 6-6" />
        </IconBase>
        All events
      </Link>

      <EventPageShell
        initialEvent={event}
        hasEnded={Date.parse(event.end_time) <= Date.now()}
        attendees={getMockAttendees(event)}
      >
        <EventDetails
          event={event}
          club={getClubById(mockClubs, event.club_id)}
          dateDetails={getEventDateDetails(event)}
        />
      </EventPageShell>
    </div>
  );
}
