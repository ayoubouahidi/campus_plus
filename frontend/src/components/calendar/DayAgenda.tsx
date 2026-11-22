import React, { useId } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCalendarFormat } from '@/hooks/useCalendarFormat';
import type { CalendarNames, DayKey, EventTimes } from '@/lib/calendar';
import type { EventCategory, EventItem } from '@/types/api';

/* --------------------------------- Types ---------------------------------- */

export interface DayAgendaProps extends React.HTMLAttributes<HTMLElement> {
  dayKey: DayKey;
  // The day's events in start-time order (eventsByDay[dayKey] ?? []).
  events: EventItem[];
  // From getEventTimes on the server, keyed by event id.
  eventTimes: Record<string, EventTimes>;
  // Month and weekday names in the visitor's language (getCalendarNames on the server, Step 12.4).
  names: CalendarNames;
  headingLevel?: 'h2' | 'h3';
  // Where each event links to. Default: its page. EventCalendar passes one that remembers the calendar's
  // place, so the event page can link back to this day (eventFromCalendarHref).
  eventHref?: (event: EventItem) => string;
}

const defaultEventHref = (event: EventItem) => `/events/${event.id}`;

/* ------------------------------ Style tables ------------------------------ */

// Category accent on the leading edge. border-s = start side, so it moves to the right in RTL.
const accentStyles: Record<EventCategory, string> = {
  Tech: 'border-s-lime-500',
  Media: 'border-s-violet-500',
  Music: 'border-s-indigo-500',
  Sports: 'border-s-teal-500',
  Business: 'border-s-orange-500',
  Gaming: 'border-s-fuchsia-500',
  EventsOrganization: 'border-s-sky-500',
};

/* -------------------------------- DayAgenda ------------------------------- */

// The selected day's events, under the month grid on phones and beside it on large screens.
// No state and no handlers: it renders the same on server and client (labels: useCalendarFormat).
export const DayAgenda = React.forwardRef<HTMLElement, DayAgendaProps>(
  ({ dayKey, events, eventTimes, names, headingLevel: Heading = 'h2', eventHref = defaultEventHref, className = '', ...props }, ref) => {
    const headingId = useId();
    const format = useCalendarFormat(names);
    const t = useTranslations('Calendar');
    const tEvents = useTranslations('Events');
    const tCategory = useTranslations('Categories');
    const tRsvp = useTranslations('Rsvp');

    return (
      <section ref={ref} aria-labelledby={headingId} className={`space-y-3 ${className}`} {...props}>
        <div>
          <Heading id={headingId} className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {format.dayLabel(dayKey)}
          </Heading>
          <p className="text-sm text-slate-500 dark:text-slate-400">{tEvents('count', { count: events.length })}</p>
        </div>

        {events.length === 0 ? (
          <EmptyState
            className="py-10"
            title={t('emptyTitle')}
            description={t('emptyBody')}
          />
        ) : (
          <ul className="space-y-2">
            {events.map((event) => {
              const times = eventTimes[event.id];
              return (
                <li
                  key={event.id}
                  className={`relative rounded-lg border border-s-4 border-slate-200/80 bg-white p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60 ${accentStyles[event.category]}`}
                >
                  {times && (
                    <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">
                      {format.agendaTime(times, dayKey)}
                    </p>
                  )}
                  <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {/* Stretched link (as in EventCard): the whole row is clickable, the ring is drawn around it. */}
                    <Link
                      href={eventHref(event)}
                      className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-violet-500"
                    >
                      {event.title}
                    </Link>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {event.club_name} · {event.location}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant={event.category}>{tCategory(event.category)}</Badge>
                    {event.has_user_rsvpd && (
                      <Badge variant="success" hasDot>
                        {tRsvp('going')}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }
);

DayAgenda.displayName = 'DayAgenda';
