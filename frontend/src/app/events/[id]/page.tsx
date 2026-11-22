import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getSessionState } from '@/auth';
import { EventBackLink } from '@/components/events/EventBackLink';
import { EventDetails } from '@/components/events/EventDetails';
import { EventPageShell } from '@/components/events/EventPageShell';
import { getEventDateDetails, readCalendarLocation } from '@/lib/calendar';
import { getClubById, getEventById, forSignedOutVisitor } from '@/lib/events';
import { getMockAttendees, mockClubs, mockEvents } from '@/lib/mockData';
import { getRequestTime } from '@/lib/requestTime';

interface EventPageProps {
  params: Promise<{ id: string }>;
  // ?from=calendar&date=…&view=… when opened from the calendar's agenda (eventFromCalendarHref).
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// One lookup per request, shared by generateMetadata and the page. Phase 7: fetch GET /api/events/:id here.
const loadEvent = cache((id: string) => getEventById(mockEvents, id));

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const event = loadEvent((await params).id);
  if (!event) return { title: (await getTranslations('Meta'))('eventNotFound') };

  const description = event.description.length > 160 ? `${event.description.slice(0, 157)}…` : event.description;
  return {
    title: event.title, // + " | Campus Hub" from the root layout's title.template
    description,
    // Link previews (WhatsApp, Slack…). The flyer image needs an absolute URL: add it with metadataBase in Phase 7.
    openGraph: { title: event.title, description, type: 'article' },
  };
}

// `/events/[id]` (Phase 4). Server Component: looks the event up, decides everything that depends on time or
// the campus time zone, renders the static content, and hands the RSVP state to <EventPageShell>.
export default async function EventPage({ params, searchParams }: EventPageProps) {
  // Render per request: "has it ended?" uses the request time (same reason as `/`, DOCS.md §5.5).
  const now = await getRequestTime();

  const event = loadEvent((await params).id);
  if (!event) notFound(); // → ./not-found.tsx, HTTP 404

  // Back link: to the calendar day the visitor came from, else to the feed. Only date/view are read and
  // validated (readCalendarLocation), so the link can never point anywhere but /calendar or /.
  const query = await searchParams;
  const backToCalendar =
    query.from === 'calendar'
      ? readCalendarLocation((name) => {
          const value = query[name];
          return typeof value === 'string' ? value : null;
        })
      : undefined;

  // Signed-out visitors never receive attendee names or "you're going", not even in the page data
  // (DOCS.md §9.3, §9.4). Same cached session read as the root layout.
  const isSignedIn = (await getSessionState()).status === 'signed-in';

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <EventBackLink calendar={backToCalendar} className="mb-6" />

      <EventPageShell
        initialEvent={isSignedIn ? event : forSignedOutVisitor(event)}
        hasEnded={Date.parse(event.end_time) <= now}
        attendees={isSignedIn ? getMockAttendees(event) : []}
      >
        <EventDetails
          event={event}
          club={getClubById(mockClubs, event.club_id)}
          dateDetails={getEventDateDetails(event, await getLocale())}
        />
      </EventPageShell>
    </div>
  );
}
