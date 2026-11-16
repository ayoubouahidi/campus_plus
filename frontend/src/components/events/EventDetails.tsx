import React from 'react';
import Link from 'next/link';
import type { Club, EventItem } from '@/types/api';
import { CardBanner } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MapPinIcon, NAV_ICONS } from '@/components/ui/layout/navIcons';
import { CATEGORY_LABELS } from '@/lib/events';
import type { EventDateDetails } from '@/lib/calendar';
import { flyerFallbackStyles } from './eventStyles';

/* --------------------------------- Types ---------------------------------- */

export interface EventDetailsProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  event: EventItem;
  // The organizing club, or undefined when it isn't known (the name from the event is shown unlinked).
  club?: Club;
  // Pre-formatted on the server (getEventDateDetails): campus time zone, see DOCS.md §5.2.
  dateDetails: EventDateDetails;
}

// The flyer spans the main column: full width on phones, ~2/3 of max-w-7xl on desktop (RSVP card beside it).
const FLYER_SIZES = '(min-width: 1280px) 820px, (min-width: 1024px) 66vw, 100vw';

const CalendarIcon = NAV_ICONS.calendar;
const ClubIcon = NAV_ICONS.clubs;

/* ------------------------------ EventDetails ------------------------------ */

// Main content of /events/[id]: flyer, category, title, when / where / organizer, description.
// No state or handlers, so it stays a Server Component and ships no JavaScript.
export const EventDetails = React.forwardRef<HTMLElement, EventDetailsProps>(
  ({ event, club, dateDetails, className = '', ...props }, ref) => (
    <article ref={ref} aria-labelledby="event-title" className={`space-y-6 ${className}`} {...props}>
      <CardBanner
        src={event.flyer_url}
        sizes={FLYER_SIZES}
        // The flyer is the first thing on screen (usually the Largest Contentful Paint image).
        loading="eager"
        className="rounded-2xl border border-slate-200/80 dark:border-slate-800"
        fallback={
          <div className={`flex h-full w-full items-center justify-center ${flyerFallbackStyles[event.category]}`}>
            <CalendarIcon className="h-14 w-14" />
          </div>
        }
      />

      <header className="space-y-3">
        <Badge variant={event.category}>{CATEGORY_LABELS[event.category]}</Badge>
        <h1
          id="event-title"
          className="text-2xl font-bold tracking-tight text-balance text-slate-900 sm:text-3xl dark:text-slate-100"
        >
          {event.title}
        </h1>
      </header>

      {/* Key facts as a description list: screen readers announce "When", "Where", "Organizer" as terms. */}
      <dl className="grid gap-4 rounded-xl border border-slate-200/80 bg-white p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex gap-3">
          <CalendarIcon className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
          <div className="min-w-0">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">When</dt>
            <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
              <time dateTime={event.start_time}>{dateDetails.date}</time>
            </dd>
            <dd className="text-sm text-slate-600 dark:text-slate-400">{dateDetails.time}</dd>
          </div>
        </div>

        <div className="flex gap-3">
          <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
          <div className="min-w-0">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">Where</dt>
            <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.location}</dd>
            <dd className="text-sm text-slate-600 dark:text-slate-400">{event.department_name}</dd>
          </div>
        </div>

        <div className="flex gap-3">
          <ClubIcon className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
          <div className="min-w-0">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Organizer
            </dt>
            <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {club ? (
                <Link
                  href={`/clubs/${club.slug}`}
                  className="text-violet-700 underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-violet-400"
                >
                  {club.name}
                </Link>
              ) : (
                event.club_name
              )}
            </dd>
            {club && <dd className="text-sm text-slate-600 dark:text-slate-400">{club.department_name}</dd>}
          </div>
        </div>
      </dl>

      <section aria-labelledby="event-about" className="space-y-2">
        <h2 id="event-about" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          About this event
        </h2>
        {/* whitespace-pre-line keeps the organizer's line breaks without parsing any markup. */}
        <p className="text-base leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-300">
          {event.description}
        </p>
      </section>
    </article>
  )
);

EventDetails.displayName = 'EventDetails';
