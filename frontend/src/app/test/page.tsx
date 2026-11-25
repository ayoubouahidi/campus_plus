import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { DEV_LOGIN_ENABLED, getSessionState, signOut } from '@/auth';
import { ChangePhotoDialog } from '@/components/profile/ChangePhotoDialog';
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
        <p className="font-semibold">Test page: Step 26, profile photo upload (Change photo)</p>
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
          <h3 className="font-semibold">What to check (Step 26): Change photo, signed in with a Django account</h3>
          {session.status === 'signed-in' ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <ChangePhotoDialog currentUrl={session.user.avatar_url} name={session.user.full_name} />
              <span className="text-slate-500 dark:text-slate-400">Same dialog as on <Link href="/profile" className="underline underline-offset-2">/profile</Link>.</span>
            </div>
          ) : (
            <p className="mt-2 text-slate-500 dark:text-slate-400">Log in first (the dev login has no Django token: it gets &quot;session expired&quot;).</p>
          )}
          <ul className="mt-2 list-disc space-y-1 ps-5 text-slate-600 dark:text-slate-300">
            <li>Choose a JPEG, PNG or WebP under 2 MB: the preview shows in the circle with the file name and size, nothing is sent yet.</li>
            <li>A GIF or PDF (picker on &quot;All files&quot;) → &quot;This file type isn&apos;t supported&quot;. A photo of 2 MB or more → &quot;2 MB or more&quot;. A text file renamed <code>x.jpg</code> → &quot;isn&apos;t a real image&quot;. Nothing is sent.</li>
            <li>Drag a photo onto the dashed zone: same as choosing it.</li>
            <li>Upload: the progress bar fills (DevTools → Network → Slow 4G to see it move), &quot;Cancel upload&quot; stops it (&quot;Upload cancelled.&quot;).</li>
            <li>After the upload: toast, dialog closed, the new photo on /profile <strong>and in the navbar</strong> (reload: it stays).</li>
            <li>&quot;Remove photo&quot; → initials everywhere.</li>
            <li>Keyboard: Tab reaches &quot;Choose a photo&quot; (focus ring), Enter/Space opens the picker, Escape closes the dialog. Screen reader: the rules are read with the picker; the progress bar announces its value.</li>
            <li>Dark mode, phone width, Français / العربية (mirrored).</li>
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
