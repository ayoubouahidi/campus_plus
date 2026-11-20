import React from 'react';
import Link from 'next/link';
import type { AppRoute } from '@/types/navigation';

// Layout for the legal pages (/privacy, /terms): title, "last updated", a short summary, a table of contents
// and numbered sections. A Server Component with no hooks: the pages ship no JavaScript.

export interface LegalSection {
  id: string; // anchor: /privacy#cookies
  title: string;
  body: React.ReactNode;
}

export interface LegalDocument {
  title: string;
  summary: React.ReactNode; // the plain-language version, shown before the details
  sections: readonly LegalSection[];
  related: { label: string; href: AppRoute }; // the other legal page
}

export interface LegalPageProps extends React.HTMLAttributes<HTMLElement> {
  document: LegalDocument;
  lastUpdated: { iso: string; label: string };
}

export const LegalPage = React.forwardRef<HTMLElement, LegalPageProps>(
  ({ document, lastUpdated, className = '', ...props }, ref) => (
    <article ref={ref} className={`mx-auto w-full max-w-5xl ${className}`} {...props}>
      <header className="border-b border-slate-200/80 pb-6 dark:border-slate-800">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
          {document.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Last updated <time dateTime={lastUpdated.iso}>{lastUpdated.label}</time>
        </p>
        <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-relaxed text-violet-950 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100">
          {document.summary}
        </div>
      </header>

      <div className="mt-8 gap-10 lg:grid lg:grid-cols-[14rem_1fr]">
        {/* Phone: a list above the text. Desktop: a column that stays in view while you read. */}
        <nav aria-labelledby="legal-toc-title" className="mb-8 lg:sticky lg:top-24 lg:mb-0 lg:self-start">
          <h2
            id="legal-toc-title"
            className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            On this page
          </h2>
          <ol className="mt-3 space-y-1.5 text-sm">
            {document.sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="rounded text-slate-600 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-slate-400 dark:hover:text-violet-400"
                >
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-10">
          {document.sections.map((section, index) => (
            // scroll-mt: an anchor jump stops below the sticky navbar instead of under it.
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24">
              <h2 id={`${section.id}-title`} className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {index + 1}. {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed text-slate-700 dark:text-slate-300">
                {section.body}
              </div>
            </section>
          ))}

          <p className="border-t border-slate-200/80 pt-6 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
            See also:{' '}
            <Link href={document.related.href} className={legalLinkStyles}>
              {document.related.label}
            </Link>
          </p>
        </div>
      </div>
    </article>
  )
);

LegalPage.displayName = 'LegalPage';

/* ------------------------ Building blocks for the text ------------------------ */

export const legalLinkStyles =
  'font-medium text-violet-700 underline underline-offset-2 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded dark:text-violet-400 dark:hover:text-violet-300';

export const LegalList = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc space-y-1.5 ps-5 marker:text-slate-400">{children}</ul>
);

export const LegalTerm = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
);

export interface LegalTableProps {
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly React.ReactNode[])[];
}

// A real <table> with a caption and column headers, so screen readers announce "Purpose: …" per cell.
// Scrolls sideways on narrow phones instead of squeezing the text.
export const LegalTable = ({ caption, columns, rows }: LegalTableProps) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
    <table className="w-full min-w-[32rem] text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="bg-slate-100/70 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col" className="px-3 py-2 font-semibold">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="px-3 py-2 align-top">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
