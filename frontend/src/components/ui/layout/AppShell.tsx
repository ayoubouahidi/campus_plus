'use client';

import React, { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Navbar,
  NavbarActions,
  NavbarBrand,
  NavbarLinks,
  NavbarSearch,
  NavbarSession,
} from '@/components/ui/layout/Navbar';
import {
  NotificationPanel,
  NotificationPopover,
  NotificationTrigger,
} from '@/components/ui/layout/NotificationPopover';
import {
  MobileNav,
  MobileNavDrawer,
  MobileNavTrigger,
  MobileTabBar,
  MobileTabBarSpacer,
} from '@/components/ui/layout/MobileNav';
import { FooterLegal, FooterNav } from '@/components/ui/layout/Footer';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { useSession } from '@/components/providers/SessionProvider';
import { SearchPalette } from '@/components/search/SearchPalette';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { FOOTER_GROUPS, isFullScreenRoute } from '@/lib/navigation';
import { AppNotification } from '@/types/notification';

// The drawer already lists the Explore pages at the top, so it only repeats the external links.
const DRAWER_FOOTER_GROUPS = FOOTER_GROUPS.filter((group) => group.id !== 'explore');

export interface AppShellProps {
  children: React.ReactNode;
  // Rendered by the (server) root layout and passed in, so the page footer stays a Server Component.
  footer: React.ReactNode;
  // Starting feed, decided on the server (Step 14.4): the mocks in dev without Django, [] with Django (no
  // notifications API: Phase 6 fills the feed from the realtime WebSocket).
  initialNotifications: AppNotification[];
}

// The one client component that wires the shell together: it owns the state the parts share
// (search palette, notification feed) and reads the session. Pages render inside <main>.
export const AppShell = ({ children, footer, initialNotifications }: AppShellProps) => {
  const { session } = useSession();
  useLiveRefresh(); // live event changes re-render the current page from the server (Step 15.2)
  const t = useTranslations('MobileNav');

  // Phase 6: the WebSocket layer adds to this feed.
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);

  const markRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((notification) => (notification.id === id ? { ...notification, is_read: true } : notification))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
  }, []);

  // ⌘K palette (Step 4.17). Stable callbacks: NavbarSearch re-binds its window ⌘K listener when onOpen changes.
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  // Login pages (Step 5.1): no navbar, tab bar or footer, the page fills the screen. After all hooks (rules of
  // hooks). usePathname is known on the server too, so the shell is never sent and then removed (no flash).
  const pathname = usePathname();
  if (isFullScreenRoute(pathname)) {
    return (
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        {children}
      </main>
    );
  }

  return (
    <MobileNav>
      <Navbar>
        <MobileNavTrigger />
        <NavbarBrand />
        <NavbarLinks />
        <NavbarActions>
          <NavbarSearch onOpen={openSearch} />
          {/* From sm up; on phones the bar is full (search, bell, avatar), so it lives in the drawer (DOCS.md §12.2). */}
          <LanguageSwitcher className="hidden sm:block" />
          {/* Notifications are per user, and the phone navbar has no room for bell + "Log in" */}
          {session.status === 'signed-in' && (
            <NotificationPopover notifications={notifications} onMarkRead={markRead} onMarkAllRead={markAllRead}>
              <NotificationTrigger />
              <NotificationPanel />
            </NotificationPopover>
          )}
          <NavbarSession session={session} />
        </NavbarActions>
      </Navbar>

      {/* Skip-link target. tabIndex -1 lets Safari move focus here, not just scroll. flex-1 pins the footer down. */}
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>

      {footer}
      <MobileTabBarSpacer />

      <MobileTabBar sessionStatus={session.status} />
      {/* Portalled to <body> when open; one instance for the whole app (navbar button and ⌘K). */}
      <SearchPalette isOpen={isSearchOpen} onClose={closeSearch} />
      <MobileNavDrawer session={session}>
        <div className="space-y-4">
          <FooterNav variant="compact" groups={DRAWER_FOOTER_GROUPS} aria-label={t('campusLinks')} />
          <FooterLegal variant="compact" />
        </div>
      </MobileNavDrawer>
    </MobileNav>
  );
};
