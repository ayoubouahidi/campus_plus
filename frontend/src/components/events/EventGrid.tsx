'use client';

import React, { useEffect, useRef } from 'react';
import { EventItem } from '@/types/api';
import { EventCard } from '@/components/events/EventCard';
import { EventSchedule } from '@/lib/time';

export interface EventGridProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  events: EventItem[];
  schedules: Record<string, EventSchedule>; // pre-formatted on the server (DOCS.md §5.2)
  onRsvpToggle: (event: EventItem) => void;
  emptyState: React.ReactNode; // shown instead of the grid when `events` is empty
  // 'h2' when the cards sit directly under the page <h1> (the feed), 'h3' under a section <h2> (a club page).
  cardHeadingLevel?: 'h2' | 'h3';
  // true when the grid is at the top of the page (its first row is the LCP), false further down.
  eagerFirstRow?: boolean;
}

// Widest layout is 3 columns (lg).
const FIRST_ROW_MAX = 3;

export const EventGrid = React.forwardRef<HTMLDivElement, EventGridProps>(
  (
    { events, schedules, onRsvpToggle, emptyState, cardHeadingLevel = 'h2', eagerFirstRow = true, className = '', ...props },
    ref
  ) => {
    const listRef = useRef<HTMLUListElement>(null);
    // Set when something inside the empty state is activated (e.g. "Clear filters"). Clicks include
    // Enter/Space on a button, so this covers keyboard users too.
    const activatedEmptyRef = useRef(false);
    const isEmpty = events.length === 0;

    // "Clear filters" unmounts itself: the empty state is replaced by the grid, and focus falls back to <body>
    // (keyboard users would restart from the top of the page). If that happened, move focus to the list,
    // so the next Tab lands on the first card.
    useEffect(() => {
      if (isEmpty || !activatedEmptyRef.current) return;
      activatedEmptyRef.current = false;
      if (document.activeElement === document.body) listRef.current?.focus();
    }, [isEmpty]);

    return (
      <div ref={ref} className={className} {...props}>
        {isEmpty ? (
          <div onClickCapture={() => (activatedEmptyRef.current = true)}>
            {emptyState}
          </div>
        ) : (
          // grid-cols-1 is required: it caps the phone column at the screen width (minmax(0, 1fr)). Without it,
          // a card grows to fit its longest unbreakable line and the page gets wider than the phone (§5.7).
          // tabIndex={-1}: focusable from script only (see the effect above), never a Tab stop itself.
          <ul
            ref={listRef}
            tabIndex={-1}
            aria-label="Events"
            className="grid grid-cols-1 gap-6 focus:outline-none sm:grid-cols-2 lg:grid-cols-3"
          >
            {events.map((event, index) => (
              <li key={event.id}>
                {/* No skipped heading level: h2 under the page <h1>, h3 under a section <h2>. */}
                <EventCard
                  event={event}
                  schedule={schedules[event.id]}
                  onRsvpToggle={onRsvpToggle}
                  headingLevel={cardHeadingLevel}
                  // The first row (1 card on phones, up to 3 on desktop) is on screen at first paint, so its
                  // flyers load right away; the rest stay lazy.
                  imageLoading={eagerFirstRow && index < FIRST_ROW_MAX ? 'eager' : 'lazy'}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);

EventGrid.displayName = 'EventGrid';
