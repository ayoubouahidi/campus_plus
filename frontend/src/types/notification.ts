import { WebSocketEventType } from '@/types/api';
import { AppRoute } from '@/types/navigation';

// A stored, user-facing record of a real-time event (created from WebSocket pushes in Phase 6).
// `kind` reuses WebSocketEventType so the socket payload and the UI can never disagree on names.
export type NotificationKind = WebSocketEventType;

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: AppRoute;     // where clicking the notification goes
  created_at: string; // ISO 8601 string
  is_read: boolean;
}
