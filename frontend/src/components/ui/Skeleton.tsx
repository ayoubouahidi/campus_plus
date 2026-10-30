import React from 'react';

export type SkeletonVariant = 'text' | 'circular' | 'rounded' | 'rectangular';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      variant = 'rounded',
      width,
      height,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<SkeletonVariant, string> = {
      text: 'h-4 w-full rounded',
      circular: 'rounded-full shrink-0',
      rounded: 'rounded-xl',
      rectangular: 'rounded-none',
    };

    return (
      <div
        ref={ref}
        aria-hidden="true"
        style={{
          width,
          height,
          ...style,
        }}
        className={`animate-pulse bg-slate-200/80 dark:bg-slate-800 ${variantStyles[variant]} ${className}`}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

/* ----------------------------- CardSkeleton ------------------------------ */

export interface CardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  hasBanner?: boolean;
}

export const CardSkeleton = React.forwardRef<HTMLDivElement, CardSkeletonProps>(
  ({ hasBanner = true, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={`flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
        {...props}
      >
        <div>
          {/* 1. Flyer Banner Wireframe */}
          {hasBanner && (
            <Skeleton
              variant="rectangular"
              className="aspect-video w-full rounded-none"
            />
          )}

          {/* 2. Header: Badge, Title & Metadata */}
          <div className="space-y-2 p-5 pb-3">
            <div className="flex items-center justify-between">
              {/* Category Badge Placeholder */}
              <Skeleton className="h-5 w-16 rounded-full" />
              {/* Status Badge Placeholder */}
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>

            {/* Event Title Placeholder */}
            <Skeleton className="h-5 w-4/5 pt-1" />

            {/* Date & Location Subtext Placeholder */}
            <Skeleton className="h-3.5 w-1/2" />
          </div>

          {/* 3. Content Body: Natural Multiline Simulation */}
          <div className="space-y-2 p-5 pt-0">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-[92%]" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        </div>

        {/* 4. Footer: Attendee Metrics & Action Button */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 p-5 pt-4 dark:border-slate-800/60">
          {/* Seats / Attendee Counter Placeholder */}
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" className="h-6 w-6" />
            <Skeleton className="h-3.5 w-20" />
          </div>

          {/* Action Button Placeholder (mirrors Button size="sm") */}
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    );
  }
);

CardSkeleton.displayName = 'CardSkeleton';

