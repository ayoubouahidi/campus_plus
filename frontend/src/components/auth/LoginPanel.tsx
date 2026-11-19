import React from 'react';
import { FortyTwoButton } from '@/components/auth/FortyTwoButton';
import { LOGIN_ERROR_MESSAGES, type LoginErrorKind } from '@/lib/login';

export interface LoginPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  // Server action that starts the 42 sign-in. Receives the form data, including `redirectTo` (= next).
  // Step 5.2 passes Auth.js signIn('42-school'); /test passes a mock.
  action: (formData: FormData) => void | Promise<void>;
  // Where to land after login. Must already be cleaned with safeNextPath() (the action re-checks it).
  next: string;
  // From ?error= via getLoginErrorKind(). null = no error box.
  error?: LoginErrorKind | null;
  // Extra sign-in options under the 42 button (today: <DevLoginForm> on developer machines).
  children?: React.ReactNode;
}

// The form column of the login page (goes in <LoginLayout>): heading, optional error, the 42 button, and
// what signing in means. Text sizes and spacing follow Ayoub's dashboard login; wording is for students.
// Server Component (no 'use client'): only the button needs the browser (pending spinner). The form posts to
// a server action, so it works before JavaScript loads and with JavaScript off.
export const LoginPanel = React.forwardRef<HTMLDivElement, LoginPanelProps>(
  ({ action, next, error = null, children, className = '', ...props }, ref) => {
    const message = error ? LOGIN_ERROR_MESSAGES[error] : null;

    return (
      <div ref={ref} className={className} {...props}>
        <h1 className="text-[1.75rem] font-bold tracking-tight text-slate-900 dark:text-slate-100">Welcome back</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Log in to Campus Hub to RSVP to events, see who&apos;s going and reach club contacts.
        </p>

        {message && (
          // role="alert": announced when it appears; also read first because it sits above the button.
          <div
            role="alert"
            className="mt-7 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-500/30 dark:bg-rose-950/40"
          >
            <p className="font-semibold text-rose-800 dark:text-rose-200">{message.title}</p>
            <p className="mt-1 text-rose-700 dark:text-rose-300">{message.description}</p>
          </div>
        )}

        <form action={action} className="mt-7">
          <input type="hidden" name="redirectTo" value={next} />
          <FortyTwoButton />
        </form>

        {children}

        <p className="mt-5 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          First time here? Signing in creates your account. We receive your 42 login, name, email, campus and
          photo, nothing else.
        </p>
      </div>
    );
  }
);

LoginPanel.displayName = 'LoginPanel';
