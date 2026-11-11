'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { IconBase, type NavIconProps } from '@/components/ui/layout/navIcons';
import { CALENDAR_VIEWS, type CalendarView } from '@/lib/calendar';

/* --------------------------------- Types ---------------------------------- */

export interface CalendarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  // "November 2026" or "Nov 2 – 8, 2026" (CALENDAR_TITLES[view](selectedKey)).
  title: string;
  view: CalendarView;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  headingLevel?: 'h1' | 'h2';
}

/* --------------------------------- Labels --------------------------------- */

// Icon-only buttons need a name, and it depends on what they step through.
const STEP_LABELS: Record<CalendarView, { previous: string; next: string }> = {
  month: { previous: 'Previous month', next: 'Next month' },
  week: { previous: 'Previous week', next: 'Next week' },
};

// rtl:-scale-x-100: in Arabic "previous" is on the right, so the arrows point the other way.
const ChevronLeftIcon = (props: NavIconProps) => (
  <IconBase className="h-5 w-5 rtl:-scale-x-100" {...props}>
    <path d="m15 18-6-6 6-6" />
  </IconBase>
);

const ChevronRightIcon = (props: NavIconProps) => (
  <IconBase className="h-5 w-5 rtl:-scale-x-100" {...props}>
    <path d="m9 18 6-6-6-6" />
  </IconBase>
);

/* ----------------------------- CalendarHeader ----------------------------- */

// Must sit inside <Tabs value={view}>: it renders the tab list, the page renders one <TabsContent> per view.
export const CalendarHeader = React.forwardRef<HTMLDivElement, CalendarHeaderProps>(
  ({ title, view, onPrevious, onNext, onToday, headingLevel: Heading = 'h2', className = '', ...props }, ref) => (
    <div ref={ref} className={`flex flex-wrap items-center justify-between gap-3 ${className}`} {...props}>
      {/* aria-live: after "Next month" the focus stays on the button, so the new title is announced. */}
      <Heading aria-live="polite" className="text-xl font-semibold text-slate-900 sm:text-2xl dark:text-slate-100">
        {title}
      </Heading>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="md" onClick={onToday}>
          Today
        </Button>

        <div className="flex items-center">
          <Button variant="ghost" size="md" className="px-2" aria-label={STEP_LABELS[view].previous} onClick={onPrevious}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="md" className="px-2" aria-label={STEP_LABELS[view].next} onClick={onNext}>
            <ChevronRightIcon />
          </Button>
        </div>

        <TabsList aria-label="Calendar view">
          {CALENDAR_VIEWS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </div>
  )
);

CalendarHeader.displayName = 'CalendarHeader';
