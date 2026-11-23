import { useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLiveMessages } from '@/components/providers/RealtimeProvider';

// Pages that show events: a live change re-renders them from the server (Step 15.2, DOCS.md §15.2).
const LIVE_ROUTES = ['/', '/calendar', '/clubs', '/events', '/profile', '/search'];
const isLiveRoute = (pathname: string) =>
  LIVE_ROUTES.some((route) => (route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`)));

// Wait this long after a message before refreshing: a board member's save can send several messages
// (create, then an update), and a reconnect resync can follow; one refresh covers them all.
const SETTLE_MS = 500;

// Called once, in the shell. On a live event message, or a resync after a reconnect (messages missed while
// offline are gone), asks Next to re-render the current page on the server: the same code path as a page load,
// so dates are formatted in campus time on the server (DOCS.md §5.2) and RSVP state comes from Django with the
// student's token. The first resync after the page opens is skipped: the page was just rendered.
export const useLiveRefresh = () => {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const connections = useRef(0);

  useLiveMessages((signal) => {
    if (signal.type === 'resync') {
      connections.current += 1;
      if (connections.current === 1) return;
    }
    if (!isLiveRoute(pathname)) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), SETTLE_MS);
  });
};
