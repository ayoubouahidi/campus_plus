import type { Club, EventItem } from '@/types/api';
import { matchesCampus, splitEventsByTime, type CampusFilter } from '@/lib/events';
import { CAMPUS_TIME_ZONE, cachedFormatter } from '@/lib/time';

// The president's contact details. Only for signed-in students: the page passes `null` to signed-out
// visitors so the details never reach their browser (Phase 5: from the real session; the API must also
// omit these fields for anonymous requests).
export type ClubContact = Pick<Club, 'president_name' | 'president_email' | 'president_phone'>;

export const getClubContact = ({ president_name, president_email, president_phone }: Club): ClubContact => ({
  president_name,
  president_email,
  president_phone,
});

// Lookups and counts for /clubs and /clubs/[slug]. Pure: lists and "now" are passed in, so pages decide
// where the data comes from (mocks today, the API in Phase 7) and when time "moves".

export const getClubBySlug = (clubs: Club[], slug: string): Club | undefined =>
  clubs.find((club) => club.slug === slug);

// Upcoming (not yet ended) events per club id. Clubs without any are absent: read with `?? 0`.
// Server side: it depends on the request time.
export const getUpcomingEventCounts = (events: EventItem[], now: number): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const event of events) {
    if (Date.parse(event.end_time) > now) counts[event.club_id] = (counts[event.club_id] ?? 0) + 1;
  }
  return counts;
};

// Directory order: alphabetical, ignoring case and accents ("École" sorts with "E").
export const sortClubsByName = (clubs: Club[]): Club[] =>
  [...clubs].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

// Same campus rule as the event feed (matchesCampus). Keeps the input order.
export const filterClubsByCampus = (clubs: Club[], campus: CampusFilter): Club[] =>
  clubs.filter((club) => matchesCampus(club.department_name, campus));

// The month a club was created: "January 2026", "janvier 2026", "يناير 2026" (Step 12.5). The page wraps it in
// Clubs.since ("Since {date}"). Server only: formatting a moment in the campus time zone (DOCS.md §5.2).
// Counts ("3 clubs", "2 upcoming events") are ICU plurals in the Clubs messages.
const sinceFormatter = cachedFormatter(
  (tag) => new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric', timeZone: CAMPUS_TIME_ZONE })
);
export const formatClubSince = (createdAt: string, locale = 'en'): string =>
  sinceFormatter(locale).format(Date.parse(createdAt));

// "+212600000000" → "+212 6 00 00 00 00" (Moroccan grouping) for display only; tel: links keep the raw value.
// Anything that isn't a +212 mobile/landline number is shown unchanged.
export const formatPhone = (phone: string): string => {
  const match = /^\+212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(phone.replace(/\s+/g, ''));
  return match ? `+212 ${match.slice(1).join(' ')}` : phone;
};

// A club's events split at `now`: upcoming (soonest first) and past (most recent first). Server side.
export const getClubEvents = (events: EventItem[], clubId: string, now: number) =>
  splitEventsByTime(events.filter((event) => event.club_id === clubId), now);
