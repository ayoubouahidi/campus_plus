import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DEV_LOGIN_ENABLED, auth, signIn } from '@/auth';
import { DevLoginForm } from '@/components/auth/DevLoginForm';
import { EmailLoginForm } from '@/components/auth/EmailLoginForm';
import { LoginLayout } from '@/components/auth/LoginLayout';
import { LoginDivider, LoginPanel } from '@/components/auth/LoginPanel';
import { getLoginErrorKind, registerHref, safeNextPath } from '@/lib/login';
import { signInWithEmail } from './actions';

export const metadata: Metadata = {
  title: 'Log in | Campus Hub',
  description: 'Log in with your 42 Intra account or your email to RSVP to campus events.',
  robots: { index: false, follow: true },
};

// The hidden `redirectTo` field can be edited in the browser: clean it again on the server.
const redirectTarget = (formData: FormData) => safeNextPath(formData.get('redirectTo')?.toString());

// Server actions (run on the server when the form is posted). signIn() answers with a redirect: to 42
// (then back to /api/auth/callback/42-school), or straight to `redirectTo` for the dev login.
async function signInWith42(formData: FormData) {
  'use server';
  await signIn('42-school', { redirectTo: redirectTarget(formData) });
}

async function signInWithDevLogin(formData: FormData) {
  'use server';
  if (!DEV_LOGIN_ENABLED) return;
  await signIn('dev', { redirectTo: redirectTarget(formData) });
}

// `/auth/login` (Step 5.2, email form since Step 11.3). Full screen (no shell, lib/navigation.ts FULL_SCREEN_ROUTES).
// ?next= where to go after login (every "Log in" link sends it); ?error= set by Auth.js after a failed 42 login;
// ?registered=1 after a sign-up whose automatic login failed (app/auth/register/actions.ts).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  // Already signed in (e.g. Back after logging in): nothing to do here.
  if (await auth()) redirect(next);
  const t = await getTranslations('Auth');

  return (
    <LoginLayout>
      <LoginPanel
        action={signInWith42}
        next={next}
        error={getLoginErrorKind(params.error)}
        notice={params.registered === '1' ? t('registered') : null}
      >
        <LoginDivider />
        <EmailLoginForm action={signInWithEmail} next={next} />
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          {t('noAccount')}{' '}
          <Link
            href={registerHref(next)}
            className="rounded font-medium text-violet-700 underline underline-offset-2 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-400 dark:hover:text-violet-300"
          >
            {t('createAccountLink')}
          </Link>
        </p>
        {DEV_LOGIN_ENABLED && <DevLoginForm action={signInWithDevLogin} next={next} />}
      </LoginPanel>
    </LoginLayout>
  );
}
