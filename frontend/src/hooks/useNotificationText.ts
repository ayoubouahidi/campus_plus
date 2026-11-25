'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { AppNotification } from '@/types/notification';

// A notification's title and sentence in the visitor's language (Step 15.3, DOCS.md §15.3). Django writes them in
// English; the bell writes its own from the kind (+ the event's name when Django sends it, TEAM_NEEDS BE10):
//  - title: always translated, except club announcements (the club's own words);
//  - sentence: translated when the event's name is known, otherwise Django's English sentence.
export const useNotificationText = () => {
  const t = useTranslations('Notifications.kinds');
  return useCallback(
    (notification: AppNotification): { title: string; body: string } => {
      const { kind, event_title: event } = notification;
      if (kind === 'club_announcement') return { title: notification.title, body: notification.body };
      return {
        title: t(`${kind}.title`),
        body: event ? t(`${kind}.body`, { event }) : notification.body,
      };
    },
    [t]
  );
};
