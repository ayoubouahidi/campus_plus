import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { DEV_LOGIN_ENABLED, getSessionState, signOut } from '@/auth';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { LOCALE_INFO } from '@/i18n/config';
import { hasBackend } from '@/lib/api/client';
import { listClubs, listDepartments, listEvents } from '@/lib/data';
import { RealtimeMonitor } from './RealtimeMonitor';
import { SessionSwitcher } from './SessionSwitcher';
import { fakeRegister, fakeResend, fakeVerify } from './signupCodeActions';

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

export default async function TestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const verified = (await searchParams).verified;

  const session = await getSessionState();
  const locale = await getLocale();
  const t = await getTranslations('Events');
  const format = await getFormatter();
  const sampleDate = new Date('2026-11-13T17:00:00Z'); // hackathon opening, a fixed date (no hydration drift)
  const [liveEvents, liveClubs, departments] = await Promise.all([listEvents(), listClubs(), listDepartments()]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="sr-only">Test page</h1>
      <section
        aria-label="Test controls"
        className="rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-950 dark:text-amber-200"
      >
        <p className="font-semibold">Test page: Step 28, sign-up with any email + the 6-digit code</p>
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
          <h3 className="font-semibold">What to check (Step 28): sign-up, then the code step (fake answers, nothing is created)</h3>
          {typeof verified === 'string' && (
            <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              Code accepted for <strong>{verified}</strong>: on the real page the account is created and the student is logged in here.
            </p>
          )}
          <div className="mt-3 max-w-md rounded-xl border border-slate-200/80 p-4 dark:border-slate-800">
            <RegisterForm
              action={fakeRegister}
              verifyAction={fakeVerify}
              resendAction={fakeResend}
              next="/test"
              departments={departments.map(({ id, name }) => ({ id, name }))}
            />
          </div>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-slate-600 dark:text-slate-300">
            <li>Any email is accepted now (<code>name@gmail.com</code> works); the hint under the field says a 6-digit code will be sent. A bad format still gets &quot;Enter a valid email&quot;.</li>
            <li>An email starting with <code>taken</code> → &quot;An account with this email already exists&quot;.</li>
            <li>Valid form → the code step: &quot;Check your email&quot;, the address in bold, the cursor already in the code field.</li>
            <li>Empty → &quot;Enter the code from the email&quot;; <code>12345</code> or letters → &quot;The code is 6 digits&quot; (nothing sent). <code>123 456</code> pasted with a space is accepted.</li>
            <li><code>111111</code> → &quot;This code doesn&apos;t work&quot;; <code>000000</code> → &quot;We couldn&apos;t check the code&quot;; <code>123456</code> → back here with a green line.</li>
            <li>&quot;Send a new code in 60 s&quot; counts down, then becomes clickable: &quot;A new code is on its way&quot; and the count restarts. Email with <code>down</code> → &quot;couldn&apos;t send&quot;; with <code>slow</code> → &quot;wait a minute&quot;.</li>
            <li>&quot;Use another email&quot; → the form comes back with names, email, year and school kept (passwords empty); submit again → the code step again.</li>
            <li>Keyboard only, screen reader (the new-code result is announced), phone width (the keypad shows digits), dark mode, Français / العربية (the code and the address stay left to right).</li>
            <li>The real flow against Ayoub&apos;s Django: <Link href="/auth/register?next=/test" className="underline underline-offset-2">/auth/register</Link> (the code is printed in <code>docker compose logs backend</code> with the console email backend).</li>
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
