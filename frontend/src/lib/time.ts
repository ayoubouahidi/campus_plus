import { intlLocale } from '@/i18n/config';

// Largest unit first; the first one that fits the gap is used ("3 hours ago", not "180 minutes ago").
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

// One formatter per language, built on first use (building an Intl formatter is the slow part).
// `locale` = the active language (useLocale() / getLocale(), Steps 12.2–12.3); 'en' by default.
// cachedFormatter(build)(locale) returns the formatter for that language, building it once.
export const cachedFormatter = <T>(build: (intlTag: string) => T) => {
  const cache = new Map<string, T>();
  return (locale: string): T => {
    let formatter = cache.get(locale);
    if (!formatter) {
      formatter = build(intlLocale(locale));
      cache.set(locale, formatter);
    }
    return formatter;
  };
};

const relativeFormatter = cachedFormatter((tag) => new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }));
const absoluteFormatter = cachedFormatter((tag) => new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' }));

// Pure: `now` is passed in so the caller decides when time "moves" and tests stay deterministic.
// Under 45 s: "now" / "maintenant" / "الآن" (Intl's own word for 0 seconds with numeric: 'auto').
export const formatRelativeTime = (iso: string, now: number, locale = 'en'): string => {
  const diffSeconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (Math.abs(diffSeconds) < 45) return relativeFormatter(locale).format(0, 'second');

  const [unit, unitSeconds] =
    RELATIVE_UNITS.find(([, seconds]) => Math.abs(diffSeconds) >= seconds) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return relativeFormatter(locale).format(Math.round(diffSeconds / unitSeconds), unit);
};

export const formatAbsoluteTime = (iso: string, locale = 'en'): string => absoluteFormatter(locale).format(new Date(iso));

// Event times are shown in campus time, whatever the viewer's device says.
// Pinning the zone is NOT enough for server/browser agreement: each runtime ships its own copy of the
// time-zone database, and Morocco's offset changes by decree (tzdata 2026e has GMT+0 from Oct 2026,
// older browsers still say GMT+1). So formatEventSchedule must run on the server only, and the result
// is passed to client components as a string. See DOCS.md §5.2.
export const CAMPUS_TIME_ZONE = 'Africa/Casablanca';

export interface EventSchedule {
  day: string;
  time: string;
}

const eventDayFormatter = cachedFormatter(
  (tag) => new Intl.DateTimeFormat(tag, { weekday: 'short', month: 'short', day: 'numeric', timeZone: CAMPUS_TIME_ZONE })
);
// Exported for lib/calendar.ts (the event page's time range). 12-hour in English, 24-hour in French.
export const eventTimeFormatter = cachedFormatter(
  (tag) => new Intl.DateTimeFormat(tag, { hour: 'numeric', minute: '2-digit', timeZone: CAMPUS_TIME_ZONE })
);

// "Thu, Nov 5" and "5:00 PM" ("ven. 20 nov." and "16:00" in French), kept separate so the card can lay them
// out with a separator. Server only (see CAMPUS_TIME_ZONE). Use getEventSchedules to format a whole list.
export const formatEventSchedule = (iso: string, locale = 'en'): EventSchedule => {
  const date = new Date(iso);
  return { day: eventDayFormatter(locale).format(date), time: eventTimeFormatter(locale).format(date) };
};

// Formats every event once, on the server, keyed by event id. Client components read from this map
// instead of formatting, so their output never depends on the browser's time-zone data.
// Pass the request's language (getLocale()); the strings are then in that language (Step 12.3).
export const getEventSchedules = (
  events: { id: string; start_time: string }[],
  locale = 'en'
): Record<string, EventSchedule> =>
  Object.fromEntries(events.map((event) => [event.id, formatEventSchedule(event.start_time, locale)]));

// Calendar-style date tile ("NOV" over "14") for event rows (/profile, Step 5.4). Server only (campus time zone).
export interface DateTile {
  month: string; // "NOV"
  day: string; // "14" (2 digits)
}

const tileMonthFormatter = new Intl.DateTimeFormat('en', { month: 'short', timeZone: CAMPUS_TIME_ZONE });
const tileDayFormatter = new Intl.DateTimeFormat('en', { day: '2-digit', timeZone: CAMPUS_TIME_ZONE });

export const formatDateTile = (iso: string): DateTile => {
  const date = new Date(iso);
  return { month: tileMonthFormatter.format(date).toUpperCase(), day: tileDayFormatter.format(date) };
};

export const getDateTiles = (events: { id: string; start_time: string }[]): Record<string, DateTile> =>
  Object.fromEntries(events.map((event) => [event.id, formatDateTile(event.start_time)]));
