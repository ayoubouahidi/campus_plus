import type { Messages } from '@/i18n/messages/en';

// A page name in the `Nav` messages (Step 12.2): config stays plain data, each component translates it with
// useTranslations('Nav'). A key that doesn't exist in en.ts is a compile error.
export type NavLabelKey = keyof Messages['Nav'];

// Every route the app is allowed to link to (mirrors DOCS.md §1.3).
// Dynamic segments use template literals, so a typo like '/club/robotics' fails at
// compile time instead of 404ing at runtime.
export type AppRoute =
  | '/'
  | '/calendar'
  | '/clubs'
  | `/clubs/${string}`
  | `/events/${string}`
  | '/auth/login'
  | '/auth/register'
  | '/profile'
  | '/me'
  | '/privacy'
  | '/terms';

// Icons are referenced by name so this contract stays plain data (no JSX, server-safe).
// Each shell component resolves names through its own Record<NavIconName, Component>.
export type NavIconName = 'discover' | 'calendar' | 'clubs' | 'profile';

// 'exact'  -> active only on the href itself (required for '/')
// 'prefix' -> active on the href and any nested segment ('/clubs' matches '/clubs/robotics')
export type NavMatchStrategy = 'exact' | 'prefix';

export interface NavItem {
  labelKey: NavLabelKey;
  href: AppRoute;
  icon: NavIconName;
  match: NavMatchStrategy;
  // Extra path prefixes that should also highlight this item (e.g. '/events' -> Discover).
  aliases?: readonly string[];
}

// Footer links can leave the app (institution sites), so they carry an explicit kind:
// internal links stay type-checked against AppRoute, external ones must be https. Internal links are our
// pages (translated label); external ones are institution names, the same in every language.
export type FooterLink =
  | { kind: 'internal'; labelKey: NavLabelKey; href: AppRoute }
  | { kind: 'external'; label: string; href: `https://${string}` };

export interface FooterLinkGroup {
  id: 'explore' | 'campuses'; // stable key for filtering (e.g. the drawer skips 'explore')
  titleKey: NavLabelKey;
  links: readonly FooterLink[];
}
