import React from 'react';
import Link from 'next/link';
import type { EventItem } from '@/types/api';
import type { EventSchedule } from '@/lib/time';

export interface PastEventListProps extends React.HTMLAttributes<HTMLUListElement> {
  events: EventItem[]; // most recent first
  schedules: Record<string, EventSchedule>; // getEventSchedules on the server (campus time zone)
}

// Compact list of past events (date · title · place), one row per event, each row opening the event page
// (its "ended" view). Used by /clubs/[slug] (Step 4.15) and /profile (Step 5.4). Server-safe.
export const PastEventList = React.forwardRef<HTMLUListElement, PastEventListProps>(
  ({ events, schedules, className = '', ...props }, ref) => (
    <ul
      ref={ref}
      className={`divide-y divide-slate-200/80 overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900 ${className}`}
      {...props}
    >
      {events.map((event) => (
        <li key={event.id} className="relative flex items-baseline gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
          <time dateTime={event.start_time} className="w-24 shrink-0 text-sm text-slate-500 dark:text-slate-400">
            {schedules[event.id]?.day}
          </time>
          <div className="min-w-0">
            {/* Stretched link: the whole row opens the event page. */}
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
  )
);

PastEventList.displayName = 'PastEventList';
