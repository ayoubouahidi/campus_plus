import React from 'react';
import { useTranslations } from 'next-intl';

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
// No 'use client': it has no state; the error files (client components) handle focus and retry. Words: the
// Errors messages (Step 12.7); `title` / `description` override them (global-error.tsx, which has no messages).
export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      title,
      description,
      code,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const t = useTranslations('Errors');
    return (
      <div
        ref={ref}
        className={`mx-auto flex w-full max-w-md flex-col items-center px-4 py-20 text-center focus:outline-none sm:py-28 ${className}`}
        {...props}
      >
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{t('label')}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">{title ?? t('title')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description ?? t('body')}</p>

        {children && <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">{children}</div>}

        {code && (
          <p className="mt-8 text-xs text-slate-500 dark:text-slate-500">
            {t('code')} <code className="font-mono select-all">{code}</code>
          </p>
        )}
      </div>
    );
  }
);

ErrorState.displayName = 'ErrorState';
