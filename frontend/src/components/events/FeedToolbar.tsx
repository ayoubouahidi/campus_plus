import React from 'react';
import { CAMPUS_FILTERS, CampusFilter, formatEventCount } from '@/lib/events';

export interface FeedToolbarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  campus: CampusFilter;
  onCampusChange: (campus: CampusFilter) => void;
  resultCount: number;
  children?: React.ReactNode; // extra filters inside the same search landmark (the CategoryFilter row)
}

const campusButtonStyles: Record<'selected' | 'idle', string> = {
  selected: 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100',
  idle: 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
};

// No text search here on purpose: the navbar's search (⌘K, "Search events…") is the site's only search box.
export const FeedToolbar = React.forwardRef<HTMLDivElement, FeedToolbarProps>(
  ({ campus, onCampusChange, resultCount, children, className = '', ...props }, ref) => (
    <div ref={ref} className={`space-y-4 ${className}`} {...props}>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Upcoming events</h1>
        {/* Polite live region: screen readers hear "1 event" after a filter changes. */}
        <p aria-live="polite" className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
          {formatEventCount(resultCount)}
        </p>
      </div>

      {/* <search> is the HTML landmark for filtering controls ("search" in a screen reader's landmark list). */}
      <search aria-label="Filter events" className="block space-y-4">
        {/* Single-choice toggle group. Not Tabs: there is one shared grid, not one panel per campus. */}
        <div
          role="group"
          aria-label="Campus"
          className="inline-flex w-full items-center rounded-xl border border-slate-200/80 bg-slate-100 p-1 sm:w-auto dark:border-slate-800 dark:bg-slate-900"
        >
          {CAMPUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={campus === value}
              onClick={() => onCampusChange(value)}
              className={`flex-1 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 motion-reduce:transition-none sm:flex-none ${
                campusButtonStyles[campus === value ? 'selected' : 'idle']
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {children}
      </search>
    </div>
  )
);

FeedToolbar.displayName = 'FeedToolbar';
