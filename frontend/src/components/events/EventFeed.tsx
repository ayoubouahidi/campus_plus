'use client';

import React, { useCallback, useState } from 'react';
import { useSyncedState } from '@/hooks/useSyncedState';
import { useTranslations } from 'next-intl';
import { EventItem } from '@/types/api';
import { CategoryFilter } from '@/components/events/CategoryFilter';
import { EventGrid } from '@/components/events/EventGrid';
import { FeedToolbar } from '@/components/events/FeedToolbar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { NAV_ICONS } from '@/components/ui/layout/navIcons';
import { useRsvp, type UpdateEvent } from '@/hooks/useRsvp';
import { DEFAULT_EVENT_FILTERS, EventFilters, filterEvents } from '@/lib/events';
import { EventSchedule } from '@/lib/time';

export interface EventFeedProps {
  initialEvents: EventItem[]; // already limited to upcoming events and sorted, on the server
  schedules: Record<string, EventSchedule>; // server-formatted times (DOCS.md §5.2)
}

const CalendarIcon = NAV_ICONS.calendar;

// The interactive part of `/`: owns the filters and the RSVP state, and composes the toolbar, the category
// chips and the grid. Everything time-dependent (which events are upcoming, how times read) was decided on
// the server and arrives as props, so server and browser render the same HTML.
export const EventFeed = ({ initialEvents, schedules }: EventFeedProps) => {
  const [events, setEvents] = useSyncedState<EventItem[]>(initialEvents); // follows live refreshes (Step 15.2)
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);
  const t = useTranslations('Feed');

  const visibleEvents = filterEvents(events, filters);

  // Saved in Django, optimistic with rollback and the toast (useRsvp, Step 14.3).
  const handleRsvpToggle = useRsvp(
    useCallback<UpdateEvent>(
      (id, change) => setEvents((current) => current.map((item) => (item.id === id ? change(item) : item))),
      [setEvents]
    )
  );

  return (
    <div className="space-y-8">
      <FeedToolbar
        resultCount={visibleEvents.length}
      >
        <CategoryFilter
          value={filters.category}
          onChange={(category) => setFilters((current) => ({ ...current, category }))}
        />
      </FeedToolbar>

      <EventGrid
        events={visibleEvents}
        schedules={schedules}
        onRsvpToggle={handleRsvpToggle}
        emptyState={
          // Two different situations: nothing is scheduled at all (filters can't help, so no button),
          // or the filters hide everything (offer the way back).
          events.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon className="h-6 w-6" />}
              title={t('emptyTitle')}
              description={t('emptyBody')}
            />
          ) : (
            <EmptyState
              icon={<CalendarIcon className="h-6 w-6" />}
              title={t('noMatchTitle')}
              description={t('noMatchBody')}
              action={
                <Button variant="secondary" onClick={() => setFilters(DEFAULT_EVENT_FILTERS)}>
                  {t('clearFilters')}
                </Button>
              }
            />
          )
        }
      />
    </div>
  );
};
