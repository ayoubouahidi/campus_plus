'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import type { EventItem } from '@/types/api';
import type { SessionStatus } from '@/types/session';
import { Button } from '@/components/ui/Button';
import { CheckIcon } from '@/components/ui/layout/navIcons';
import { useSession } from '@/components/providers/SessionProvider';

/* --------------------------------- Types ---------------------------------- */

export interface RsvpCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  // Current RSVP state. Controlled: the page owns it, so the attendee list (Step 4.9) stays in sync.
  event: EventItem;
  // Decided on the server (request time vs end_time), so it can't flip during hydration.
  hasEnded: boolean;
  // Receives the event as it was before the click.
  onRsvpToggle: (event: EventItem) => void;
}

/* ---------------------------------- State --------------------------------- */

// Everything the card can show, resolved once, then looked up in tables (no nested ternaries in JSX).
type RsvpState = 'ended' | 'loading' | 'signedOut' | 'going' | 'notGoing';

const getRsvpState = (event: EventItem, hasEnded: boolean, session: SessionStatus): RsvpState => {
  if (hasEnded) return 'ended';
  if (session === 'loading') return 'loading';
  if (session === 'signed-out') return 'signedOut';
  return event.has_user_rsvpd ? 'going' : 'notGoing';
};

// The status line above the count; null = no status line.
const STATUS: Record<RsvpState, { text: string; tone: string } | null> = {
  ended: { text: 'This event has ended', tone: 'text-slate-700 dark:text-slate-300' },
  loading: null,
  signedOut: null,
  going: { text: "You're going", tone: 'text-emerald-700 dark:text-emerald-400' },
  notGoing: null,
};

const describeCount = (count: number, state: RsvpState): string => {
  if (state === 'ended') return count === 0 ? 'Nobody RSVP’d' : `${count} went`;
  return count === 0 ? 'Be the first to RSVP' : `${count} going`;
};

// Mirrors Button's primary/md styles: "Log in to RSVP" navigates, so it is a link, not a button.
const LOGIN_LINK_STYLES =
  'inline-flex items-center justify-center rounded-lg border-transparent bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40';

/* --------------------------------- RsvpCard -------------------------------- */

// One element, two layouts: below lg a bar fixed above the phone tab bar (always reachable while reading);
// from lg a card that sticks beside the content. A single DOM node means a single RSVP button for
// screen readers and one tab stop, whatever the screen size.
export const RsvpCard = React.forwardRef<HTMLElement, RsvpCardProps>(
  ({ event, hasEnded, onRsvpToggle, className = '', ...props }, ref) => {
    const headingId = useId();
    const { session } = useSession();
    const state = getRsvpState(event, hasEnded, session.status);
    const status = STATUS[state];

    const actions: Record<RsvpState, React.ReactNode> = {
      ended: null,
      loading: (
        <Button isLoading disabled>
          RSVP
        </Button>
      ),
      signedOut: (
        <Link href={`/auth/login?next=/events/${event.id}`} className={LOGIN_LINK_STYLES}>
          Log in to RSVP
        </Link>
      ),
      going: (
        <Button variant="secondary" onClick={() => onRsvpToggle(event)}>
          Cancel RSVP
        </Button>
      ),
      notGoing: <Button onClick={() => onRsvpToggle(event)}>RSVP</Button>,
    };

    return (
      <>
        {/* Below lg: reserves the bar's height at the end of the content so it never hides the last lines. */}
        <div aria-hidden="true" className="h-20 lg:hidden" />

        <aside
          ref={ref}
          aria-labelledby={headingId}
          className={`fixed inset-x-0 bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] z-30 border-t border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-md md:bottom-0 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:sticky lg:top-20 lg:bottom-auto lg:rounded-xl lg:border lg:bg-white lg:p-5 lg:backdrop-blur-none dark:border-slate-800 dark:bg-slate-950/95 lg:dark:bg-slate-900 ${className}`}
          {...props}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 lg:flex-col lg:items-stretch">
            <div className="min-w-0 space-y-0.5">
              <h2
                id={headingId}
                className="sr-only lg:not-sr-only lg:mb-2 lg:text-base lg:font-semibold lg:text-slate-900 lg:dark:text-slate-100"
              >
                RSVP
              </h2>
              {status && (
                <p className={`flex items-center gap-1.5 text-sm font-semibold ${status.tone}`}>
                  {state === 'going' && <CheckIcon className="h-4 w-4" />}
                  {status.text}
                </p>
              )}
              <p className="text-sm text-slate-500 dark:text-slate-400">{describeCount(event.rsvps_count, state)}</p>
            </div>

            {actions[state] && <div className="shrink-0 lg:[&>*]:w-full">{actions[state]}</div>}
          </div>
        </aside>
      </>
    );
  }
);

RsvpCard.displayName = 'RsvpCard';
