'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import './globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

// Last resort: the root layout itself failed (./error.tsx can't help, it lives inside that layout). This
// file replaces the whole document, so it brings its own <html>, <body>, styles and <title>, and has no
// navbar or footer (they are part of the broken layout). Dark mode still works: it follows the OS setting.
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {/* metadata exports don't work in error files; React 19 hoists this into <head>. */}
        <title>Something went wrong | Campus Hub</title>
        <ErrorState
          title="Campus Hub is having trouble"
          description="The site couldn’t load. Try again in a moment; if it keeps happening, the team is on it."
          code={error.digest}
        >
          <Button onClick={() => retry()} className="h-10">
            Try again
          </Button>
          {/* A full page load, not <Link>: the app's router is part of what broke. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Go to the home page
          </a>
        </ErrorState>
      </body>
    </html>
  );
}
