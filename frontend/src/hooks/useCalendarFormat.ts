import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  dayParts,
  getAgendaTimeKind,
  weekBounds,
  type CalendarNames,
  type CalendarView,
  type DayKey,
  type EventTimes,
} from '@/lib/calendar';

export interface CalendarFormat {
  monthTitle: (key: DayKey) => string; // "November 2026", "novembre 2026", "نونبر 2026"
  weekTitle: (key: DayKey) => string; // "Nov 2 – 8, 2026", "2 – 8 nov. 2026", "2 – 8 نونبر 2026"
  dayLabel: (key: DayKey) => string; // "Thursday, November 5", "jeudi 5 novembre", "الخميس، 5 نونبر"
  agendaTime: (times: EventTimes, day: DayKey) => string; // "From 8:00 AM", "Dès 8:00", "من 8:00"
  title: Record<CalendarView, (key: DayKey) => string>; // header title per view
}

// The calendar's labels in the visitor's language (Step 12.4, DOCS.md §12.4). `names` comes from the server
// (getCalendarNames), the word order from the Calendar messages: no Intl call here, so the server render and
// the browser render are identical (no hydration mismatch, whatever ICU version the browser has).
export const useCalendarFormat = (names: CalendarNames): CalendarFormat => {
  const t = useTranslations('Calendar');

  return useMemo(() => {
    const monthTitle = (key: DayKey) => {
      const { year, monthIndex } = dayParts(key);
      return t('monthTitle', { month: names.months[monthIndex], year });
    };

    // Same month: the month once. Across months: both months. Across years: both years.
    const weekTitle = (key: DayKey) => {
      const { start, end } = weekBounds(key);
      const [a, b] = [dayParts(start), dayParts(end)];
      const [startMonth, endMonth] = [names.monthsShort[a.monthIndex], names.monthsShort[b.monthIndex]];
      if (a.year !== b.year) {
        return t('weekCrossYear', { startMonth, startDay: a.day, startYear: a.year, endMonth, endDay: b.day, endYear: b.year });
      }
      if (a.monthIndex !== b.monthIndex) {
        return t('weekCrossMonth', { startMonth, startDay: a.day, endMonth, endDay: b.day, year: b.year });
      }
      return t('weekSameMonth', { month: startMonth, startDay: a.day, endDay: b.day, year: b.year });
    };

    const dayLabel = (key: DayKey) => {
      const { monthIndex, day, weekdayIndex } = dayParts(key);
      return t('dayLabel', { weekday: names.weekdays[weekdayIndex].long, month: names.months[monthIndex], day });
    };

    const agendaTime = (times: EventTimes, day: DayKey) =>
      t(getAgendaTimeKind(times, day), { start: times.start, end: times.end });

    return { monthTitle, weekTitle, dayLabel, agendaTime, title: { month: monthTitle, week: weekTitle } };
  }, [names, t]);
};
