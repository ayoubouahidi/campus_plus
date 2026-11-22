import React from 'react';
import { useTranslations } from 'next-intl';
import type { Club } from '@/types/api';
import { EmptyState } from '@/components/ui/EmptyState';
import { NAV_ICONS } from '@/components/ui/layout/navIcons';
import { ClubCard } from './ClubCard';

export interface ClubDirectoryProps {
  clubs: Club[]; // already sorted (sortClubsByName on the server)
  upcomingCounts: Record<string, number>; // getUpcomingEventCounts (server, request time)
}

const ClubsIcon = NAV_ICONS.clubs;

// /clubs: heading + count, intro, club grid or empty state. No filter since Campus Hub serves 1337 only
// (DOCS.md §13: the All / 1337 / EMINES toggle was removed), so no state either: a Server Component that
// ships no JavaScript.
export const ClubDirectory = ({ clubs, upcomingCounts }: ClubDirectoryProps) => {
  const t = useTranslations('Clubs');

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('title')}</h1>
          <p className="shrink-0 text-sm text-slate-500 dark:text-slate-400">{t('count', { count: clubs.length })}</p>
        </div>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">{t('intro')}</p>
      </div>

      {clubs.length === 0 ? (
        <EmptyState icon={<ClubsIcon className="h-6 w-6" />} title={t('emptyTitle')} description={t('emptyBody')} />
      ) : (
        // grid-cols-1 caps the phone column at the screen width (same fix as the event grid, §5.7).
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <li key={club.id}>
              <ClubCard club={club} upcomingCount={upcomingCounts[club.id] ?? 0} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
