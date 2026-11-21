'use server';

import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { addDevAccount } from '@/lib/devAccounts';
import { loginHref, safeNextPath } from '@/lib/login';
import {
  fromDjangoErrors,
  readRegisterForm,
  toPublicValues,
  validateRegistration,
  type RegisterState,
  type RegisterValues,
} from '@/lib/register';

type SignupResult = { ok: true } | { ok: false; state: Omit<RegisterState, 'values'> };

const UNAVAILABLE: SignupResult = { ok: false, state: { error: 'unavailable', fieldErrors: {} } };

// Django POST /api/signup/ (Ahmed / Ayoub): creates the user (password hashed by Django) → 201, or 400 with
// DRF field errors. We only need to know it worked: the login right after gives us the token and the user.
async function createAccount(values: RegisterValues): Promise<SignupResult> {
  if (!process.env.BACKEND_URL) {
    if (process.env.NODE_ENV === 'production') return UNAVAILABLE;
    // Dev fallback (lib/devAccounts.ts): same answers as Django, kept in memory.
    const created = addDevAccount({ email: values.email, password: values.password, full_name: `${values.first_name} ${values.last_name}` });
    return created
      ? { ok: true }
      : { ok: false, state: { error: 'email-taken', fieldErrors: { email: 'This email already has an account.' } } };
  }

  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/api/signup/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // password_confirm stays here: Django doesn't know it.
      body: JSON.stringify({
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        password: values.password,
        year_of_study: Number(values.year_of_study),
        department_id: values.department_id,
        club_id: values.club_id || null,
      }),
      cache: 'no-store',
    });
  } catch {
    return UNAVAILABLE; // network error, Django down
  }
  if (res.status === 201 || res.ok) return { ok: true };
  if (res.status === 400) return { ok: false, state: fromDjangoErrors(await res.json().catch(() => null)) };
  return UNAVAILABLE;
}

// Sign-up (Step 11.2), for <RegisterForm> via useActionState. Success: the account is created, then the
// student is logged in with the same email provider as the login form and sent to `redirectTo`.
export async function registerWithEmail(_previous: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = readRegisterForm(formData);
  const publicValues = toPublicValues(values);
  const redirectTo = safeNextPath(formData.get('redirectTo')?.toString());

  const fieldErrors = validateRegistration(values);
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors, values: publicValues };

  const result = await createAccount(values);
  if (!result.ok) return { ...result.state, values: publicValues };

  try {
    await signIn('email', { email: values.email, password: values.password, redirectTo });
  } catch (error) {
    // The account exists but the automatic login failed (e.g. Django briefly down): send the student to the
    // login page instead of showing a sign-up error for an account that was created.
    if (error instanceof AuthError) {
      console.error('[auth] login right after sign-up failed', error);
      redirect(`${loginHref(redirectTo)}&registered=1`);
    }
    throw error; // the success redirect (NEXT_REDIRECT) and anything unexpected
  }
  return { error: null, fieldErrors: {}, values: publicValues }; // not reached: signIn() redirects
}
