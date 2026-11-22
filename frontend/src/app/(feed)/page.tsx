import { getLocale } from 'next-intl/server';
import { getSessionState } from '@/auth';
import { EventFeed } from '@/components/events/EventFeed';
import { eventsForVisitor, getUpcomingEvents } from '@/lib/events';
import { getBackendToken } from '@/lib/api/token';
import { listEvents } from '@/lib/data';
import { getEventSchedules } from '@/lib/time';
import { getRequestTime } from '@/lib/requestTime';

// `/`: the public event feed (Phase 3). Server Component: it decides everything that depends on time or on
// the server's time-zone data, then hands plain data to the interactive <EventFeed>.
export default async function Home() {
  // Render per request. Without this, Next.js prerenders `/` at build time, "now" freezes at the build date,
  // and events that have already ended keep showing in production (DOCS.md §5.5).
  const now = await getRequestTime();

  // Django (or the mocks in dev, lib/data.ts). Signed out: the count only, no attendee names, no "Going"
  // (DOCS.md §9.3, §9.4); eventsForVisitor stays as a second guard after the API's own rule.
  const isSignedIn = (await getSessionState()).status === 'signed-in';
  const events = await listEvents({ upcoming: true }, await getBackendToken());
  const upcomingEvents = eventsForVisitor(getUpcomingEvents(events, now), isSignedIn);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <EventFeed initialEvents={upcomingEvents} schedules={getEventSchedules(upcomingEvents, await getLocale())} />
    </div>
  );
}
