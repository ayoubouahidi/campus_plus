import React from 'react';
import { useTranslations } from 'next-intl';
import { EventCardSkeleton } from '@/components/events/EventSkeletons';
import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton';
import { PROFILE_PANEL } from './profileStyles';

// Figma "My Profile · Desktop · Loading": same boxes as the real page (heading row, hero, stats, events
// header + 3 cards, recently attended rows) so nothing jumps. Change the profile components → change this.
export const ProfileSkeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <SkeletonRegion ref={ref} label={useTranslations('Profile')('loading')} className={className} {...props}>
      <div aria-hidden="true" className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-11 w-28 rounded-lg" />
        </div>

        <div className={`relative overflow-hidden ${PROFILE_PANEL}`}>
          <Skeleton variant="rectangular" className="h-[104px] w-full" />
          <div className="flex flex-col gap-4 px-5 pb-6 sm:flex-row sm:py-6 sm:pe-8 sm:ps-40">
            <Skeleton
              variant="circular"
              className="-mt-[52px] h-[104px] w-[104px] ring-[5px] ring-white sm:absolute sm:top-[63px] sm:start-[31px] sm:mt-0 dark:ring-slate-900"
            />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-9 w-56 rounded-lg" />
              <Skeleton className="h-6 w-44 rounded" />
              <Skeleton className="h-4 w-40 rounded" />
            </div>
            <div className="flex gap-2 sm:flex-col">
              <Skeleton className="h-11 w-32 rounded-lg" />
              <Skeleton className="h-11 w-32 rounded-lg" />
            </div>
          </div>
        </div>

        <div className={`flex ${PROFILE_PANEL}`}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 items-center gap-2 px-6 py-5">
              <Skeleton className="hidden size-11 rounded-[10px] sm:block" />
              <div className="space-y-1.5">
                <Skeleton className="h-7 w-8 rounded" />
                <Skeleton className="h-3.5 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32 rounded" />
            <Skeleton className="hidden h-4 w-64 rounded sm:block" />
          </div>
          <Skeleton className="hidden h-[52px] w-60 rounded-xl sm:block" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>

        <div className="space-y-4 pt-2">
          <Skeleton className="h-6 w-40 rounded" />
          <div className={`divide-y divide-slate-200/80 px-6 dark:divide-slate-800 ${PROFILE_PANEL}`}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                <Skeleton className="h-[52px] w-[52px] rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-56 rounded" />
                  <Skeleton className="h-3 w-36 rounded" />
                </div>
                <Skeleton className="h-6 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonRegion>
  )
);

ProfileSkeleton.displayName = 'ProfileSkeleton';
