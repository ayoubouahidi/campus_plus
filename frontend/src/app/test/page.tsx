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
        <p className="font-semibold">Test page: Step 12.3, the feed, event cards, event page, RSVP and attendees in EN / FR / AR</p>
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
          <h3 className="font-semibold">Pages to open (Step 12.3 is live on them)</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            <li>
              <Link href="/" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Feed (/)
              </Link>
            </li>
            <li>
              <Link href="/events/evt_welcome_bbq" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Upcoming one-day event
              </Link>
            </li>
            <li>
              <Link href="/events/evt_hackathon_ai" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Ended multi-day event
              </Link>
            </li>
            <li>
              <Link href="/events/evt_basketball_final" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Event with attendees
              </Link>
            </li>
            <li>
              <Link href="/events/nope" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Unknown event (404)
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">What to check (Step 12.3), in Français then العربية</h3>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-slate-600 dark:text-slate-300">
            <li>Feed heading, result count (&quot;1 événement&quot;, &quot;فعالية واحدة&quot;; filter down to 0 for &quot;Aucun événement&quot;), campus toggle (&quot;Tous&quot; / &quot;الكل&quot;; 1337 and EMINES stay), category chips (&quot;Toutes&quot;, translated category names).</li>
            <li>Pick a campus + category with no events: the empty state and &quot;Effacer les filtres&quot; are translated; the button brings the grid back and focus lands on it.</li>
            <li>Event cards: category badge, date (&quot;ven. 27 nov.&quot;, &quot;الجمعة، 27 نونبر&quot;, Moroccan month names), &quot;N participants&quot;, and the RSVP slot: signed out &quot;Se connecter pour participer&quot;; signed in (session switcher above) &quot;Participer&quot; / &quot;J’y vais&quot;. The toast after a click is translated.</li>
            <li>Event page: back link (&quot;Tous les événements&quot;; from the calendar, &quot;Retour au calendrier&quot;), When / Where / Organizer, &quot;À propos&quot;, date with the year and the time range (16:00 – 18:00 in French, 24-hour).</li>
            <li>Ended multi-day event (hackathon): date range &quot;vendredi 13 – dimanche 15 novembre 2026&quot;, &quot;Début 8:00, fin 17:00&quot;, RSVP card &quot;Cet événement est terminé&quot;, &quot;120 participants&quot; / &quot;حضر 120 شخصًا&quot;.</li>
            <li>Attendees: signed out, the lock line and &quot;Se connecter pour voir qui participe&quot;. Signed in: the summary sentence (&quot;Vous et Salma Idrissi&quot;, &quot;… et 3 autres&quot;; Arabic joins with و), &quot;Tout voir&quot;, the dialog title and the &quot;Vous&quot; / &quot;أنت&quot; badge.</li>
            <li>RSVP card (signed in): &quot;Participer&quot; → &quot;Vous participez&quot; + &quot;Annuler ma participation&quot;; on phones it is the bottom bar, in Arabic its button is on the left.</li>
            <li>Screen reader: each card&apos;s button says the event (&quot;Participer à Leet Jam&quot;); the count is announced after a filter change; the event list and filters are named in the current language.</li>
            <li>Arabic layout: card badge and date start on the right, the back arrow points right, the facts box icons sit on the right of each fact.</li>
            <li>⌘K search: typing a category in the current language finds its events (&quot;musique&quot;, &quot;رياضة&quot;); English names still work.</li>
            <li>Stays as written: event titles, descriptions, places, club names (data). Still English (next steps): calendar, clubs pages, login, profile, legal pages, page titles in the browser tab.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
