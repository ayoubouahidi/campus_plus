import Link from 'next/link';

// Shown by notFound() in ./page.tsx (unknown or deleted event), inside the root layout. Same look as the
// global 404 (src/app/not-found.tsx), with copy for events. HTTP status stays 404; Next adds noindex.
export default function EventNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-20 text-center sm:py-28">
      <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">Event not found</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        This event doesn&apos;t exist or was removed by its organizer. There&apos;s plenty more going on.
      </p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        >
          Discover events
        </Link>
        <Link
          href="/calendar"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Open the calendar
        </Link>
      </div>
    </div>
  );
}
