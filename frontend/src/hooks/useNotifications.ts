'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  loadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationResult,
} from '@/app/notifications/actions';
import { useLiveMessages } from '@/components/providers/RealtimeProvider';
import { useToast } from '@/components/ui/Toast';
import { openLiveSocket, type RealtimeStatus } from '@/lib/liveSocket';
import { NOTIFICATIONS_WS_PATH, mergeNotifications, parseNotificationMessage } from '@/lib/notifications';
import type { AppNotification } from '@/types/notification';

// A server action can throw instead of answering (network down, or a tab older than the server after a deploy:
// "Server Action not found"). Treated like Django being unavailable, never as an unhandled rejection.
const settle = <T,>(call: Promise<NotificationResult<T>>): Promise<NotificationResult<T>> =>
  call.catch(() => ({ ok: false, error: 'unavailable' }) as const);

interface Feed {
  items: AppNotification[];
  unread: number; // Django's count: can be more than the unread items loaded
}

const EMPTY: Feed = { items: [], unread: 0 };
const markItemsRead = (items: AppNotification[], ids?: Set<string>) =>
  items.map((item) => (!ids || ids.has(item.id) ? { ...item, is_read: true } : item));

// The bell's data for the signed-in student (Step 15.3, DOCS.md §15.3), from Django's stored notifications:
//  - load: GET the newest page + the unread count (server action), on mount and after every (re)connect;
//  - live: /ws/notifications/ adds new ones and corrects the count (e.g. read in another tab);
//  - mark as read (one / all): shown at once, saved in Django, undone with a toast if Django refuses.
// The socket is opened before the first reload completes, and items are merged by id, so a notification created
// while the page loads is neither lost nor shown twice (API_SPEC.md's advice).
export const useNotifications = (enabled: boolean) => {
  const t = useTranslations('Notifications');
  const { showToast } = useToast();
  const [feed, setFeed] = useState<Feed>(EMPTY);
  const [status, setStatus] = useState<RealtimeStatus>('off');
  const feedRef = useRef(feed);
  useEffect(() => {
    feedRef.current = feed;
  });

  // State is set in the promise callback, never during the effect itself.
  const load = useCallback(() => {
    void settle(loadNotificationsAction()).then((result) => {
      if (!result.ok) return; // keep what is shown; the next reconnect tries again
      setFeed((current) => ({
        items: mergeNotifications(result.value.items, current.items),
        unread: result.value.unreadCount,
      }));
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    const stop = openLiveSocket({
      path: NOTIFICATIONS_WS_PATH,
      onStatus: setStatus,
      onEstablished: load,
      onMessage: (text) => {
        const message = parseNotificationMessage(text);
        if (!message) {
          console.warn('[notifications] ignored message', text);
          return;
        }
        if (message.type === 'created') {
          const { notification } = message;
          setFeed((current) =>
            current.items.some((item) => item.id === notification.id)
              ? current
              : { items: mergeNotifications([notification], current.items), unread: current.unread + (notification.is_read ? 0 : 1) }
          );
        } else {
          // 0 = everything was read (here or in another tab): the loaded items follow.
          setFeed((current) => ({ items: message.count === 0 ? markItemsRead(current.items) : current.items, unread: message.count }));
        }
      },
    });
    return () => {
      stop();
      setFeed(EMPTY); // signed out: nothing of the previous student stays in memory
      setStatus('off');
    };
  }, [enabled, load]);

  // An event deleted while its notifications are on screen: Django's reload would link them to /calendar
  // (event_id becomes null), so do the same at once instead of leading to "Event not found".
  useLiveMessages((signal) => {
    if (signal.type !== 'deleted') return;
    const href = `/events/${signal.id}`;
    setFeed((current) =>
      current.items.some((item) => item.href === href)
        ? { ...current, items: current.items.map((item) => (item.href === href ? { ...item, href: '/calendar' } : item)) }
        : current
    );
  });

  const failed = useCallback(
    () => showToast({ title: t('saveFailed.title'), description: t('saveFailed.description'), variant: 'danger' }),
    [showToast, t]
  );

  const markRead = useCallback(
    (id: string) => {
      const item = feedRef.current.items.find((candidate) => candidate.id === id);
      if (!item || item.is_read) return;
      const ids = new Set([id]);
      setFeed((current) => ({ items: markItemsRead(current.items, ids), unread: Math.max(0, current.unread - 1) }));
      void settle(markNotificationReadAction(id)).then((result) => {
        if (result.ok) return;
        setFeed((current) => ({
          items: current.items.map((candidate) => (candidate.id === id ? { ...candidate, is_read: false } : candidate)),
          unread: current.unread + 1,
        }));
        failed();
      });
    },
    [failed]
  );

  const markAllRead = useCallback(() => {
    const before = feedRef.current;
    if (before.unread === 0) return;
    const wereUnread = new Set(before.items.filter((item) => !item.is_read).map((item) => item.id));
    setFeed((current) => ({ items: markItemsRead(current.items), unread: 0 }));
    void settle(markAllNotificationsReadAction()).then((result) => {
      if (result.ok) return;
      setFeed((current) => ({
        items: current.items.map((item) => (wereUnread.has(item.id) ? { ...item, is_read: false } : item)),
        unread: current.unread + before.unread,
      }));
      failed();
    });
  }, [failed]);

  return { notifications: feed.items, unreadCount: feed.unread, status, markRead, markAllRead };
};
