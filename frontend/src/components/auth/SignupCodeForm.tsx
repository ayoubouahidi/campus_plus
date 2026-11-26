'use client';

import React, { useActionState, useEffect, useId, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useFieldError } from '@/hooks/useFieldError';
import type { FieldError } from '@/lib/login';
import {
  RESEND_COOLDOWN_SECONDS,
  SIGNUP_CODE_INITIAL_STATE,
  SIGNUP_CODE_LENGTH,
  SIGNUP_CODE_MINUTES,
  validateSignupCode,
  type ResendResult,
  type SignupCodeState,
} from '@/lib/register';

/* --------------------------------- Types ---------------------------------- */

export interface SignupCodeFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action'> {
  email: string; // where Django sent the code (already lower-cased)
  next: string; // where to go once logged in, already cleaned with safeNextPath()
  // Server actions: the register page passes verifySignupCode / resendSignupCode; /test passes fakes.
  action: (previous: SignupCodeState, formData: FormData) => Promise<SignupCodeState>;
  resendAction: (email: string) => Promise<ResendResult>;
  onChangeEmail: () => void; // back to the sign-up form, its fields kept
}

/* ----------------------------- SignupCodeForm ----------------------------- */

// The code step of sign-up (Step 28, DOCS.md §28). Django emailed a 6-digit code; the account is only created
// when it's confirmed here, and the student is then logged in.
//  - One text field, not 6 boxes: one tab stop, one label, paste works, and autocomplete="one-time-code" lets
//    phones offer the code from the email or SMS. Digits are shown left to right in every language (dir="ltr").
//  - Checked in the browser first (6 digits; spaces and dashes are dropped), then by the server action, then by
//    Django (wrong / expired / 5 tries: one message, on purpose).
//  - "Send a new code" waits RESEND_COOLDOWN_SECONDS (Django sends at most one per minute) and counts down.
export const SignupCodeForm = React.forwardRef<HTMLFormElement, SignupCodeFormProps>(
  ({ email, next, action, resendAction, onChangeEmail, className = '', onSubmit, ...props }, ref) => {
    const t = useTranslations('Auth.signupCode');
    const errorText = useFieldError();
    const [state, formAction, isPending] = useActionState(action, SIGNUP_CODE_INITIAL_STATE);
    const [clientError, setClientError] = useState<FieldError | undefined>(undefined);
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS); // a code was just sent
    const [resendStatus, setResendStatus] = useState<ResendResult | null>(null);
    const [isResending, startResend] = useTransition();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const headingId = useId();

    // The student arrives here from the sign-up form: put them straight in the field.
    useEffect(() => inputRef.current?.focus(), []);

    // One tick per second while counting down; nothing runs once it reaches 0.
    useEffect(() => {
      if (cooldown <= 0) return;
      const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1_000);
      return () => window.clearTimeout(timer);
    }, [cooldown]);

    const fieldError = clientError ?? state.fieldError;

    const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
      onSubmit?.(event);
      const error = validateSignupCode(String(new FormData(event.currentTarget).get('code') ?? ''));
      setClientError(error);
      if (error) {
        event.preventDefault(); // nothing is sent
        inputRef.current?.focus();
      }
    };

    const resend = () =>
      startResend(async () => {
        setResendStatus(null);
        const result = await resendAction(email);
        setResendStatus(result);
        if (result !== 'unavailable') setCooldown(RESEND_COOLDOWN_SECONDS);
      });

    return (
      <form
        ref={ref}
        action={formAction}
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby={headingId}
        className={`space-y-4 ${className}`}
        {...props}
      >
        <div>
          <h2 id={headingId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t.rich('sentTo', {
              email: () => (
                <strong dir="ltr" className="font-semibold text-slate-900 dark:text-slate-100">
                  {email}
                </strong>
              ),
              minutes: SIGNUP_CODE_MINUTES,
            })}
          </p>
        </div>

        {state.error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-500/30 dark:bg-rose-950/40"
          >
            <p className="font-semibold text-rose-800 dark:text-rose-200">{t(`errors.${state.error}.title`)}</p>
            <p className="mt-1 text-rose-700 dark:text-rose-300">{t(`errors.${state.error}.description`)}</p>
          </div>
        )}

        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="redirectTo" value={next} />

        <Input
          ref={inputRef}
          name="code"
          label={t('label')}
          helperText={t('help', { length: SIGNUP_CODE_LENGTH })}
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          maxLength={SIGNUP_CODE_LENGTH + 2} // room for "123 456" pasted with a space
          dir="ltr"
          className="text-center font-mono text-lg tracking-[0.5em]"
          error={errorText(fieldError)}
          onChange={() => setClientError(undefined)}
          required
        />

        <Button type="submit" isLoading={isPending} className="w-full">
          {t(isPending ? 'verifying' : 'verify')}
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Button
            type="button"
            variant="ghost"
            onClick={resend}
            isLoading={isResending}
            disabled={cooldown > 0 || isPending}
          >
            {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
          </Button>
          <Button type="button" variant="ghost" onClick={onChangeEmail} disabled={isPending}>
            {t('changeEmail')}
          </Button>
        </div>

        {/* Polite: the result of "Send a new code" is announced without moving the focus. */}
        <p aria-live="polite" className="min-h-5 text-sm text-slate-600 dark:text-slate-400">
          {resendStatus ? t(`resendStatus.${resendStatus}`) : ''}
        </p>
      </form>
    );
  }
);

SignupCodeForm.displayName = 'SignupCodeForm';
