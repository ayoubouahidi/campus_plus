'use client';

import React, { useState } from 'react';
import { CategoryFilter } from '@/components/events/CategoryFilter';
import { EventCard } from '@/components/events/EventCard';
import { FeedToolbar } from '@/components/events/FeedToolbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_EVENT_FILTERS, EventFilters, filterEvents, formatEventCount, toggleRsvp } from '@/lib/events';
import { mockEvents } from '@/lib/mockData';
import { EventSchedule } from '@/lib/time';
import { EventItem } from '@/types/api';

// Verification bench: Phase 3, Step 3.4 (FeedToolbar + CategoryFilter + FilterChip), rendered by src/app/page.tsx.
// The grid and the "no results" line are stand-ins; the real EventGrid and empty state arrive in Step 3.5.
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
      'Filter down to nothing (e.g. 1337 + Sports): count says "No events" and the placeholder line appears.',
      'RSVP still works on filtered cards, and the change survives switching filters.',
    ],
  },
  {
    area: 'Keyboard',
    steps: [
      'Tab order: All / 1337 / EMINES → All → each category chip → the cards.',
      'Enter or Space toggles a campus button or chip. Every control shows a violet focus ring, not cut off on phones.',
    ],
  },
  {
    area: 'Screen reader',
    steps: [
      '"Upcoming events" is the page\'s only heading level 1.',
      'Landmarks list has a search region "Filter events".',
      'Campus buttons and chips are read as toggle buttons, "pressed" / "not pressed", in groups named "Campus" and "Filter by category".',
      'After changing a filter, the new count (e.g. "1 event") is read once.',
    ],
  },
  {
    area: 'Responsive & dark mode',
    steps: [
      '375px: campus buttons fill the width; chips in one row that scrolls sideways to the screen edge, no scrollbar, no page-wide horizontal scroll.',
      '≥ 640px: campus buttons shrink to their content. ≥ 768px: chips wrap onto two lines if needed.',
      'Dark mode: idle chips slate-800, selected violet-500, campus group slate-900.',
    ],
  },
];

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
        Bench · Phase 3 · Step 3.4
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

      {/* grid-cols-1 caps the phone column at the screen width (minmax(0, 1fr)); without it, a card grows to fit
          its longest unbreakable line and the whole page gets wider than the phone (DOCS.md §5.7). */}
      {visibleEvents.length > 0 ? (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleEvents.map((event) => (
            <li key={event.id}>
              <EventCard event={event} schedule={schedules[event.id]} onRsvpToggle={handleRsvpToggle} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Placeholder: nothing matches. The real empty state (with &quot;Clear filters&quot;) comes in Step 3.5.
        </p>
      )}

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
