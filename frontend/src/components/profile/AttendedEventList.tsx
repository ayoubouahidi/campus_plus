import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { EventItem } from '@/types/api';
import type { DateTile } from '@/lib/time';
import { ChevronIcon } from './profileIcons';
import { PROFILE_PANEL, profileChip } from './profileStyles';

export interface AttendedEventListProps extends React.HTMLAttributes<HTMLUListElement> {
  events: EventItem[]; // most recent first
  dateTiles: Record<string, DateTile>; // getDateTiles on the server (campus time zone)
}

// Figma "PastEventRow" list: date tile (NOV / 14), title, location, "Attended" chip, chevron. Each row opens
// the event page (stretched link). Server-safe.
export const AttendedEventList = React.forwardRef<HTMLUListElement, AttendedEventListProps>(
  ({ events, dateTiles, className = '', ...props }, ref) => {
    const t = useTranslations('Profile');
    return (
      <ul ref={ref} className={`divide-y divide-slate-200/80 px-4 sm:px-6 dark:divide-slate-800 ${PROFILE_PANEL} ${className}`} {...props}>
        {events.map((event) => {
          const tile = dateTiles[event.id];
          return (
            <li key={event.id} className="group relative flex items-center gap-4 py-4">
              <time
                dateTime={event.start_time}
                className="flex w-[52px] shrink-0 flex-col items-center rounded-lg bg-slate-50 py-1 font-semibold dark:bg-slate-950"
              >
                <span className="text-[10px] leading-[15px] text-slate-500 dark:text-slate-400">{tile?.month}</span>
                <span className="text-xl leading-[30px] text-slate-900 dark:text-slate-100">{tile?.day}</span>
              </time>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/events/${event.id}`}
                  className="block text-sm font-medium leading-[21px] text-slate-900 after:absolute after:inset-0 after:rounded-lg group-hover:text-violet-700 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-violet-500 dark:text-slate-100 dark:group-hover:text-violet-300"
                >
                  {event.title}
                </Link>
                <p className="truncate text-xs leading-[18px] text-slate-600 dark:text-slate-400">{event.location}</p>
              </div>
              <span className={`hidden sm:inline-flex ${profileChip('emerald')}`}>{t('attendedChip')}</span>
              <ChevronIcon className="text-slate-500 rtl:-scale-x-100 dark:text-slate-400" />
            </li>
          );
        })}
      </ul>
    );
  }
);

AttendedEventList.displayName = 'AttendedEventList';
