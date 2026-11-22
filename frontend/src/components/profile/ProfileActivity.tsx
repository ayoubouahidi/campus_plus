'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { EventItem } from '@/types/api';
import { EventGrid } from '@/components/events/EventGrid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useRsvpToast } from '@/hooks/useRsvpToast';
import { toggleRsvp } from '@/lib/events';
import type { DateTile, EventSchedule } from '@/lib/time';
import { AttendedEventList } from './AttendedEventList';
import { StatCalendarIcon, StatCheckIcon, StatClubIcon } from './profileIcons';
import { PROFILE_PANEL, profileChip } from './profileStyles';

export interface ProfileActivityProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  // getMyEvents on the server: RSVP'd events split at the request time.
  upcoming: EventItem[];
  past: EventItem[];
  schedules: Record<string, EventSchedule>; // getEventSchedules (cards)
  dateTiles: Record<string, DateTile>; // getDateTiles (past rows)
}

const RECENT_LIMIT = 3;

/* ------------------------------- Stats ------------------------------- */

interface StatProps {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string; // desktop label
  shortLabel: string; // phone label
  extra?: React.ReactNode; // "Coming soon"
  extraShort?: string; // the same note on phones, under the label
}

// Desktop: icon tile + value + label in a row. Phone: centered value over a short label (Figma phone frame).
const Stat = ({ icon, value, label, shortLabel, extra, extraShort }: StatProps) => (
  <div className="flex flex-1 flex-col items-center gap-1 px-2 py-5 text-center sm:flex-row sm:gap-2 sm:px-6 sm:text-start">
    <span className="hidden size-11 shrink-0 items-center justify-center rounded-[10px] bg-violet-50 text-violet-600 sm:flex dark:bg-violet-500/10 dark:text-violet-400">
      {icon}
    </span>
    <div className="min-w-0">
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        <span className="text-2xl font-semibold leading-9 text-slate-900 dark:text-slate-100">{value}</span>
        {extra && <span className="hidden sm:inline-flex">{extra}</span>}
      </div>
      <p className="text-[13px] leading-5 text-slate-600 dark:text-slate-400">
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </p>
      {extraShort && <p className="text-[11px] text-slate-500 sm:hidden dark:text-slate-500">{extraShort}</p>}
    </div>
  </div>
);

/* ------------------------------- Empty ------------------------------- */

const DISCOVER_LINK =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white ring-4 ring-violet-500/20 transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-violet-500/50';

const GoingEmpty = () => {
  const t = useTranslations('Profile');
  const tEvent = useTranslations('EventPage');
  return (
    <div className={`flex flex-col items-center px-6 py-10 text-center ${PROFILE_PANEL}`}>
      <span className="flex size-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
        <StatCalendarIcon width={28} height={28} />
      </span>
      <p className="mt-5 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('goingEmptyTitle')}</p>
      <p className="mt-2 max-w-xs text-sm text-slate-600 dark:text-slate-400">{t('goingEmptyBody')}</p>
      <Link href="/" className={`mt-6 ${DISCOVER_LINK}`}>
        {/* inline-block: a transform has no effect on an inline span, so the arrow wouldn't flip in Arabic. */}
        <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
          →
        </span>
        {tEvent('discover')}
      </Link>
    </div>
  );
};

const PastEmpty = () => {
  const t = useTranslations('Profile');
  return (
    <div className={`p-5 ${PROFILE_PANEL}`}>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('pastEmptyTitle')}</p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t('pastEmptyBody')}</p>
    </div>
  );
};

/* ------------------------------ Activity ----------------------------- */

const TAB_TRIGGER =
  'h-11 flex-1 gap-2 px-4 font-semibold sm:flex-none aria-selected:border aria-selected:border-slate-200 aria-selected:text-violet-600 dark:aria-selected:border-slate-700 dark:aria-selected:text-violet-400';

const countChip = (isActive: boolean) =>
  `rounded-md px-2.5 py-0.5 text-xs font-medium ${
    isActive ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' : 'bg-slate-200/60 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
  }`;

// Figma "ProfileStats" + "Your events" (tabs Going / Went to) + "Recently attended". One client component so
// the stats and tab counts follow RSVP changes made on the cards. Cancelled cards stay until reload (undo on
// the spot); the counts use has_user_rsvpd.
export const ProfileActivity = React.forwardRef<HTMLDivElement, ProfileActivityProps>(
  ({ upcoming, past, schedules, dateTiles, className = '', ...props }, ref) => {
    const [events, setEvents] = useState(upcoming);
    // New list from the server (navigation, refresh after an action): start over from it, otherwise the old
    // cards would be paired with the new `schedules` map ("schedule is undefined"). React's documented
    // "reset state when a prop changes" pattern.
    const [sourceList, setSourceList] = useState(upcoming);
    if (sourceList !== upcoming) {
      setSourceList(upcoming);
      setEvents(upcoming);
    }
    const [tab, setTab] = useState('going');
    const announceRsvp = useRsvpToast();
    const t = useTranslations('Profile');

    const goingCount = events.filter((event) => event.has_user_rsvpd).length;
    const recent = past.slice(0, RECENT_LIMIT);

    const handleRsvpToggle = (before: EventItem) => {
      setEvents((current) => current.map((item) => (item.id === before.id ? toggleRsvp(item) : item)));
      announceRsvp(before);
    };

    return (
      <div ref={ref} className={`space-y-6 ${className}`} {...props}>
        <section aria-label={t('stats')} className={`flex ${PROFILE_PANEL}`}>
          <Stat icon={<StatCalendarIcon />} value={goingCount} label={t('upcomingRsvps')} shortLabel={t('upcomingShort')} />
          <Stat icon={<StatCheckIcon />} value={past.length} label={t('attended')} shortLabel={t('attendedShort')} />
          <Stat
            icon={<StatClubIcon />}
            value={<span aria-label={t('notAvailable')}>—</span>}
            label={t('clubsFollowed')}
            shortLabel={t('clubsShort')}
            extra={<span className={profileChip('neutral')}>{t('comingSoon')}</span>}
            extraShort={t('comingSoon')}
          />
        </section>

        <section aria-labelledby="profile-events" className="pt-2">
          <Tabs value={tab} onValueChange={setTab} className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="min-w-0 flex-1">
                <h2 id="profile-events" className="text-xl font-semibold leading-[30px] text-slate-900 dark:text-slate-100">
                  {t('yourEvents')}
                </h2>
                <p className="hidden text-sm text-slate-600 sm:block dark:text-slate-400">{t('eventsTagline')}</p>
              </div>
              <TabsList aria-label={t('yourEvents')} className="w-full gap-1 sm:w-auto">
                <TabsTrigger value="going" className={TAB_TRIGGER}>
                  {t('going')} <span className={countChip(tab === 'going')}>{goingCount}</span>
                </TabsTrigger>
                <TabsTrigger value="went" className={TAB_TRIGGER}>
                  {t('wentTo')} <span className={countChip(tab === 'went')}>{past.length}</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="going">
              <EventGrid
                events={events}
                schedules={schedules}
                onRsvpToggle={handleRsvpToggle}
                cardHeadingLevel="h3"
                eagerFirstRow={false}
                emptyState={<GoingEmpty />}
              />
            </TabsContent>
            <TabsContent value="went">
              {past.length > 0 ? <AttendedEventList events={past} dateTiles={dateTiles} /> : <PastEmpty />}
            </TabsContent>
          </Tabs>
        </section>

        <section aria-labelledby="profile-recent" className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-4">
            <h2 id="profile-recent" className="text-lg font-semibold leading-[27px] text-slate-900 dark:text-slate-100">
              {t('recent')}
            </h2>
            {past.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="sm:hidden">{t('recentShort', { shown: recent.length, total: past.length })}</span>
                <span className="hidden sm:inline">{t('recentLong', { shown: recent.length, total: past.length })}</span>
              </p>
            )}
          </div>
          {recent.length > 0 ? <AttendedEventList events={recent} dateTiles={dateTiles} /> : <PastEmpty />}
        </section>
      </div>
    );
  }
);

ProfileActivity.displayName = 'ProfileActivity';
