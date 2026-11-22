import React from 'react';
import { useLocale } from 'next-intl';
import { LogoutForm } from '@/components/auth/LogoutForm';
import type { EventItem, User } from '@/types/api';
import { getDateTiles, getEventSchedules } from '@/lib/time';
import { ProfileActivity } from './ProfileActivity';
import { ProfileHero } from './ProfileHero';

export interface ProfileViewProps extends React.HTMLAttributes<HTMLDivElement> {
  user: User;
  login: string | null;
  campus: string | null;
  upcoming: EventItem[]; // getMyEvents(...).upcoming
  past: EventItem[]; // getMyEvents(...).past
  logoutAction: () => void | Promise<void>; // 'use server': signOut({ redirectTo })
}

// The whole /profile body (Figma "Profile page content"): "My profile" + Log out, hero, stats, your events,
// recently attended. Server Component: formats dates in campus time here (DOCS.md §5.2), then hands plain data
// to the interactive part. Used by app/profile/page.tsx and the /test bench, so both render the same thing.
export const ProfileView = React.forwardRef<HTMLDivElement, ProfileViewProps>(
  ({ user, login, campus, upcoming, past, logoutAction, className = '', ...props }, ref) => {
    const all = [...upcoming, ...past];
    const locale = useLocale(); // card dates in the active language (Step 12.3); the rest of /profile is 12.6

    return (
      <div ref={ref} className={`space-y-6 ${className}`} {...props}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-base font-medium text-slate-600 dark:text-slate-400">My profile</p>
          <LogoutForm action={logoutAction} />
        </div>

        <ProfileHero user={user} login={login} campus={campus} />

        <ProfileActivity upcoming={upcoming} past={past} schedules={getEventSchedules(all, locale)} dateTiles={getDateTiles(all)} />
      </div>
    );
  }
);

ProfileView.displayName = 'ProfileView';
