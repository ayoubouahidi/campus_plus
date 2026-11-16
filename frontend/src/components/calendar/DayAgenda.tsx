import React, { useId } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { CATEGORY_LABELS } from '@/lib/events';
import { formatAgendaTime, formatDayLabel, type DayKey, type EventTimes } from '@/lib/calendar';
import type { EventCategory, EventItem } from '@/types/api';

/* --------------------------------- Types ---------------------------------- */

export interface DayAgendaProps extends React.HTMLAttributes<HTMLElement> {
  dayKey: DayKey;
  // The day's events in start-time order (eventsByDay[dayKey] ?? []).
  events: EventItem[];
  // From getEventTimes on the server, keyed by event id.
  eventTimes: Record<string, EventTimes>;
  headingLevel?: 'h2' | 'h3';
}

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

const describeCount = (count: number): string =>
  count === 0 ? 'No events' : `${count} ${count === 1 ? 'event' : 'events'}`;

/* -------------------------------- DayAgenda ------------------------------- */

// The selected day's events, under the month grid on phones and beside it on large screens.
// No hooks besides useId and no handlers: it renders the same on server and client.
export const DayAgenda = React.forwardRef<HTMLElement, DayAgendaProps>(
  ({ dayKey, events, eventTimes, headingLevel: Heading = 'h2', className = '', ...props }, ref) => {
    const headingId = useId();

    return (
      <section ref={ref} aria-labelledby={headingId} className={`space-y-3 ${className}`} {...props}>
        <div>
          <Heading id={headingId} className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {formatDayLabel(dayKey)}
          </Heading>
          <p className="text-sm text-slate-500 dark:text-slate-400">{describeCount(events.length)}</p>
        </div>

        {events.length === 0 ? (
          <EmptyState
            className="py-10"
            title="Nothing on this day"
            description="Pick another day to see what's on."
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
                      {formatAgendaTime(times, dayKey)}
                    </p>
                  )}
                  <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {/* Stretched link (as in EventCard): the whole row is clickable, the ring is drawn around it. */}
                    <Link
                      href={`/events/${event.id}`}
                      className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-violet-500"
                    >
                      {event.title}
                    </Link>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {event.club_name} · {event.location}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant={event.category}>{CATEGORY_LABELS[event.category]}</Badge>
                    {event.has_user_rsvpd && (
                      <Badge variant="success" hasDot>
                        Going
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
