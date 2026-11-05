import type { Club, EventItem } from '@/types/api';
import { matchesCampus, type CampusFilter } from '@/lib/events';
import { CAMPUS_TIME_ZONE } from '@/lib/time';

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

// "No upcoming events", "1 upcoming event", "3 upcoming events".
export const formatUpcomingCount = (count: number): string =>
  count === 0 ? 'No upcoming events' : `${count} upcoming ${count === 1 ? 'event' : 'events'}`;

// Directory order: alphabetical, ignoring case and accents ("École" sorts with "E").
export const sortClubsByName = (clubs: Club[]): Club[] =>
  [...clubs].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

// Same campus rule as the event feed (matchesCampus). Keeps the input order.
export const filterClubsByCampus = (clubs: Club[], campus: CampusFilter): Club[] =>
  clubs.filter((club) => matchesCampus(club.department_name, campus));

// "No clubs", "1 club", "6 clubs" (the directory's live result count).
export const formatClubCount = (count: number): string =>
  count === 0 ? 'No clubs' : `${count} ${count === 1 ? 'club' : 'clubs'}`;

// "Since January 2026". Server only: formatting a moment in the campus time zone (DOCS.md §5.2).
const sinceFormatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: CAMPUS_TIME_ZONE });
export const formatClubSince = (createdAt: string): string => `Since ${sinceFormatter.format(Date.parse(createdAt))}`;

// "+212600000000" → "+212 6 00 00 00 00" (Moroccan grouping) for display only; tel: links keep the raw value.
// Anything that isn't a +212 mobile/landline number is shown unchanged.
export const formatPhone = (phone: string): string => {
  const match = /^\+212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(phone.replace(/\s+/g, ''));
  return match ? `+212 ${match.slice(1).join(' ')}` : phone;
};

// A club's events split at `now`: upcoming (not yet ended, soonest first) and past (most recent first).
// Server side: it depends on the request time.
export const getClubEvents = (
  events: EventItem[],
  clubId: string,
  now: number
): { upcoming: EventItem[]; past: EventItem[] } => {
  const own = events.filter((event) => event.club_id === clubId);
  const byStart = (a: EventItem, b: EventItem) => Date.parse(a.start_time) - Date.parse(b.start_time);
  return {
    upcoming: own.filter((event) => Date.parse(event.end_time) > now).sort(byStart),
    past: own.filter((event) => Date.parse(event.end_time) <= now).sort((a, b) => byStart(b, a)),
  };
};
