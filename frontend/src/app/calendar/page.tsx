import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { getSessionState } from '@/auth';
import { EventCalendar } from '@/components/calendar/EventCalendar';
import { getCalendarNames, getEventIdsByDay, getEventTimes, toCampusDayKey } from '@/lib/calendar';
import { eventsForVisitor } from '@/lib/events';
import { mockEvents } from '@/lib/mockData';
import { getRequestTime } from '@/lib/requestTime';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Meta');
  return {
    title: t('calendar'),
    description: t('calendarDescription'),
  };
}

// `/calendar` (Phase 4). Server Component: it decides "today" and puts events on campus days (both need
// the server's time-zone data, DOCS.md §5.2), then hands plain data to the interactive <EventCalendar>.
export default async function CalendarPage() {
  // Render per request, so "today" is the request date, not the build date (same as `/`, DOCS.md §5.5).
  const now = await getRequestTime();

  // Phase 7: fetch the events of the visible range from the API instead of mockEvents.
  // Past events stay listed: a calendar shows what happened too, unlike the "upcoming" feed.
  // Signed out: no "Going" badges in the day agenda (DOCS.md §9.4).
  const isSignedIn = (await getSessionState()).status === 'signed-in';
  const events = eventsForVisitor(mockEvents, isSignedIn);
  // Times, month and weekday names in the visitor's language, made here on the server (Step 12.4).
  const locale = await getLocale();
  const t = await getTranslations('Calendar');

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* The visible title is the month/week in the calendar header (an h2); this names the page. */}
      <h1 className="sr-only">{t('heading')}</h1>
      <EventCalendar
        events={events}
        eventIdsByDay={getEventIdsByDay(events)}
        eventTimes={getEventTimes(events, locale)}
        names={getCalendarNames(locale)}
        todayKey={toCampusDayKey(now)}
        urlState
      />
    </div>
  );
}
