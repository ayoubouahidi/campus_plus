import React from 'react';
import type { AtomicLevel } from '@/lib/designTokens';
import { ATOMIC_LEVELS } from '@/lib/designTokens';

// Layout pieces of the design-system page (Step 17.1, DOCS.md §17). Server Components: no state.

const levelTone: Record<AtomicLevel, string> = {
  foundations: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  atoms: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  molecules: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  organisms: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  templates: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
};

// The level label ("Atoms"…) used in the table of contents and on each specimen.
export const LevelTag = ({ level, className = '' }: { level: AtomicLevel; className?: string }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${levelTone[level]} ${className}`}>
    {ATOMIC_LEVELS[level].title}
  </span>
);

export interface DsSectionProps extends React.HTMLAttributes<HTMLElement> {
  level: AtomicLevel;
}

// One atomic level: heading + description + its specimens. `id` = the level, for the table of contents.
export const DsSection = React.forwardRef<HTMLElement, DsSectionProps>(
  ({ level, children, className = '', ...props }, ref) => (
    <section ref={ref} id={level} aria-labelledby={`${level}-title`} className={`scroll-mt-24 space-y-6 ${className}`} {...props}>
      <header className="space-y-2 border-b border-slate-200/80 pb-4 dark:border-slate-800">
        <h2 id={`${level}-title`} className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {ATOMIC_LEVELS[level].title}
        </h2>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">{ATOMIC_LEVELS[level].description}</p>
      </header>
      {children}
    </section>
  )
);
DsSection.displayName = 'DsSection';

export interface SpecimenProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  path?: string; // source file, so a developer can find it
  description?: string;
}

// One component (or token family) on a card: its name, file, a sentence, then live examples.
export const Specimen = React.forwardRef<HTMLElement, SpecimenProps>(
  ({ title, path, description, children, className = '', ...props }, ref) => (
    <article
      ref={ref}
      className={`rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
      {...props}
    >
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {path && (
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400" dir="ltr">
            {path}
          </p>
        )}
        {description && <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>}
      </div>
      {children}
    </article>
  )
);
Specimen.displayName = 'Specimen';

// A labelled row of examples inside a specimen ("Variants", "Sizes", "States"…).
export const SpecimenRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  </div>
);
