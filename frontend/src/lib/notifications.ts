import { toNotification } from '@/lib/api/mappers';
import type { RawNotification } from '@/lib/api/raw';
import type { AppNotification } from '@/types/notification';

// The notification socket's protocol (Step 15.3, DOCS.md §15.3; API_SPEC.md "Personal notification WebSocket" on
// branch Ahmed). Pure: parsing and merging only, shared by useNotifications and /test.

export const NOTIFICATIONS_WS_PATH = '/ws/notifications/';

// Most the bell keeps in memory (Django's first page is 30, live ones add on top).
export const NOTIFICATIONS_KEPT = 50;

export type NotificationMessage =
  | { type: 'created'; notification: AppNotification }
  | { type: 'unread_count'; count: number };

type RawMessage =
  | { type: 'notification.created'; data: RawNotification }
  | { type: 'notification.unread_count'; data: { unread_count: number } };

// null for anything unknown (ignored, logged by the caller). The handshake acknowledgment never gets here
// (lib/liveSocket.ts handles it).
export const parseNotificationMessage = (text: string): NotificationMessage | null => {
  let raw: RawMessage;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  switch (raw?.type) {
    case 'notification.created':
      return { type: 'created', notification: toNotification(raw.data) };
    case 'notification.unread_count':
      return typeof raw.data?.unread_count === 'number' ? { type: 'unread_count', count: raw.data.unread_count } : null;
    default:
      return null;
  }
};

// One list, newest first, each id once (a live message and a reload can bring the same notification). Read wins:
// Django never turns a read notification back to unread, so a reload that started before a "mark as read"
// can't undo it on screen.
export const mergeNotifications = (incoming: AppNotification[], current: AppNotification[]): AppNotification[] => {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const known = byId.get(item.id);
    byId.set(item.id, known ? { ...item, is_read: item.is_read || known.is_read } : item);
  }
  return [...byId.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id, 'en', { numeric: true }))
    .slice(0, NOTIFICATIONS_KEPT);
};
