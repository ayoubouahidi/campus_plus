import type { RawClub, RawEvent, RawUser } from '@/lib/api/raw';

// Example responses for the /test mapping panel (Step 14.1). Copied from API_SPEC.md on branch `Ahmed`
// (e04d4a3), with the fields API_SPEC describes in prose filled in (rsvps_count, attendees_preview…).
// Test-only data: real pages read Django through lib/data.ts.

export const SAMPLE_EVENT_SIGNED_IN: RawEvent = {
  id: 3,
  title: 'AI Hackathon',
  description: 'Build an edge AI project.',
  club_id: 2,
  club_name: 'LEET Dev',
  club_slug: 'leet-dev',
  department_name: '1337 Coding School',
  flyer_url: 'https://example.test/media/events_pics/example.webp',
  start_time: '2026-11-21T09:00:00Z',
  end_time: '2026-11-23T09:00:00Z',
  location: 'Agora Hall',
  category: 'Tech',
  status: 'planned',
  capacity: 150,
  rsvps_count: 2,
  has_user_rsvpd: true,
  attendees_preview: [{ id: 20, full_name: 'Yassine El Amrani', avatar_url: null }],
};

// The same event as an anonymous visitor gets it, with the edge cases the mapper must absorb.
export const SAMPLE_EVENT_EDGE: RawEvent = {
  ...SAMPLE_EVENT_SIGNED_IN,
  id: 4,
  club_id: null, // a department event, no club
  club_name: null,
  club_slug: null,
  description: null,
  flyer_url: '',
  category: 'Workshops', // not one of our 7: falls back to EventsOrganization
  status: 'cancelled',
  capacity: null,
  has_user_rsvpd: false,
  attendees_preview: [],
};

export const SAMPLE_CLUB: RawClub = {
  id: 3,
  slug: 'leet-dev',
  name: 'LEET Dev',
  description: 'A software engineering club.',
  department_id: 1,
  department_name: '1337 Coding School',
  logo_url: '',
  banner_url: null,
  president_name: 'Yassine El Amrani',
  upcoming_event_count: 3,
  created_at: '2025-01-12T10:00:00Z',
};

export const SAMPLE_CLUB_NO_SLUG: RawClub = { ...SAMPLE_CLUB, id: 9, slug: null, name: 'Club waiting for A0' };

export const SAMPLE_USER: RawUser = {
  id: 42,
  email: 'student@1337.ma',
  full_name: 'Mouad Najjar',
  login: 'mnajjar',
  avatar_url: '',
  campus: 'Benguerir',
  role: 'BOARD_MEMBER',
  phone: '',
  club_id: 2,
  club_slug: 'leet-dev',
};
