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
  // A good-news line above the buttons (today: "account created" after a sign-up, ?registered=1).
  notice?: React.ReactNode;
  // Extra sign-in options under the 42 button: <LoginDivider> + <EmailLoginForm> (Step 11.1), and
  // <DevLoginForm> on developer machines.
  children?: React.ReactNode;
}

// The form column of the login page (goes in <LoginLayout>): heading, optional error, the 42 button, and
// what signing in means. Text sizes and spacing follow Ayoub's dashboard login; wording is for students.
// Server Component (no 'use client'): only the button needs the browser (pending spinner). The form posts to
// a server action, so it works before JavaScript loads and with JavaScript off.
export const LoginPanel = React.forwardRef<HTMLDivElement, LoginPanelProps>(
  ({ action, next, error = null, notice, children, className = '', ...props }, ref) => {
    const message = error ? LOGIN_ERROR_MESSAGES[error] : null;

    return (
      <div ref={ref} className={className} {...props}>
        <h1 className="text-[1.75rem] font-bold tracking-tight text-slate-900 dark:text-slate-100">Welcome back</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Log in to Campus Hub to RSVP to events, see who&apos;s going and reach club contacts.
        </p>

        {notice && (
          // role="status": announced politely, it's information, not a problem.
          <div
            role="status"
            className="mt-7 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            {notice}
          </div>
        )}

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
          First time with 42? Signing in creates your account. We receive your 42 login, name, email, campus and
          photo, nothing else.
        </p>
      </div>
    );
  }
);

LoginPanel.displayName = 'LoginPanel';

// "or" between the 42 button and the email form. A plain line with text: decorative for screen readers,
// which already hear two separate forms ("Continue with 42 Intra", then the "Log in with email" form).
export const LoginDivider = ({ className = '' }: { className?: string }) => (
  <div aria-hidden="true" className={`my-6 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 ${className}`}>
    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
    or with email
    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
  </div>
);
