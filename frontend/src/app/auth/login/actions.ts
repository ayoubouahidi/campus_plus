'use server';

import { AuthError, CredentialsSignin } from 'next-auth';
import { signIn } from '@/auth';
import {
  BACKEND_UNAVAILABLE_CODE,
  hasFieldErrors,
  safeNextPath,
  validateEmailLogin,
  type EmailLoginState,
} from '@/lib/login';

// Email + password login (Step 11.1), for <EmailLoginForm> via useActionState. Success: Auth.js sets the
// session cookie and signIn() redirects to `redirectTo` (cleaned again here: the hidden field is editable).
// Failure: returns the state the form shows. The password is never returned.
export async function signInWithEmail(_previous: EmailLoginState, formData: FormData): Promise<EmailLoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  const fieldErrors = validateEmailLogin(email, password);
  if (hasFieldErrors(fieldErrors)) return { error: null, fieldErrors, email };

  try {
    await signIn('email', { email, password, redirectTo: safeNextPath(formData.get('redirectTo')?.toString()) });
  } catch (error) {
    // authorize() returned null (wrong email/password) or threw BackendUnavailable (src/auth.ts).
    if (error instanceof CredentialsSignin) {
      return {
        error: error.code === BACKEND_UNAVAILABLE_CODE ? 'unavailable' : 'invalid',
        fieldErrors: {},
        email,
      };
    }
    // Any other Auth.js failure (config, callback): our side, not the student's.
    if (error instanceof AuthError) {
      console.error('[auth] email login failed', error);
      return { error: 'unavailable', fieldErrors: {}, email };
    }
    throw error; // the success redirect (NEXT_REDIRECT) and anything unexpected
  }
  return { error: null, fieldErrors: {}, email }; // not reached: signIn() redirects on success
}
