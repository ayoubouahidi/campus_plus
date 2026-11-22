import React from 'react';
import { useTranslations } from 'next-intl';
import { CAMPUS_FILTERS, CAMPUS_NAMES, type CampusFilter } from '@/lib/events';

export interface CampusToggleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: CampusFilter;
  onChange: (campus: CampusFilter) => void;
}

const buttonStyles: Record<'selected' | 'idle', string> = {
  selected: 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100',
  idle: 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
};

// All / 1337 / EMINES, shared by the event feed and the clubs directory.
// Single-choice toggle group (aria-pressed buttons). Not Tabs: there is one shared list, not one panel per campus.
export const CampusToggle = React.forwardRef<HTMLDivElement, CampusToggleProps>(
  ({ value, onChange, className = '', ...props }, ref) => {
    const t = useTranslations('Feed');
    return (
      <div
        ref={ref}
        role="group"
        aria-label={t('campus')}
        className={`inline-flex w-full items-center rounded-xl border border-slate-200/80 bg-slate-100 p-1 sm:w-auto dark:border-slate-800 dark:bg-slate-900 ${className}`}
        {...props}
      >
        {CAMPUS_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 motion-reduce:transition-none sm:flex-none ${
              buttonStyles[value === option ? 'selected' : 'idle']
            }`}
          >
            {option === 'all' ? t('allCampuses') : CAMPUS_NAMES[option]}
          </button>
        ))}
      </div>
    );
  }
);

CampusToggle.displayName = 'CampusToggle';
