'use client';

import React, { useCallback } from 'react';
import { useSyncedState } from '@/hooks/useSyncedState';
import type { AttendeePreview, EventItem } from '@/types/api';
import { useRsvp, type UpdateEvent } from '@/hooks/useRsvp';
import { AttendeesSection } from './AttendeesSection';
import { RsvpCard } from './RsvpCard';

export interface EventPageShellProps {
  initialEvent: EventItem;
  // Everything below comes from the server page.
  hasEnded: boolean;
  attendees: AttendeePreview[];
  // <EventDetails>: rendered on the server and passed through, so it ships no JavaScript.
  children: React.ReactNode;
}

// The interactive part of /events/[id]: owns the RSVP state shared by the attendee list and the RSVP
// card, and lays out content (left) + RSVP (right from lg, a bottom bar below).
export const EventPageShell = ({ initialEvent, hasEnded, attendees, children }: EventPageShellProps) => {
  const [event, setEvent] = useSyncedState(initialEvent); // follows live refreshes (Step 15.2)
  // Saved in Django, optimistic with rollback (useRsvp, Step 14.3). One event here, so `id` is always ours.
  const handleRsvpToggle = useRsvp(useCallback<UpdateEvent>((_id, change) => setEvent(change), [setEvent]));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0 space-y-8">
        {children}
        <AttendeesSection event={event} attendees={attendees} hasEnded={hasEnded} />
      </div>
      <RsvpCard event={event} hasEnded={hasEnded} onRsvpToggle={handleRsvpToggle} />
    </div>
  );
};
