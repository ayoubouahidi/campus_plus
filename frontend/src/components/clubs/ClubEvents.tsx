'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { EventItem } from '@/types/api';
import { EventGrid } from '@/components/events/EventGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { NAV_ICONS } from '@/components/ui/layout/navIcons';
import { useRsvpToast } from '@/hooks/useRsvpToast';
import { toggleRsvp } from '@/lib/events';
import type { EventSchedule } from '@/lib/time';

export interface ClubEventsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  // Both from getClubEvents on the server (split at the request time).
  upcoming: EventItem[];
  past: EventItem[];
  // getEventSchedules for upcoming + past (server, campus time zone).
  schedules: Record<string, EventSchedule>;
}

const CalendarIcon = NAV_ICONS.calendar;

// Bottom of /clubs/[slug]: the club's upcoming events as feed cards (RSVP works here too), then its past
// events as a compact list. Owns the RSVP state for these cards, like EventFeed does on `/`.
export const ClubEvents = React.forwardRef<HTMLDivElement, ClubEventsProps>(
  ({ upcoming, past, schedules, className = '', ...props }, ref) => {
    const [events, setEvents] = useState(upcoming);
    const announceRsvp = useRsvpToast();

    // Optimistic (Phase 7 sends the request). Toast decided outside the state updater.
    const handleRsvpToggle = (before: EventItem) => {
      setEvents((current) => current.map((item) => (item.id === before.id ? toggleRsvp(item) : item)));
      announceRsvp(before);
    };

    return (
      <div ref={ref} className={`space-y-12 ${className}`} {...props}>
        <section aria-labelledby="club-upcoming" className="space-y-4">
          <h2 id="club-upcoming" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Upcoming events{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">({events.length})</span>
          </h2>
          <EventGrid
            events={events}
            schedules={schedules}
            onRsvpToggle={handleRsvpToggle}
            cardHeadingLevel="h3"
            eagerFirstRow={false}
            emptyState={
              <EmptyState
                className="py-10"
                icon={<CalendarIcon className="h-6 w-6" />}
                title="Nothing scheduled right now"
                description="This club hasn't announced its next event yet. Check back soon."
              />
            }
          />
        </section>

        {/* Past events only when there are some: an empty "past" section adds nothing. */}
        {past.length > 0 && (
          <section aria-labelledby="club-past" className="space-y-4">
            <h2 id="club-past" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Past events{' '}
              <span className="font-normal text-slate-500 dark:text-slate-400">({past.length})</span>
            </h2>
            <ul className="divide-y divide-slate-200/80 overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {past.map((event) => (
                <li key={event.id} className="relative flex items-baseline gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <time
                    dateTime={event.start_time}
                    className="w-24 shrink-0 text-sm text-slate-500 dark:text-slate-400"
                  >
                    {schedules[event.id]?.day}
                  </time>
                  <div className="min-w-0">
                    {/* Stretched link: the whole row opens the event page (its "ended" view). */}
                    <Link
                      href={`/events/${event.id}`}
                      className="block truncate text-sm font-medium text-slate-900 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-violet-500 dark:text-slate-100"
                    >
                      {event.title}
                    </Link>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{event.location}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }
);

ClubEvents.displayName = 'ClubEvents';
