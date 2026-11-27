import { AppRoute } from '@/types/navigation';

// Django's notification types (notifications/models.py on branch Ahmed, API_SPEC.md "Personal notification API"),
// plus `event_removed`: Django sends `event_cancelled` with no event_id when an event is deleted (title "Event
// removed"); the mapper tells the two apart so the bell can say "removed" in every language (DOCS.md §15.3).
export type NotificationKind =
  | 'new_event'
  | 'event_updated'
  | 'event_cancelled'
  | 'event_removed'
  | 'rsvp_confirmed'
  | 'rsvp_cancelled'
  | 'club_announcement';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  // Django's own text, in English (TEAM_NEEDS BE10). The bell writes the title and sentence in the visitor's
  // language from `kind` + `event_title` (useNotificationText) and falls back to these when it can't.
  title: string;
  body: string;
  event_title?: string; // the event's name, once Django sends it (BE10)
  href: AppRoute; // where clicking the notification goes
  created_at: string; // ISO 8601 string
  is_read: boolean;
}

// One page of the bell: the newest notifications and Django's unread count (it can be more than the unread
// items in `items`, which holds only the first page).
export interface NotificationFeed {
  items: AppNotification[];
  unreadCount: number;
}
