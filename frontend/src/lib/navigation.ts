import { FooterLinkGroup, NavItem } from "@/types/navigation";

// Consumed by Navbar (desktop links) and MobileNav (bottom tab bar + drawer).
export const PUBLIC_NAV: readonly NavItem[] = [
  { label: 'Discover', href: '/', icon: 'discover', match: 'exact', aliases: ['/events'] },
  { label: 'Calendar', href: '/calendar', icon: 'calendar', match: 'prefix' },
  { label: 'Clubs', href: '/clubs', icon: 'clubs', match: 'prefix' },
];

// Lives in the session slot (avatar link), not the main link row. '/me' is an alias of '/profile'.
export const PROFILE_NAV_ITEM: NavItem = {
  label: 'My Profile',
  href: '/profile',
  icon: 'profile',
  match: 'prefix',
  aliases: ['/me'],
};

// Signed-out stand-in for the profile slot (MobileNav tab bar). '/auth' covers login and register.
export const LOGIN_NAV_ITEM: NavItem = {
  label: 'Log in',
  href: '/auth/login',
  icon: 'profile',
  match: 'prefix',
  aliases: ['/auth'],
};

// Footer columns. "Explore" is derived from PUBLIC_NAV so the footer can't drift from the navbar.
export const FOOTER_GROUPS: readonly FooterLinkGroup[] = [
  {
    id: 'explore',
    title: 'Explore',
    links: PUBLIC_NAV.map(({ label, href }) => ({ kind: 'internal', label, href })),
  },
  {
    id: 'campuses',
    title: 'Campuses',
    links: [
      { kind: 'external', label: '1337 Coding School', href: 'https://1337.ma' },
      { kind: 'external', label: 'EMINES', href: 'https://www.emines-ingenieur.org' },
      { kind: 'external', label: 'UM6P', href: 'https://um6p.ma' },
      { kind: 'external', label: '42 Network', href: 'https://www.42network.org' },
    ],
  },
];

// Strips a trailing slash so '/clubs/' and '/clubs' compare equal. Root stays '/'.
const normalizePath = (path: string) =>
  path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

// Segment-aware prefix check: '/clubs' matches '/clubs/robotics' but not '/clubsfair'.
const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isNavItemActive = (item: NavItem, pathname: string | null): boolean => {
  if (!pathname) return false;
  const current = normalizePath(pathname);
  const href = normalizePath(item.href);

  const hrefMatches = item.match === 'exact' ? current === href : matchesPrefix(current, href);
  if (hrefMatches) return true;

  return (item.aliases ?? []).some((alias) => matchesPrefix(current, normalizePath(alias)));
};
