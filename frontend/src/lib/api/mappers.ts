import type { AttendeePreview, Club, Department, EventCategory, EventItem, User } from '@/types/api';
import type { AppNotification, NotificationKind } from '@/types/notification';
import { EVENT_CATEGORIES } from '@/lib/events';
import type { RawAttendee, RawClub, RawDepartment, RawEvent, RawNotification, RawUser } from './raw';

// Django's JSON → the student site's types (Step 14.1, DOCS.md §14). Pure functions: no fetch, no Next.js, so
// they run anywhere and can be checked with the examples from API_SPEC.md. The rest of the app only ever sees
// the types from @/types/api, so a backend rename changes raw.ts and this file, nothing else.
//
// Rules everywhere:
//  - ids become strings (our routes and React keys are strings; Django's are numbers);
//  - missing optional text becomes '' and missing images null, as the mocks already do;
//  - a value we can't place (unknown category, club without a slug) is handled here, never in a component.

const isCategory = (value: string): value is EventCategory => (EVENT_CATEGORIES as string[]).includes(value);

export const toAttendee = (raw: RawAttendee): AttendeePreview => ({
  id: String(raw.id),
  full_name: raw.full_name,
  avatar_url: raw.avatar_url || null,
});

// Unknown categories would break the colour tables (Record<EventCategory, …>): they fall back to the generic
// "Events" category and are logged once per event, so a new Django choice is noticed without crashing a page.
export const toEventItem = (raw: RawEvent): EventItem => {
  if (!isCategory(raw.category)) console.warn(`[api] event ${raw.id}: unknown category "${raw.category}"`);
  return {
    id: String(raw.id),
    club_id: raw.club_id === null ? '' : String(raw.club_id),
    club_name: raw.club_name ?? '',
    club_slug: raw.club_slug,
    department_name: raw.department_name ?? '',
    title: raw.title,
    description: raw.description ?? '',
    flyer_url: raw.flyer_url ?? '',
    location: raw.location ?? '',
    category: isCategory(raw.category) ? raw.category : 'EventsOrganization',
    start_time: raw.start_time,
    end_time: raw.end_time,
    status: raw.status,
    capacity: raw.capacity,
    rsvps_count: raw.rsvps_count ?? 0,
    has_user_rsvpd: raw.has_user_rsvpd ?? false,
    attendees_preview: (raw.attendees_preview ?? []).map(toAttendee),
  };
};

// null for a club without a slug: its page (/clubs/{slug}) can't exist yet (TEAM_NEEDS BE5). Callers drop it.
export const toClub = (raw: RawClub): Club | null => {
  if (!raw.slug) return null;
  return {
    id: String(raw.id),
    department_id: raw.department_id === null ? '' : String(raw.department_id),
    department_name: raw.department_name ?? '',
    name: raw.name,
    slug: raw.slug,
    description: raw.description ?? '',
    logo_url: raw.logo_url ?? '',
    banner_url: raw.banner_url || null,
    president_name: raw.president_name ?? '',
    // Copied only when Django sent them (signed-in requests, TEAM_NEEDS BE1), so "absent" stays absent.
    ...(raw.president_email ? { president_email: raw.president_email } : {}),
    ...(raw.president_phone ? { president_phone: raw.president_phone } : {}),
    created_at: raw.created_at,
  };
};

export const toClubs = (raws: RawClub[]): Club[] => raws.flatMap((raw) => toClub(raw) ?? []);

export const toDepartment = (raw: RawDepartment): Department => ({
  id: String(raw.id),
  name: raw.name ?? raw.title,
  slug: raw.slug ?? '',
});

export const toUser = (raw: RawUser): User => ({
  id: String(raw.id),
  email: raw.email,
  full_name: raw.full_name,
  avatar_url: raw.avatar_url || null,
  role: raw.role,
  club_id: raw.club_id === null ? null : String(raw.club_id),
});

// Django types the bell knows. An unknown one (a new Django choice) is shown as an announcement: Django's own
// title and message, no translation, so nothing is lost (logged once per notification).
const DJANGO_KINDS: readonly string[] = [
  'new_event',
  'event_updated',
  'event_cancelled',
  'rsvp_confirmed',
  'rsvp_cancelled',
  'club_announcement',
] satisfies Exclude<NotificationKind, 'event_removed'>[];

export const toNotification = (raw: RawNotification): AppNotification => {
  let kind: NotificationKind = 'club_announcement';
  if (DJANGO_KINDS.includes(raw.notification_type)) kind = raw.notification_type as NotificationKind;
  else console.warn(`[api] notification ${raw.id}: unknown type "${raw.notification_type}"`);
  // A deleted event: Django sends event_cancelled without an event (it no longer exists).
  if (kind === 'event_cancelled' && raw.event_id === null) kind = 'event_removed';
  return {
    id: String(raw.id),
    kind,
    title: raw.title,
    body: raw.message,
    ...(raw.event_title ? { event_title: raw.event_title } : {}),
    href: raw.event_id === null ? '/calendar' : `/events/${raw.event_id}`,
    created_at: raw.created_at,
    is_read: raw.is_read,
  };
};
