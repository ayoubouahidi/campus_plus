import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { LoginLayout } from '@/components/auth/LoginLayout';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { RegisterPanel } from '@/components/auth/RegisterPanel';
import { safeNextPath } from '@/lib/login';
import { listDepartments } from '@/lib/data';
import { signInWith42 } from '../login/actions';
import { registerWithEmail } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Meta');
  return {
    title: t('register'),
    description: t('registerDescription'),
    robots: { index: false, follow: true },
  };
}

// `/auth/register` (Step 11.3): email sign-up, full screen like /auth/login (FULL_SCREEN_ROUTES covers /auth).
// ?next= where to go once the account exists (the student is logged in right away).
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNextPath((await searchParams).next);

  // Already signed in: no second account.
  if (await auth()) redirect(next);

  // Django's departments (or the mocks in dev, lib/data.ts). Only what the form needs is sent. No clubs: sign-up
  // has no club field (DOCS.md §23).
  const departments = (await listDepartments()).map(({ id, name }) => ({ id, name }));

  return (
    <LoginLayout>
      <RegisterPanel next={next} fortyTwoAction={signInWith42}>
        <RegisterForm action={registerWithEmail} next={next} departments={departments} />
      </RegisterPanel>
    </LoginLayout>
  );
}
