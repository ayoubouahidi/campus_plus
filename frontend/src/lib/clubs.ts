import type { Club, EventItem } from '@/types/api';
import { matchesCampus, type CampusFilter } from '@/lib/events';

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
