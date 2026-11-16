'use client';

import React, { useState } from 'react';
import type { AttendeePreview, EventItem } from '@/types/api';
import { useRsvpToast } from '@/hooks/useRsvpToast';
import { toggleRsvp } from '@/lib/events';
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
  const [event, setEvent] = useState(initialEvent);
  const announceRsvp = useRsvpToast();

  // Optimistic (Phase 7 sends the request and rolls back on failure). Toast decided outside the updater.
  const handleRsvpToggle = (before: EventItem) => {
    setEvent(toggleRsvp);
    announceRsvp(before);
  };

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
