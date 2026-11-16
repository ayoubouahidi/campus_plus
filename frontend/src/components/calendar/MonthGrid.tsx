'use client';

import React from 'react';
import type { EventItem } from '@/types/api';
import { WEEKDAYS, buildMonthMatrix, formatDayLabel, formatMonthTitle, type DayKey } from '@/lib/calendar';
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

export interface MonthGridProps extends React.TableHTMLAttributes<HTMLTableElement> {
  // The selected day. It also decides which month is shown, so the selection is always visible.
  selectedKey: DayKey;
  // Today in campus time, computed on the server (toCampusDayKey).
  todayKey: DayKey;
  // Events per day, in start-time order (built from getEventIdsByDay on the server).
  eventsByDay: Record<DayKey, EventItem[]>;
  onSelectDay: (key: DayKey) => void;
}

const MAX_CHIPS = 2; // titles shown per day from `sm` up

/* -------------------------------- MonthGrid ------------------------------- */

export const MonthGrid = React.forwardRef<HTMLTableElement, MonthGridProps>(
  ({ selectedKey, todayKey, eventsByDay, onSelectDay, className = '', onKeyDown, ...props }, ref) => {
    const { gridRef, selectDay, handleKeyDown } = useDayGridNavigation<HTMLTableElement>(selectedKey, onSelectDay);
    const mergedRef = useMergedRef(ref, gridRef);

    const days = buildMonthMatrix(selectedKey);
    const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table
          ref={mergedRef}
          role="grid"
          aria-label={formatMonthTitle(selectedKey)}
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
            {weeks.map((week) => (
              <tr key={week[0].key}>
                {week.map(({ key, day, inMonth }) => {
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
                        className={`flex h-16 w-full flex-col items-center gap-1 p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 sm:h-28 sm:items-stretch sm:p-1.5 ${
                          isSelected ? dayCellStyles.selected : dayCellStyles.idle
                        }`}
                      >
                        <span
                          className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm sm:self-start ${dayNumberStyles[tone]}`}
                        >
                          {day}
                        </span>

                        {/* Phones: one dot per event (decorative; the count is in aria-label). */}
                        {events.length > 0 && (
                          <span aria-hidden="true" className="flex gap-0.5 sm:hidden">
                            {events.slice(0, MAX_DOTS).map((item) => (
                              <span key={item.id} className={`size-1.5 rounded-full ${dotStyles[item.category]}`} />
                            ))}
                          </span>
                        )}

                        {/* sm and up: titles. Hidden from screen readers: the agenda lists them. */}
                        <span aria-hidden="true" className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                          {events.slice(0, MAX_CHIPS).map((item) => (
                            <span
                              key={item.id}
                              className={`truncate rounded px-1.5 py-0.5 text-start text-xs font-medium ${chipStyles[item.category]}`}
                            >
                              {item.title}
                            </span>
                          ))}
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
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

MonthGrid.displayName = 'MonthGrid';
