// English messages: the reference (Step 12.1, DOCS.md §12.1). Its shape is the `Messages` type: fr.ts and
// ar.ts must have exactly the same keys (`satisfies Messages`), so a missing translation fails the build.
// Format: ICU messages ({name}, {count, plural, …}, {gender, select, …}). One namespace per area.

const en = {
  LanguageSwitcher: {
    label: 'Language',
    current: 'Language: {language}',
  },
  // Shell (Step 12.2): page names used by the navbar, tab bar, drawer and footer (lib/navigation.ts labelKey).
  Nav: {
    discover: 'Discover',
    calendar: 'Calendar',
    clubs: 'Clubs',
    profile: 'My Profile',
    login: 'Log in',
    explore: 'Explore',
    campuses: 'Campuses',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
  },
  Navbar: {
    skipToContent: 'Skip to content',
    home: 'Campus Hub home',
    main: 'Main',
    search: 'Search events and clubs',
    searchShort: 'Search events…',
    loadingAccount: 'Loading account',
    profileLink: 'My Profile ({name})',
  },
  MobileNav: {
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menu: 'Menu',
    pages: 'Pages',
    campusLinks: 'Campus links',
  },
  Footer: {
    tagline: 'Events, clubs and RSVPs for students of 1337 Coding School and EMINES (UM6P), all in one place.',
    nav: 'Footer',
    legal: 'Legal',
    newTab: '(opens in a new tab)',
    copyright: '© {year} Campus Hub. Made by students, for students.',
  },
  Notifications: {
    title: 'Notifications',
    trigger: '{count, plural, =0 {Notifications} other {Notifications, # unread}}',
    unread: '{count} unread',
    markAllRead: 'Mark all as read',
    emptyTitle: 'You’re all caught up',
    emptyBody: 'New events and changes to events you follow will show up here.',
    unreadPrefix: 'Unread: ',
    arrivedOne: 'New notification: {title}',
    arrivedMany: '{count, plural, other {# new notifications}}',
  },
  Search: {
    title: 'Search events and clubs',
    placeholder: 'Search events and clubs…',
    results: 'Search results',
    events: 'Events',
    clubs: 'Clubs',
    comingUp: 'Coming up',
    noMatch: 'No events or clubs match “{query}”.',
    count: '{count, plural, =0 {No results} one {# result} other {# results}}',
    club: 'Club',
  },
  // Event categories (EventCategory → label). Fixed list, so it is UI text, not club data.
  Categories: {
    Tech: 'Tech',
    Media: 'Media',
    Music: 'Music',
    Sports: 'Sports',
    Business: 'Business',
    Gaming: 'Gaming',
    EventsOrganization: 'Events',
  },
  // Shared by the ui/ primitives.
  Common: {
    close: 'Close',
    dismissNotification: 'Dismiss notification',
  },
  // Step 12.3: the feed (/), event cards, the event page, RSVP and attendees.
  Feed: {
    title: 'Upcoming events',
    filters: 'Filter events',
    campus: 'Campus',
    allCampuses: 'All',
    categories: 'Filter by category',
    allCategories: 'All',
    list: 'Events',
    loading: 'Loading events',
    emptyTitle: 'No upcoming events yet',
    emptyBody: 'New events show up here as soon as clubs publish them.',
    noMatchTitle: 'No events match your filters',
    noMatchBody: 'Try another campus or category.',
    clearFilters: 'Clear filters',
  },
  // RSVP words shared by the event cards, the event page's RSVP card and the toast. The sr* texts follow the
  // visible word for screen readers ("RSVP" + " to Leet Jam"), so six RSVP buttons don't sound alike.
  Rsvp: {
    heading: 'RSVP',
    rsvp: 'RSVP',
    going: 'Going',
    cancel: 'Cancel RSVP',
    loginToRsvp: 'Log in to RSVP',
    srTitle: ' to {title}',
    srCancel: ' to {title}, cancel RSVP',
    youreGoing: 'You’re going',
    ended: 'This event has ended',
    cardCount: '{count, plural, =0 {No RSVPs yet} other {# going}}',
    countUpcoming: '{count, plural, =0 {Be the first to RSVP} other {# going}}',
    countEnded: '{count, plural, =0 {Nobody RSVP’d} other {# went}}',
    toastGoing: 'You’re going',
    toastCancelled: 'RSVP cancelled',
  },
  Attendees: {
    headingUpcoming: 'Who’s going',
    headingEnded: 'Who went',
    emptyUpcoming: 'Nobody has RSVP’d yet.',
    emptyEnded: 'Nobody RSVP’d to this event.',
    locked: 'Names are only shown to signed-in students.',
    loginUpcoming: 'Log in to see who’s going',
    loginEnded: 'Log in to see who went',
    seeAll: 'See all',
    you: 'You',
    people: '{count, plural, one {# person} other {# people}}',
    others: '{count, plural, one {# other} other {# others}}',
  },
  EventPage: {
    allEvents: 'All events',
    backToCalendar: 'Back to calendar',
    when: 'When',
    where: 'Where',
    organizer: 'Organizer',
    about: 'About this event',
    startsEnds: 'Starts {start}, ends {end}',
    loading: 'Loading event',
    notFoundTitle: 'Event not found',
    notFoundBody: 'This event doesn’t exist or was removed by its organizer. There’s plenty more going on.',
    discover: 'Discover events',
    openCalendar: 'Open the calendar',
  },
  Events: {
    count: '{count, plural, =0 {No events} one {# event} other {# events}}',
  },
};

export type Messages = typeof en;
export default en;
