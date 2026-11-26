'use server';

import { redirect } from 'next/navigation';
import {
  normalizeSignupCode,
  readRegisterForm,
  toPublicValues,
  validateRegistration,
  validateSignupCode,
  type RegisterState,
  type ResendResult,
  type SignupCodeState,
} from '@/lib/register';

// TEST ONLY (Step 28, /test): the sign-up form and its code step with fake answers, so every case can be tried
// without Django and without creating accounts. The real actions are in app/auth/register/actions.ts.
//  - sign-up: any valid form → "code sent"; an email starting with "taken" → "already exists";
//  - code: 123456 → success (back to /test?verified=…); 000000 → "couldn't check"; anything else → "doesn't work";
//  - new code: an email containing "down" → "couldn't send"; "slow" → "wait a minute"; otherwise "sent".

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fakeRegister(_previous: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = readRegisterForm(formData);
  const publicValues = toPublicValues(values);
  const fieldErrors = validateRegistration(values);
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors, values: publicValues };
  await wait(600);
  if (values.email.toLowerCase().startsWith('taken')) {
    return { error: 'email-taken', fieldErrors: { email: { key: 'emailTaken' } }, values: publicValues };
  }
  return { error: null, fieldErrors: {}, values: publicValues, verifyEmail: values.email.trim().toLowerCase() };
}

export async function fakeVerify(_previous: SignupCodeState, formData: FormData): Promise<SignupCodeState> {
  const raw = String(formData.get('code') ?? '');
  const fieldError = validateSignupCode(raw);
  if (fieldError) return { error: null, fieldError };
  await wait(600);
  const code = normalizeSignupCode(raw);
  if (code === '000000') return { error: 'unavailable' };
  if (code !== '123456') return { error: 'wrong-code' };
  redirect(`/test?verified=${encodeURIComponent(String(formData.get('email') ?? ''))}`);
}

export async function fakeResend(email: string): Promise<ResendResult> {
  await wait(600);
  if (email.includes('down')) return 'unavailable';
  if (email.includes('slow')) return 'throttled';
  return 'sent';
}
