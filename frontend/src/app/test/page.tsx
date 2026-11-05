import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// TEST PAGE (/test): where each new step is checked before it goes into the real pages.
// Workflow: build the step here → the user validates it in the browser → move it into the real route
// (e.g. src/app/page.tsx) → reset this page for the next step. Dev only: it is a 404 in production.
// Optional scenarios: read `searchParams` (a Promise in Next.js 16) and switch on ?scenario=<key>
// (see git history, e.g. Step 4.5, for an example).

export const metadata: Metadata = {
  title: 'Test page',
  robots: { index: false, follow: false },
};

export default function TestPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="sr-only">Test page</h1>
      <section
        aria-label="Test controls"
        className="rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <p className="font-semibold">Test page: nothing under test</p>
        <p className="mt-2">
          The calendar is live at{' '}
          <Link href="/calendar" className="font-medium underline underline-offset-2">
            /calendar
          </Link>
          . The next step (event page, <code>/events/[id]</code>) starts here.
        </p>
      </section>
    </div>
  );
}
