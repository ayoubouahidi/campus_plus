import React from 'react';
import Link from 'next/link';
import { loginHref } from '@/lib/login';

export interface RegisterPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  next: string; // already cleaned with safeNextPath(), carried to the login link
  children: React.ReactNode; // <RegisterForm>
}

const linkStyles =
  'rounded font-medium text-violet-700 underline underline-offset-2 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-400 dark:hover:text-violet-300';

// The form column of /auth/register (goes in <LoginLayout>, like LoginPanel): heading, the form, and the way
// back to login. 42 students are pointed to the login page: their account is created by "Continue with 42".
// Server Component.
export const RegisterPanel = React.forwardRef<HTMLDivElement, RegisterPanelProps>(
  ({ next, children, className = '', ...props }, ref) => (
    <div ref={ref} className={className} {...props}>
      <h1 className="text-[1.75rem] font-bold tracking-tight text-slate-900 dark:text-slate-100">Create your account</h1>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        For students without a 42 account. With 42, just{' '}
        <Link href={loginHref(next)} className={linkStyles}>
          continue with 42 Intra
        </Link>
        : it creates your account.
      </p>

      <div className="mt-7">{children}</div>

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{' '}
        <Link href={loginHref(next)} className={linkStyles}>
          Log in
        </Link>
      </p>
      <p className="mt-3 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        By creating an account you accept the{' '}
        <Link href="/terms" className={linkStyles}>
          Terms of Service
        </Link>{' '}
        and the{' '}
        <Link href="/privacy" className={linkStyles}>
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
);

RegisterPanel.displayName = 'RegisterPanel';
