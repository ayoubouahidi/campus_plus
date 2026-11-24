// What Django sends (branch `Ahmed` at e04d4a3, API_SPEC.md), before mapping (Step 14.1, DOCS.md §14).
// Only the fields the student site reads are listed; Django sends more (legacy aliases like `name` /
// `starts_at`, `created_at` on events…), which the mappers ignore. Keep these in step with API_SPEC.md:
// a renamed field shows up here first, and the mapper is the only code that changes.

export interface RawPage<T> {
  count: number;
  next: string | null; // absolute URL with Django's host, e.g. http://web:8000/api/club-events/?page=2
  previous: string | null;
  results: T[];
}

export interface RawAttendee {
  id: number;
  full_name: string;
  avatar_url: string | null;
}

export type RawEventStatus = 'planned' | 'ongoing' | 'completed' | 'cancelled';

export interface RawEvent {
  id: number;
  title: string;
  description: string | null;
  club_id: number | null; // an event can belong to a department only
  club_name: string | null;
  club_slug: string | null;
  department_name: string | null;
  flyer_url: string; // absolute URL, or '' without a flyer
  start_time: string; // ISO 8601, UTC
  end_time: string;
  location: string | null;
  category: string; // one of our 7 categories (Django choices), checked by the mapper
  status: RawEventStatus;
  capacity: number | null;
  rsvps_count: number;
  has_user_rsvpd: boolean; // false for anonymous requests
  attendees_preview: RawAttendee[]; // [] for anonymous requests, at most 3
}

export interface RawClub {
  id: number;
  slug: string | null; // nullable until Ahmed's A0 backfill (TEAM_NEEDS BE5)
  name: string;
  description: string | null;
  department_id: number | null;
  department_name: string | null;
  logo_url: string; // '' without a logo
  banner_url: string | null;
  president_name: string | null;
  // Only for signed-in requests, once the API sends them (TEAM_NEEDS BE1). Absent today.
  president_email?: string;
  president_phone?: string;
  upcoming_event_count?: number;
  created_at: string;
}

export interface RawDepartment {
  id: number;
  name?: string; // `title` exposed under our name (DepartmentSerializer)
  title: string;
  slug: string | null;
}

export type RawRole = 'STUDENT' | 'BOARD_MEMBER' | 'SUPERADMIN';

// GET /api/me/, and `user` in the login / sync responses.
export interface RawUser {
  id: number;
  email: string;
  full_name: string;
  login: string;
  avatar_url: string; // '' without a picture
  campus: string;
  role: RawRole;
  phone: string;
  club_id: number | null;
  club_slug: string | null;
}

// POST / DELETE /api/club-events/{id}/rsvp/ (200, 201; 409 when full with the same two fields).
export interface RawRsvpState {
  rsvps_count: number;
  has_user_rsvpd: boolean;
}

// GET /api/notifications/ results and the `data` of a `notification.created` socket message (Step 15.3).
// `read_at` is absent from the socket message; `event_title` is asked for in TEAM_NEEDS BE10.
export interface RawNotification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
  event_id: number | null;
  event_title?: string | null;
}
