'use client';

import React from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { LogoutIcon } from '@/components/profile/profileIcons';

export interface LogoutFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action'> {
  // Server action: Auth.js signOut({ redirectTo }). Passed in so this client file doesn't import server code.
  action: () => void | Promise<void>;
}

// Figma "Button · Log out": 44px secondary button with the out-arrow icon.
const LogoutSubmit = () => {
  const { pending } = useFormStatus(); // pending while the server action runs
  const t = useTranslations('Auth');
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      {pending ? (
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <LogoutIcon className="rtl:-scale-x-100" />
      )}
      {t(pending ? 'loggingOut' : 'logOut')}
    </button>
  );
};

// "Log out" button. A form posting to a server action: works without JavaScript, and the server clears the
// session cookie before redirecting (Step 5.4).
export const LogoutForm = React.forwardRef<HTMLFormElement, LogoutFormProps>(
  ({ action, className = '', ...props }, ref) => (
    <form ref={ref} action={action} className={className} {...props}>
      <LogoutSubmit />
    </form>
  )
);

LogoutForm.displayName = 'LogoutForm';
