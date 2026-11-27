import { AttendeePreview, Department, Club, EventItem, User } from '@/types/api';
import { AppNotification } from '@/types/notification';

export const mockCurrentUser: User = {
  id: 'usr_01',
  email: 'student@1337.ma',
  full_name: 'Mouad Najjar',
  avatar_url: null,
  role: 'BOARD_MEMBER',
  club_id: 'club_leet_frame',
};

// Campus Hub serves 1337 only (decided 2026-11-22: EMINES and UM6P are not partners). One department, so the
// sign-up form's school field has a single choice; the model keeps departments for the backend's shape.
export const mockDepartments: Department[] = [{ id: 'dept_1337', name: '1337 Coding School', slug: '1337' }];

export const mockClubs: Club[] = [
  {
    id: 'club_leet_frame',
    department_id: 'dept_1337',
    department_name: '1337 Coding School',
    name: 'Leet Frame',
    slug: 'leet-frame',
    description: 'Audiovisual, photography, and cinematic storytelling community at 1337.',
    logo_url: '', // no logo uploaded: Avatar shows initials
    banner_url: null,
    president_name: 'Mouad Najjar',
    president_phone: '+212600000000',
    president_email: 'leetframe@1337.ma',
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'club_leet_music',
    department_id: 'dept_1337',
    department_name: '1337 Coding School',
    name: 'LEET Music',
    slug: 'leet-music',
    description: 'Live performance, beat production, DJing, and campus jam sessions.',
    logo_url: '', // no logo uploaded: Avatar shows initials
    banner_url: null,
    president_name: 'Saad M.',
    president_phone: '+212611223344',
    president_email: 'leetmusic@1337.ma',
    created_at: '2026-02-01T12:00:00Z',
  },
  {
    id: 'club_leet_business',
    department_id: 'dept_1337',
    department_name: '1337 Coding School',
    name: 'LEET Business',
    slug: 'leet-business',
    description: 'Startup ideas, product pitches, and case challenges for 1337 students who build.',
    logo_url: '', // no logo uploaded: Avatar shows initials
    banner_url: null,
    president_name: 'Yassine K.',
    president_phone: '+212622334455',
    president_email: 'leetbusiness@1337.ma',
    created_at: '2026-01-20T09:30:00Z',
  },
  {
    id: 'club_leet_dev',
    department_id: 'dept_1337',
    department_name: '1337 Coding School',
    name: 'LEET Dev',
    slug: 'leet-dev',
    description: 'Systems programming, hackathons, and open-source projects built by 1337 students.',
    logo_url: '', // no logo uploaded: Avatar shows initials
    banner_url: null,
    president_name: 'Anas B.',
    president_phone: '+212633445566',
    president_email: 'leetdev@1337.ma',
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 'club_leet_sports',
    department_id: 'dept_1337',
    department_name: '1337 Coding School',
    name: 'LEET Sports',
    slug: 'leet-sports',
    description: 'Football and basketball leagues, tournaments, and weekly training sessions for 1337 students.',
    logo_url: '', // no logo uploaded: Avatar shows initials
    banner_url: null,
    president_name: 'Kenza R.',
    president_phone: '+212644556677',
    president_email: 'leetsports@1337.ma',
    created_at: '2026-01-05T09:00:00Z',
  },
  {
    id: 'club_bde',
    department_id: 'dept_1337',
    department_name: '1337 Coding School',
    name: 'Student Events Committee',
    slug: 'student-events',
    description: 'Welcome days, celebrations, and end-of-semester events for every 1337 student.',
    logo_url: '', // no logo uploaded: Avatar shows initials
    banner_url: null,
    president_name: 'Omar L.',
    president_phone: '+212655667788',
    president_email: 'events@1337.ma',
    created_at: '2026-01-02T10:00:00Z',
  },
];

// Small pool the attendee previews draw from (initials fallback: no avatar images yet)
const ATTENDEES = {
  salma: { id: 'usr_02', full_name: 'Salma Idrissi', avatar_url: null },
  youssef: { id: 'usr_03', full_name: 'Youssef Benali', avatar_url: null },
  imane: { id: 'usr_04', full_name: 'Imane Chraibi', avatar_url: null },
  hamza: { id: 'usr_05', full_name: 'Hamza El Amrani', avatar_url: null },
  nora: { id: 'usr_06', full_name: 'Nora Tazi', avatar_url: null },
} satisfies Record<string, AttendeePreview>;

// Times are UTC. Campus time (Africa/Casablanca) is UTC+0 from Oct 2026 with tzdata 2026e (DOCS.md §5.2).
export const mockEvents: EventItem[] = [
  {
    id: 'evt_workshop_cine',
    club_id: 'club_leet_frame',
    club_name: 'Leet Frame',
    department_name: '1337 Coding School',
    title: 'Cinematic Storytelling & Lighting Masterclass',
    description: 'A 2-day practical session on framing, three-point lighting, and Davinci Resolve workflow.',
    flyer_url: '', // no flyer uploaded: exercises the banner fallback
    location: 'Cluster 2 - Main Lab',
    category: 'Media',
    start_time: '2026-11-05T17:00:00Z',
    end_time: '2026-11-05T20:00:00Z',
    rsvps_count: 42,
    has_user_rsvpd: true,
    attendees_preview: [ATTENDEES.salma, ATTENDEES.youssef, ATTENDEES.imane],
  },
  {
    id: 'evt_jam_session',
    club_id: 'club_leet_music',
    club_name: 'LEET Music',
    department_name: '1337 Coding School',
    title: 'LEET Jam Session: Afro House & Melodic Sets',
    description: 'Live electronic sets, open synthesizers, and collaborative jam session.',
    flyer_url: '/mock/events/jam-session.png',
    location: 'Auditorium Courtyard',
    category: 'Music',
    start_time: '2026-11-07T19:00:00Z',
    end_time: '2026-11-07T22:00:00Z',
    rsvps_count: 87,
    has_user_rsvpd: false,
    attendees_preview: [ATTENDEES.hamza, ATTENDEES.nora, ATTENDEES.salma],
  },
  {
    id: 'evt_hackathon_ai',
    club_id: 'club_leet_dev',
    club_name: 'LEET Dev',
    department_name: '1337 Coding School',
    title: '42 Campus Hackathon: Edge AI & Systems',
    description: '48-hour systems development sprint focusing on C++, microservices, and network protocols.',
    flyer_url: '/mock/events/hackathon.png',
    location: 'Agora Hall',
    category: 'Tech',
    start_time: '2026-11-13T08:00:00Z',
    end_time: '2026-11-15T17:00:00Z',
    rsvps_count: 120,
    has_user_rsvpd: false,
    attendees_preview: [ATTENDEES.youssef, ATTENDEES.imane, ATTENDEES.hamza],
  },
  {
    id: 'evt_case_competition',
    club_id: 'club_leet_business',
    club_name: 'LEET Business',
    department_name: '1337 Coding School',
    // Long on purpose: checks that titles clamp to two lines on cards.
    title: 'Startup Pitch Night: Products Built by 1337 Students in Their First Year, Final Round',
    description: 'Teams of four pitch the products they built to a jury of founders and mentors.',
    flyer_url: '/mock/events/symposium.png',
    location: 'Auditorium',
    category: 'Business',
    start_time: '2026-11-18T13:30:00Z',
    end_time: '2026-11-18T18:00:00Z',
    rsvps_count: 2,
    has_user_rsvpd: true,
    attendees_preview: [ATTENDEES.nora, ATTENDEES.salma],
  },
  {
    id: 'evt_basketball_final',
    club_id: 'club_leet_sports',
    club_name: 'LEET Sports',
    department_name: '1337 Coding School',
    title: 'Inter-Pool Basketball Final',
    description: 'The season final between this year’s pools. Bring your team colours.',
    flyer_url: '/mock/events/basketball.png',
    location: 'Sports Complex - Main Court',
    category: 'Sports',
    start_time: '2026-11-21T16:00:00Z',
    end_time: '2026-11-21T18:00:00Z',
    rsvps_count: 2,
    has_user_rsvpd: true, // Step 5.4: an upcoming RSVP for /profile's "Going"
    attendees_preview: [ATTENDEES.hamza],
  },
  {
    id: 'evt_welcome_bbq',
    club_id: 'club_bde',
    club_name: 'Student Events Committee',
    department_name: '1337 Coding School',
    title: 'Winter Welcome BBQ',
    description: 'Food, music and club stands in the courtyard to close the semester.',
    flyer_url: '/mock/events/campus-bbq.png',
    location: 'Campus Courtyard',
    category: 'EventsOrganization',
    start_time: '2026-11-27T11:00:00Z',
    end_time: '2026-11-27T15:00:00Z',
    rsvps_count: 0,
    has_user_rsvpd: false,
    attendees_preview: [],
  },
];

// Newest first, as GET /api/notifications/ returns them (Step 15.3: Django's types and English text). Three unread.
export const mockNotifications: AppNotification[] = [
  {
    id: 'ntf_04',
    kind: 'new_event',
    title: 'New campus event',
    body: 'A new campus event, "42 Campus Hackathon: Edge AI & Systems", was published.',
    event_title: '42 Campus Hackathon: Edge AI & Systems',
    href: '/events/evt_hackathon_ai',
    created_at: '2026-09-24T16:45:00Z',
    is_read: false,
  },
  {
    id: 'ntf_03',
    kind: 'event_updated',
    title: 'Event updated',
    body: 'An event you registered for, "LEET Jam Session", changed.',
    event_title: 'LEET Jam Session',
    href: '/events/evt_jam_session',
    created_at: '2026-09-24T11:20:00Z',
    is_read: false,
  },
  {
    id: 'ntf_02',
    kind: 'event_removed',
    title: 'Event removed',
    body: '"Night Photography Walk" was removed and is no longer available.',
    event_title: 'Night Photography Walk',
    href: '/calendar',
    created_at: '2026-09-23T19:05:00Z',
    is_read: false,
  },
  {
    id: 'ntf_01',
    kind: 'rsvp_confirmed',
    title: 'RSVP confirmed',
    body: 'You are registered for "Cinematic Storytelling & Lighting Masterclass".',
    event_title: 'Cinematic Storytelling & Lighting Masterclass',
    href: '/events/evt_workshop_cine',
    created_at: '2026-09-22T09:00:00Z',
    is_read: true,
  },
];

// Full attendee list for /events/[id] (Phase 7: GET /api/events/:id/attendees). The current user is NOT
// included: the page adds "You" from the session, so the list follows RSVP clicks. Starts with the event's
// preview, then deterministic fake names until the count matches rsvps_count (minus the user if going).
const FIRST_NAMES = ['Aya', 'Mehdi', 'Rania', 'Ilyas', 'Sara', 'Othmane', 'Lina', 'Adam', 'Hiba', 'Zakaria', 'Meryem', 'Reda'];
const LAST_NAMES = ['Alaoui', 'Bennani', 'Cherkaoui', 'Daoudi', 'El Fassi', 'Ghazi', 'Hajji', 'Idrissi', 'Jabri', 'Kettani'];

export const getMockAttendees = (event: EventItem): AttendeePreview[] => {
  const others = Math.max(0, event.rsvps_count - (event.has_user_rsvpd ? 1 : 0));
  const preview = event.attendees_preview.slice(0, others);
  const generated = Array.from({ length: others - preview.length }, (_, i) => ({
    id: `usr_gen_${event.id}_${i}`,
    full_name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length]}`,
    avatar_url: null,
  }));
  return [...preview, ...generated];
};
