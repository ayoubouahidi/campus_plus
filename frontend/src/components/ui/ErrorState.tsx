import React from 'react';

export interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: string;
  description?: string;
  // Next.js error digest: a short id that matches the server log. Shown so a student can report it.
  code?: string;
  // Actions, usually "Try again" + a way out ("Discover events").
  children?: React.ReactNode;
}

// The "something broke" page body, used by app/error.tsx and app/global-error.tsx. Same layout as the 404
// pages (centered, narrow), rose instead of violet. Never shows the raw error message: in production it is
// generic for server errors anyway, and client messages are technical. The code is enough to find the log.
// No 'use client': it has no state; the error files (client components) handle focus and retry.
export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      title = 'Something went wrong',
      description = 'This page couldn’t load. It’s probably temporary: try again in a moment.',
      code,
      children,
      className = '',
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={`mx-auto flex w-full max-w-md flex-col items-center px-4 py-20 text-center focus:outline-none sm:py-28 ${className}`}
      {...props}
    >
      <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">Error</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>

      {children && <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">{children}</div>}

      {code && (
        <p className="mt-8 text-xs text-slate-500 dark:text-slate-500">
          Error code: <code className="font-mono select-all">{code}</code>
        </p>
      )}
    </div>
  )
);

ErrorState.displayName = 'ErrorState';
