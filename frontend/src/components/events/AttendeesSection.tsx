'use client';

import React, { useId, useState } from 'react';
import type { AttendeePreview, EventItem } from '@/types/api';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '@/components/ui/Modal';
import { useSession } from '@/components/providers/SessionProvider';

/* --------------------------------- Types ---------------------------------- */

export interface AttendeesSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  // Current RSVP state (controlled, shared with RsvpCard): the user appears here as soon as they RSVP.
  event: EventItem;
  // Everyone else who is going (getMockAttendees today, the API in Phase 7). Never includes the user.
  attendees: AttendeePreview[];
  hasEnded: boolean;
}

const MAX_AVATARS = 6;

/* --------------------------------- Helpers -------------------------------- */

// "You", "You and Salma Idrissi", "Salma Idrissi, Youssef Benali and 40 others". Written out so the
// avatar stack can be aria-hidden: this sentence is what screen readers hear.
const summarize = (names: string[], total: number): string => {
  if (names.length === 0) return `${total} ${total === 1 ? 'person' : 'people'}`;
  const rest = total - names.length;
  if (rest <= 0) return names.join(' and ');
  return `${names.join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
};

const HEADINGS = { upcoming: "Who's going", ended: 'Who went' } as const;

/* ---------------------------- AttendeesSection ---------------------------- */

export const AttendeesSection = React.forwardRef<HTMLElement, AttendeesSectionProps>(
  ({ event, attendees, hasEnded, className = '', ...props }, ref) => {
    const headingId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const { session } = useSession();

    // "You" first when signed in and going; the session decides, so Phase 5 auth needs no change here.
    const me = session.status === 'signed-in' && event.has_user_rsvpd ? session.user : null;
    const people: (AttendeePreview & { isMe?: boolean })[] = me
      ? [{ id: me.id, full_name: me.full_name, avatar_url: me.avatar_url, isMe: true }, ...attendees]
      : attendees;
    const total = event.rsvps_count;
    const heading = HEADINGS[hasEnded ? 'ended' : 'upcoming'];
    const names = people.slice(0, 2).map((person) => (person.isMe ? 'You' : person.full_name));

    return (
      <section ref={ref} aria-labelledby={headingId} className={`space-y-3 ${className}`} {...props}>
        <h2 id={headingId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {heading} <span className="font-normal text-slate-500 dark:text-slate-400">({total})</span>
        </h2>

        {total === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {hasEnded ? 'Nobody RSVP’d to this event.' : 'Nobody has RSVP’d yet.'}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <AvatarGroup max={MAX_AVATARS} total={total} aria-hidden="true">
              {people.slice(0, MAX_AVATARS).map((person) => (
                <Avatar key={person.id} size="sm" name={person.full_name} src={person.avatar_url} />
              ))}
            </AvatarGroup>
            <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-400">{summarize(names, total)}</p>
            <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={() => setIsOpen(true)}>
              See all
            </Button>
          </div>
        )}

        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
          <ModalHeader onClose={() => setIsOpen(false)}>
            <ModalTitle>
              {heading} ({total})
            </ModalTitle>
          </ModalHeader>
          <ModalContent className="-mx-2">
            <ul className="space-y-1">
              {people.map((person) => (
                <li key={person.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                  <Avatar size="sm" name={person.full_name} src={person.avatar_url} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">
                    {person.full_name}
                  </span>
                  {person.isMe && <Badge variant="success">You</Badge>}
                </li>
              ))}
            </ul>
          </ModalContent>
        </Modal>
      </section>
    );
  }
);

AttendeesSection.displayName = 'AttendeesSection';
