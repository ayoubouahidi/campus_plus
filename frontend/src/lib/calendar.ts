import type { EventItem } from '@/types/api';
import { CAMPUS_TIME_ZONE } from '@/lib/time';

// A calendar date in campus time, 'YYYY-MM-DD'. A plain string so it crosses the server → client
// boundary as-is, compares with ===, and sorts with < (lexical order = date order).
export type DayKey = string;

export interface CalendarDay {
  key: DayKey;
  day: number; // 1–31
  inMonth: boolean; // false for the leading/trailing days borrowed from the neighbouring months
}

const DAY_MS = 86_400_000;

// 6 weeks: every month fits, and the grid keeps the same height from month to month (no layout jump).
export const CALENDAR_WEEKS = 6;

// Monday first (Morocco). Phase 7 translates the labels.
export const WEEKDAYS: { short: string; long: string }[] = [
  { short: 'Mon', long: 'Monday' },
  { short: 'Tue', long: 'Tuesday' },
  { short: 'Wed', long: 'Wednesday' },
  { short: 'Thu', long: 'Thursday' },
  { short: 'Fri', long: 'Friday' },
  { short: 'Sat', long: 'Saturday' },
  { short: 'Sun', long: 'Sunday' },
];

/* ----------------------- Date-only arithmetic (any runtime) ---------------------- */
// A DayKey is mapped to UTC midnight of that date. No time zone is involved, so these give the same
// result on the server and in every browser and are safe in client components.

const keyToUtc = (key: DayKey): number => {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

const utcToKey = (ms: number): DayKey => new Date(ms).toISOString().slice(0, 10);

export const addDays = (key: DayKey, days: number): DayKey => utcToKey(keyToUtc(key) + days * DAY_MS);

// Same day of the month, clamped to the target month's length (Jan 31 + 1 month = Feb 28/29).
export const addMonths = (key: DayKey, months: number): DayKey => {
  const [year, month, day] = key.split('-').map(Number);
  const firstOfTarget = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = firstOfTarget.getUTCFullYear();
  const targetMonth = firstOfTarget.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return utcToKey(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
};

// 0 = Monday … 6 = Sunday.
export const weekdayIndex = (key: DayKey): number => (new Date(keyToUtc(key)).getUTCDay() + 6) % 7;

export const isSameMonth = (a: DayKey, b: DayKey): boolean => a.slice(0, 7) === b.slice(0, 7);

// The 42 days shown for the month containing `key`, Monday of the first week first.
export const buildMonthMatrix = (key: DayKey): CalendarDay[] => {
  const firstOfMonth = `${key.slice(0, 8)}01`;
  const gridStart = addDays(firstOfMonth, -weekdayIndex(firstOfMonth));

  return Array.from({ length: CALENDAR_WEEKS * 7 }, (_, i) => {
    const dayKey = addDays(gridStart, i);
    return { key: dayKey, day: Number(dayKey.slice(8)), inMonth: isSameMonth(dayKey, key) };
  });
};

// The 7 days (Monday → Sunday) of the week containing `key`. inMonth is always true: a week view
// doesn't dim days of the neighbouring month.
export const buildWeekDays = (key: DayKey): CalendarDay[] => {
  const monday = addDays(key, -weekdayIndex(key));
  return Array.from({ length: 7 }, (_, i) => {
    const dayKey = addDays(monday, i);
    return { key: dayKey, day: Number(dayKey.slice(8)), inMonth: true };
  });
};

// Labels for a date (not a moment): formatted in UTC, matching keyToUtc, so client-safe.
const monthTitleFormatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayLabelFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

const shortMonthFormatter = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });

export const formatMonthTitle = (key: DayKey): string => monthTitleFormatter.format(keyToUtc(key)); // "November 2026"
export const formatDayLabel = (key: DayKey): string => dayLabelFormatter.format(keyToUtc(key)); // "Thursday, November 5"

// Monday–Sunday of the week containing `key`: "Nov 2 – 8, 2026", "Nov 30 – Dec 6, 2026",
// "Dec 28, 2026 – Jan 3, 2027". Built by hand rather than with Intl's formatRange, whose spacing
// (thin spaces around the dash) differs between ICU versions, i.e. between server and browser.
export const formatWeekTitle = (key: DayKey): string => {
  const start = addDays(key, -weekdayIndex(key));
  const end = addDays(start, 6);
  const [startYear, endYear] = [start.slice(0, 4), end.slice(0, 4)];
  const [startDay, endDay] = [Number(start.slice(8)), Number(end.slice(8))];
  const [startMonth, endMonth] = [start, end].map((day) => shortMonthFormatter.format(keyToUtc(day)));

  if (startYear !== endYear) return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
  if (startMonth !== endMonth) return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${endYear}`;
  return `${startMonth} ${startDay} – ${endDay}, ${endYear}`;
};

/* ----------------------------------- Views ----------------------------------- */

export type CalendarView = 'month' | 'week';

// Tab order in the calendar header.
export const CALENDAR_VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
];

export const isCalendarView = (value: string): value is CalendarView => value === 'month' || value === 'week';

// What the header's previous / next buttons do in each view (direction -1 or 1).
export const CALENDAR_STEPS: Record<CalendarView, (key: DayKey, direction: -1 | 1) => DayKey> = {
  month: (key, direction) => addMonths(key, direction),
  week: (key, direction) => addDays(key, 7 * direction),
};

export const CALENDAR_TITLES: Record<CalendarView, (key: DayKey) => string> = {
  month: formatMonthTitle,
  week: formatWeekTitle,
};

/* --------------------------- Moments → days (server only) -------------------------- */
// Turning a moment into a campus date needs time-zone data, which differs between runtimes
// (see CAMPUS_TIME_ZONE in lib/time.ts). Run these on the server and pass the result down.

const campusDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const toCampusDayKey = (ms: number): DayKey => {
  const parts = Object.fromEntries(campusDateFormatter.formatToParts(ms).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

// First and last campus day of an event. The end is exclusive: an event ending at exactly midnight
// doesn't spill into the next day.
const getEventDaySpan = (event: EventItem): { first: DayKey; last: DayKey } => {
  const start = Date.parse(event.start_time);
  return {
    first: toCampusDayKey(start),
    last: toCampusDayKey(Math.max(start, Date.parse(event.end_time) - 1)),
  };
};

// Event ids per campus day, each day in start-time order. A multi-day event is listed on every day it covers.
// Ids, not events: the client keeps one copy of each event (so an RSVP updates it everywhere).
export const getEventIdsByDay = (events: EventItem[]): Record<DayKey, string[]> => {
  const byDay: Record<DayKey, string[]> = {};
  const sorted = [...events].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));

  for (const event of sorted) {
    const { first, last } = getEventDaySpan(event);
    for (let day = first; day <= last; day = addDays(day, 1)) {
      (byDay[day] ??= []).push(event.id);
    }
  }
  return byDay;
};

// Start/end of an event in campus time, pre-formatted on the server ("5:00 PM").
export interface EventTimes {
  startDay: DayKey;
  endDay: DayKey;
  start: string;
  end: string;
}

const campusTimeFormatter = new Intl.DateTimeFormat('en', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: CAMPUS_TIME_ZONE,
});

export const getEventTimes = (events: EventItem[]): Record<string, EventTimes> =>
  Object.fromEntries(
    events.map((event) => {
      const { first, last } = getEventDaySpan(event);
      return [
        event.id,
        {
          startDay: first,
          endDay: last,
          start: campusTimeFormatter.format(Date.parse(event.start_time)),
          end: campusTimeFormatter.format(Date.parse(event.end_time)),
        },
      ];
    })
  );

// Date and time lines for the event page, in campus time. Server only.
//   One day:   "Thursday, November 5, 2026"                        · "5:00 PM – 8:00 PM"
//   Multi-day: "Friday, November 13 – Sunday, November 15, 2026"   · "Starts 8:00 AM, ends 5:00 PM"
// The year is written once when both days share it. Built by hand (not formatRange) for the same reason
// as formatWeekTitle: ICU versions disagree on the spacing.
export interface EventDateDetails {
  date: string;
  time: string;
  isMultiDay: boolean;
}

const campusLongDayFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: CAMPUS_TIME_ZONE,
});

export const getEventDateDetails = (event: EventItem): EventDateDetails => {
  const { first, last } = getEventDaySpan(event);
  const startMs = Date.parse(event.start_time);
  const endMs = Date.parse(event.end_time);
  const [start, end] = [campusTimeFormatter.format(startMs), campusTimeFormatter.format(endMs)];
  const [startYear, endYear] = [first.slice(0, 4), last.slice(0, 4)];

  if (first === last) {
    return { date: `${campusLongDayFormatter.format(startMs)}, ${startYear}`, time: `${start} – ${end}`, isMultiDay: false };
  }

  const startDay = campusLongDayFormatter.format(startMs);
  // The last day is the one before an exclusive midnight end (see getEventDaySpan).
  const endDay = campusLongDayFormatter.format(Math.max(startMs, endMs - 1));
  const date =
    startYear === endYear ? `${startDay} – ${endDay}, ${endYear}` : `${startDay}, ${startYear} – ${endDay}, ${endYear}`;
  return { date, time: `Starts ${start}, ends ${end}`, isMultiDay: true };
};

/* ------------------------- Agenda time label (any runtime) ------------------------- */

// What an event's time looks like on one given day of the agenda. Pure string work on server-made
// values, so it is client-safe.
export const formatAgendaTime = ({ startDay, endDay, start, end }: EventTimes, day: DayKey): string => {
  if (startDay === endDay) return `${start} – ${end}`;
  if (day === startDay) return `From ${start}`;
  if (day === endDay) return `Until ${end}`;
  return 'All day';
};
