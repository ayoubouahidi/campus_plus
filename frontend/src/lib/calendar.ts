import type { EventItem } from '@/types/api';
import { CAMPUS_TIME_ZONE, cachedFormatter, eventTimeFormatter } from '@/lib/time';

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

/* ------------------------- Names and labels (Step 12.4) ------------------------- */
// The calendar re-renders in the browser on every click (another month, another day), so its labels are
// built on both sides. Intl's output can differ between the server's and the browser's ICU versions
// (spacing, Arabic commas, month spellings), which would break hydration. So Intl runs on the server
// only, once per language: getCalendarNames() returns the bare month and weekday names in the visitor's
// language, the page passes them down as a prop, and the client only puts them into message templates
// (useCalendarFormat, Calendar.* messages). Same strings on both sides, by construction.

export interface WeekdayNames {
  long: string; // "Monday", "lundi", "الاثنين": the <abbr> title and the screen-reader name
  short: string; // "Mon", "lun.", "الاثنين": column headers from `sm`
  compact: string; // phones: short, except Arabic, whose short names are full words (too wide for 7 columns): "ن"
}

export interface CalendarNames {
  months: string[]; // 12 long names, January first
  monthsShort: string[]; // 12 short names ("Nov", "nov.", "نونبر")
  weekdays: WeekdayNames[]; // 7, Monday first (Morocco)
}

const nameFormatter = cachedFormatter(
  (tag) => (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { ...options, timeZone: 'UTC' })
);

const calendarNamesCache = new Map<string, CalendarNames>();

// Server only (see above). Dates are UTC midnights, so no time zone can shift the day.
export const getCalendarNames = (locale = 'en'): CalendarNames => {
  const cached = calendarNamesCache.get(locale);
  if (cached) return cached;

  const format = nameFormatter(locale);
  const [monthLong, monthShort] = [format({ month: 'long' }), format({ month: 'short' })];
  const [dayLong, dayShort, dayNarrow] = [format({ weekday: 'long' }), format({ weekday: 'short' }), format({ weekday: 'narrow' })];
  const months = Array.from({ length: 12 }, (_, month) => Date.UTC(2026, month, 15));
  const mondayFirst = Array.from({ length: 7 }, (_, i) => Date.UTC(2026, 10, 2 + i)); // Mon 2 Nov 2026 → Sun 8

  const names: CalendarNames = {
    months: months.map((ms) => monthLong.format(ms)),
    monthsShort: months.map((ms) => monthShort.format(ms)),
    weekdays: mondayFirst.map((ms) => ({
      long: dayLong.format(ms),
      short: dayShort.format(ms),
      compact: (locale === 'ar' ? dayNarrow : dayShort).format(ms),
    })),
  };
  calendarNamesCache.set(locale, names);
  return names;
};

// The pieces of a DayKey the templates need: numbers as strings, so ICU never adds a thousands separator
// to a year ("2,026").
export const dayParts = (key: DayKey) => ({
  year: key.slice(0, 4),
  monthIndex: Number(key.slice(5, 7)) - 1,
  day: String(Number(key.slice(8))),
  weekdayIndex: weekdayIndex(key),
});

// Monday and Sunday of the week containing `key` (for the week title).
export const weekBounds = (key: DayKey): { start: DayKey; end: DayKey } => {
  const start = addDays(key, -weekdayIndex(key));
  return { start, end: addDays(start, 6) };
};

/* ----------------------------------- Views ----------------------------------- */

export type CalendarView = 'month' | 'week';

// Tab order in the calendar header (labels: Calendar.month / Calendar.week).
export const CALENDAR_VIEWS: CalendarView[] = ['month', 'week'];

export const isCalendarView = (value: string): value is CalendarView => value === 'month' || value === 'week';

// What the header's previous / next buttons do in each view (direction -1 or 1).
export const CALENDAR_STEPS: Record<CalendarView, (key: DayKey, direction: -1 | 1) => DayKey> = {
  month: (key, direction) => addMonths(key, direction),
  week: (key, direction) => addDays(key, 7 * direction),
};

/* ---------------------------- URL state (any runtime) ---------------------------- */
// The calendar keeps its place in the query string: /calendar?date=2026-11-21&view=week. Both are optional
// (no date = today, no view = month), so a plain /calendar stays clean and still works when shared.

export interface CalendarLocation {
  date?: DayKey;
  view?: CalendarView;
}

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// A real 'YYYY-MM-DD' date: the round trip rejects 2026-02-30, 2026-13-01 and the like.
export const isDayKey = (value: string | null | undefined): value is DayKey =>
  typeof value === 'string' && DAY_KEY_PATTERN.test(value) && utcToKey(keyToUtc(value)) === value;

// Reads date/view from any query-string source (URLSearchParams, useSearchParams, a page's searchParams via
// a small getter). Invalid values are dropped, never thrown on: a mistyped link still opens the calendar.
export const readCalendarLocation = (get: (name: string) => string | null | undefined): CalendarLocation => {
  const date = get('date');
  const view = get('view');
  return {
    date: isDayKey(date) ? date : undefined,
    view: view && isCalendarView(view) ? view : undefined,
  };
};

// '?date=…&view=week', or '' when everything is default. Month is the default view, so it's left out.
export const calendarQuery = ({ date, view }: CalendarLocation): string => {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (view && view !== 'month') params.set('view', view);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const calendarHref = (location: CalendarLocation = {}): string => `/calendar${calendarQuery(location)}`;

// An event page opened from the calendar remembers where it came from, so its back link can return there.
export const eventFromCalendarHref = (eventId: string, { date, view }: CalendarLocation): string => {
  const params = new URLSearchParams({ from: 'calendar' });
  if (date) params.set('date', date);
  if (view && view !== 'month') params.set('view', view);
  return `/events/${eventId}?${params.toString()}`;
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

// Start/end of an event in campus time, pre-formatted on the server ("5:00 PM", "17:00").
export interface EventTimes {
  startDay: DayKey;
  endDay: DayKey;
  start: string;
  end: string;
}

// Pass the request's language (getLocale()): the times are written in it (Step 12.4).
export const getEventTimes = (events: EventItem[], locale = 'en'): Record<string, EventTimes> => {
  const times = eventTimeFormatter(locale);
  return Object.fromEntries(
    events.map((event) => {
      const { first, last } = getEventDaySpan(event);
      return [
        event.id,
        {
          startDay: first,
          endDay: last,
          start: times.format(Date.parse(event.start_time)),
          end: times.format(Date.parse(event.end_time)),
        },
      ];
    })
  );
};

// Date and time lines for the event page, in campus time and the visitor's language. Server only.
//   One day:   "Thursday, November 5, 2026"                      · "5:00 – 8:00 PM"
//              "jeudi 5 novembre 2026"                           · "17:00 – 20:00"
//   Multi-day: "Friday, November 13 – Sunday, November 15, 2026" · start and end times, worded by
//              <EventDetails> ("Starts 8:00 AM, ends 5:00 PM", EventPage.startsEnds)
// Intl's formatRange writes the range: each language has its own grammar for it (French writes the shared
// month once, Arabic puts the year after a comma), which a hand-built "a – b, year" would get wrong outside
// English. Its spacing differs between ICU versions, which is fine here: this runs on the server only, the
// browser receives the finished string (the calendar's labels, which run in both, use getCalendarNames instead).
export interface EventDateDetails {
  date: string;
  time: string; // one-day events: the time range
  start: string; // start time alone (multi-day events)
  end: string; // end time alone (multi-day events)
  isMultiDay: boolean;
}

const longDayFormatter = cachedFormatter(
  (tag) =>
    new Intl.DateTimeFormat(tag, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: CAMPUS_TIME_ZONE,
    })
);

export const getEventDateDetails = (event: EventItem, locale = 'en'): EventDateDetails => {
  const { first, last } = getEventDaySpan(event);
  const startMs = Date.parse(event.start_time);
  const endMs = Date.parse(event.end_time);
  const times = eventTimeFormatter(locale);
  const [start, end] = [times.format(startMs), times.format(endMs)];

  if (first === last) {
    return { date: longDayFormatter(locale).format(startMs), time: times.formatRange(startMs, endMs), start, end, isMultiDay: false };
  }
  // The last day is the one before an exclusive midnight end (see getEventDaySpan).
  const date = longDayFormatter(locale).formatRange(startMs, Math.max(startMs, endMs - 1));
  return { date, time: `${start} – ${end}`, start, end, isMultiDay: true };
};

/* ------------------------- Agenda time label (any runtime) ------------------------- */

// How an event's time reads on one given day of the agenda: "5:00 PM – 8:00 PM" (one day), "From 8:00 AM"
// (its first day), "Until 5:00 PM" (its last day), "All day" (a day in between). The words are the
// Calendar.timeRange / from / until / allDay messages (useCalendarFormat). Client-safe.
export type AgendaTimeKind = 'timeRange' | 'from' | 'until' | 'allDay';

export const getAgendaTimeKind = ({ startDay, endDay }: EventTimes, day: DayKey): AgendaTimeKind => {
  if (startDay === endDay) return 'timeRange';
  if (day === startDay) return 'from';
  if (day === endDay) return 'until';
  return 'allDay';
};
