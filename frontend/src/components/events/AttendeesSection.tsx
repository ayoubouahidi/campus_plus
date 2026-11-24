'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { AttendeePreview, EventItem } from '@/types/api';
import type { SessionStatus } from '@/types/session';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { LockIcon } from '@/components/ui/layout/navIcons';
import { useSession } from '@/components/providers/SessionProvider';
import { loginHref } from '@/lib/login';
import { intlLocale } from '@/i18n/config';

/* --------------------------------- Types ---------------------------------- */

export interface AttendeesSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  // Current RSVP state (controlled, shared with RsvpCard): the user appears here as soon as they RSVP.
  event: EventItem;
  // Everyone else who is going (getMockAttendees today, the API in Phase 7). Never includes the user.
  // Empty for signed-out visitors: the server page doesn't send names to them (DOCS.md §9.3).
  attendees: AttendeePreview[];
  hasEnded: boolean;
}

const MAX_AVATARS = 6;

/* --------------------------------- Helpers -------------------------------- */

// "You", "You and Salma Idrissi", "Salma Idrissi, Youssef Benali, and 40 others" ("… et 40 autres",
// "… و40 شخصًا آخر"). Written out so the avatar stack can be aria-hidden: this sentence is what screen readers
// hear. Intl.ListFormat joins the parts with each language's commas and "and"; the counts come from the
// Attendees messages (plural rules per language).
type AttendeesT = ReturnType<typeof useTranslations<'Attendees'>>;

const summarize = (names: string[], total: number, t: AttendeesT, locale: string): string => {
  if (names.length === 0) return t('people', { count: total });
  const rest = total - names.length;
  const parts = rest > 0 ? [...names, t('others', { count: rest })] : names;
  return new Intl.ListFormat(intlLocale(locale), { type: 'conjunction' }).format(parts);
};

const HEADINGS = { upcoming: 'headingUpcoming', ended: 'headingEnded' } as const;

// Names are for signed-in students only (Privacy Policy, DOCS.md §9.3). 'empty' wins: with nobody going there
// is nothing to hide. 'loading' shows a skeleton so names never flash in and out.
type AttendeesState = 'empty' | 'loading' | 'locked' | 'visible';

const getAttendeesState = (total: number, status: SessionStatus): AttendeesState => {
  if (total === 0) return 'empty';
  if (status === 'loading') return 'loading';
  return status === 'signed-in' ? 'visible' : 'locked';
};

const loginLinkStyles =
  'rounded text-sm font-medium text-violet-700 underline underline-offset-2 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-400 dark:hover:text-violet-300';

/* ---------------------------- AttendeesSection ---------------------------- */

export const AttendeesSection = React.forwardRef<HTMLElement, AttendeesSectionProps>(
  ({ event, attendees, hasEnded, className = '', ...props }, ref) => {
    const headingId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const { session } = useSession();
    const t = useTranslations('Attendees');
    const locale = useLocale();

    // "You" first when signed in and going; the session decides, so Phase 5 auth needs no change here.
    const me = session.status === 'signed-in' && event.has_user_rsvpd ? session.user : null;
    const people: (AttendeePreview & { isMe?: boolean })[] = me
      ? [{ id: me.id, full_name: me.full_name, avatar_url: me.avatar_url, isMe: true }, ...attendees]
      : attendees;
    const total = event.rsvps_count;
    const heading = t(HEADINGS[hasEnded ? 'ended' : 'upcoming']);
    const names = people.slice(0, 2).map((person) => (person.isMe ? t('you') : person.full_name));
    const state = getAttendeesState(total, session.status);

    const body: Record<AttendeesState, React.ReactNode> = {
      empty: (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t(hasEnded ? 'emptyEnded' : 'emptyUpcoming')}
        </p>
      ),
      loading: (
        <div className="flex items-center gap-4" aria-hidden="true">
          <div className="flex -space-x-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="circular" className="h-8 w-8 ring-2 ring-white dark:ring-slate-950" />
            ))}
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
      ),
      locked: (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
            <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            {t('locked')}
          </p>
          <Link href={loginHref(`/events/${event.id}`)} className={loginLinkStyles}>
            {t(hasEnded ? 'loginEnded' : 'loginUpcoming')}
          </Link>
        </div>
      ),
      visible: (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <AvatarGroup max={MAX_AVATARS} total={total} aria-hidden="true">
            {people.slice(0, MAX_AVATARS).map((person) => (
              <Avatar key={person.id} size="sm" name={person.full_name} src={person.avatar_url} />
            ))}
          </AvatarGroup>
          <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-400">{summarize(names, total, t, locale)}</p>
          <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={() => setIsOpen(true)}>
            {t('seeAll')}
          </Button>
        </div>
      ),
    };

    return (
      <section ref={ref} aria-labelledby={headingId} className={`space-y-3 ${className}`} {...props}>
        <h2 id={headingId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {heading} <span className="font-normal text-slate-500 dark:text-slate-400">({total})</span>
        </h2>

        {body[state]}

        {/* Only reachable from "See all", i.e. the visible state. */}
        <Modal isOpen={isOpen && state === 'visible'} onClose={() => setIsOpen(false)}>
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
                  {person.isMe && <Badge variant="success">{t('you')}</Badge>}
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
