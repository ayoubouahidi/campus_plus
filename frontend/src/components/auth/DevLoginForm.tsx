import React from 'react';

export interface DevLoginFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action'> {
  // Server action: Auth.js signIn('dev', { redirectTo }).
  action: (formData: FormData) => void | Promise<void>;
  next: string; // already cleaned with safeNextPath()
}

// Developer-only shortcut under the 42 button: signs in as the mock student without 42 (AUTH_DEV_LOGIN=true,
// see src/auth.ts). Dashed amber like the /test controls, so nobody mistakes it for a real option.
// Server Component; works without JavaScript.
export const DevLoginForm = React.forwardRef<HTMLFormElement, DevLoginFormProps>(
  ({ action, next, className = '', ...props }, ref) => (
    <form ref={ref} action={action} className={`mt-4 ${className}`} {...props}>
      <input type="hidden" name="redirectTo" value={next} />
      <button
        type="submit"
        className="w-full rounded-lg border border-dashed border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:border-amber-500/50 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
      >
        Dev login (mock student, no 42)
      </button>
    </form>
  )
);

DevLoginForm.displayName = 'DevLoginForm';
