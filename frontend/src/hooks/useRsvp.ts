import { useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { rsvpAction } from '@/app/events/actions';
import { useToast } from '@/components/ui/Toast';
import { useRsvpToast } from '@/hooks/useRsvpToast';
import { toggleRsvp } from '@/lib/events';
import type { EventItem } from '@/types/api';

// Replaces one event in the caller's state (a list or a single event).
export type UpdateEvent = (id: string, change: (event: EventItem) => EventItem) => void;

// RSVP for real (Step 14.3, DOCS.md §14.3), shared by the feed, the event page, club pages and /profile.
//  1. The button changes at once (optimistic), so the click feels instant.
//  2. rsvpAction saves it in Django with the student's token.
//  3. Success: Django's count replaces our guess (others may have RSVP'd meanwhile), then the usual toast.
//     Failure: the event goes back to how it was (with Django's count if it sent one, e.g. when full) and an
//     error toast says why.
// A second click on the same event while its request runs is ignored (no double POST / DELETE race).
export const useRsvp = (update: UpdateEvent) => {
  const announce = useRsvpToast();
  const { showToast } = useToast();
  const t = useTranslations('Rsvp');
  const pending = useRef(new Set<string>());

  return useCallback(
    async (before: EventItem) => {
      if (pending.current.has(before.id)) return;
      pending.current.add(before.id);
      update(before.id, toggleRsvp);
      try {
        const result = await rsvpAction(before.id, !before.has_user_rsvpd);
        if (result.ok) {
          const state = result.state;
          if (state) update(before.id, (event) => ({ ...event, ...state }));
          announce(before);
          return;
        }
        const count = result.rsvps_count;
        update(before.id, () => (count === undefined ? before : { ...before, rsvps_count: count }));
        showToast({ title: t(`errors.${result.error}.title`), description: t(`errors.${result.error}.description`), variant: 'danger' });
      } catch {
        // The action itself failed (network between browser and Next): same as "unavailable".
        update(before.id, () => before);
        showToast({ title: t('errors.unavailable.title'), description: t('errors.unavailable.description'), variant: 'danger' });
      } finally {
        pending.current.delete(before.id);
      }
    },
    [announce, showToast, t, update]
  );
};
