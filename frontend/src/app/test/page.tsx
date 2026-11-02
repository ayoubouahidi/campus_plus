import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { EventFeed } from '@/components/events/EventFeed';
import { getUpcomingEvents } from '@/lib/events';
import { mockEvents } from '@/lib/mockData';
import { getEventSchedules } from '@/lib/time';

// TEST PAGE (/test): where each new step is checked before it goes into the real pages.
// Workflow: build the step here → the user validates it in the browser → move it into the real route
// (e.g. src/app/page.tsx) → reset this page for the next step. Dev only: it is a 404 in production.

export const metadata: Metadata = {
  title: 'Test page',
  robots: { index: false, follow: false },
};

// Scenarios that are hard to reach on the real page (e.g. "nothing scheduled" only happens once every
// mock event has ended). Switch with ?scenario=<key>.
const SCENARIOS = {
  default: { label: 'Mock events', events: () => getUpcomingEvents(mockEvents, Date.now()) },
  empty: { label: 'Nothing scheduled', events: () => [] },
} as const;

type ScenarioKey = keyof typeof SCENARIOS;

const isScenarioKey = (value: unknown): value is ScenarioKey =>
  typeof value === 'string' && value in SCENARIOS;

const CHECKS = [
  'Mock events: 6 cards in date order, page exactly as wide as the phone (no zoom-out).',
  'Campus + category filters update the count ("1 event" for EMINES); "Clear filters" brings every card back and the next Tab lands on the first card.',
  'RSVP: "You\'re going" / "RSVP cancelled" toasts, the button switches between RSVP and Going.',
  'Nothing scheduled: "No upcoming events yet" with no button.',
  'Dark mode, keyboard only (Tab / Enter / Space), and the browser console stays empty.',
];

export default async function TestPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  await connection();

  const { scenario } = await searchParams;
  const active: ScenarioKey = isScenarioKey(scenario) ? scenario : 'default';
  const events = SCENARIOS[active].events();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section
        aria-label="Test controls"
        className="mb-8 rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <p className="font-semibold">Test page: Event feed (Phase 3)</p>

        <nav aria-label="Scenarios" className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => (
            <Link
              key={key}
              href={key === 'default' ? '/test' : `/test?scenario=${key}`}
              aria-current={key === active ? 'page' : undefined}
              className="rounded-full border border-amber-400 px-3 py-1 font-medium hover:bg-amber-100 aria-[current=page]:bg-amber-400 aria-[current=page]:text-amber-950 dark:border-amber-500/50 dark:hover:bg-amber-500/20"
            >
              {SCENARIOS[key].label}
            </Link>
          ))}
        </nav>

        <ol className="mt-3 list-decimal space-y-1 pl-5">
          {CHECKS.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ol>
      </section>

      {/* key: switching scenario remounts the feed, so its filter/RSVP state starts fresh. */}
      <EventFeed key={active} initialEvents={events} schedules={getEventSchedules(events)} />
    </div>
  );
}
