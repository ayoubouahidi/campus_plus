'use client';

import { useState } from 'react';
import type { Club } from '@/types/api';
import { CampusToggle } from '@/components/filters/CampusToggle';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { NAV_ICONS } from '@/components/ui/layout/navIcons';
import { filterClubsByCampus, formatClubCount } from '@/lib/clubs';
import type { CampusFilter } from '@/lib/events';
import { ClubCard } from './ClubCard';

export interface ClubDirectoryProps {
  clubs: Club[]; // already sorted (sortClubsByName on the server)
  upcomingCounts: Record<string, number>; // getUpcomingEventCounts (server, request time)
}

const ClubsIcon = NAV_ICONS.clubs;

// The interactive part of /clubs: heading + live count, campus filter, club grid or empty state.
export const ClubDirectory = ({ clubs, upcomingCounts }: ClubDirectoryProps) => {
  const [campus, setCampus] = useState<CampusFilter>('all');
  const visible = filterClubsByCampus(clubs, campus);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Clubs</h1>
          {/* Polite live region, as on the feed: "1 club" is read after the filter changes. */}
          <p aria-live="polite" className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
            {formatClubCount(visible.length)}
          </p>
        </div>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Student clubs at 1337 and EMINES. Open one to see who runs it and what&apos;s coming up.
        </p>
        <search aria-label="Filter clubs" className="block">
          <CampusToggle value={campus} onChange={setCampus} />
        </search>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ClubsIcon className="h-6 w-6" />}
          title="No clubs on this campus yet"
          description="Clubs open to every school are listed under All."
          action={
            <Button variant="secondary" onClick={() => setCampus('all')}>
              Show all clubs
            </Button>
          }
        />
      ) : (
        // grid-cols-1 caps the phone column at the screen width (same fix as the event grid, §5.7).
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((club) => (
            <li key={club.id}>
              <ClubCard club={club} upcomingCount={upcomingCounts[club.id] ?? 0} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
