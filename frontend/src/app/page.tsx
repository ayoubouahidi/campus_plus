'use client';

import React, { useState } from 'react';
import { EventCard } from '@/components/events/EventCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { toggleRsvp } from '@/lib/events';
import { mockEvents } from '@/lib/mockData';
import { EventItem } from '@/types/api';

// Verification bench: Phase 3, Step 3.2 (EventCard + toggleRsvp).
// The grid markup here is a stand-in; the real EventGrid arrives in Step 3.5.

const [goingEvent, notGoingEvent] = [mockEvents[0], mockEvents[1]];

const SELF_CHECKS: { name: string; actual: string; expected: string }[] = [
  {
    name: 'toggleRsvp on a "Going" event (42) → not going, 41',
    actual: JSON.stringify([toggleRsvp(goingEvent).has_user_rsvpd, toggleRsvp(goingEvent).rsvps_count]),
    expected: '[false,41]',
  },
  {
    name: 'toggleRsvp on a "RSVP" event (87) → going, 88',
    actual: JSON.stringify([toggleRsvp(notGoingEvent).has_user_rsvpd, toggleRsvp(notGoingEvent).rsvps_count]),
    expected: '[true,88]',
  },
  {
    name: 'Toggling twice gives back the same values',
    actual: JSON.stringify(toggleRsvp(toggleRsvp(goingEvent))),
    expected: JSON.stringify(goingEvent),
  },
  {
    name: 'toggleRsvp never mutates its input',
    actual: JSON.stringify([goingEvent.has_user_rsvpd, goingEvent.rsvps_count]),
    expected: '[true,42]',
  },
];

const CHECKLIST: { area: string; steps: string[] }[] = [
  {
    area: 'What each card shows',
    steps: [
      'Masterclass: no flyer → violet tint with a calendar icon; button says "Going" with a green check; "42 going".',
      'Case Competition: title cut to 2 lines with "…"; full title in /events link.',
      'Basketball: one avatar, "1 going". Welcome BBQ: no avatars, "No RSVPs yet".',
      'Hover an avatar: the attendee\'s name appears as a tooltip.',
      'Every card in a row has the same height, and the footers line up.',
    ],
  },
  {
    area: 'Mouse',
    steps: [
      'Hover a card: it lifts slightly, the border turns violet, the image zooms a little.',
      'Click anywhere on a card (image, text, empty space) → goes to /events/<id> (a 404 until Phase 4, expected). Use Back.',
      'Click RSVP → becomes "Going ✓", count +1, toast "You\'re going". Click Going → back to RSVP, count −1, toast "RSVP cancelled". No navigation.',
    ],
  },
  {
    area: 'Keyboard',
    steps: [
      'Tab: each card has exactly two stops, the title link (focus ring around the whole card) then the RSVP button.',
      'Enter on the link navigates; Enter/Space on the button toggles and focus stays on the button.',
    ],
  },
  {
    area: 'Screen reader',
    steps: [
      'Each card title is a heading level 3 link. Buttons read "RSVP to <title>" / "Going to <title>, cancel RSVP".',
      'Toggling announces the toast. Avatars are not read out; the "N going" text is.',
      'The date is a <time> element with the ISO value.',
    ],
  },
  {
    area: 'Responsive, dark mode & motion',
    steps: [
      '375px: 1 column; ≥ 640px: 2; ≥ 1024px: 3. No horizontal scroll; long locations end with "…".',
      'DevTools → Network → Img: on a phone width the flyers load as small .webp/.avif files (~10–30 kB), not the 200 kB PNGs.',
      'Dark mode: cards slate-900, fallback banner tinted, avatar rings blend into the card.',
      'Reduced motion (DevTools → Rendering → prefers-reduced-motion: reduce): no lift, no zoom on hover.',
    ],
  },
];

export default function EventCardBench() {
  const [events, setEvents] = useState<EventItem[]>(mockEvents);
  const { showToast } = useToast();

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
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Phase 3 · Step 3.2
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">EventCard</h1>
      </header>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} onRsvpToggle={handleRsvpToggle} />
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">
              Self-checks: {passedCount} / {SELF_CHECKS.length} passed
            </CardTitle>
            <CardDescription>
              <code>toggleRsvp</code> from <code>src/lib/events.ts</code>.
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
}
