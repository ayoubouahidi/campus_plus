// Largest unit first; the first one that fits the gap is used ("3 hours ago", not "180 minutes ago").
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

// 'en' until Phase 7 swaps in the active locale.
const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const absoluteFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

// Pure: `now` is passed in so the caller decides when time "moves" and tests stay deterministic.
export const formatRelativeTime = (iso: string, now: number): string => {
  const diffSeconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (Math.abs(diffSeconds) < 45) return 'just now';

  const [unit, unitSeconds] =
    RELATIVE_UNITS.find(([, seconds]) => Math.abs(diffSeconds) >= seconds) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return relativeFormatter.format(Math.round(diffSeconds / unitSeconds), unit);
};

export const formatAbsoluteTime = (iso: string): string => absoluteFormatter.format(new Date(iso));

// Event times are shown in campus time, whatever the viewer's device says. Pinning the zone also keeps
// server and browser output identical (the server runs in UTC), so there is no hydration mismatch.
export const CAMPUS_TIME_ZONE = 'Africa/Casablanca';

const eventDayFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: CAMPUS_TIME_ZONE,
});
const eventTimeFormatter = new Intl.DateTimeFormat('en', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: CAMPUS_TIME_ZONE,
});

// "Thu, Nov 5" and "6:00 PM", kept separate so the card can lay them out with a separator.
export const formatEventSchedule = (iso: string): { day: string; time: string } => {
  const date = new Date(iso);
  return { day: eventDayFormatter.format(date), time: eventTimeFormatter.format(date) };
};
