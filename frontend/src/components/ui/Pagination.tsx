import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getPageItems } from '@/lib/advancedSearch';

// Page links for any paged list (Step 18.1, DOCS.md §18.1). A molecule: links + the page-number rule
// (getPageItems). Real links, not buttons: each page has its own URL, so it works before JavaScript loads,
// opens in a new tab, and the back button returns to the previous page.
//
// No 'use client' and no state. `hrefFor` is a function, so render it from a Server Component (as /search does)
// or from a client component that builds the hrefs itself; a function can't cross the server → client boundary.

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  page: number; // current page, 1-based
  pageCount: number;
  hrefFor: (page: number) => string;
}

const itemBase =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40';

type ItemState = 'current' | 'link' | 'disabled';

const itemStyles: Record<ItemState, string> = {
  current: 'bg-violet-600 text-white dark:bg-violet-500',
  link: 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  disabled: 'cursor-not-allowed text-slate-300 dark:text-slate-600',
};

// Previous / Next arrows point the reading direction: flipped in Arabic (rtl:-scale-x-100).
const Arrow = ({ direction }: { direction: 'previous' | 'next' }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100">
    <path d={direction === 'previous' ? 'm12.5 15-5-5 5-5' : 'm7.5 5 5 5-5 5'} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  ({ page, pageCount, hrefFor, className = '', ...props }, ref) => {
    const t = useTranslations('Pagination');
    if (pageCount <= 1) return null; // one page: nothing to choose

    const edge = (direction: 'previous' | 'next', target: number, enabled: boolean) => {
      const label = t(direction);
      const content = (
        <>
          <Arrow direction={direction} />
          <span className="hidden sm:inline">{label}</span>
        </>
      );
      // At the first / last page the control stays in place (no layout jump) but is not a link.
      return enabled ? (
        <Link
          href={hrefFor(target)}
          rel={direction === 'previous' ? 'prev' : 'next'}
          aria-label={label}
          className={`${itemBase} gap-1.5 ${itemStyles.link}`}
        >
          {content}
        </Link>
      ) : (
        <span aria-disabled="true" className={`${itemBase} gap-1.5 ${itemStyles.disabled}`}>
          {content}
        </span>
      );
    };

    return (
      <nav ref={ref} aria-label={t('label')} className={`flex justify-center ${className}`} {...props}>
        <ul className="flex flex-wrap items-center justify-center gap-1">
          <li>{edge('previous', page - 1, page > 1)}</li>
          {getPageItems(page, pageCount).map((item, index) =>
            item === 'gap' ? (
              // Skipped pages: decorative, the numbers around it say where you are.
              <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-sm text-slate-400">
                …
              </li>
            ) : (
              <li key={item}>
                <Link
                  href={hrefFor(item)}
                  aria-label={t('page', { page: item })}
                  aria-current={item === page ? 'page' : undefined}
                  className={`${itemBase} ${itemStyles[item === page ? 'current' : 'link']}`}
                >
                  {item}
                </Link>
              </li>
            )
          )}
          <li>{edge('next', page + 1, page < pageCount)}</li>
        </ul>
      </nav>
    );
  }
);

Pagination.displayName = 'Pagination';
