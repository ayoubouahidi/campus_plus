import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { DEV_LOGIN_ENABLED, getSessionState, signOut } from '@/auth';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { LOCALE_INFO } from '@/i18n/config';
import { hasBackend } from '@/lib/api/client';
import { toClub, toEventItem, toUser } from '@/lib/api/mappers';
import { listClubs, listEvents } from '@/lib/data';
import { SAMPLE_CLUB, SAMPLE_CLUB_NO_SLUG, SAMPLE_EVENT_EDGE, SAMPLE_EVENT_SIGNED_IN, SAMPLE_USER } from './apiSamples';
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
  const mapperCases = [
    { label: 'Event (signed-in request)', raw: SAMPLE_EVENT_SIGNED_IN, mapped: toEventItem(SAMPLE_EVENT_SIGNED_IN) },
    { label: 'Event (edge cases)', raw: SAMPLE_EVENT_EDGE, mapped: toEventItem(SAMPLE_EVENT_EDGE) },
    { label: 'Club', raw: SAMPLE_CLUB, mapped: toClub(SAMPLE_CLUB) },
    { label: 'Club without a slug', raw: SAMPLE_CLUB_NO_SLUG, mapped: toClub(SAMPLE_CLUB_NO_SLUG) },
    { label: 'User (/api/me/)', raw: SAMPLE_USER, mapped: toUser(SAMPLE_USER) },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="sr-only">Test page</h1>
      <section
        aria-label="Test controls"
        className="rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-950 dark:text-amber-200"
      >
        <p className="font-semibold">Test page: Step 14.3, RSVP saved in Django, Full and Cancelled events</p>
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
          <h3 className="font-semibold">Mappers on the API_SPEC.md examples (raw → mapped)</h3>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            {mapperCases.map(({ label, raw, mapped }) => (
              <details key={label} className="rounded-lg border border-slate-200/80 p-3 dark:border-slate-800">
                <summary className="cursor-pointer font-medium">{label}</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <pre dir="ltr" className="overflow-x-auto rounded bg-slate-50 p-2 text-xs dark:bg-slate-800">{JSON.stringify(raw, null, 2)}</pre>
                  <pre dir="ltr" className="overflow-x-auto rounded bg-violet-50 p-2 text-xs dark:bg-violet-500/10">{JSON.stringify(mapped, null, 2)}</pre>
                </div>
              </details>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">With the local Django (DOCS §14.2), log in as student@1337.ma</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            <li>
              <Link href="/events/1" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Hackathon (places left)
              </Link>
            </li>
            <li>
              <Link href="/events/2" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Jam session (no RSVP yet)
              </Link>
            </li>
            <li>
              <Link href="/events/5" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Pair Programming (full)
              </Link>
            </li>
            <li>
              <Link href="/events/4" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Basketball (cancelled)
              </Link>
            </li>
            <li>
              <Link href="/profile" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Profile
              </Link>
            </li>
            <li>
              <Link href="/" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Feed
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">What to check (Step 14.3)</h3>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-slate-600 dark:text-slate-300">
            <li>RSVP on the jam session: the button turns &quot;Going&quot; at once, the toast says &quot;You&apos;re going&quot;, the count is Django&apos;s. Reload: it stays (saved). Cancel: back to &quot;RSVP&quot;, reload: still cancelled.</li>
            <li>Same from the event page, a club page and /profile: one behaviour everywhere.</li>
            <li>Pair Programming Night (capacity 2, already 2): card shows a disabled &quot;Full&quot;; event page &quot;This event is full&quot;, &quot;No places left&quot;, no button.</li>
            <li>Hackathon: &quot;146 places left&quot; under the count, changes after RSVP / cancel.</li>
            <li>Basketball final (cancelled): red &quot;Cancelled&quot; badge on the card, the event page and in the calendar agenda; no RSVP button, no count, &quot;This event was cancelled&quot;.</li>
            <li>Failure: stop Django (<code>docker stop campusbe-web-1</code>), click RSVP: the button flips, then goes back, red toast &quot;Your RSVP wasn&apos;t saved&quot;. Start it again (<code>docker start campusbe-web-1</code>).</li>
            <li>Double-click fast on RSVP: only one request (the second click is ignored while the first runs).</li>
            <li>French and Arabic: Complet / مكتمل, Annulé / ملغاة, places left with plurals, the error toasts.</li>
            <li>Without Django (mocks): RSVP still works on screen as before, nothing is saved.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
