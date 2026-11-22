import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { IconBase } from '@/components/ui/layout/navIcons';
import { calendarHref, type CalendarLocation } from '@/lib/calendar';

export interface EventBackLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  // Set when the event page was opened from the calendar (?from=calendar&date=…&view=…, read by the page
  // with readCalendarLocation). Omitted: back to the Discover feed.
  calendar?: CalendarLocation;
}

type BackTarget = 'feed' | 'calendar';

// Keys of the EventPage messages.
const BACK_LABELS: Record<BackTarget, 'allEvents' | 'backToCalendar'> = {
  feed: 'allEvents',
  calendar: 'backToCalendar',
};

// The "back" link above an event. A real link (not history.back()), so it also works for people who
// arrived from a shared URL, and it returns to the exact calendar day and view the visitor came from.
// No 'use client': it has no state, so it renders on the server with the page.
export const EventBackLink = React.forwardRef<HTMLAnchorElement, EventBackLinkProps>(
  ({ calendar, className = '', ...props }, ref) => {
    const target: BackTarget = calendar ? 'calendar' : 'feed';
    const href = calendar ? calendarHref(calendar) : '/';
    const t = useTranslations('EventPage');

    return (
      <Link
        ref={ref}
        href={href}
        className={`inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-400 dark:hover:text-slate-100 ${className}`}
        {...props}
      >
        {/* Points "back" in reading direction: flipped in RTL. */}
        <IconBase className="h-4 w-4 rtl:-scale-x-100">
          <path d="m15 18-6-6 6-6" />
        </IconBase>
        {t(BACK_LABELS[target])}
      </Link>
    );
  }
);

EventBackLink.displayName = 'EventBackLink';
