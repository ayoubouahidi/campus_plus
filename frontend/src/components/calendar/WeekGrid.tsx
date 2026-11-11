'use client';

import React from 'react';
import type { EventItem } from '@/types/api';
import {
  WEEKDAYS,
  buildWeekDays,
  formatAgendaTime,
  formatDayLabel,
  formatWeekTitle,
  type DayKey,
  type EventTimes,
} from '@/lib/calendar';
import { useDayGridNavigation } from '@/hooks/useDayGridNavigation';
import { useMergedRef } from '@/lib/refs';
import {
  MAX_DOTS,
  chipStyles,
  dayCellStyles,
  dayNumberStyles,
  describeCount,
  dotStyles,
  getDayTone,
} from './dayStyles';

/* --------------------------------- Types ---------------------------------- */

export interface WeekGridProps extends React.TableHTMLAttributes<HTMLTableElement> {
  // The selected day. It also decides which week is shown.
  selectedKey: DayKey;
  todayKey: DayKey;
  eventsByDay: Record<DayKey, EventItem[]>;
  // From getEventTimes on the server; the chips show each event's time for that day.
  eventTimes: Record<string, EventTimes>;
  onSelectDay: (key: DayKey) => void;
}

const MAX_CHIPS = 4; // events shown per day from `md` up; the agenda lists them all

/* -------------------------------- WeekGrid -------------------------------- */

// One row of 7 tall day columns. Same grid semantics and keys as MonthGrid (↑ / ↓ go to the
// previous / next week). Below `md` the columns are too narrow for text: dots, like the month view.
export const WeekGrid = React.forwardRef<HTMLTableElement, WeekGridProps>(
  ({ selectedKey, todayKey, eventsByDay, eventTimes, onSelectDay, className = '', onKeyDown, ...props }, ref) => {
    const { gridRef, selectDay, handleKeyDown } = useDayGridNavigation<HTMLTableElement>(selectedKey, onSelectDay);
    const mergedRef = useMergedRef(ref, gridRef);

    const days = buildWeekDays(selectedKey);

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table
          ref={mergedRef}
          role="grid"
          aria-label={formatWeekTitle(selectedKey)}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            handleKeyDown(event);
          }}
          className={`w-full table-fixed border-collapse ${className}`}
          {...props}
        >
          <thead>
            <tr>
              {WEEKDAYS.map(({ short, long }) => (
                <th key={short} scope="col" className="py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <abbr title={long} className="no-underline">
                    {short}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {days.map(({ key, day, inMonth }) => {
                const events = eventsByDay[key] ?? [];
                const isSelected = key === selectedKey;
                const tone = getDayTone(key, inMonth, todayKey, selectedKey);

                return (
                  <td
                    key={key}
                    aria-selected={isSelected}
                    className="border-t border-slate-200/80 p-0 align-top dark:border-slate-800 [&:not(:first-child)]:border-l"
                  >
                    <button
                      type="button"
                      data-day={key}
                      tabIndex={isSelected ? 0 : -1}
                      aria-label={`${formatDayLabel(key)}, ${describeCount(events.length)}`}
                      aria-current={key === todayKey ? 'date' : undefined}
                      onClick={() => selectDay(key)}
                      className={`flex h-20 w-full flex-col items-center gap-1.5 overflow-hidden p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 md:h-80 md:items-stretch md:p-1.5 ${
                        isSelected ? dayCellStyles.selected : dayCellStyles.idle
                      }`}
                    >
                      <span
                        className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-base md:self-start ${dayNumberStyles[tone]}`}
                      >
                        {day}
                      </span>

                      {/* Below md: dots (decorative; the count is in aria-label). */}
                      {events.length > 0 && (
                        <span aria-hidden="true" className="flex gap-0.5 md:hidden">
                          {events.slice(0, MAX_DOTS).map((item) => (
                            <span key={item.id} className={`size-1.5 rounded-full ${dotStyles[item.category]}`} />
                          ))}
                        </span>
                      )}

                      {/* md and up: time + title. Hidden from screen readers: the agenda lists them. */}
                      <span aria-hidden="true" className="hidden min-w-0 flex-col gap-1 md:flex">
                        {events.slice(0, MAX_CHIPS).map((item) => {
                          const times = eventTimes[item.id];
                          return (
                            <span
                              key={item.id}
                              className={`block rounded px-1.5 py-1 text-start text-xs ${chipStyles[item.category]}`}
                            >
                              {times && <span className="block font-semibold">{formatAgendaTime(times, key)}</span>}
                              <span className="line-clamp-2 font-medium">{item.title}</span>
                            </span>
                          );
                        })}
                        {events.length > MAX_CHIPS && (
                          <span className="px-1.5 text-start text-xs text-slate-500 dark:text-slate-400">
                            +{events.length - MAX_CHIPS} more
                          </span>
                        )}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
);

WeekGrid.displayName = 'WeekGrid';
