'use client'; // Error boundaries must be Client Components

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';

interface RouteErrorProps {
  error: Error & { digest?: string };
  // Next.js 16.3+: re-fetches the segment from the server and re-renders it (replaces the older `reset`).
  retry: () => void;
}

const SECONDARY_LINK_STYLES =
  'inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800';

// Shown in place of any page that throws while rendering (server or browser). It sits inside the root
// layout, so the navbar, tab bar and footer stay and the student can still go elsewhere. Errors in the
// root layout itself are handled by ./global-error.tsx.
export default function RouteError({ error, retry }: RouteErrorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Phase 7: send to an error-reporting service instead of the console.
  useEffect(() => {
    console.error(error);
  }, [error]);

  // The page content was swapped without a navigation: move focus here so screen readers announce it
  // and keyboard users don't stay on a control that no longer exists.
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <ErrorState ref={containerRef} tabIndex={-1} code={error.digest}>
      <Button onClick={() => retry()} className="h-10">
        Try again
      </Button>
      <Link href="/" className={SECONDARY_LINK_STYLES}>
        Discover events
      </Link>
    </ErrorState>
  );
}
