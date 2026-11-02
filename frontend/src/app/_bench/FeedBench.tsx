'use client';

import React, { useState } from 'react';
import { CategoryFilter } from '@/components/events/CategoryFilter';
import { EventGrid } from '@/components/events/EventGrid';
import { FeedToolbar } from '@/components/events/FeedToolbar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { NAV_ICONS } from '@/components/ui/layout/navIcons';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_EVENT_FILTERS, EventFilters, filterEvents, formatEventCount, toggleRsvp } from '@/lib/events';
import { mockEvents } from '@/lib/mockData';
import { EventSchedule } from '@/lib/time';
import { EventItem } from '@/types/api';

// Verification bench: Phase 3, Step 3.5 (EventGrid + EmptyState) on top of Step 3.4's toolbar, rendered by
// src/app/page.tsx. Step 3.6 turns this into the real page and removes the bench parts (label, checks).
// `_bench` is a private folder: the App Router never turns it into a route.

const count = (filters: Partial<EventFilters>) =>
  String(filterEvents(mockEvents, { ...DEFAULT_EVENT_FILTERS, ...filters }).length);

const SELF_CHECKS: { name: string; actual: string; expected: string }[] = [
  { name: 'formatEventCount(0) → "No events"', actual: formatEventCount(0), expected: 'No events' },
  { name: 'formatEventCount(1) → "1 event"', actual: formatEventCount(1), expected: '1 event' },
  { name: 'formatEventCount(6) → "6 events"', actual: formatEventCount(6), expected: '6 events' },
  { name: 'Campus EMINES → 1 event', actual: count({ campus: 'emines' }), expected: '1' },
  { name: 'Campus 1337 + Music → 1 event', actual: count({ campus: '1337', category: 'Music' }), expected: '1' },
];

const CHECKLIST: { area: string; steps: string[] }[] = [
  {
    area: 'Filters (mouse)',
    steps: [
      'Campus: All → 1337 → EMINES. The selected button turns white (dark: slate-800); the grid and the count change at once.',
      'There is no search box in the toolbar: the navbar\'s "Search events…" (⌘K) is the only search.',
      'Category chips: one selected at a time (violet). Its colour dot turns white. "All" resets the category.',
      'Both combine: EMINES + Business shows only the case competition.',
      'Filter down to nothing (e.g. 1337 + Sports): count says "No events" and the empty state appears: dashed box, calendar icon, "No events match your filters", "Clear filters".',
      'Click "Clear filters": campus and category go back to All, all 6 events return. RSVPs you made are kept.',
      'RSVP still works on filtered cards, and the change survives switching filters.',
    ],
  },
  {
    area: 'Keyboard',
    steps: [
      'Tab order: All / 1337 / EMINES → All → each category chip → the cards.',
      'Enter or Space toggles a campus button or chip. Every control shows a violet focus ring, not cut off on phones.',
      'Filter to nothing, Tab to "Clear filters", press Enter. Then press Tab once: focus goes to the first card, not back to the top of the page.',
    ],
  },
  {
    area: 'Screen reader',
    steps: [
      '"Upcoming events" is the page\'s only heading level 1.',
      'Landmarks list has a search region "Filter events".',
      'Campus buttons and chips are read as toggle buttons, "pressed" / "not pressed", in groups named "Campus" and "Filter by category".',
      'After changing a filter, the new count (e.g. "1 event") is read once.',
      'Card titles are now heading level 2 (directly under the h1). The cards are in a list named "Events".',
      'After "Clear filters", the screen reader says "6 events" and lands on the "Events" list.',
    ],
  },
  {
    area: 'Responsive & dark mode',
    steps: [
      '375px: campus buttons fill the width; chips in one row that scrolls sideways to the screen edge, no scrollbar, no page-wide horizontal scroll.',
      '≥ 640px: campus buttons shrink to their content. ≥ 768px: chips wrap onto two lines if needed.',
      'Dark mode: idle chips slate-800, selected violet-500, campus group slate-900, empty-state border slate-700, icon circle violet tint.',
      '375px: the empty state fits the screen, text centred, button below.',
    ],
  },
];

const CalendarIcon = NAV_ICONS.calendar;

interface FeedBenchProps {
  schedules: Record<string, EventSchedule>;
}

export const FeedBench = ({ schedules }: FeedBenchProps) => {
  const [events, setEvents] = useState<EventItem[]>(mockEvents);
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);
  const { showToast } = useToast();

  const visibleEvents = filterEvents(events, filters);

  // `event` is the card's current object, so the toast is decided here, outside the state updater.
  const handleRsvpToggle = (event: EventItem) => {
    setEvents((current) => current.map((item) => (item.id === event.id ? toggleRsvp(item) : item)));
    showToast(
      event.has_user_rsvpd
        ? { title: 'RSVP cancelled', description: event.title, variant: 'info' }
        : { title: "You're going", description: event.title, variant: 'success' },
    );
  };

  const passedCount = SELF_CHECKS.filter((check) => check.actual === check.expected).length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
        Bench · Phase 3 · Step 3.5
      </p>

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
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">
              Self-checks: {passedCount} / {SELF_CHECKS.length} passed
            </CardTitle>
            <CardDescription>
              <code>formatEventCount</code> and <code>filterEvents</code> from <code>src/lib/events.ts</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {SELF_CHECKS.map(({ name, actual, expected }) => {
                const passed = actual === expected;
                return (
                  <li key={name} className="flex gap-2">
                    <span aria-hidden="true">{passed ? '✅' : '❌'}</span>
                    <span className="sr-only">{passed ? 'Passed:' : 'Failed:'}</span>
                    <span className="min-w-0 text-slate-700 dark:text-slate-300">
                      {name}
                      {!passed && (
                        <span className="block break-words text-xs text-rose-700 dark:text-rose-400">
                          got {actual}, expected {expected}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">What to check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {CHECKLIST.map(({ area, steps }) => (
              <section key={area}>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{area}</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
                  {steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </section>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
