import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DEV_LOGIN_ENABLED, auth, signIn } from '@/auth';
import { DevLoginForm } from '@/components/auth/DevLoginForm';
import { LoginLayout } from '@/components/auth/LoginLayout';
import { LoginPanel } from '@/components/auth/LoginPanel';
import { getLoginErrorKind, safeNextPath } from '@/lib/login';

export const metadata: Metadata = {
  title: 'Log in | Campus Hub',
  description: 'Log in with your 42 Intra account to RSVP to campus events.',
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

// `/auth/login` (Step 5.2). Full screen (no shell, lib/navigation.ts FULL_SCREEN_ROUTES).
// ?next= where to go after login (every "Log in" link sends it); ?error= set by Auth.js after a failed login.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  // Already signed in (e.g. Back after logging in): nothing to do here.
  if (await auth()) redirect(next);

  return (
    <LoginLayout>
      <LoginPanel action={signInWith42} next={next} error={getLoginErrorKind(params.error)}>
        {DEV_LOGIN_ENABLED && <DevLoginForm action={signInWithDevLogin} next={next} />}
      </LoginPanel>
    </LoginLayout>
  );
}
