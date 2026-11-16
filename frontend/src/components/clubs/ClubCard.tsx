import React from 'react';
import Link from 'next/link';
import type { Club } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { Card, CardBanner, CardFooter } from '@/components/ui/Card';
import { NAV_ICONS } from '@/components/ui/layout/navIcons';
import { formatUpcomingCount } from '@/lib/clubs';

/* --------------------------------- Types ---------------------------------- */

export interface ClubCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  club: Club;
  // Computed on the server (getUpcomingEventCounts), because "upcoming" depends on the request time.
  upcomingCount: number;
  // 'h2' when cards sit directly under the page <h1> (the directory), 'h3' under a section <h2>.
  headingLevel?: 'h2' | 'h3';
}

// Directory grid: 1 → 2 → 3 columns inside max-w-7xl (same breakpoints as the event grid).
const BANNER_SIZES = '(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';

const CalendarIcon = NAV_ICONS.calendar;

/* -------------------------------- ClubCard -------------------------------- */

// One club in the /clubs directory. No state or handlers: a Server Component. The whole card is one link
// (stretched over the card from the club name), so there is a single tab stop per club.
export const ClubCard = React.forwardRef<HTMLDivElement, ClubCardProps>(
  ({ club, upcomingCount, headingLevel: Heading = 'h2', className = '', ...props }, ref) => (
    <Card ref={ref} isHoverable className={`relative flex h-full flex-col ${className}`} {...props}>
      <CardBanner
        src={club.banner_url ?? undefined}
        sizes={BANNER_SIZES}
        aspectRatio="wide"
        // No banner yet: a soft brand gradient, so cards keep the same height.
        fallback={
          <div className="h-full w-full bg-gradient-to-br from-violet-200 via-violet-100 to-white dark:from-violet-500/25 dark:via-violet-500/10 dark:to-slate-900" />
        }
      />

      <div className="flex flex-1 flex-col px-5">
        {/* Logo overlaps the banner; decorative (the name is right next to it). */}
        <Avatar
          name={club.name}
          src={club.logo_url || null}
          size="lg"
          aria-hidden="true"
          className="-mt-6 self-start rounded-full ring-4 ring-white dark:ring-slate-900"
        />

        <Heading className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {/* Stretched link (as in EventCard): ::after covers the card, the ring is drawn around it. */}
          <Link
            href={`/clubs/${club.slug}`}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-violet-500"
          >
            {club.name}
          </Link>
        </Heading>
        <p className="text-sm text-slate-500 dark:text-slate-400">{club.department_name}</p>

        <p className="mt-3 line-clamp-2 flex-1 text-sm text-slate-600 dark:text-slate-300">{club.description}</p>
      </div>

      {/* Same footer as EventCard: full-width divider and its own padding, so both cards end alike. */}
      <CardFooter className="justify-start gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
        <CalendarIcon className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
        {formatUpcomingCount(upcomingCount)}
      </CardFooter>
    </Card>
  )
);

ClubCard.displayName = 'ClubCard';
