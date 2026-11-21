'use client';

import React, { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { loginHref } from '@/lib/login';
import {
  PASSWORD_MIN_LENGTH,
  REGISTER_ERROR_MESSAGES,
  REGISTER_INITIAL_STATE,
  YEAR_OPTIONS,
  firstErrorField,
  readRegisterForm,
  validateRegistration,
  type RegisterField,
  type RegisterFieldErrors,
  type RegisterState,
} from '@/lib/register';

/* --------------------------------- Types ---------------------------------- */

export interface RegisterFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action'> {
  // Server action for useActionState: creates the account, logs in and redirects, or returns the errors.
  // The register page passes registerWithEmail; /test passes a wrapper with extra fake cases.
  action: (previous: RegisterState, formData: FormData) => Promise<RegisterState>;
  next: string; // already cleaned with safeNextPath()
  // From the server (Phase 7: GET /api/departments/ and /api/clubs/). Plain data, so this stays serializable.
  departments: { id: string; name: string }[];
  clubs: { id: string; name: string; department_id: string }[];
}

const linkStyles =
  'rounded font-medium text-violet-700 underline underline-offset-2 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-400 dark:hover:text-violet-300';

/* ------------------------------ RegisterForm ------------------------------ */

// Email sign-up (Step 11.2). Same pattern as EmailLoginForm: checked in the browser on submit (messages under
// the fields, focus on the first wrong one, nothing posted), then again on the server. After a failed attempt
// every field keeps its value except the two passwords. The club list follows the chosen school.
export const RegisterForm = React.forwardRef<HTMLFormElement, RegisterFormProps>(
  ({ action, next, departments, clubs, className = '', onSubmit, ...props }, ref) => {
    const [state, formAction, isPending] = useActionState(action, REGISTER_INITIAL_STATE);
    const [clientErrors, setClientErrors] = useState<RegisterFieldErrors>({});
    const [departmentId, setDepartmentId] = useState(state.values.department_id);
    const formRef = useRef<HTMLFormElement | null>(null);

    const fieldErrors = Object.keys(clientErrors).length > 0 ? clientErrors : state.fieldErrors;
    const message = state.error ? REGISTER_ERROR_MESSAGES[state.error] : null;
    const values = state.values;
    const departmentClubs = clubs.filter((club) => club.department_id === departmentId);

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

    return (
      <form
        ref={setRefs}
        action={formAction}
        onSubmit={handleSubmit}
        noValidate // our messages instead of the browser's bubbles
        aria-label="Create your account"
        className={`space-y-4 ${className}`}
        {...props}
      >
        {message && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-500/30 dark:bg-rose-950/40"
          >
            <p className="font-semibold text-rose-800 dark:text-rose-200">{message.title}</p>
            <p className="mt-1 text-rose-700 dark:text-rose-300">{message.description}</p>
            {state.error === 'email-taken' && (
              <Link href={loginHref(next)} className={`mt-2 inline-block ${linkStyles}`}>
                Log in instead
              </Link>
            )}
          </div>
        )}

        <input type="hidden" name="redirectTo" value={next} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="first_name"
            label="First name"
            autoComplete="given-name"
            defaultValue={values.first_name}
            error={fieldErrors.first_name}
            onChange={clearError('first_name')}
            required
          />
          <Input
            name="last_name"
            label="Last name"
            autoComplete="family-name"
            defaultValue={values.last_name}
            error={fieldErrors.last_name}
            onChange={clearError('last_name')}
            required
          />
        </div>

        <Input
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          defaultValue={values.email}
          error={fieldErrors.email}
          onChange={clearError('email')}
          required
        />
        <Input
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password" // password managers offer a strong one
          helperText={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          error={fieldErrors.password}
          onChange={clearError('password')}
          required
        />
        <Input
          name="password_confirm"
          type="password"
          label="Confirm password"
          autoComplete="new-password"
          error={fieldErrors.password_confirm}
          onChange={clearError('password_confirm')}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            name="year_of_study"
            label="Year of study"
            placeholder="Choose…"
            options={YEAR_OPTIONS}
            defaultValue={values.year_of_study}
            error={fieldErrors.year_of_study}
            onChange={clearError('year_of_study')}
            required
          />
          <Select
            name="department_id"
            label="School"
            placeholder="Choose…"
            options={departments.map((department) => ({ value: department.id, label: department.name }))}
            defaultValue={values.department_id}
            error={fieldErrors.department_id}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              clearError('department_id')();
            }}
            required
          />
        </div>

        {/* key: a new school resets the club to "No club" (its clubs are different). */}
        <Select
          key={departmentId}
          name="club_id"
          label="Club (optional)"
          options={[
            { value: '', label: departmentId ? 'No club' : 'Choose your school first' },
            ...departmentClubs.map((club) => ({ value: club.id, label: club.name })),
          ]}
          defaultValue={departmentClubs.some((club) => club.id === values.club_id) ? values.club_id : ''}
          helperText="The club you’re a member of, if any."
          disabled={!departmentId || departmentClubs.length === 0}
          error={fieldErrors.club_id}
          onChange={clearError('club_id')}
        />

        <Button type="submit" isLoading={isPending} className="w-full">
          {isPending ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>
    );
  }
);

RegisterForm.displayName = 'RegisterForm';
