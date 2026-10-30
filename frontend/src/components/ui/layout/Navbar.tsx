'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PUBLIC_NAV, PROFILE_NAV_ITEM, isNavItemActive } from '@/lib/navigation';
import { NAV_ICONS, SearchIcon } from '@/components/ui/layout/navIcons';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { SessionState } from '@/types/session';

type LinkState = 'active' | 'idle';

const linkStateStyles: Record<LinkState, string> = {
  active: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
  idle:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
};

/* --------------------------------- Navbar --------------------------------- */

export type NavbarProps = React.HTMLAttributes<HTMLElement>;

export const Navbar = React.forwardRef<HTMLElement, NavbarProps>(
  ({ children, className = '', ...props }, ref) => (
    <header
      ref={ref}
      className={`sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80 ${className}`}
      {...props}
    >
      {/* First tab stop on every page; the target id is set on <main> in the root layout */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </header>
  )
);

Navbar.displayName = 'Navbar';

/* ------------------------------- NavbarBrand ------------------------------ */

export type NavbarBrandProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

export const NavbarBrand = React.forwardRef<HTMLAnchorElement, NavbarBrandProps>(
  ({ className = '', ...props }, ref) => (
    <Link
      ref={ref}
      href="/"
      aria-label="Campus Hub home"
      className={`flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${className}`}
      {...props}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white shadow-sm"
        aria-hidden="true"
      >
        CH
      </span>
      {/* Below 360px (small Androids, iPhone SE 1st gen) only the CH mark fits next to the actions */}
      <span className="hidden flex-col leading-tight min-[360px]:flex" aria-hidden="true">
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Campus Hub</span>
        <span className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">1337 · EMINES</span>
      </span>
    </Link>
  )
);

NavbarBrand.displayName = 'NavbarBrand';

/* ------------------------------- NavbarLinks ------------------------------ */

export type NavbarLinksProps = React.HTMLAttributes<HTMLElement>;

// Desktop only (md+). Small viewports get MobileNav's bottom tab bar instead.
export const NavbarLinks = React.forwardRef<HTMLElement, NavbarLinksProps>(
  ({ className = '', ...props }, ref) => {
    const pathname = usePathname();

    return (
      <nav ref={ref} aria-label="Main" className={`hidden md:block ${className}`} {...props}>
        <ul className="flex items-center gap-1">
          {PUBLIC_NAV.map((item) => {
            const isActive = isNavItemActive(item, pathname);
            const Icon = NAV_ICONS[item.icon];

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${linkStateStyles[isActive ? 'active' : 'idle']}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
);

NavbarLinks.displayName = 'NavbarLinks';

/* ------------------------------ NavbarActions ----------------------------- */

export type NavbarActionsProps = React.HTMLAttributes<HTMLDivElement>;

// Right-aligned slot for the ⌘K search trigger, notifications and the session menu.
export const NavbarActions = React.forwardRef<HTMLDivElement, NavbarActionsProps>(
  ({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={`ml-auto flex items-center gap-2 ${className}`} {...props}>
      {children}
    </div>
  )
);

NavbarActions.displayName = 'NavbarActions';

/* ------------------------------ NavbarSearch ------------------------------ */

type Platform = 'mac' | 'other';

const shortcutModifier: Record<Platform, string> = {
  mac: '⌘',
  other: 'Ctrl',
};

const detectPlatform = (): Platform =>
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? 'mac' : 'other';

export interface NavbarSearchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'> {
  // Fired on click and on ⌘K / Ctrl+K anywhere on the page.
  onOpen: () => void;
}

// Icon-only below sm. Between md and lg the desktop links need the room, so the label collapses again.
export const NavbarSearch = React.forwardRef<HTMLButtonElement, NavbarSearchProps>(
  ({ onOpen, disabled, className = '', ...props }, ref) => {
    const [mounted, setMounted] = useState(false);
    const [platform, setPlatform] = useState<Platform>('other');

    // navigator only exists in the browser: server HTML and the first client render both use 'other'
    useEffect(() => {
      setPlatform(detectPlatform());
      setMounted(true);
    }, []);

    useEffect(() => {
      if (disabled) return;

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey) || event.repeat) return;
        // Overrides the browser's own Ctrl+K (jump to the address/search bar)
        event.preventDefault();
        onOpen();
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [disabled, onOpen]);

    return (
      <button
        ref={ref}
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-label="Search events and clubs"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className={`inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 text-sm text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50 sm:w-56 sm:px-3 md:w-auto md:px-2.5 lg:w-64 lg:px-3 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200 ${className}`}
        {...props}
      >
        <SearchIcon className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline md:hidden lg:inline">Search events…</span>
        {/* Hidden until mount so a Mac user never sees "Ctrl" flash to "⌘" */}
        <kbd
          aria-hidden="true"
          className={`ml-auto hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-medium leading-none text-slate-500 sm:inline-block md:hidden lg:inline-block dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 ${mounted ? '' : 'invisible'}`}
        >
          {shortcutModifier[platform]} K
        </kbd>
      </button>
    );
  }
);

NavbarSearch.displayName = 'NavbarSearch';

/* ------------------------------ NavbarSession ----------------------------- */

// Kept as an alias so existing imports keep working; the shape lives in types/session.ts.
export type NavbarSessionState = SessionState;

type AuthLinkVariant = 'primary' | 'ghost';

// Mirrors Button's primary/ghost variants. These navigate, so they are links, not <Button>s.
const authLinkStyles: Record<AuthLinkVariant, string> = {
  primary: 'bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
};

const authLinkBase =
  'h-9 items-center rounded-lg px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40';

const avatarRingStyles: Record<LinkState, string> = {
  active: 'ring-2 ring-violet-500 dark:ring-violet-400',
  idle: 'ring-2 ring-transparent hover:ring-slate-300 dark:hover:ring-slate-600',
};

export interface NavbarSessionProps extends React.HTMLAttributes<HTMLDivElement> {
  session: NavbarSessionState;
}

export const NavbarSession = React.forwardRef<HTMLDivElement, NavbarSessionProps>(
  ({ session, className = '', ...props }, ref) => {
    const pathname = usePathname();
    const isProfileActive = isNavItemActive(PROFILE_NAV_ITEM, pathname);

    return (
      <div ref={ref} className={`flex items-center gap-2 ${className}`} {...props}>
        {session.status === 'loading' && (
          <>
            <Skeleton variant="circular" width={32} height={32} />
            <span className="sr-only">Loading account</span>
          </>
        )}

        {session.status === 'signed-out' && (
          <>
            <Link href="/auth/login" className={`inline-flex ${authLinkBase} ${authLinkStyles.ghost}`}>
              Log in
            </Link>
            {/* Below sm there's only room for one; the login page links to registration */}
            <Link
              href="/auth/register"
              className={`hidden sm:inline-flex ${authLinkBase} ${authLinkStyles.primary}`}
            >
              Sign up
            </Link>
          </>
        )}

        {session.status === 'signed-in' && (
          <Link
            href={PROFILE_NAV_ITEM.href}
            aria-label={`${PROFILE_NAV_ITEM.label} (${session.user.full_name})`}
            aria-current={isProfileActive ? 'page' : undefined}
            className="flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
          >
            {/* The link's aria-label already names the user; hide the avatar's own alt text */}
            <Avatar
              aria-hidden="true"
              src={session.user.avatar_url}
              name={session.user.full_name}
              size="sm"
              className={`rounded-full transition-shadow duration-150 ${avatarRingStyles[isProfileActive ? 'active' : 'idle']}`}
            />
          </Link>
        )}
      </div>
    );
  }
);

NavbarSession.displayName = 'NavbarSession';
