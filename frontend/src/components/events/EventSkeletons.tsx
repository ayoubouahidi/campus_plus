import React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardFooter } from '@/components/ui/Card';
import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton';

// Loading placeholders for the event views. Each one copies the real component's boxes (same containers,
// paddings and grid classes), so nothing jumps when the content arrives. Change the real component →
// change its skeleton here too. Server-safe: no state, no JavaScript shipped.

/* ---------------------------- EventCardSkeleton --------------------------- */

// Mirrors EventCard: 16:9 flyer · badge + date · title · location · footer (attendees + RSVP button).
export const EventCardSkeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <Card ref={ref} aria-hidden="true" className={`flex h-full flex-col ${className}`} {...props}>
      <Skeleton variant="rectangular" className="aspect-video w-full" />

      <div className="flex-1 space-y-2 p-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3.5 w-28 rounded" />
        </div>
        {/* Title line is text-lg (28px tall): a 20px bar with 4px above and below. */}
        <Skeleton className="my-1 h-5 w-4/5 rounded" />
        <Skeleton className="my-0.5 h-4 w-2/3 rounded" />
      </div>

      <CardFooter className="gap-3">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} variant="circular" className="h-6 w-6 ring-2 ring-white dark:ring-slate-900" />
            ))}
          </div>
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        {/* Button size="sm": 24px tall. */}
        <Skeleton className="h-6 w-14 rounded-md" />
      </CardFooter>
    </Card>
  )
);

EventCardSkeleton.displayName = 'EventCardSkeleton';

/* ---------------------------- EventGridSkeleton --------------------------- */

export interface EventGridSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number; // default 6: two rows on desktop, enough to fill a phone screen
}

// Same grid classes as EventGrid's <ul>.
export const EventGridSkeleton = React.forwardRef<HTMLDivElement, EventGridSkeletonProps>(
  ({ count = 6, className = '', ...props }, ref) => (
    <div ref={ref} className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 ${className}`} {...props}>
      {Array.from({ length: count }, (_, index) => (
        <EventCardSkeleton key={index} />
      ))}
    </div>
  )
);

EventGridSkeleton.displayName = 'EventGridSkeleton';

/* ---------------------------- EventFeedSkeleton --------------------------- */

// Mirrors EventFeed: heading + count · category chips · grid. For app/loading.tsx.
export const EventFeedSkeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <SkeletonRegion ref={ref} label={useTranslations('Feed')('loading')} className={`space-y-8 ${className}`} {...props}>
      <div className="space-y-4" aria-hidden="true">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-52 rounded-lg" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        {/* CategoryFilter: one row of 32px chips (scrolls on phones, so clipped here). */}
        <div className="flex gap-2 overflow-hidden py-1">
          {['w-12', 'w-16', 'w-20', 'w-16', 'w-24', 'w-20', 'w-36', 'w-20'].map((width, index) => (
            <Skeleton key={index} className={`h-8 shrink-0 rounded-full ${width}`} />
          ))}
        </div>
      </div>

      <EventGridSkeleton />
    </SkeletonRegion>
  )
);

EventFeedSkeleton.displayName = 'EventFeedSkeleton';

/* ---------------------------- EventPageSkeleton --------------------------- */

// Mirrors /events/[id]: back link · (flyer · badge + title · facts box · about · attendees) + RSVP card.
// For app/events/[id]/loading.tsx.
export const EventPageSkeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <SkeletonRegion ref={ref} label={useTranslations('EventPage')('loading')} className={className} {...props}>
      <div aria-hidden="true">
        <Skeleton className="mb-6 h-5 w-24 rounded" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="min-w-0 space-y-8">
            <div className="space-y-6">
              <Skeleton className="aspect-video w-full rounded-2xl" />

              <div className="space-y-3">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-8 w-3/4 rounded-lg sm:h-9" />
              </div>

              {/* The When / Where / Organizer box. */}
              <div className="grid gap-4 rounded-xl border border-slate-200/80 bg-white p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex gap-3">
                    <Skeleton className="mt-0.5 h-5 w-5 shrink-0 rounded" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-12 rounded" />
                      <Skeleton className="h-4 w-3/4 rounded" />
                      <Skeleton className="h-4 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <Skeleton className="h-6 w-20 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-11/12 rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
              </div>
            </div>

            <div className="space-y-3">
              <Skeleton className="h-6 w-36 rounded" />
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {[0, 1, 2, 3].map((index) => (
                    <Skeleton key={index} variant="circular" className="h-8 w-8 ring-2 ring-slate-50 dark:ring-slate-950" />
                  ))}
                </div>
                <Skeleton className="h-4 w-48 rounded" />
              </div>
            </div>
          </div>

          {/* RSVP card from lg. Below lg the real page shows a bar at the bottom of the screen instead; it
              appears with the content (a placeholder bar there would only flash). */}
          <div className="hidden space-y-3 rounded-xl border border-slate-200/80 bg-white p-5 lg:sticky lg:top-20 lg:block dark:border-slate-800 dark:bg-slate-900">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </SkeletonRegion>
  )
);

EventPageSkeleton.displayName = 'EventPageSkeleton';
