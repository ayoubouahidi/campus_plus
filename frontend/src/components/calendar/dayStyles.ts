import type { EventCategory } from '@/types/api';
import type { DayKey } from '@/lib/calendar';

// Shared look of a day cell in MonthGrid and WeekGrid, so both views always match.

export type DayTone = 'today' | 'selected' | 'inMonth' | 'outside';

export const dayNumberStyles: Record<DayTone, string> = {
  today: 'bg-violet-600 font-semibold text-white dark:bg-violet-500',
  selected: 'font-semibold text-violet-700 dark:text-violet-300',
  inMonth: 'text-slate-900 dark:text-slate-100',
  outside: 'text-slate-400 dark:text-slate-600',
};

// Priority: today > selected > in month > outside.
export const getDayTone = (key: DayKey, inMonth: boolean, todayKey: DayKey, selectedKey: DayKey): DayTone => {
  if (key === todayKey) return 'today';
  if (key === selectedKey) return 'selected';
  return inMonth ? 'inMonth' : 'outside';
};

// Background of the whole cell button.
export const dayCellStyles = {
  selected: 'bg-violet-50 dark:bg-violet-500/10',
  idle: 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
} as const;

// Same tints as Badge's category styles, at chip size.
export const chipStyles: Record<EventCategory, string> = {
  Tech: 'bg-lime-500/15 text-lime-700 dark:text-lime-400',
  Media: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  Music: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
  Sports: 'bg-teal-500/15 text-teal-700 dark:text-teal-400',
  Business: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  Gaming: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400',
  EventsOrganization: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
};

export const dotStyles: Record<EventCategory, string> = {
  Tech: 'bg-lime-500',
  Media: 'bg-violet-500',
  Music: 'bg-indigo-500',
  Sports: 'bg-teal-500',
  Business: 'bg-orange-500',
  Gaming: 'bg-fuchsia-500',
  EventsOrganization: 'bg-sky-500',
};

export const MAX_DOTS = 3; // dots per day on phones

export const describeCount = (count: number): string =>
  count === 0 ? 'no events' : `${count} ${count === 1 ? 'event' : 'events'}`;
