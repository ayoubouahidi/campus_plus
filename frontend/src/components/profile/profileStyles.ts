// Small tinted chips used across the profile (Figma "Badge · Student / Attended"). The campus chip and the
// "Coming soon" clubs stat were removed (DOCS.md §21.1).
// Not the Badge primitive: its status/category colours don't include the violet "role" tint from the design.
export type ProfileChipTone = 'violet' | 'neutral' | 'emerald';

export const PROFILE_CHIP_BASE =
  'inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium leading-[18px]';

export const PROFILE_CHIP_TONES: Record<ProfileChipTone, string> = {
  violet:
    'border-violet-400/30 bg-violet-50 text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-300',
  neutral:
    'border-slate-200/30 bg-slate-50 text-slate-600 dark:border-slate-700/60 dark:bg-slate-950 dark:text-slate-300',
  emerald:
    'border-emerald-400/30 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-300',
};

export const profileChip = (tone: ProfileChipTone) => `${PROFILE_CHIP_BASE} ${PROFILE_CHIP_TONES[tone]}`;

// Big rounded panels (hero, stats, lists): 16px radius, hairline border, the design's very soft shadow.
export const PROFILE_PANEL =
  'rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_0_rgba(15,23,41,0.04)] dark:border-slate-800 dark:bg-slate-900';
