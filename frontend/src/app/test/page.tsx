import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { DEV_LOGIN_ENABLED, getSessionState, signOut } from '@/auth';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { LOCALE_INFO } from '@/i18n/config';
import { SessionSwitcher } from './SessionSwitcher';

// TEST PAGE (/test): where each new step is checked before it goes into the real pages.
// Workflow: build the step here → the user validates it in the browser → move it into the real route
// (e.g. src/app/page.tsx) → reset this page for the next step. Dev only: it is a 404 in production.
// Optional scenarios: read `searchParams` (a Promise in Next.js 16) and switch on ?scenario=<key>
// (see git history, e.g. Steps 4.5, 4.9, 4.13, 4.15 and 5.4, for examples).
// Reusable test tools: ./SessionSwitcher.tsx (switches the UI session; "Real" = the Auth.js session) and the
// real-session box below (log in / sign out).

export const metadata: Metadata = {
  title: 'Test page',
  robots: { index: false, follow: false },
};

async function testSignOut() {
  'use server';
  await signOut({ redirectTo: '/test' });
}

export default async function TestPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const session = await getSessionState();
  const locale = await getLocale();
  const t = await getTranslations('Events');
  const format = await getFormatter();
  const sampleDate = new Date('2026-11-13T17:00:00Z'); // hackathon opening, a fixed date (no hydration drift)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="sr-only">Test page</h1>
      <section
        aria-label="Test controls"
        className="rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-950 dark:text-amber-200"
      >
        <p className="font-semibold">Test page: Step 12.4, the calendar in EN / FR / AR</p>
        <p className="mt-2">
          Live since Phase 5:{' '}
          <Link href="/auth/login" className="font-medium underline underline-offset-2">/auth/login</Link> (42,
          Dev login {DEV_LOGIN_ENABLED ? 'on' : 'off'}),{' '}
          <Link href="/profile" className="font-medium underline underline-offset-2">/profile</Link> (alias /me,
          signed-in only).
        </p>
        <p className="mt-2">
          Real session:{' '}
          {session.status === 'signed-in' ? `signed in as ${session.user.full_name} (${session.user.role})` : 'signed out'}
        </p>
        {session.status === 'signed-in' ? (
          <form action={testSignOut} className="mt-2">
            <button type="submit" className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-300">
              Sign out
            </button>
          </form>
        ) : (
          <Link
            href="/auth/login?next=/test"
            className="mt-2 inline-flex rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-300"
          >
            Log in
          </Link>
        )}
        <SessionSwitcher />
      </section>

      <section aria-labelledby="i18n-test" className="mt-6 space-y-6 rounded-xl border border-slate-200/80 bg-white p-4 text-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="i18n-test" className="text-base font-semibold">
            Language switcher
          </h2>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <LanguageSwitcher variant="full" />
          </div>
        </div>

        <dl className="grid gap-2 sm:grid-cols-3">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">&lt;html lang&gt;</dt>
            <dd className="font-mono">{locale}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">&lt;html dir&gt;</dt>
            <dd className="font-mono">{LOCALE_INFO[locale].dir}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Date (Intl, campus time)</dt>
            <dd>{format.dateTime(sampleDate, { dateStyle: 'full', timeStyle: 'short' })}</dd>
          </div>
        </dl>

        <div>
          <h3 className="font-semibold">Plural forms (Arabic has six)</h3>
          <ul className="mt-2 grid gap-1 sm:grid-cols-3">
            {[0, 1, 2, 3, 11, 100].map((count) => (
              <li key={count} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <span className="font-mono text-slate-500">{count} → </span>
                {t('count', { count })}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Mirroring (logical classes)</h3>
          <div className="mt-2 flex items-center gap-3 rounded-lg border-s-4 border-violet-500 bg-slate-50 p-3 text-start dark:bg-slate-800">
            <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span>
            <span>Accent bar on the start side, arrow pointing forward, text aligned to the start.</span>
            <span className="ms-auto rounded bg-violet-100 px-2 py-0.5 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">end</span>
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Pages to open (Step 12.4 is live on /calendar)</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            <li>
              <Link href="/calendar?date=2026-11-14" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Month (November 2026)
              </Link>
            </li>
            <li>
              <Link href="/calendar?date=2026-11-14&view=week" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Week with the 3-day hackathon
              </Link>
            </li>
            <li>
              <Link href="/calendar?date=2026-12-01&view=week" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Week across two months
              </Link>
            </li>
            <li>
              <Link href="/calendar?date=2026-12-29&view=week" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Week across two years
              </Link>
            </li>
            <li>
              <Link href="/calendar" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Today
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">What to check (Step 12.4), in Français then العربية</h3>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-slate-600 dark:text-slate-300">
            <li>Header: title &quot;novembre 2026&quot; / &quot;نونبر 2026&quot; (Moroccan month names), &quot;Aujourd’hui&quot;, Mois / Semaine tabs; the arrows&apos; names (hover or screen reader): &quot;Mois précédent&quot;, &quot;Semaine suivante&quot;…</li>
            <li>Week titles: &quot;9 – 15 nov. 2026&quot;, across months &quot;30 nov. – 6 déc. 2026&quot;, across years &quot;28 déc. 2026 – 3 janv. 2027&quot;; Arabic &quot;9 – 15 نونبر 2026&quot;.</li>
            <li>Weekday headers start on Monday: lun. mar. mer.… In Arabic, full names from 640px wide (الاثنين…) and one letter on phones (ن ث ر خ ج س ح); hover shows the full name.</li>
            <li>Agenda: day heading &quot;samedi 14 novembre&quot; / &quot;السبت، 14 نونبر&quot;, the count, the hackathon&apos;s times per day: &quot;Dès 8:00&quot;, &quot;Toute la journée&quot;, &quot;Jusqu’à 17:00&quot; (24-hour in French and Arabic), category badge, &quot;J’y vais&quot; badge when signed in and going. An empty day: &quot;Rien ce jour-là&quot;.</li>
            <li>Week view (from 768px): each chip shows the translated time; more than 4 events on a day shows &quot;+N autres&quot;.</li>
            <li><strong>Click around</strong> (next/previous month and week, Today, other days, switch Month/Week): titles and labels stay in the chosen language. Open the browser console: <strong>no hydration warning</strong> after a reload in each language.</li>
            <li>Arabic layout: the grid reads right to left (Monday on the right), the cell separators sit between the days (no double line on the left edge), ← and → arrows point the right way, keyboard ← / → move one day in the reading direction.</li>
            <li>Screen reader: a day button reads &quot;jeudi 5 novembre, 1 événement&quot;; the grid is named after the month or week; the page heading is &quot;Calendrier&quot;.</li>
            <li>Still English (next steps): clubs pages, login, profile, legal pages, page titles in the browser tab.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
