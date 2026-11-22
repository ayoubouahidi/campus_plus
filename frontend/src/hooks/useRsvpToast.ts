import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';
import type { EventItem } from '@/types/api';

// The toast after an RSVP click, the same everywhere (feed cards, event page). Pass the event as it was
// *before* the toggle, and call it outside state updaters (they run twice in Strict Mode).
export const useRsvpToast = () => {
  const { showToast } = useToast();
  const t = useTranslations('Rsvp');

  return useCallback(
    (before: EventItem) =>
      showToast(
        before.has_user_rsvpd
          ? { title: t('toastCancelled'), description: before.title, variant: 'info' }
          : { title: t('toastGoing'), description: before.title, variant: 'success' }
      ),
    [showToast, t]
  );
};
