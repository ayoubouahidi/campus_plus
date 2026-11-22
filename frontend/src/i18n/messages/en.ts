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
  Events: {
    count: '{count, plural, =0 {No events} one {# event} other {# events}}',
  },
};

export type Messages = typeof en;
export default en;
