import { cache } from 'react';
import type { AttendeePreview, Club, Department, EventItem } from '@/types/api';
import { ApiError, apiFetch, apiFetchAll, hasBackend, ApiUnavailable } from '@/lib/api/client';
import { toAttendee, toClub, toClubs, toDepartment, toEventItem } from '@/lib/api/mappers';
import type { RawAttendee, RawClub, RawDepartment, RawEvent, RawPage, RawRsvpState } from '@/lib/api/raw';
import { getMockAttendees, mockClubs, mockDepartments, mockEvents, mockNotifications } from '@/lib/mockData';
import type { AppNotification } from '@/types/notification';

// Where server pages get their data (Step 14.1, DOCS.md §14). One function per need; each one:
//  - with BACKEND_URL: calls Django (lib/api/client.ts) and maps the answer (lib/api/mappers.ts);
//  - without BACKEND_URL, in development: returns the mocks, so the site still runs without the backend
//    (same rule as the logins in src/auth.ts);
//  - without BACKEND_URL in production: throws ApiUnavailable (error page), never silently shows mocks.
// Pass `token` (getBackendToken) when the visitor is signed in: Django then fills has_user_rsvpd and the
// attendee previews. Server only.

export const mocksOnly = (): boolean => {
  if (hasBackend()) return false;
  if (process.env.NODE_ENV === 'production') throw new ApiUnavailable('(any)', new Error('BACKEND_URL is not set'));
  return true;
};

const PAGE = 'page_size=200'; // Django's maximum (ClubEventPagination.max_page_size)

/* --------------------------------- Events -------------------------------- */

export interface EventQuery {
  upcoming?: boolean; // only events that haven't ended (Django: ?upcoming=true)
  club?: string; // a club's slug
}

// Mocks: every event; pages already filter by time (getUpcomingEvents, splitEventsByTime), so the result is the
// same either way. API: Django filters, the pages' filters then change nothing.
export const listEvents = cache(async (query: EventQuery = {}, token: string | null = null): Promise<EventItem[]> => {
  if (mocksOnly()) {
    const club = query.club ? mockClubs.find((item) => item.slug === query.club) : undefined;
    return query.club ? mockEvents.filter((event) => event.club_id === club?.id) : mockEvents;
  }
  const params = new URLSearchParams(PAGE);
  if (query.upcoming) params.set('upcoming', 'true');
  if (query.club) params.set('club', query.club);
  const raws = await apiFetchAll<RawEvent>(`/api/club-events/?${params}`, { token });
  return raws.map(toEventItem);
});

// null when the event doesn't exist (404), so the page can call notFound(). Non-numeric ids (old links with
// mock ids) never reach Django: they can't exist there.
export const getEvent = cache(async (id: string, token: string | null = null): Promise<EventItem | null> => {
  if (mocksOnly()) return mockEvents.find((event) => event.id === id) ?? null;
  if (!/^\d+$/.test(id)) return null;
  try {
    return toEventItem(await apiFetch<RawEvent>(`/api/club-events/${id}/`, { token }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

// Everyone going, for the event page's list (signed-in only: anonymous visitors get [] without a request).
// First 100 names: the dialog is for browsing, not for exporting.
export const getAttendees = async (event: EventItem, token: string | null): Promise<AttendeePreview[]> => {
  if (mocksOnly()) return getMockAttendees(event);
  if (!token) return [];
  const page = await apiFetch<RawPage<RawAttendee>>(`/api/club-events/${event.id}/attendees/?page_size=100`, { token });
  return page.results.map(toAttendee);
};

// RSVP or cancel (Step 14.3). POST and DELETE are idempotent on Django's side. Throws ApiError (401 signed out,
// 404 unknown event, 409 full: body carries the current count) or ApiUnavailable; the server action sorts them.
export const setRsvp = async (
  eventId: string,
  going: boolean,
  token: string
): Promise<{ rsvps_count: number; has_user_rsvpd: boolean }> => {
  const state = await apiFetch<RawRsvpState>(`/api/club-events/${encodeURIComponent(eventId)}/rsvp/`, {
    method: going ? 'POST' : 'DELETE',
    token,
  });
  return { rsvps_count: state.rsvps_count, has_user_rsvpd: state.has_user_rsvpd };
};

/* ---------------------------------- Clubs -------------------------------- */

// Django sends a bare array (not paginated, AH5). Clubs without a slug are dropped by the mapper.
export const listClubs = cache(async (): Promise<Club[]> => {
  if (mocksOnly()) return mockClubs;
  return toClubs(await apiFetch<RawClub[]>('/api/clubs/'));
});

// With a token, Django can add the president's contact (TEAM_NEEDS BE1); the page still decides who sees it.
export const getClub = cache(async (slug: string, token: string | null = null): Promise<Club | null> => {
  if (mocksOnly()) return mockClubs.find((club) => club.slug === slug) ?? null;
  try {
    return toClub(await apiFetch<RawClub>(`/api/clubs/${encodeURIComponent(slug)}/`, { token }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

/* ------------------------------ Notifications ----------------------------- */

// The bell's starting feed (Step 14.4). Django has no notifications endpoint: the feed is built from realtime
// events in Phase 6. Until then: the mocks in dev without Django (to keep the popover testable), otherwise
// empty, never fake notifications in front of real students. Never throws (read by the root layout).
export const getInitialNotifications = (): AppNotification[] =>
  !hasBackend() && process.env.NODE_ENV !== 'production' ? mockNotifications : [];

/* ------------------------------- Departments ------------------------------ */

export const listDepartments = cache(async (): Promise<Department[]> => {
  if (mocksOnly()) return mockDepartments;
  return (await apiFetch<RawDepartment[]>('/api/departments/')).map(toDepartment);
});
