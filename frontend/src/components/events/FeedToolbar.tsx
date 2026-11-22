import React from 'react';
import { useTranslations } from 'next-intl';
import { CampusToggle } from '@/components/filters/CampusToggle';
import { CampusFilter } from '@/lib/events';

export interface FeedToolbarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  campus: CampusFilter;
  onCampusChange: (campus: CampusFilter) => void;
  resultCount: number;
  children?: React.ReactNode; // extra filters inside the same search landmark (the CategoryFilter row)
}

// No text search here on purpose: the navbar's search (⌘K, "Search events…") is the site's only search box.
export const FeedToolbar = React.forwardRef<HTMLDivElement, FeedToolbarProps>(
  ({ campus, onCampusChange, resultCount, children, className = '', ...props }, ref) => {
    const t = useTranslations('Feed');
    const tEvents = useTranslations('Events');
    return (
      <div ref={ref} className={`space-y-4 ${className}`} {...props}>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('title')}</h1>
          {/* Polite live region: screen readers hear "1 event" after a filter changes. */}
          <p aria-live="polite" className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
            {tEvents('count', { count: resultCount })}
          </p>
        </div>

        {/* <search> is the HTML landmark for filtering controls ("search" in a screen reader's landmark list). */}
        <search aria-label={t('filters')} className="block space-y-4">
          <CampusToggle value={campus} onChange={onCampusChange} />

          {children}
        </search>
      </div>
    );
  }
);

FeedToolbar.displayName = 'FeedToolbar';
