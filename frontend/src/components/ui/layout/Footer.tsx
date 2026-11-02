import React from 'react';
import Link from 'next/link';
import { FOOTER_GROUPS } from '@/lib/navigation';
import { ExternalIcon } from '@/components/ui/layout/navIcons';
import { FooterLink, FooterLinkGroup } from '@/types/navigation';

// No hooks, no browser APIs: a Server Component by default, so it ships no JavaScript.

const footerLinkStyles =
  'inline-flex items-center gap-1 rounded text-sm text-slate-600 transition-colors duration-150 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-slate-400 dark:hover:text-violet-400';

// Internal links use next/link (client-side navigation); external ones open a new tab and say so.
const FooterLinkItem = ({ link }: { link: FooterLink }) => {
  if (link.kind === 'internal') {
    return (
      <Link href={link.href} className={footerLinkStyles}>
        {link.label}
      </Link>
    );
  }

  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={footerLinkStyles}>
      {link.label}
      <ExternalIcon className="h-3.5 w-3.5" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
};

/* --------------------------------- Footer --------------------------------- */

export type FooterProps = React.HTMLAttributes<HTMLElement>;

export const Footer = React.forwardRef<HTMLElement, FooterProps>(
  ({ children, className = '', ...props }, ref) => (
    <footer
      ref={ref}
      className={`border-t border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950 ${className}`}
      {...props}
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_2fr] lg:px-8">
        {children}
      </div>
    </footer>
  )
);

Footer.displayName = 'Footer';

/* ------------------------------- FooterBrand ------------------------------ */

export type FooterBrandProps = React.HTMLAttributes<HTMLDivElement>;

export const FooterBrand = React.forwardRef<HTMLDivElement, FooterBrandProps>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`max-w-sm space-y-3 ${className}`} {...props}>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white shadow-sm"
        >
          CH
        </span>
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Campus Hub</span>
      </div>
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Events, clubs and RSVPs for students of 1337 Coding School and EMINES (UM6P), all in one place.
      </p>
    </div>
  )
);

FooterBrand.displayName = 'FooterBrand';

/* -------------------------------- FooterNav ------------------------------- */

// 'full' = page footer columns; 'compact' = single column inside the mobile drawer
export type FooterVariant = 'full' | 'compact';

const footerNavLayoutStyles: Record<FooterVariant, string> = {
  full: 'grid grid-cols-2 gap-8',
  compact: 'space-y-4',
};

const footerGroupTitleStyles: Record<FooterVariant, string> = {
  full: 'text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100',
  compact: 'text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
};

const footerListStyles: Record<FooterVariant, string> = {
  full: 'mt-3 space-y-2',
  compact: 'mt-2 space-y-1.5',
};

// In the page footer the group titles sit under the page's h1; in the drawer, under its "Menu" h2.
const footerGroupTitleLevel: Record<FooterVariant, 'h2' | 'h3'> = {
  full: 'h2',
  compact: 'h3',
};

export interface FooterNavProps extends React.HTMLAttributes<HTMLElement> {
  variant?: FooterVariant;
  groups?: readonly FooterLinkGroup[];
}

// Each column is a heading + list, so screen-reader users can jump between groups by heading.
export const FooterNav = React.forwardRef<HTMLElement, FooterNavProps>(
  ({ variant = 'full', groups = FOOTER_GROUPS, className = '', ...props }, ref) => {
    const GroupTitle = footerGroupTitleLevel[variant];

    return (
      <nav ref={ref} aria-label="Footer" className={`${footerNavLayoutStyles[variant]} ${className}`} {...props}>
        {groups.map((group) => (
          <div key={group.id}>
            <GroupTitle className={footerGroupTitleStyles[variant]}>{group.title}</GroupTitle>
            <ul className={footerListStyles[variant]}>
              {group.links.map((link) => (
                <li key={link.href}>
                  <FooterLinkItem link={link} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    );
  }
);

FooterNav.displayName = 'FooterNav';

/* ------------------------------- FooterLegal ------------------------------ */

const footerLegalStyles: Record<FooterVariant, string> = {
  // Spans the full grid width under the brand and link columns
  full: 'flex flex-col gap-2 border-t border-slate-200/80 pt-6 sm:flex-row sm:items-center sm:justify-between md:col-span-2 dark:border-slate-800',
  compact: '',
};

export interface FooterLegalProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: FooterVariant;
}

export const FooterLegal = React.forwardRef<HTMLDivElement, FooterLegalProps>(
  ({ variant = 'full', className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`text-xs text-slate-500 dark:text-slate-400 ${footerLegalStyles[variant]} ${className}`}
      {...props}
    >
      <p>
        © {new Date().getFullYear()} Campus Hub. Made by students, for students.
      </p>
      {variant === 'full' && <p>1337 Coding School × EMINES · UM6P</p>}
    </div>
  )
);

FooterLegal.displayName = 'FooterLegal';
