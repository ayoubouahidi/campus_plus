import type { Metadata } from 'next';
import { connection } from 'next/server';
import { EventCalendar } from '@/components/calendar/EventCalendar';
import { getEventIdsByDay, getEventTimes, toCampusDayKey } from '@/lib/calendar';
import { mockEvents } from '@/lib/mockData';

export const metadata: Metadata = {
  title: 'Calendar | Campus Hub',
  description: 'Every campus event by month or week, for 1337 Coding School and EMINES.',
};

// `/calendar` (Phase 4). Server Component: it decides "today" and puts events on campus days (both need
// the server's time-zone data, DOCS.md §5.2), then hands plain data to the interactive <EventCalendar>.
export default async function CalendarPage() {
  // Render per request, so "today" is the request date, not the build date (same as `/`, DOCS.md §5.5).
  await connection();

  // Phase 7: fetch the events of the visible range from the API instead of mockEvents.
  // Past events stay listed: a calendar shows what happened too, unlike the "upcoming" feed.
  const events = mockEvents;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* The visible title is the month/week in the calendar header (an h2); this names the page. */}
      <h1 className="sr-only">Calendar</h1>
      <EventCalendar
        events={events}
        eventIdsByDay={getEventIdsByDay(events)}
        eventTimes={getEventTimes(events)}
        todayKey={toCampusDayKey(Date.now())}
      />
    </div>
  );
}
