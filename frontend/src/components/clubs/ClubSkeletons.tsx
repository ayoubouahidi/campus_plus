import React from 'react';
import { useTranslations } from 'next-intl';
import { EventGridSkeleton } from '@/components/events/EventSkeletons';
import { Card, CardFooter } from '@/components/ui/Card';
import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton';

// Loading placeholders for the club views, copying the real components' boxes so nothing jumps when the
// content arrives. Change ClubCard / ClubDirectory / ClubHeader → change these too. Server-safe.

/* ----------------------------- ClubCardSkeleton --------------------------- */

// Mirrors ClubCard: 21:9 banner · logo overlapping it · name · department · 2-line description · footer.
export const ClubCardSkeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <Card ref={ref} aria-hidden="true" className={`flex h-full flex-col ${className}`} {...props}>
      <Skeleton variant="rectangular" className="aspect-[21/9] w-full" />

      <div className="flex flex-1 flex-col px-5">
        {/* Avatar size="lg" (48px), pulled up over the banner, ring = card colour. */}
        <Skeleton
          variant="circular"
          className="-mt-6 h-12 w-12 bg-slate-200 ring-4 ring-white dark:bg-slate-800 dark:ring-slate-900"
        />
        <Skeleton className="mt-4 h-5 w-2/3 rounded" />
        <Skeleton className="mt-1.5 h-4 w-1/3 rounded" />
        <div className="mt-3 space-y-1.5">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
        </div>
      </div>

      <CardFooter className="justify-start">
        <Skeleton className="h-4 w-36 rounded" />
      </CardFooter>
    </Card>
  )
);

ClubCardSkeleton.displayName = 'ClubCardSkeleton';

/* -------------------------- ClubDirectorySkeleton ------------------------- */

// Mirrors ClubDirectory: heading + count · intro text · grid. For app/clubs/loading.tsx.
export const ClubDirectorySkeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <SkeletonRegion ref={ref} label={useTranslations('Clubs')('loading')} className={`space-y-8 ${className}`} {...props}>
      <div className="space-y-4" aria-hidden="true">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <div className="max-w-2xl space-y-1.5">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
        </div>
      </div>

      <div aria-hidden="true" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <ClubCardSkeleton key={index} />
        ))}
      </div>
    </SkeletonRegion>
  )
);

ClubDirectorySkeleton.displayName = 'ClubDirectorySkeleton';

/* ----------------------------- ClubPageSkeleton --------------------------- */

// Mirrors /clubs/[slug]: back link · banner + logo + name · about + contact card · upcoming events grid.
// For app/clubs/[slug]/loading.tsx.
export const ClubPageSkeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <SkeletonRegion ref={ref} label={useTranslations('Clubs')('loadingClub')} className={className} {...props}>
      <div aria-hidden="true">
        <Skeleton className="mb-6 h-5 w-20 rounded" />

        <div className="space-y-6">
          <div>
            <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
            <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-end sm:gap-5 sm:px-6">
              {/* Avatar size="xl" (64px), ring = page background. */}
              <Skeleton
                variant="circular"
                className="-mt-8 h-16 w-16 bg-slate-200 ring-4 ring-slate-50 sm:-mt-10 dark:bg-slate-800 dark:ring-slate-950"
              />
              <div className="space-y-2 sm:pb-1">
                <Skeleton className="h-8 w-56 rounded-lg sm:h-9" />
                <Skeleton className="h-4 w-40 rounded" />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-3">
              <Skeleton className="h-6 w-20 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/5 rounded" />
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
            </div>
          </div>
        </div>

        <div className="mt-12 space-y-4">
          <Skeleton className="h-6 w-44 rounded" />
          <EventGridSkeleton count={3} />
        </div>
      </div>
    </SkeletonRegion>
  )
);

ClubPageSkeleton.displayName = 'ClubPageSkeleton';
