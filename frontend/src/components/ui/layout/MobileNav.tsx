'use client';

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOGIN_NAV_ITEM, PROFILE_NAV_ITEM, PUBLIC_NAV, isNavItemActive } from '@/lib/navigation';
import { trapTabKey } from '@/lib/focus';
import { useMergedRef } from '@/lib/refs';
import { CloseIcon, MenuIcon, NAV_ICONS } from '@/components/ui/layout/navIcons';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { SessionState, SessionStatus } from '@/types/session';
import { NavItem } from '@/types/navigation';

/* ------------------------------ MobileTabBar ------------------------------ */

type TabState = 'active' | 'idle';

// The fourth tab follows the session; null while auth is resolving, so "Log in" never flashes.
const accountTab: Record<SessionStatus, NavItem | null> = {
  loading: null,
  'signed-out': LOGIN_NAV_ITEM,
  'signed-in': PROFILE_NAV_ITEM,
};

const tabLabelStyles: Record<TabState, string> = {
  active: 'font-semibold text-violet-700 dark:text-violet-400',
  idle: 'font-medium text-slate-500 dark:text-slate-400',
};

// Pill behind the active icon (the "you are here" marker), invisible when idle
const tabIconStyles: Record<TabState, string> = {
  active: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  idle: 'text-slate-500 group-hover:bg-slate-100 dark:text-slate-400 dark:group-hover:bg-slate-800',
};

export interface MobileTabBarProps extends React.HTMLAttributes<HTMLElement> {
  sessionStatus: SessionStatus;
}

// Phones and small tablets only (below md), where Navbar hides its links.
// Pages must reserve space for it with <MobileTabBarSpacer /> at the end of the shell (root layout, Task 2.5).
export const MobileTabBar = React.forwardRef<HTMLElement, MobileTabBarProps>(
  ({ sessionStatus, className = '', ...props }, ref) => {
    const pathname = usePathname();
    const account = accountTab[sessionStatus];
    const tabs = account ? [...PUBLIC_NAV, account] : PUBLIC_NAV;

    return (
      <nav
        ref={ref}
        aria-label="Main"
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-950/90 ${className}`}
        {...props}
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
          {tabs.map((item) => {
            const tabState: TabState = isNavItemActive(item, pathname) ? 'active' : 'idle';
            const Icon = NAV_ICONS[item.icon];

            return (
              <li key={item.href} className="flex">
                <Link
                  href={item.href}
                  aria-current={tabState === 'active' ? 'page' : undefined}
                  className="group flex flex-1 flex-col items-center justify-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/40"
                >
                  <span
                    className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-150 ${tabIconStyles[tabState]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className={`text-[11px] leading-none ${tabLabelStyles[tabState]}`}>{item.label}</span>
                </Link>
              </li>
            );
          })}

          {!account && (
            // Holds the fourth slot while the session loads, so the other tabs don't shift
            <li className="flex flex-col items-center justify-center gap-1" aria-hidden="true">
              <Skeleton variant="circular" width={28} height={28} />
              <Skeleton variant="rounded" width={40} height={8} />
            </li>
          )}
        </ul>
      </nav>
    );
  }
);

MobileTabBar.displayName = 'MobileTabBar';

/* --------------------------- MobileTabBarSpacer --------------------------- */

export type MobileTabBarSpacerProps = React.HTMLAttributes<HTMLDivElement>;

// Place it last in the page shell (after the footer): reserves the fixed tab bar's height
// (64px + 1px border + iPhone home indicator) so the end of the page can scroll clear of it.
export const MobileTabBarSpacer = React.forwardRef<HTMLDivElement, MobileTabBarSpacerProps>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      className={`h-[calc(4rem+1px+env(safe-area-inset-bottom))] md:hidden ${className}`}
      {...props}
    />
  )
);

MobileTabBarSpacer.displayName = 'MobileTabBarSpacer';

/* ---------------------------- Drawer context ------------------------------ */

interface MobileNavContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  drawerId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

const useMobileNav = () => {
  const context = useContext(MobileNavContext);
  if (!context) {
    throw new Error('MobileNavTrigger and MobileNavDrawer must be wrapped inside a <MobileNav>.');
  }
  return context;
};

/* -------------------------------- MobileNav ------------------------------- */

export interface MobileNavProps {
  children: React.ReactNode;
}

// State-only provider (renders no DOM): the trigger sits inside the Navbar and the drawer is
// portalled to <body>, so the shared open/closed state has to wrap the whole shell.
export const MobileNav = ({ children }: MobileNavProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const drawerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Any route change closes the drawer, including browser Back/Forward (links also close on tap).
  // Adjusting state during render, not in an effect, so the new page never paints with it open.
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({ isOpen, open, close, drawerId, triggerRef }), [isOpen, open, close, drawerId]);

  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
};

/* ---------------------------- MobileNavTrigger ---------------------------- */

export type MobileNavTriggerProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>;

// The burger. Below md only, like the tab bar; place it before <NavbarBrand />.
export const MobileNavTrigger = React.forwardRef<HTMLButtonElement, MobileNavTriggerProps>(
  ({ onClick, className = '', ...props }, ref) => {
    const { isOpen, open, drawerId, triggerRef } = useMobileNav();
    const setTriggerRef = useMergedRef(ref, triggerRef);

    return (
      <button
        ref={setTriggerRef}
        type="button"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        // Only point at the drawer while it exists in the DOM
        aria-controls={isOpen ? drawerId : undefined}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) open();
        }}
        className={`-ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 md:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${className}`}
        {...props}
      >
        <MenuIcon className="h-5 w-5" />
      </button>
    );
  }
);

MobileNavTrigger.displayName = 'MobileNavTrigger';

/* ----------------------------- MobileNavDrawer ---------------------------- */

const drawerLinkStyles: Record<TabState, string> = {
  active: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
  idle: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
};

type AccountLinkVariant = 'primary' | 'outline';

const accountLinkStyles: Record<AccountLinkVariant, string> = {
  primary: 'bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800',
  outline:
    'border border-slate-300 text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800',
};

const linkFocusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40';

// The drawer is a phone-only surface; at md+ the navbar shows everything it holds.
const DESKTOP_QUERY = '(min-width: 768px)';

export interface MobileNavDrawerProps extends React.HTMLAttributes<HTMLDivElement> {
  session: SessionState;
  // Extra content under the account section (footer links in Task 2.4)
  children?: React.ReactNode;
}

export const MobileNavDrawer = React.forwardRef<HTMLDivElement, MobileNavDrawerProps>(
  ({ session, children, className = '', onKeyDown, ...props }, ref) => {
    const { isOpen, close, drawerId, triggerRef } = useMobileNav();
    const pathname = usePathname();
    const titleId = useId();
    const [mounted, setMounted] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const setDrawerRef = useMergedRef(ref, drawerRef);

    useEffect(() => {
      setMounted(true);
    }, []);

    const closeAndRestoreFocus = useCallback(() => {
      close();
      triggerRef.current?.focus();
    }, [close, triggerRef]);

    // While open: focus the close button, lock page scroll, close on Esc or on growing to desktop width
    useEffect(() => {
      if (!isOpen) return;

      closeButtonRef.current?.focus();
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeAndRestoreFocus();
      };
      const desktopQuery = window.matchMedia(DESKTOP_QUERY);
      const handleViewportChange = (event: MediaQueryListEvent) => {
        if (event.matches) close();
      };

      document.addEventListener('keydown', handleKeyDown);
      desktopQuery.addEventListener('change', handleViewportChange);
      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener('keydown', handleKeyDown);
        desktopQuery.removeEventListener('change', handleViewportChange);
      };
    }, [isOpen, close, closeAndRestoreFocus]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || !drawerRef.current) return;
      trapTabKey(event, drawerRef.current);
    };

    if (!mounted || !isOpen) return null;

    const isProfileActive = isNavItemActive(PROFILE_NAV_ITEM, pathname);

    // Portalled to <body>: the navbar's backdrop-blur would otherwise become the containing block
    // for this `fixed` layer and clip it to the header.
    return createPortal(
      <div className="fixed inset-0 z-50 md:hidden">
        <div
          aria-hidden="true"
          onClick={closeAndRestoreFocus}
          className="animate-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm motion-reduce:animate-none"
        />

        <div
          ref={setDrawerRef}
          id={drawerId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={handleKeyDown}
          className={`animate-drawer-in motion-reduce:animate-none absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col overflow-y-auto border-r border-slate-200/80 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:border-slate-800 dark:bg-slate-900 ${className}`}
          {...props}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800">
            <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Menu
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close menu"
              onClick={closeAndRestoreFocus}
              className={`-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${linkFocusRing}`}
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <nav aria-label="Pages" className="px-3 py-4">
            <ul className="space-y-1">
              {PUBLIC_NAV.map((item) => {
                const linkState: TabState = isNavItemActive(item, pathname) ? 'active' : 'idle';
                const Icon = NAV_ICONS[item.icon];

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={linkState === 'active' ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors duration-150 ${linkFocusRing} ${drawerLinkStyles[linkState]}`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto border-t border-slate-200/80 px-4 py-4 dark:border-slate-800">
            {session.status === 'loading' && (
              <div className="flex items-center gap-3">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="rounded" height={10} width="60%" />
                  <Skeleton variant="rounded" height={10} width="80%" />
                </div>
                <span className="sr-only">Loading account</span>
              </div>
            )}

            {session.status === 'signed-out' && (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/auth/login"
                  onClick={close}
                  className={`flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-150 ${linkFocusRing} ${accountLinkStyles.outline}`}
                >
                  Log in
                </Link>
                <Link
                  href="/auth/register"
                  onClick={close}
                  className={`flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-150 ${linkFocusRing} ${accountLinkStyles.primary}`}
                >
                  Sign up
                </Link>
              </div>
            )}

            {session.status === 'signed-in' && (
              <Link
                href={PROFILE_NAV_ITEM.href}
                onClick={close}
                aria-current={isProfileActive ? 'page' : undefined}
                className={`-mx-2 flex items-center gap-3 rounded-lg p-2 transition-colors duration-150 ${linkFocusRing} ${drawerLinkStyles[isProfileActive ? 'active' : 'idle']}`}
              >
                <Avatar
                  aria-hidden="true"
                  src={session.user.avatar_url}
                  name={session.user.full_name}
                  size="md"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{session.user.full_name}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {PROFILE_NAV_ITEM.label} · {session.user.email}
                  </span>
                </span>
              </Link>
            )}
          </div>

          {children && (
            <div className="border-t border-slate-200/80 px-4 py-4 dark:border-slate-800">{children}</div>
          )}
        </div>
      </div>,
      document.body
    );
  }
);

MobileNavDrawer.displayName = 'MobileNavDrawer';
