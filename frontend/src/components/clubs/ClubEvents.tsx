'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { EventItem } from '@/types/api';
import { EventGrid } from '@/components/events/EventGrid';
import { PastEventList } from '@/components/events/PastEventList';
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
    const t = useTranslations('Clubs');

    // Optimistic (Phase 7 sends the request). Toast decided outside the state updater.
    const handleRsvpToggle = (before: EventItem) => {
      setEvents((current) => current.map((item) => (item.id === before.id ? toggleRsvp(item) : item)));
      announceRsvp(before);
    };

    return (
      <div ref={ref} className={`space-y-12 ${className}`} {...props}>
        <section aria-labelledby="club-upcoming" className="space-y-4">
          <h2 id="club-upcoming" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t('upcoming')}{' '}
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
                title={t('nothingTitle')}
                description={t('nothingBody')}
              />
            }
          />
        </section>

        {/* Past events only when there are some: an empty "past" section adds nothing. */}
        {past.length > 0 && (
          <section aria-labelledby="club-past" className="space-y-4">
            <h2 id="club-past" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('past')}{' '}
              <span className="font-normal text-slate-500 dark:text-slate-400">({past.length})</span>
            </h2>
            <PastEventList events={past} schedules={schedules} />
          </section>
        )}
      </div>
    );
  }
);

ClubEvents.displayName = 'ClubEvents';
