import React from 'react';
import { useTranslations } from 'next-intl';
import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton';

// Loading placeholder for /calendar, mirroring EventCalendar: header (title · Today · arrows · view tabs),
// the month grid (always 6 weeks, so its height is known: lib/calendar.ts) and the day agenda beside it
// from lg. Server-safe. For app/calendar/loading.tsx. Change EventCalendar → change this too.

const WEEKS = 6;
const DAYS = 7;

export const CalendarSkeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <SkeletonRegion ref={ref} label={useTranslations('Calendar')('loading')} className={className} {...props}>
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-7 w-44 rounded-lg sm:h-8" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-16 rounded-lg" />
              <Skeleton className="h-9 w-[4.5rem] rounded-lg" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-7 py-2">
              {Array.from({ length: DAYS }, (_, day) => (
                <Skeleton key={day} className="mx-auto h-4 w-7 rounded" />
              ))}
            </div>
            {Array.from({ length: WEEKS }, (_, week) => (
              <div key={week} className="grid grid-cols-7 border-t border-slate-200/80 dark:border-slate-800">
                {Array.from({ length: DAYS }, (_, day) => (
                  <div
                    key={day}
                    className="flex h-16 justify-center border-slate-200/80 p-1 sm:h-28 sm:justify-start sm:p-1.5 dark:border-slate-800 [&:not(:first-child)]:border-s"
                  >
                    <Skeleton variant="circular" className="size-7" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* DayAgenda: date heading, count, a few event rows. */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-[4.5rem] w-full rounded-lg" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  )
);

CalendarSkeleton.displayName = 'CalendarSkeleton';
