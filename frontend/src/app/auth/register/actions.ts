'use server';

import { redirect } from 'next/navigation';
import { AuthError, CredentialsSignin } from 'next-auth';
import { signIn } from '@/auth';
import { addPendingDevAccount, hasPendingDevAccount } from '@/lib/devAccounts';
import { BACKEND_UNAVAILABLE_CODE, EMAIL_PATTERN, loginHref, safeNextPath } from '@/lib/login';
import {
  fromDjangoErrors,
  normalizeSignupCode,
  readRegisterForm,
  toPublicValues,
  validateRegistration,
  validateSignupCode,
  type RegisterState,
  type RegisterValues,
  type ResendResult,
  type SignupCodeState,
} from '@/lib/register';

// `verify`: Django emailed a code and keeps the sign-up pending (Step 28). `created`: an older Django that creates
// the account at once (201) and doesn't send codes: the student is logged in right away, as before Step 28.
type SignupResult = { ok: true; next: 'verify' | 'created' } | { ok: false; state: Omit<RegisterState, 'values'> };

const UNAVAILABLE: SignupResult = { ok: false, state: { error: 'unavailable', fieldErrors: {} } };

const backendPost = (path: string, body: unknown): Promise<Response> =>
  fetch(`${process.env.BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });

// Django POST /api/signup/ (Ayoub): 202 "a code was sent" (the account doesn't exist yet), 400 with DRF field
// errors, 503 when the email couldn't be sent.
async function createAccount(values: RegisterValues): Promise<SignupResult> {
  if (!process.env.BACKEND_URL) {
    if (process.env.NODE_ENV === 'production') return UNAVAILABLE;
    // Dev fallback (lib/devAccounts.ts): same answers as Django, kept in memory; the code is DEV_SIGNUP_CODE.
    const created = addPendingDevAccount({ email: values.email, password: values.password, full_name: `${values.first_name} ${values.last_name}` });
    return created
      ? { ok: true, next: 'verify' }
      : { ok: false, state: { error: 'email-taken', fieldErrors: { email: { key: 'emailTaken' } } } };
  }

  let res: Response;
  try {
    // password_confirm stays here: Django doesn't know it.
    res = await backendPost('/api/signup/', {
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      password: values.password,
      year_of_study: Number(values.year_of_study),
    });
  } catch {
    return UNAVAILABLE; // network error, timeout, Django down
  }
  if (res.status === 202) return { ok: true, next: 'verify' };
  if (res.status === 201) return { ok: true, next: 'created' };
  if (res.status === 400) return { ok: false, state: fromDjangoErrors(await res.json().catch(() => null)) };
  return UNAVAILABLE; // 503 (email not sent) and anything else
}

// Sign-up (Steps 11.2 and 28), for <RegisterForm> via useActionState. Success: Django emailed a 6-digit code and
// the form switches to the code step (verifyEmail). The password is never sent back to the browser.
export async function registerWithEmail(_previous: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = readRegisterForm(formData);
  const publicValues = toPublicValues(values);
  const redirectTo = safeNextPath(formData.get('redirectTo')?.toString());

  const fieldErrors = validateRegistration(values);
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors, values: publicValues };

  const result = await createAccount(values);
  if (!result.ok) return { ...result.state, values: publicValues };
  if (result.next === 'verify') return { error: null, fieldErrors: {}, values: publicValues, verifyEmail: values.email.trim().toLowerCase() };

  // Older Django (no codes): the account exists, log in with the email provider like the login form.
  try {
    await signIn('email', { email: values.email, password: values.password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      console.error('[auth] login right after sign-up failed', error);
      redirect(`${loginHref(redirectTo)}&registered=1`);
    }
    throw error; // the success redirect (NEXT_REDIRECT) and anything unexpected
  }
  return { error: null, fieldErrors: {}, values: publicValues }; // not reached: signIn() redirects
}

// The code step (Step 28), for <SignupCodeForm> via useActionState. The right code creates the account in Django
// and logs the student in (Auth.js provider 'signup-code', src/auth.ts), then redirects to `redirectTo`.
export async function verifySignupCode(_previous: SignupCodeState, formData: FormData): Promise<SignupCodeState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const raw = String(formData.get('code') ?? '');
  const redirectTo = safeNextPath(formData.get('redirectTo')?.toString());

  const fieldError = validateSignupCode(raw);
  if (fieldError) return { error: null, fieldError };
  if (!EMAIL_PATTERN.test(email)) return { error: 'wrong-code' }; // the hidden field was edited

  try {
    await signIn('signup-code', { email, code: normalizeSignupCode(raw), redirectTo });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      if (error.code !== BACKEND_UNAVAILABLE_CODE) return { error: 'wrong-code' };
      // The account may exist already (Django answered, reading it failed): the login page is the safe place.
      console.error('[auth] sign-up code: backend unavailable', error);
      return { error: 'unavailable' };
    }
    if (error instanceof AuthError) {
      console.error('[auth] sign-up code failed', error);
      return { error: 'unavailable' };
    }
    throw error; // the success redirect (NEXT_REDIRECT) and anything unexpected
  }
  return { error: null }; // not reached: signIn() redirects
}

// "Send a new code" (Step 28). Django answers the same for every address (it doesn't reveal who is signing up)
// and sends at most one code per minute; the button waits RESEND_COOLDOWN_SECONDS for the same reason.
export async function resendSignupCode(email: string): Promise<ResendResult> {
  const address = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(address)) return 'unavailable';
  if (!process.env.BACKEND_URL) {
    if (process.env.NODE_ENV === 'production') return 'unavailable';
    if (hasPendingDevAccount(address)) console.info(`[dev] sign-up code sent again to ${address}`);
    return 'sent';
  }
  try {
    const res = await backendPost('/api/signup/resend/', { email: address });
    if (res.status === 429) return 'throttled';
    return res.ok ? 'sent' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
