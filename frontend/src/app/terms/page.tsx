import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { LegalPage } from '@/components/legal/LegalPage';
import { LEGAL_DOCUMENTS } from '@/components/legal/legalContent';
import { LEGAL_LAST_UPDATED } from '@/lib/legal';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Meta');
  return { title: t('terms'), description: t('termsDescription') };
}

// `/terms` (Step 9.2, DOCS.md §9). Mandatory page (subject v21.2), linked from the footer on every page.
// No data, no time, no session of its own: the text lives in components/legal/content/{en,fr,ar}.tsx, in the
// visitor's language (Step 12.7).
export default async function TermsPage() {
  const locale = await getLocale();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <LegalPage document={LEGAL_DOCUMENTS[locale].terms} lastUpdated={LEGAL_LAST_UPDATED} />
    </div>
  );
}
