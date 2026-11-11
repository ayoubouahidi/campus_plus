import React from 'react';
import type { Club } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { CardBanner } from '@/components/ui/Card';
import type { ClubContact } from '@/lib/clubs';
import { ClubContactCard } from './ClubContactCard';

/* --------------------------------- Types ---------------------------------- */

export interface ClubHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  club: Club;
  // "Since January 2026", formatted on the server (formatClubSince): campus time zone.
  since: string;
  // getClubContact(club) for signed-in students, null for visitors (the details never reach their browser).
  contact: ClubContact | null;
}

// Full content width: phones 100vw, desktop capped by max-w-7xl.
const BANNER_SIZES = '(min-width: 1280px) 1216px, 100vw';

/* -------------------------------- ClubHeader ------------------------------- */

// Top of /clubs/[slug]: banner, logo, name, campus and "since", then About + the contact card.
// Server Component; only the contact card is client code (it reads the session).
export const ClubHeader = React.forwardRef<HTMLElement, ClubHeaderProps>(
  ({ club, since, contact, className = '', ...props }, ref) => (
    <header ref={ref} className={`space-y-6 ${className}`} {...props}>
      <div>
        <CardBanner
          src={club.banner_url ?? undefined}
          sizes={BANNER_SIZES}
          aspectRatio="wide"
          loading="eager" // first thing on screen (LCP)
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800"
          fallback={
            <div className="h-full w-full bg-gradient-to-br from-violet-200 via-violet-100 to-white dark:from-violet-500/25 dark:via-violet-500/10 dark:to-slate-900" />
          }
        />

        {/* Logo overlaps the banner's bottom edge; name and meta sit beside it from sm, below on phones. */}
        <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-end sm:gap-5 sm:px-6">
          <Avatar
            name={club.name}
            src={club.logo_url || null}
            size="xl"
            aria-hidden="true"
            className="-mt-8 self-start rounded-full ring-4 ring-slate-50 sm:-mt-10 dark:ring-slate-950"
          />
          <div className="min-w-0 sm:pb-1">
            <h1 className="text-2xl font-bold tracking-tight text-balance text-slate-900 sm:text-3xl dark:text-slate-100">
              {club.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {club.department_name} · {since}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="club-about" className="space-y-2">
          <h2 id="club-about" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            About
          </h2>
          <p className="text-base leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-300">
            {club.description}
          </p>
        </section>

        <ClubContactCard contact={contact} clubSlug={club.slug} />
      </div>
    </header>
  )
);

ClubHeader.displayName = 'ClubHeader';
