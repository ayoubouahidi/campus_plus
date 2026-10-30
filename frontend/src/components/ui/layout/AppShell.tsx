'use client';

import React, { useCallback, useState } from 'react';
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
import { useSession } from '@/components/providers/SessionProvider';
import { useToast } from '@/components/ui/Toast';
import { FOOTER_GROUPS } from '@/lib/navigation';
import { mockNotifications } from '@/lib/mockData';
import { AppNotification } from '@/types/notification';

// The drawer already lists the Explore pages at the top, so it only repeats the external links.
const DRAWER_FOOTER_GROUPS = FOOTER_GROUPS.filter((group) => group.id !== 'explore');

export interface AppShellProps {
  children: React.ReactNode;
  // Rendered by the (server) root layout and passed in, so the page footer stays a Server Component.
  footer: React.ReactNode;
}

// The one client component that wires the shell together: it owns the state the parts share
// (search trigger, notification feed) and reads the session. Pages render inside <main>.
export const AppShell = ({ children, footer }: AppShellProps) => {
  const { session } = useSession();
  const { showToast } = useToast();

  // Mock feed until the Phase 6 WebSocket layer owns it
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);

  const markRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((notification) => (notification.id === id ? { ...notification, is_read: true } : notification))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
  }, []);

  // Placeholder until the search palette exists: confirms ⌘K / the button work
  const openSearch = useCallback(() => {
    showToast({
      title: 'Search is coming soon',
      description: 'Finding events and clubs from anywhere will open here.',
      variant: 'info',
    });
  }, [showToast]);

  return (
    <MobileNav>
      <Navbar>
        <MobileNavTrigger />
        <NavbarBrand />
        <NavbarLinks />
        <NavbarActions>
          <NavbarSearch onOpen={openSearch} />
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
      <MobileNavDrawer session={session}>
        <div className="space-y-4">
          <FooterNav variant="compact" groups={DRAWER_FOOTER_GROUPS} aria-label="Campus links" />
          <FooterLegal variant="compact" />
        </div>
      </MobileNavDrawer>
    </MobileNav>
  );
};
