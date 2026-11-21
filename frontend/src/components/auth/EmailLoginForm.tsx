'use client';

import React, { useActionState, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  EMAIL_LOGIN_ERROR_MESSAGES,
  EMAIL_LOGIN_INITIAL_STATE,
  hasFieldErrors,
  validateEmailLogin,
  type EmailLoginFieldErrors,
  type EmailLoginState,
} from '@/lib/login';

/* --------------------------------- Types ---------------------------------- */

export interface EmailLoginFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action'> {
  // Server action for useActionState: signs in with Auth.js (the 'email' provider) and redirects on success,
  // or returns the error to show. The login page passes the real one; /test passes a mock.
  action: (previous: EmailLoginState, formData: FormData) => Promise<EmailLoginState>;
  next: string; // already cleaned with safeNextPath() (the action cleans it again)
}

/* ----------------------------- EmailLoginForm ----------------------------- */

// Email + password login (Step 11.1), under the 42 button. Checked in the browser first (instant messages
// next to the fields, focus on the first wrong one), then again on the server. After a failed login the
// email stays and the password is cleared (React resets the form after an action; defaultValue = state.email).
export const EmailLoginForm = React.forwardRef<HTMLFormElement, EmailLoginFormProps>(
  ({ action, next, className = '', onSubmit, ...props }, ref) => {
    const [state, formAction, isPending] = useActionState(action, EMAIL_LOGIN_INITIAL_STATE);
    const [clientErrors, setClientErrors] = useState<EmailLoginFieldErrors>({});
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    // Browser check wins while it has something to say; otherwise the server's (same rules, in case JS was
    // off or the check was skipped).
    const fieldErrors = hasFieldErrors(clientErrors) ? clientErrors : state.fieldErrors;
    const message = state.error ? EMAIL_LOGIN_ERROR_MESSAGES[state.error] : null;

    const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
      onSubmit?.(event);
      const data = new FormData(event.currentTarget);
      const errors = validateEmailLogin(String(data.get('email') ?? ''), String(data.get('password') ?? ''));
      setClientErrors(errors);
      if (hasFieldErrors(errors)) {
        event.preventDefault(); // nothing is sent
        (errors.email ? emailRef : passwordRef).current?.focus();
      }
    };

    // Typing in a field clears its browser message (the server's goes away on the next submit).
    const clearError = (field: keyof EmailLoginFieldErrors) => () =>
      setClientErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

    return (
      <form
        ref={ref}
        action={formAction}
        onSubmit={handleSubmit}
        noValidate // our messages instead of the browser's bubbles: same look, read by screen readers
        aria-label="Log in with email"
        className={`space-y-4 ${className}`}
        {...props}
      >
        {message && (
          // role="alert": announced as soon as it appears after the failed attempt.
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-500/30 dark:bg-rose-950/40"
          >
            <p className="font-semibold text-rose-800 dark:text-rose-200">{message.title}</p>
            <p className="mt-1 text-rose-700 dark:text-rose-300">{message.description}</p>
          </div>
        )}

        <input type="hidden" name="redirectTo" value={next} />
        <Input
          ref={emailRef}
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          defaultValue={state.email}
          error={fieldErrors.email}
          onChange={clearError('email')}
          required
        />
        <Input
          ref={passwordRef}
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          error={fieldErrors.password}
          onChange={clearError('password')}
          required
        />
        <Button type="submit" isLoading={isPending} className="w-full">
          {isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    );
  }
);

EmailLoginForm.displayName = 'EmailLoginForm';
