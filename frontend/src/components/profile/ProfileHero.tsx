import React from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/Avatar';
import type { User, UserRole } from '@/types/api';
import { PROFILE_PANEL, profileChip, type ProfileChipTone } from './profileStyles';

export interface ProfileHeroProps extends React.HTMLAttributes<HTMLElement> {
  user: User;
  login: string | null; // 42 login → "@mnajjar"
  campus: string | null; // 42 campus → chip
  memberSince?: string | null; // "September 2024" once Django sends it (/api/me/); hidden when null
}

const ROLE_TONES: Record<UserRole, ProfileChipTone> = { STUDENT: 'violet', BOARD_MEMBER: 'emerald', SUPERADMIN: 'neutral' };

// Disabled "· Soon" buttons from the design: visible so students know what's coming, not focusable as actions.
const SOON_BUTTON =
  'inline-flex h-11 cursor-not-allowed items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-slate-100 px-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400';

// Figma "ProfileHero": violet gradient banner, 104px avatar overlapping it, name (the page h1), @login + role +
// campus chips, email, member since; "Edit profile / Change photo · Soon" on the right (under, on phones).
// Server Component. Arabic: everything mirrors with logical classes (ps-/pe-/start-), the avatar included, and
// the banner gradient runs the other way (rtl:bg-gradient-to-l). Role labels: Profile.roles.<UserRole>.
export const ProfileHero = React.forwardRef<HTMLElement, ProfileHeroProps>(
  ({ user, login, campus, memberSince = null, className = '', ...props }, ref) => {
    const t = useTranslations('Profile');
    return (
      <header ref={ref} className={`relative overflow-hidden ${PROFILE_PANEL} ${className}`} {...props}>
        {/* Banner: decorative brand line (desktop) / school name (phone) */}
        <div className="flex h-[104px] items-start justify-end bg-gradient-to-r rtl:bg-gradient-to-l from-violet-100 via-violet-50 via-60% to-indigo-100 px-4 pt-4 sm:items-center sm:px-8 sm:pt-0 dark:from-violet-950/80 dark:via-violet-950/40 dark:to-indigo-950/70">
          <p className="text-xs font-semibold text-violet-700 sm:hidden dark:text-violet-300">1337 Coding School</p>
          <div className="hidden sm:block">
            <p className="text-[11px] font-semibold leading-[17px] tracking-wide text-violet-700 uppercase dark:text-violet-300">
              Campus Hub
            </p>
            <p className="text-lg font-medium leading-[27px] text-violet-900 dark:text-violet-100">{t('tagline')}</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-5 pb-6 sm:flex-row sm:items-start sm:py-6 sm:pe-8 sm:ps-40">
          {/* Avatar: overlaps the banner. Phone: in the flow, pulled up; from sm: absolute on the start side. */}
          <Avatar
            src={user.avatar_url}
            name={user.full_name}
            size="2xl"
            aria-hidden="true"
            className="-mt-[52px] rounded-full ring-[5px] ring-white sm:absolute sm:top-[63px] sm:start-[31px] sm:mt-0 dark:ring-slate-900"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-[30px] sm:leading-[45px] dark:text-slate-100">
              {user.full_name}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              {/* dir="ltr": in Arabic the bidi algorithm would otherwise move the "@" to the end ("mnajjar@"). */}
              {login && (
                <span dir="ltr" className="font-mono text-[13px] text-slate-600 dark:text-slate-400">
                  @{login}
                </span>
              )}
              <span className={profileChip(ROLE_TONES[user.role])}>{t(`roles.${user.role}`)}</span>
              {campus && <span className={profileChip('neutral')}>{campus}</span>}
            </div>
            {user.email && <p className="truncate text-sm text-slate-600 dark:text-slate-400">{user.email}</p>}
            {memberSince && <p className="text-xs text-slate-500 dark:text-slate-500">{t('memberSince', { date: memberSince })}</p>}
          </div>

          <div className="flex gap-2 sm:flex-col">
            <button type="button" disabled className={SOON_BUTTON}>
              <span className="sm:hidden">{t('editSoon')}</span>
              <span className="hidden sm:inline">{t('editProfileSoon')}</span>
            </button>
            <button type="button" disabled className={SOON_BUTTON}>
              {t('changePhotoSoon')}
            </button>
          </div>
        </div>
      </header>
    );
  }
);

ProfileHero.displayName = 'ProfileHero';
