import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { DEV_LOGIN_ENABLED, getSessionState, signOut } from '@/auth';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { LOCALE_INFO } from '@/i18n/config';
import { SessionSwitcher } from './SessionSwitcher';
import { ToastDemo } from './ToastDemo';

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
        <p className="font-semibold">Test page: Step 12.2, the shell (navbar, phone menu, footer, search, notifications) in EN / FR / AR</p>
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

        <div className="flex items-center gap-3">
          <ToastDemo />
        </div>

        <div>
          <h3 className="font-semibold">What to check (Step 12.2: the shell is live on every page)</h3>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-slate-600 dark:text-slate-300">
            <li>Navbar (from 640px wide): the globe button sits next to search. Switch to Français, then العربية: links, search button, Log in / avatar label change; in Arabic the logo is on the right and the actions on the left.</li>
            <li>Phone width (below 640px): no globe in the navbar; open the menu (burger): the switcher is in the drawer, under the account. In Arabic the drawer is on the right and slides in from the right; the close button is at its far side.</li>
            <li>Phone tab bar: Découvrir / Calendrier / Clubs / Se connecter, and the Arabic names; the order mirrors in Arabic.</li>
            <li>Footer: description, Explore / Campuses columns, Privacy / Terms, copyright line, all translated; campus names (1337, EMINES, UM6P) stay as they are. Columns mirror in Arabic.</li>
            <li>Search (⌘K / Ctrl+K): title, placeholder, &quot;Coming up&quot;, &quot;Events&quot; / &quot;Clubs&quot; groups, category under each event (Tech → Tech / تقنية…), &quot;No events or clubs match…&quot;. Event titles and club names stay as written (data).</li>
            <li>Notifications (signed in: use the session switcher above): bell label with the unread count, panel title, &quot;N unread&quot; (Arabic plural forms), &quot;Mark all as read&quot;, relative times (&quot;il y a 2 heures&quot;, &quot;قبل ساعتين&quot;); the panel opens toward the inside of the screen in Arabic and the red badge sits on the bell&apos;s outer corner.</li>
            <li>Toast (button above): bottom right in English/French, bottom left in Arabic; screen reader reads the close button as &quot;Fermer la notification&quot; / &quot;إغلاق الإشعار&quot;.</li>
            <li>Keyboard: Tab from the top of the page: the first stop is &quot;Skip to content&quot; in the current language, at the top left (top right in Arabic).</li>
            <li>Screen reader: landmarks are named in the current language (&quot;Principale&quot;, &quot;Pied de page&quot;, &quot;Mentions légales&quot;…).</li>
            <li>Not yet translated (next steps): the page contents (feed, calendar, clubs, events, login, profile, legal pages).</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
