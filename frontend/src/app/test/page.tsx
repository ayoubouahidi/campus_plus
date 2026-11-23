import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { DEV_LOGIN_ENABLED, getSessionState, signOut } from '@/auth';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { LOCALE_INFO } from '@/i18n/config';
import { hasBackend } from '@/lib/api/client';
import { listClubs, listEvents } from '@/lib/data';
import { RealtimeMonitor } from './RealtimeMonitor';
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
  const [liveEvents, liveClubs] = await Promise.all([listEvents(), listClubs()]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="sr-only">Test page</h1>
      <section
        aria-label="Test controls"
        className="rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-950 dark:text-amber-200"
      >
        <p className="font-semibold">Test page: Steps 18.1–18.2, advanced search (/search, opened from the navbar search)</p>
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
          <h3 className="font-semibold">Data source right now</h3>
          <p className="mt-1">
            {hasBackend() ? (
              <>Django at <code>{process.env.BACKEND_URL}</code>: {liveEvents.length} events and {liveClubs.length} clubs read through lib/data.ts.</>
            ) : (
              <>Mocks (no <code>BACKEND_URL</code>): {liveEvents.length} events and {liveClubs.length} clubs from lib/mockData.ts, the dev fallback.</>
            )}
          </p>
        </div>

        <div>
          <h3 className="font-semibold">What to check (Steps 18.1–18.2): the navbar search and <Link href="/search" className="underline underline-offset-2">/search</Link></h3>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-slate-600 dark:text-slate-300">
            <li>Step 18.2, one search box: open the navbar search (⌘K / Ctrl K), type &quot;jam&quot;. Under the results: &quot;See all results for “jam”&quot;. Arrow down to it (or click) → /search?q=jam&amp;when=all, the words already in the field.</li>
            <li>Type &quot;zzzz&quot; (no match) and press Enter: it opens /search directly (the only option). With no words, the option isn&apos;t there.</li>
            <li>The screen reader count (&quot;2 results&quot;) doesn&apos;t count &quot;See all&quot;. In French / Arabic the option is translated.</li>
            <li>Live: with /search open, run <code>! docker compose exec -T frontend node /tmp/live_demo.js 5</code>: &quot;Live Demo Night&quot; appears in the results and disappears at the end, without reloading.</li>
            <li>Local data: 24 extra &quot;Search Demo&quot; events were added to Django (LEET Dev), so there are 3 pages of upcoming events.</li>
            <li>Filters: type &quot;demo&quot; (results update after a short pause, the URL changes, page goes back to 1); pick a category, &quot;Past&quot; / &quot;Any time&quot;, a club. Each choice applies at once.</li>
            <li>Sorting: Best match (needs words; without words the hint says &quot;sorted by date&quot;), Soonest first, Latest first, Most popular (most RSVPs first).</li>
            <li>Pagination: 12 per page, Previous / numbers / Next, the current page highlighted; the filters stay in every page link. Try <Link href="/search?q=demo&amp;sort=latest&amp;page=2" className="underline underline-offset-2">/search?q=demo&amp;sort=latest&amp;page=2</Link>.</li>
            <li>Links and history: copy a results URL into a new tab (same results); Back / Forward walk through your choices; <Link href="/search?page=99&amp;sort=bogus&amp;category=Foo" className="underline underline-offset-2">a broken URL</Link> falls back to sensible defaults.</li>
            <li>&quot;Clear all&quot; appears once something is chosen and returns to plain /search. No results: the empty message with &quot;Clear all&quot;.</li>
            <li>Words: &quot;leet&quot; also shows &quot;Matching clubs&quot; above the events (page 1 only); &quot;musique&quot; in French or &quot;رياضة&quot; in Arabic matches the category; accents don&apos;t matter.</li>
            <li>RSVP on a result card works as on the feed. Signed out: counts only, no names.</li>
            <li>Keyboard and screen reader: Tab through the form and pages; the result count is announced after each change; the current page is announced as current. Arabic: arrows of Previous / Next point the right way.</li>
            <li>Without JavaScript (optional): the Search button still submits the form and the server answers.</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Live connection</h3>
          <div className="mt-2">
            <RealtimeMonitor />
          </div>
        </div>
      </section>
    </div>
  );
}
