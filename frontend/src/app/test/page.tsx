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
        <p className="font-semibold">Test page: Step 12.6, login, sign-up and the profile in EN / FR / AR</p>
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
          <h3 className="font-semibold">Pages to open (Step 12.6 is live on them)</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            <li>
              <Link href="/auth/login" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Login
              </Link>
            </li>
            <li>
              <Link href="/auth/login?registered=1" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Login after sign-up
              </Link>
            </li>
            <li>
              <Link href="/auth/login?error=AccessDenied" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                42 refused
              </Link>
            </li>
            <li>
              <Link href="/auth/login?error=Configuration" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Login unavailable
              </Link>
            </li>
            <li>
              <Link href="/auth/register" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Sign-up
              </Link>
            </li>
            <li>
              <Link href="/profile" className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                Profile (signed in)
              </Link>
            </li>
          </ul>
          <p className="mt-2 text-slate-500 dark:text-slate-400">The login pages redirect when you are signed in: sign out first (box above) to see them.</p>
        </div>

        <div>
          <h3 className="font-semibold">What to check (Step 12.6), in Français then العربية</h3>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-slate-600 dark:text-slate-300">
            <li>Login: heading, intro, &quot;Continuer avec 42 Intra&quot; (and &quot;Ouverture de 42 Intra…&quot; while it loads), &quot;ou par e-mail&quot;, field labels, button, &quot;Pas de compte et pas de 42 ?&quot;, the 42 note at the bottom. The back arrow at the top points right in Arabic. The dev login button stays English (developers only).</li>
            <li>Error and notice boxes: ?error=AccessDenied, ?error=Configuration, ?registered=1 (links above).</li>
            <li>Email login, browser check: submit empty → &quot;Saisissez votre e-mail.&quot; / &quot;أدخل بريدك الإلكتروني.&quot;, then a bad email → the &quot;valid email&quot; message. A wrong password (with Django off, any unknown email) → &quot;E-mail ou mot de passe incorrect&quot;.</li>
            <li>Sign-up: labels, &quot;Au moins 8 caractères.&quot;, year list &quot;1re année, 2e année…&quot; / &quot;السنة الأولى…&quot;, &quot;Choisissez d’abord votre école&quot;, the intro and terms sentences with their links in the right place. Submit empty: every field shows its message, focus goes to the first one; mismatched passwords → &quot;Les mots de passe ne correspondent pas.&quot;</li>
            <li>Sign up twice with the same email → the &quot;Un compte existe déjà&quot; box, &quot;Cet e-mail a déjà un compte.&quot; under the field, and &quot;Se connecter plutôt&quot;.</li>
            <li>/profile (signed in): &quot;Mon profil&quot;, &quot;Se déconnecter&quot; (&quot;Déconnexion…&quot; while it runs), stats (&quot;Participations à venir&quot;, &quot;Événements suivis&quot;, &quot;Clubs suivis · Bientôt&quot;), &quot;Vos événements&quot; with the J’y vais / J’y suis allé tabs, empty states, &quot;Récemment suivis&quot; + &quot;Les 3 derniers sur N événements&quot;, the &quot;Suivi&quot; chip, date tiles &quot;NOV.&quot; / &quot;نونبر&quot;.</li>
            <li>Arabic /profile: stats, tabs and rows mirror; the row chevrons and the logout icon point the other way; the date tile month fits in its box.</li>
            <li>Messages that come from Django itself (a field it rejects) stay in Django&apos;s language: expected until the backend sends keys or translated text.</li>
            <li>Still English (next step 12.7): Privacy / Terms, error and 404 pages, page titles in the browser tab.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
