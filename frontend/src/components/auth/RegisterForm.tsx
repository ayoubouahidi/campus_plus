'use client';

import React, { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SignupCodeForm } from '@/components/auth/SignupCodeForm';
import { useFieldError } from '@/hooks/useFieldError';
import { loginHref } from '@/lib/login';
import {
  PASSWORD_MIN_LENGTH,
  REGISTER_INITIAL_STATE,
  YEARS,
  firstErrorField,
  readRegisterForm,
  validateRegistration,
  type RegisterField,
  type RegisterFieldErrors,
  type RegisterState,
  type ResendResult,
  type SignupCodeState,
} from '@/lib/register';

/* --------------------------------- Types ---------------------------------- */

export interface RegisterFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action'> {
  // Server action for useActionState: creates the account, logs in and redirects, or returns the errors.
  // The register page passes registerWithEmail; /test passes a wrapper with extra fake cases.
  action: (previous: RegisterState, formData: FormData) => Promise<RegisterState>;
  // The code step (Step 28): confirm the emailed code, and "Send a new code". Same pattern: real actions on the
  // register page, fakes on /test.
  verifyAction: (previous: SignupCodeState, formData: FormData) => Promise<SignupCodeState>;
  resendAction: (email: string) => Promise<ResendResult>;
  next: string; // already cleaned with safeNextPath()
}

const linkStyles =
  'rounded font-medium text-violet-700 underline underline-offset-2 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-400 dark:hover:text-violet-300';

/* ------------------------------ RegisterForm ------------------------------ */

// Email sign-up (Step 11.2). Same pattern as EmailLoginForm: checked in the browser on submit (messages under
// the fields, focus on the first wrong one, nothing posted), then again on the server. After a failed attempt
// every field keeps its value except the two passwords. No club field (DOCS.md §23).
// Step 28: when Django has emailed a code (state.verifyEmail), the code step replaces the fields; "Use another
// email" brings the fields back with their values.
export const RegisterForm = React.forwardRef<HTMLFormElement, RegisterFormProps>(
  ({ action, verifyAction, resendAction, next, className = '', onSubmit, ...props }, ref) => {
    const [state, formAction, isPending] = useActionState(action, REGISTER_INITIAL_STATE);
    // The answer the student stepped back from with "Use another email". A new submit gives a new state object,
    // so the code step comes back by itself for the next answer (no effect needed).
    const [leftState, setLeftState] = useState<RegisterState | null>(null);
    const [clientErrors, setClientErrors] = useState<RegisterFieldErrors>({});
    const formRef = useRef<HTMLFormElement | null>(null);

    const fieldErrors = Object.keys(clientErrors).length > 0 ? clientErrors : state.fieldErrors;
    const t = useTranslations('Auth');
    const errorText = useFieldError();
    const values = state.values;

    const setRefs = (node: HTMLFormElement | null) => {
      formRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    const focusField = (field: RegisterField | undefined) => {
      if (field) formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
    };

    const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
      onSubmit?.(event);
      const errors = validateRegistration(readRegisterForm(new FormData(event.currentTarget)));
      setClientErrors(errors);
      if (Object.keys(errors).length > 0) {
        event.preventDefault(); // nothing is sent
        focusField(firstErrorField(errors));
      }
    };

    // Changing a field clears its browser message (the server's go away on the next submit).
    const clearError = (field: RegisterField) => () =>
      setClientErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

    if (state.verifyEmail && leftState !== state) {
      return (
        <SignupCodeForm
          email={state.verifyEmail}
          next={next}
          action={verifyAction}
          resendAction={resendAction}
          onChangeEmail={() => setLeftState(state)}
          className={className}
        />
      );
    }

    return (
      <form
        ref={setRefs}
        action={formAction}
        onSubmit={handleSubmit}
        noValidate // our messages instead of the browser's bubbles
        aria-label={t('registerTitle')}
        className={`space-y-4 ${className}`}
        {...props}
      >
        {state.error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-500/30 dark:bg-rose-950/40"
          >
            <p className="font-semibold text-rose-800 dark:text-rose-200">{t(`registerErrors.${state.error}.title`)}</p>
            <p className="mt-1 text-rose-700 dark:text-rose-300">{t(`registerErrors.${state.error}.description`)}</p>
            {state.error === 'email-taken' && (
              <Link href={loginHref(next)} className={`mt-2 inline-block ${linkStyles}`}>
                {t('loginInstead')}
              </Link>
            )}
          </div>
        )}

        <input type="hidden" name="redirectTo" value={next} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="first_name"
            label={t('firstName')}
            autoComplete="given-name"
            defaultValue={values.first_name}
            error={errorText(fieldErrors.first_name)}
            onChange={clearError('first_name')}
            required
          />
          <Input
            name="last_name"
            label={t('lastName')}
            autoComplete="family-name"
            defaultValue={values.last_name}
            error={errorText(fieldErrors.last_name)}
            onChange={clearError('last_name')}
            required
          />
        </div>

        <Input
          name="email"
          type="email"
          label={t('email')}
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          helperText={t('emailCodeHelp')}
          defaultValue={values.email}
          error={errorText(fieldErrors.email)}
          onChange={clearError('email')}
          required
        />
        <Input
          name="password"
          type="password"
          label={t('password')}
          autoComplete="new-password" // password managers offer a strong one
          helperText={t('passwordHelp', { min: PASSWORD_MIN_LENGTH })}
          error={errorText(fieldErrors.password)}
          onChange={clearError('password')}
          required
        />
        <Input
          name="password_confirm"
          type="password"
          label={t('confirmPassword')}
          autoComplete="new-password"
          error={errorText(fieldErrors.password_confirm)}
          onChange={clearError('password_confirm')}
          required
        />

        {/* No school field: Campus Hub is 1337 only, Django puts every student in the 1337 department. */}
        <Select
          name="year_of_study"
          label={t('year')}
          placeholder={t('choose')}
          options={YEARS.map((year) => ({ value: String(year), label: t('yearOption', { year }) }))}
          defaultValue={values.year_of_study}
          error={errorText(fieldErrors.year_of_study)}
          onChange={clearError('year_of_study')}
          required
        />

        <Button type="submit" isLoading={isPending} className="w-full">
          {t(isPending ? 'creating' : 'create')}
        </Button>
      </form>
    );
  }
);

RegisterForm.displayName = 'RegisterForm';
