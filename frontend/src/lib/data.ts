import { cache } from 'react';
import type { AttendeePreview, Club, Department, EventCategory, EventItem, User } from '@/types/api';
import { ApiError, apiFetch, apiFetchAll, hasBackend, ApiUnavailable } from '@/lib/api/client';
import { toAttendee, toClub, toClubs, toDepartment, toEventItem, toNotification, toUser } from '@/lib/api/mappers';
import type { RawAttendee, RawClub, RawDepartment, RawEvent, RawNotification, RawPage, RawRsvpState, RawUser } from '@/lib/api/raw';
import { getMockAttendees, mockClubs, mockDepartments, mockEvents, mockNotifications } from '@/lib/mockData';
import type { NotificationFeed } from '@/types/notification';

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
  rsvped?: boolean; // only the signed-in student's RSVPs, past and upcoming (Django: ?rsvped=true, TEAM_NEEDS BE2)
  category?: EventCategory; // one category (Django: ?category=Music; the /search page, Step 18.1)
}

// Mocks: every event; pages already filter by time (getUpcomingEvents, splitEventsByTime), so the result is the
// same either way. API: Django filters, the pages' filters then change nothing.
export const listEvents = cache(async (query: EventQuery = {}, token: string | null = null): Promise<EventItem[]> => {
  if (mocksOnly()) {
    const club = query.club ? mockClubs.find((item) => item.slug === query.club) : undefined;
    const events = query.club ? mockEvents.filter((event) => event.club_id === club?.id) : mockEvents;
    const inCategory = query.category ? events.filter((event) => event.category === query.category) : events;
    return query.rsvped ? inCategory.filter((event) => event.has_user_rsvpd) : inCategory;
  }
  if (query.rsvped && !token) return []; // Django answers 401: no token, no RSVPs (e.g. a dev login)
  const params = new URLSearchParams(PAGE);
  if (query.upcoming) params.set('upcoming', 'true');
  if (query.club) params.set('club', query.club);
  if (query.rsvped) params.set('rsvped', 'true');
  if (query.category) params.set('category', query.category);
  try {
    return (await apiFetchAll<RawEvent>(`/api/club-events/?${params}`, { token })).map(toEventItem);
  } catch (error) {
    // "My events" with a token Django no longer knows (DOCS.md §27): none, like a signed-out visitor.
    if (query.rsvped && error instanceof ApiError && error.status === 401) return [];
    throw error;
  }
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
  try {
    const page = await apiFetch<RawPage<RawAttendee>>(`/api/club-events/${event.id}/attendees/?page_size=100`, { token });
    return page.results.map(toAttendee);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return []; // stale token (DOCS.md §27): no names
    throw error;
  }
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

const NOTIFICATIONS_PAGE = 30; // what the panel shows; older ones stay in Django (no "load more" yet)

// The signed-in student's newest notifications and unread count (Step 15.3, GET /api/notifications/ and
// /unread-count/). Django only ever returns the token owner's records. Mocks: the four sample ones.
export const listNotifications = async (token: string): Promise<NotificationFeed> => {
  if (mocksOnly()) return { items: mockNotifications, unreadCount: mockNotifications.filter((item) => !item.is_read).length };
  const [page, count] = await Promise.all([
    apiFetch<RawPage<RawNotification>>(`/api/notifications/?page_size=${NOTIFICATIONS_PAGE}`, { token }),
    apiFetch<{ unread_count: number }>('/api/notifications/unread-count/', { token }),
  ]);
  return { items: page.results.map(toNotification), unreadCount: count.unread_count };
};

// Idempotent on Django's side; a non-numeric id (a mock one) can't exist there: 404, like Django.
export const markNotificationRead = async (id: string, token: string): Promise<void> => {
  if (mocksOnly()) return;
  if (!/^\d+$/.test(id)) throw new ApiError(404, null, `/api/notifications/${id}/read/`);
  await apiFetch(`/api/notifications/${id}/read/`, { method: 'POST', token });
};

export const markAllNotificationsRead = async (token: string): Promise<void> => {
  if (mocksOnly()) return;
  await apiFetch('/api/notifications/read-all/', { method: 'POST', token });
};

/* ------------------------------- Current user ------------------------------- */

// The signed-in student as Django knows them right now (Step 21.2, GET /api/me/). The login cookie keeps the
// values from login time; /profile reads this so an edit shows at once. null in mocks mode (dev without
// Django: the session user is used instead) and without a Django token (dev login).
export interface Me {
  user: User;
  phone: string; // "" when none; normalized "+212…" once Django validates it (TEAM_NEEDS BE12)
}

export const getMe = cache(async (token: string | null): Promise<Me | null> => {
  if (mocksOnly() || !token) return null;
  try {
    const raw = await apiFetch<RawUser>('/api/me/', { token });
    return { user: toUser(raw), phone: raw.phone ?? '' };
  } catch (error) {
    // The token is no longer valid (DOCS.md §27): /profile falls back to the session user instead of crashing.
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

// PATCH /api/me/ { phone } (Django keeps it on the student's UserMember). Returns the phone as Django saved it.
// Mocks: nothing to save, the value is echoed back.
export const updateMyPhone = async (phone: string, token: string): Promise<string> => {
  if (mocksOnly()) return phone;
  const raw = await apiFetch<RawUser>('/api/me/', { method: 'PATCH', token, body: { phone } });
  return raw.phone ?? '';
};

// POST /api/me/avatar/ (multipart `file`, Ayoub's TEAM_NEEDS BE16): Django re-checks the image, resizes it to
// 512 px, strips its metadata and returns the user with the new public URL. DELETE removes it ("" → initials).
// Step 26, DOCS.md §26. No mocks branch: the route handler answers "unavailable" without Django.
export const uploadMyAvatar = async (file: Blob, fileName: string, token: string): Promise<string | null> => {
  const form = new FormData();
  form.append('file', file, fileName);
  const raw = await apiFetch<RawUser>('/api/me/avatar/', { method: 'POST', token, body: form });
  return raw.avatar_url || null;
};

export const deleteMyAvatar = async (token: string): Promise<string | null> => {
  const raw = await apiFetch<RawUser>('/api/me/avatar/', { method: 'DELETE', token });
  return raw.avatar_url || null;
};

/* ------------------------------- Departments ------------------------------ */

export const listDepartments = cache(async (): Promise<Department[]> => {
  if (mocksOnly()) return mockDepartments;
  return (await apiFetch<RawDepartment[]>('/api/departments/')).map(toDepartment);
});
