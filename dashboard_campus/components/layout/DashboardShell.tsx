"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { NavIcon } from "@/components/layout/NavIcon";
import { NAVIGATION, type DashboardArea } from "@/components/layout/navigation";

export type ShellProfile = { full_name: string; email: string; avatar_url: string | null };

type Props = {
  area: DashboardArea;
  profile: ShellProfile;
  /** Shown under the badge, e.g. the club's name for a board member. */
  context?: string;
  children: React.ReactNode;
};

function isActive(pathname: string, href: string, root: string) {
  return href === root ? pathname === root : pathname === href || pathname.startsWith(`${href}/`);
}

function LogoutButton() {
  const [pending, setPending] = useState(false);
  return (
    <form action={logout} onSubmit={() => setPending(true)}>
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:opacity-60 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        {pending ? "Logging out…" : "Log out"}
      </button>
    </form>
  );
}

function SidebarContent({
  area,
  profile,
  context,
  onNavigate,
}: Omit<Props, "children"> & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { badge, items } = NAVIGATION[area];
  const root = items[0].href;

  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <div className="space-y-3">
        <Link href={root} onClick={onNavigate} aria-label="Campus Hub dashboard home" className="inline-block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
          <Logo decorative className="h-9" />
        </Link>
        <div>
          <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            {badge}
          </span>
          {context && (
            <p className="mt-2 truncate text-sm font-medium text-slate-700 dark:text-slate-300">{context}</p>
          )}
        </div>
      </div>

      <nav aria-label="Dashboard" className="flex-1">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href, root);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
                    active
                      ? "bg-violet-50 font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                      : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  }`}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-2 border-t border-slate-200/80 pt-4 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-xl px-1">
          <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{profile.full_name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile.email}</p>
          </div>
          <ThemeToggle />
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}

export default function DashboardShell({ area, profile, context, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Phone drawer: Esc closes it, the page behind doesn't scroll, focus moves in and back.
  useEffect(() => {
    if (!menuOpen) return;
    const button = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      button?.focus();
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-violet-700 focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop: fixed-width sidebar that stays in view while the page scrolls. */}
      <aside className="hidden border-r border-slate-200/80 bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 dark:border-slate-800 dark:bg-slate-900">
        <SidebarContent area={area} profile={profile} context={context} />
      </aside>

      {/* Phone and tablet: top bar with a menu button. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <Logo className="h-8" />
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="dashboard-drawer"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-slate-950/50" onClick={() => setMenuOpen(false)} />
          <div
            ref={drawerRef}
            id="dashboard-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-white shadow-xl dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <SidebarContent area={area} profile={profile} context={context} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
        {children}
      </div>
    </div>
  );
}
