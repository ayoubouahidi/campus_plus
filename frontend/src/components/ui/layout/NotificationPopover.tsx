'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { BellIcon, IconBase, NavIconProps } from '@/components/ui/layout/navIcons';
import { trapTabKey } from '@/lib/focus';
import { useMergedRef } from '@/lib/refs';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/time';
import { AppNotification, NotificationKind } from '@/types/notification';

/* -------------------------------- Context --------------------------------- */

interface NotificationPopoverContextValue {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  panelId: string;
  titleId: string;
  rootRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  notifications: readonly AppNotification[];
  unreadCount: number;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
}

const NotificationPopoverContext = createContext<NotificationPopoverContextValue | null>(null);

const useNotificationPopover = () => {
  const context = useContext(NotificationPopoverContext);
  if (!context) {
    throw new Error(
      'NotificationPopover subcomponents (NotificationTrigger, NotificationPanel) must be wrapped inside a <NotificationPopover>.'
    );
  }
  return context;
};

/* -------------------------- NotificationPopover --------------------------- */

export interface NotificationPopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  // Owned by the caller (the WebSocket layer in Phase 6); the popover only owns open/closed.
  notifications: readonly AppNotification[];
  // Called when an unread notification is clicked. Omit to leave read state untouched.
  onMarkRead?: (id: string) => void;
  // Shows the "Mark all as read" button when provided and something is unread.
  onMarkAllRead?: () => void;
}

interface Announcement {
  id: number; // bumps on every announcement so identical text is still re-read
  text: string;
}

const describeArrivals = (arrived: readonly AppNotification[]) =>
  arrived.length === 1 ? `New notification: ${arrived[0].title}` : `${arrived.length} new notifications`;

// `relative` wrapper: the panel is positioned against it from sm up.
export const NotificationPopover = React.forwardRef<HTMLDivElement, NotificationPopoverProps>(
  ({ notifications, onMarkRead, onMarkAllRead, children, className = '', ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const seenIdsRef = useRef<Set<string> | null>(null);
    const panelId = useId();
    const titleId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const setRootRef = useMergedRef(ref, rootRef);

    const toggle = useCallback(() => setIsOpen((open) => !open), []);
    const close = useCallback(() => setIsOpen(false), []);

    const unreadCount = useMemo(
      () => notifications.filter((notification) => !notification.is_read).length,
      [notifications]
    );

    // Announce unread notifications that weren't in the previous list. The first list is not "new".
    useEffect(() => {
      const seenIds = seenIdsRef.current;
      seenIdsRef.current = new Set(notifications.map((notification) => notification.id));
      if (!seenIds) return;

      const arrived = notifications.filter((notification) => !notification.is_read && !seenIds.has(notification.id));
      if (arrived.length === 0) return;
      setAnnouncement((previous) => ({ id: (previous?.id ?? 0) + 1, text: describeArrivals(arrived) }));
    }, [notifications]);

    const value = useMemo(
      () => ({
        isOpen,
        toggle,
        close,
        panelId,
        titleId,
        rootRef,
        triggerRef,
        notifications,
        unreadCount,
        onMarkRead,
        onMarkAllRead,
      }),
      [isOpen, toggle, close, panelId, titleId, notifications, unreadCount, onMarkRead, onMarkAllRead]
    );

    return (
      <NotificationPopoverContext.Provider value={value}>
        <div ref={setRootRef} className={`relative ${className}`} {...props}>
          {children}
          {/* Always in the DOM so screen readers are already listening when text arrives */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {announcement && <span key={announcement.id}>{announcement.text}</span>}
          </div>
        </div>
      </NotificationPopoverContext.Provider>
    );
  }
);

NotificationPopover.displayName = 'NotificationPopover';

/* -------------------------- NotificationTrigger --------------------------- */

type TriggerState = 'open' | 'closed';

const triggerStateStyles: Record<TriggerState, string> = {
  open: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
  closed:
    'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
};

// Keeps the badge to at most three characters so it never outgrows the bell.
const formatUnreadCount = (count: number) => (count > 99 ? '99+' : String(count));

export type NotificationTriggerProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>;

export const NotificationTrigger = React.forwardRef<HTMLButtonElement, NotificationTriggerProps>(
  ({ onClick, className = '', ...props }, ref) => {
    const { isOpen, toggle, panelId, triggerRef, unreadCount } = useNotificationPopover();
    const setTriggerRef = useMergedRef(ref, triggerRef);

    // The badge is visual only, so the count lives in the accessible name.
    const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';

    return (
      <button
        ref={setTriggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        // Only point at the panel while it exists in the DOM
        aria-controls={isOpen ? panelId : undefined}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) toggle();
        }}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${triggerStateStyles[isOpen ? 'open' : 'closed']} ${className}`}
        {...props}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-950"
          >
            {formatUnreadCount(unreadCount)}
          </span>
        )}
      </button>
    );
  }
);

NotificationTrigger.displayName = 'NotificationTrigger';

/* --------------------------- NotificationPanel ---------------------------- */

// Exhaustive: a new WebSocketEventType without an entry here is a compile error.
const KIND_STYLES: Record<
  NotificationKind,
  { icon: (props: NavIconProps) => React.JSX.Element; tone: string }
> = {
  event_created: {
    icon: (props) => (
      <IconBase {...props}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
      </IconBase>
    ),
    tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  },
  event_updated: {
    icon: (props) => (
      <IconBase {...props}>
        <path d="M4 20h4L19 9l-4-4L4 16v4z" />
        <path d="m13.5 6.5 4 4" />
      </IconBase>
    ),
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
  event_deleted: {
    icon: (props) => (
      <IconBase {...props}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4M10 13.5l4 4M14 13.5l-4 4" />
      </IconBase>
    ),
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  },
};

type ReadState = 'unread' | 'read';

const itemStyles: Record<ReadState, string> = {
  unread: 'bg-violet-50/60 dark:bg-violet-500/5',
  read: '',
};

const itemDotStyles: Record<ReadState, string> = {
  unread: 'bg-violet-600 dark:bg-violet-400',
  read: 'bg-transparent',
};

const itemTitleStyles: Record<ReadState, string> = {
  unread: 'font-semibold text-slate-900 dark:text-slate-100',
  read: 'font-medium text-slate-700 dark:text-slate-300',
};

export type NotificationPanelProps = React.HTMLAttributes<HTMLDivElement>;

// Below sm the panel spans the viewport (minus gutters) under the navbar; from sm it drops from the bell.
export const NotificationPanel = React.forwardRef<HTMLDivElement, NotificationPanelProps>(
  ({ className = '', onKeyDown, ...props }, ref) => {
    const {
      isOpen,
      close,
      panelId,
      titleId,
      rootRef,
      triggerRef,
      notifications,
      unreadCount,
      onMarkRead,
      onMarkAllRead,
    } = useNotificationPopover();
    const [mounted, setMounted] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const panelRef = useRef<HTMLDivElement>(null);
    const setPanelRef = useMergedRef(ref, panelRef);

    useEffect(() => {
      setMounted(true);
    }, []);

    const closeAndRestoreFocus = useCallback(() => {
      close();
      triggerRef.current?.focus();
    }, [close, triggerRef]);

    // On open: move focus to the first notification (or the panel itself when empty)
    useEffect(() => {
      if (!mounted || !isOpen || !panelRef.current) return;
      const firstItem = panelRef.current.querySelector<HTMLElement>('[data-notification-item]');
      (firstItem ?? panelRef.current).focus();
    }, [mounted, isOpen]);

    // Relative times are computed client-side only (the panel never renders on the server),
    // refreshed on open and every minute while open.
    useEffect(() => {
      if (!isOpen) return;
      setNow(Date.now());
      const interval = window.setInterval(() => setNow(Date.now()), 60_000);
      return () => window.clearInterval(interval);
    }, [isOpen]);

    // The button unmounts once nothing is unread, so park focus on the panel instead of losing it
    const handleMarkAllRead = () => {
      onMarkAllRead?.();
      panelRef.current?.focus();
    };

    // While open: Esc closes (focus back to the bell); a press outside the popover closes in place
    useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeAndRestoreFocus();
      };
      const handlePointerDown = (event: PointerEvent) => {
        if (!rootRef.current?.contains(event.target as Node)) close();
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('pointerdown', handlePointerDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('pointerdown', handlePointerDown);
      };
    }, [isOpen, close, closeAndRestoreFocus, rootRef]);

    // Focus trap: Tab / Shift+Tab wrap around inside the panel
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || !panelRef.current) return;
      trapTabKey(event, panelRef.current);
    };

    if (!mounted || !isOpen) return null;

    return (
      <div
        ref={setPanelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`fixed inset-x-4 top-[4.5rem] z-50 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl focus:outline-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 dark:border-slate-800 dark:bg-slate-900 ${className}`}
        {...props}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Notifications
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
          </div>
          {onMarkAllRead && unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="rounded-md px-2 py-1 text-xs font-semibold text-violet-700 transition-colors duration-150 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-400 dark:hover:bg-violet-500/10"
            >
              Mark all as read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <BellIcon className="h-6 w-6" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">You&apos;re all caught up</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                New events and changes to events you follow will show up here.
              </p>
            </div>
          </div>
        ) : (
          <ul className="max-h-[min(28rem,calc(100vh-8rem))] divide-y divide-slate-200/80 overflow-y-auto dark:divide-slate-800">
            {notifications.map((notification) => {
              const readState: ReadState = notification.is_read ? 'read' : 'unread';
              const { icon: KindIcon, tone } = KIND_STYLES[notification.kind];

              return (
                <li key={notification.id}>
                  <Link
                    href={notification.href}
                    data-notification-item
                    onClick={() => {
                      if (!notification.is_read) onMarkRead?.(notification.id);
                      close();
                    }}
                    className={`flex gap-3 px-4 py-3 transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/40 dark:hover:bg-slate-800/60 dark:focus-visible:bg-slate-800/60 ${itemStyles[readState]}`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}
                    >
                      <KindIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className={`block text-sm ${itemTitleStyles[readState]}`}>
                        {!notification.is_read && <span className="sr-only">Unread: </span>}
                        {notification.title}
                      </span>
                      <span className="block text-sm text-slate-500 dark:text-slate-400">{notification.body}</span>
                      <time
                        dateTime={notification.created_at}
                        title={formatAbsoluteTime(notification.created_at)}
                        className="block text-xs text-slate-400 dark:text-slate-500"
                      >
                        {formatRelativeTime(notification.created_at, now)}
                      </time>
                    </span>
                    {/* Unread dot; the state is spoken through the sr-only prefix instead */}
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${itemDotStyles[readState]}`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }
);

NotificationPanel.displayName = 'NotificationPanel';
