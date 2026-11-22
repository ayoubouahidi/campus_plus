import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FOOTER_GROUPS, LEGAL_LINKS } from '@/lib/navigation';
import { ExternalIcon } from '@/components/ui/layout/navIcons';
import { Logo } from '@/components/ui/Logo';
import { FooterLink, FooterLinkGroup } from '@/types/navigation';

// No state, no browser APIs: a Server Component by default, so it ships no JavaScript. useTranslations (next-intl)
// works in Server Components too, and in the drawer, where AppShell renders FooterNav/FooterLegal on the client.

const footerLinkStyles =
  'inline-flex items-center gap-1 rounded text-sm text-slate-600 transition-colors duration-150 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-slate-400 dark:hover:text-violet-400';

// Internal links use next/link (client-side navigation); external ones open a new tab and say so.
const FooterLinkItem = ({ link }: { link: FooterLink }) => {
  const t = useTranslations('Nav');
  const tFooter = useTranslations('Footer');
  if (link.kind === 'internal') {
    return (
      <Link href={link.href} className={footerLinkStyles}>
        {t(link.labelKey)}
      </Link>
    );
  }

  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={footerLinkStyles}>
      {link.label}
      <ExternalIcon className="h-3.5 w-3.5" />
      <span className="sr-only"> {tFooter('newTab')}</span>
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
  ({ className = '', ...props }, ref) => {
    const t = useTranslations('Footer');
    return (
      <div ref={ref} className={`max-w-sm space-y-3 ${className}`} {...props}>
        <Logo className="h-12" />
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t('tagline')}</p>
      </div>
    );
  }
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
    const t = useTranslations('Nav');
    const tFooter = useTranslations('Footer');

    return (
      <nav ref={ref} aria-label={tFooter('nav')} className={`${footerNavLayoutStyles[variant]} ${className}`} {...props}>
        {groups.map((group) => (
          <div key={group.id}>
            <GroupTitle className={footerGroupTitleStyles[variant]}>{t(group.titleKey)}</GroupTitle>
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

const footerLegalNavStyles: Record<FooterVariant, string> = {
  full: '',
  compact: 'mt-2',
};

// Same look as the column links, one size smaller to match the copyright line.
const footerLegalLinkStyles =
  'rounded text-xs text-slate-600 underline-offset-2 transition-colors duration-150 hover:text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-slate-400 dark:hover:text-violet-400';

export interface FooterLegalProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: FooterVariant;
}

export const FooterLegal = React.forwardRef<HTMLDivElement, FooterLegalProps>(
  ({ variant = 'full', className = '', ...props }, ref) => {
    const t = useTranslations('Footer');
    const tNav = useTranslations('Nav');
    return (
      <div
        ref={ref}
        className={`text-xs text-slate-500 dark:text-slate-400 ${footerLegalStyles[variant]} ${className}`}
        {...props}
      >
        <p>{t('copyright', { year: String(new Date().getFullYear()) })}</p>
        {/* Its own landmark, so screen-reader users find "Legal" in the landmarks list on every page. */}
        <nav aria-label={t('legal')} className={footerLegalNavStyles[variant]}>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={footerLegalLinkStyles}>
                  {tNav(link.labelKey)}
                </Link>
              </li>
            ))}
            {variant === 'full' && <li aria-hidden="true">·</li>}
            {variant === 'full' && <li>1337 Coding School</li>}
          </ul>
        </nav>
      </div>
    );
  }
);

FooterLegal.displayName = 'FooterLegal';
