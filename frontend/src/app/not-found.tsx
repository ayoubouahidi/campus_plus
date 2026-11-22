import type { Metadata } from 'next';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

// The root not-found file may export metadata (Next 16 docs): the tab says "Page introuvable | Campus Hub".
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('Errors'))('notFoundTitle') };
}

// Rendered inside the root layout (navbar, tab bar, footer come from AppShell) for any unmatched URL
// or notFound() call. Server Component: no JavaScript shipped.
export default function NotFound() {
  const t = useTranslations('Errors');
  const tEvent = useTranslations('EventPage');
  const tClubs = useTranslations('Clubs');
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-20 text-center sm:py-28">
      <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">{t('notFoundTitle')}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {t('notFoundBody')}
      </p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        >
          {tEvent('discover')}
        </Link>
        <Link
          href="/clubs"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {tClubs('browse')}
        </Link>
      </div>
    </div>
  );
}
