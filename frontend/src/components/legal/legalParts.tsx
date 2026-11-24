import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal';
import { legalLinkStyles } from './LegalPage';

// Links used inside the legal texts of every language (content/en.tsx, fr.tsx, ar.tsx).

// The team's inbox. dir="ltr": an email address stays left to right inside an Arabic sentence.
export const ContactLink = () => (
  <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} dir="ltr" className={legalLinkStyles}>
    {LEGAL_CONTACT_EMAIL}
  </a>
);

// Opens in a new tab and says so to screen readers, in the visitor's language (Footer.newTab).
export const ExternalLink = ({ href, children }: { href: `https://${string}`; children: ReactNode }) => {
  const t = useTranslations('Footer');
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={legalLinkStyles}>
      {children}
      <span className="sr-only"> {t('newTab')}</span>
    </a>
  );
};
