import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { PRIVACY_POLICY } from '@/components/legal/legalContent';
import { LEGAL_LAST_UPDATED } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy | Campus Hub',
  description: 'What Campus Hub collects, who can see it, the cookies we use and how to get your data deleted.',
};

// `/privacy` (Step 9.2, DOCS.md §9). Mandatory page (subject v21.2), linked from the footer on every page.
// No data, no time, no session of its own: the text lives in components/legal/legalContent.tsx.
export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <LegalPage document={PRIVACY_POLICY} lastUpdated={LEGAL_LAST_UPDATED} />
    </div>
  );
}
