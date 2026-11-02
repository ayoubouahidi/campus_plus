'use client';

import React, { useState } from 'react';
import { EventItem } from '@/types/api';
import { CategoryFilter } from '@/components/events/CategoryFilter';
import { EventGrid } from '@/components/events/EventGrid';
import { FeedToolbar } from '@/components/events/FeedToolbar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { NAV_ICONS } from '@/components/ui/layout/navIcons';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_EVENT_FILTERS, EventFilters, filterEvents, toggleRsvp } from '@/lib/events';
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
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);
  const { showToast } = useToast();

  const visibleEvents = filterEvents(events, filters);

  // Optimistic RSVP (Phase 7 sends the request and rolls back on failure). `event` is the card's current
  // object, so the toast is decided here, outside the state updater (updaters run twice in Strict Mode).
  const handleRsvpToggle = (event: EventItem) => {
    setEvents((current) => current.map((item) => (item.id === event.id ? toggleRsvp(item) : item)));
    showToast(
      event.has_user_rsvpd
        ? { title: 'RSVP cancelled', description: event.title, variant: 'info' }
        : { title: "You're going", description: event.title, variant: 'success' },
    );
  };

  return (
    <div className="space-y-8">
      <FeedToolbar
        campus={filters.campus}
        onCampusChange={(campus) => setFilters((current) => ({ ...current, campus }))}
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
              title="No upcoming events yet"
              description="New events show up here as soon as clubs publish them."
            />
          ) : (
            <EmptyState
              icon={<CalendarIcon className="h-6 w-6" />}
              title="No events match your filters"
              description="Try another campus or category."
              action={
                <Button variant="secondary" onClick={() => setFilters(DEFAULT_EVENT_FILTERS)}>
                  Clear filters
                </Button>
              }
            />
          )
        }
      />
    </div>
  );
};
