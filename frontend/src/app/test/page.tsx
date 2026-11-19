import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DEV_LOGIN_ENABLED, auth, signOut } from '@/auth';
import { safeNextPath } from '@/lib/login';
import { SessionSwitcher } from './SessionSwitcher';

// TEST PAGE (/test): where each new step is checked before it goes into the real pages.
// Workflow: build the step here → the user validates it in the browser → move it into the real route
// (e.g. src/app/page.tsx) → reset this page for the next step. Dev only: it is a 404 in production.
// Optional scenarios: read `searchParams` (a Promise in Next.js 16) and switch on ?scenario=<key>
// (see git history, e.g. Steps 4.5, 4.9, 4.13 and 4.15, for examples).
// Reusable test tool: ./SessionSwitcher.tsx (signed in / out / loading; restores the default on leave).

export const metadata: Metadata = {
  title: 'Test page',
  robots: { index: false, follow: false },
};

// Sign out of the real Auth.js session so the login can be tried again (logout UI comes in Step 5.4).
async function testSignOut() {
  'use server';
  await signOut({ redirectTo: '/test' });
}

const ERROR_SCENARIOS = [
  { label: 'No error', error: null },
  { label: 'AccessDenied', error: 'AccessDenied' },
  { label: 'Configuration', error: 'Configuration' },
  { label: 'OAuthCallbackError (cancelled)', error: 'OAuthCallbackError' },
] as const;

const NEXT_SCENARIOS = [
  { label: 'none', next: null },
  { label: '/test (come back here)', next: '/test' },
  { label: 'event page', next: '/events/evt_hackathon_ai' },
  { label: 'calendar week', next: '/calendar?date=2026-11-21&view=week' },
  { label: '//evil.com', next: '//evil.com' },
  { label: '/\\evil.com', next: '/\\evil.com' },
  { label: 'https://evil.com', next: 'https://evil.com' },
] as const;

const scenarioQuery = (error: string | null, next: string | null) => {
  const params = new URLSearchParams();
  if (error) params.set('error', error);
  if (next) params.set('next', next);
  const query = params.toString();
  return query ? `?${query}` : '';
};

const pill =
  'rounded-full border border-amber-400 px-3 py-1 font-medium aria-[current=true]:bg-amber-400 aria-[current=true]:text-amber-950 dark:border-amber-500/50';

export default async function TestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const params = await searchParams;
  const rawError = typeof params.error === 'string' ? params.error : null;
  const rawNext = typeof params.next === 'string' ? params.next : null;
  const next = safeNextPath(rawNext);
  const session = await auth();
  const has42Keys = Boolean(process.env.AUTH_42_SCHOOL_ID && process.env.AUTH_42_SCHOOL_SECRET);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section
        aria-label="Test controls"
        className="rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-950 dark:text-amber-200"
      >
        <p className="font-semibold">Step 5.3: the whole site uses the real session</p>

        <div className="mt-3 rounded-lg bg-white/60 p-3 dark:bg-black/20">
          <p>
            <span className="font-semibold">Real session (Auth.js):</span>{' '}
            {session ? (
              <>
                signed in as <code className="font-mono">{session.user.name}</code> ({session.user.email}), role{' '}
                <code className="font-mono">{session.user.role}</code>, id <code className="font-mono">{session.user.id}</code>
                , 42 login <code className="font-mono">{session.user.login ?? '—'}</code>
              </>
            ) : (
              'signed out'
            )}
          </p>
          <p className="mt-1">
            42 keys: {has42Keys ? 'set' : 'missing (the 42 button will fail at 42)'} · Dev login:{' '}
            {DEV_LOGIN_ENABLED ? 'on' : 'off'} · Backend: {process.env.BACKEND_URL ? process.env.BACKEND_URL : 'none (dev fallback)'}
          </p>
          <p className="mt-1 text-xs">
            The navbar, tab bar, drawer, RSVP card, attendees and club contacts now follow this session.
          </p>
          <SessionSwitcher />
          {session && (
            <form action={testSignOut} className="mt-2">
              <button type="submit" className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-300">
                Sign out (real session)
              </button>
            </form>
          )}
        </div>

        <div role="group" aria-label="?error=" className="mt-3 flex flex-wrap items-center gap-2">
          <span>?error=</span>
          {ERROR_SCENARIOS.map(({ label, error: code }) => (
            <Link key={label} href={`/test${scenarioQuery(code, rawNext)}`} aria-current={rawError === code} className={pill}>
              {label}
            </Link>
          ))}
        </div>

        <div role="group" aria-label="?next=" className="mt-3 flex flex-wrap items-center gap-2">
          <span>?next=</span>
          {NEXT_SCENARIOS.map(({ label, next: value }) => (
            <Link key={label} href={`/test${scenarioQuery(rawError, value)}`} aria-current={rawNext === value} className={pill}>
              {label}
            </Link>
          ))}
        </div>

        <Link
          href={`/auth/login${scenarioQuery(rawError, rawNext)}`}
          className="mt-4 inline-flex rounded-lg bg-amber-400 px-4 py-2 font-semibold text-amber-950 hover:bg-amber-300"
        >
          Open /auth/login with these settings →
        </Link>

        <p className="mt-3">
          Raw <code>next</code>: <code className="font-mono">{rawNext ?? '(none)'}</code> → cleaned:{' '}
          <code className="font-mono font-semibold">{next}</code>
        </p>

        <details className="mt-3">
          <summary className="cursor-pointer font-medium">What to check</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Signed out</strong> (sign out above): navbar shows one violet <strong>Log in</strong> button (no &quot;Sign up&quot;), no bell; phone tab bar shows &quot;Log in&quot;; drawer has one Log in button.</li>
            <li>Signed out, on <Link href="/events/evt_hackathon_ai" className="underline">an event</Link>: the RSVP card asks you to log in; on <Link href="/clubs/leet-frame" className="underline">a club</Link>: the contact card is locked. View source: the president&apos;s email is <strong>not</strong> in the page.</li>
            <li>Click Log in from that club page → Dev login → you come back to the same club, now with the contact details, avatar in the navbar, bell visible. No reload needed.</li>
            <li>Reload any page while signed in: the avatar is there from the first paint (no &quot;Log in&quot; flash).</li>
            <li>&quot;UI session&quot; buttons still switch the look for testing; leaving /test goes back to the real session.</li>
            <li>Login page itself: unchanged (full screen, 42 + dev button).</li>
          </ul>
        </details>
      </section>
    </div>
  );
}
