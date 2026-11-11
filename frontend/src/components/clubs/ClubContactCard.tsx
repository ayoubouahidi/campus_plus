'use client';

import React from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { IconBase, type NavIconProps } from '@/components/ui/layout/navIcons';
import { useSession } from '@/components/providers/SessionProvider';
import { formatPhone, type ClubContact } from '@/lib/clubs';
import type { SessionStatus } from '@/types/session';

/* --------------------------------- Types ---------------------------------- */

export interface ClubContactCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  // null when the server didn't send the details (signed-out visitor). The card then shows the locked state
  // even if the session flips on the client: the data simply isn't there.
  contact: ClubContact | null;
  clubSlug: string; // for the login link's ?next=
}

type ContactState = 'loading' | 'locked' | 'visible';

// Loading wins (no flash), then both conditions are needed to show anything: a signed-in session AND data.
const getContactState = (status: SessionStatus, contact: ClubContact | null): ContactState => {
  if (status === 'loading') return 'loading';
  return status === 'signed-in' && contact ? 'visible' : 'locked';
};

/* ---------------------------------- Icons ---------------------------------- */

const MailIcon = (props: NavIconProps) => (
  <IconBase {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </IconBase>
);

const PhoneIcon = (props: NavIconProps) => (
  <IconBase {...props}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </IconBase>
);

const LockIcon = (props: NavIconProps) => (
  <IconBase {...props}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </IconBase>
);

const contactLinkStyles =
  'flex items-center gap-2 rounded-md text-sm text-violet-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-violet-400';

// Mirrors Button's primary/sm styles: "Log in" navigates, so it is a link.
const loginLinkStyles =
  'inline-flex items-center justify-center rounded-md bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40';

/* ----------------------------- ClubContactCard ----------------------------- */

// The president's contact, for signed-in students only. Signed out (or not sent by the server): a locked
// card with a login link that comes back here. While the session loads: a skeleton, so the details never
// flash in and out.
export const ClubContactCard = React.forwardRef<HTMLElement, ClubContactCardProps>(
  ({ contact, clubSlug, className = '', ...props }, ref) => {
    const { session } = useSession();
    const state = getContactState(session.status, contact);

    const body: Record<ContactState, React.ReactNode> = {
      loading: (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ),
      locked: (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
            <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            Contact details are only shown to signed-in students.
          </p>
          <Link href={`/auth/login?next=/clubs/${clubSlug}`} className={loginLinkStyles}>
            Log in to see them
          </Link>
        </div>
      ),
      visible: contact && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar name={contact.president_name} size="md" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {contact.president_name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">President</p>
            </div>
          </div>
          <ul className="space-y-2">
            <li>
              <a href={`mailto:${contact.president_email}`} className={contactLinkStyles}>
                <MailIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{contact.president_email}</span>
              </a>
            </li>
            <li>
              {/* dir="ltr": a phone number stays left-to-right in Arabic pages (Phase 7). */}
              <a href={`tel:${contact.president_phone}`} className={contactLinkStyles}>
                <PhoneIcon className="h-4 w-4 shrink-0" />
                <span dir="ltr">{formatPhone(contact.president_phone)}</span>
              </a>
            </li>
          </ul>
        </div>
      ),
    };

    return (
      <section
        ref={ref}
        aria-labelledby="club-contact"
        aria-busy={state === 'loading'}
        className={`space-y-3 rounded-xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 ${className}`}
        {...props}
      >
        <h2 id="club-contact" className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Contact
        </h2>
        {body[state]}
      </section>
    );
  }
);

ClubContactCard.displayName = 'ClubContactCard';
