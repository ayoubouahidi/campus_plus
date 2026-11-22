import type { Locale } from '@/i18n/config';
import type { LegalDocument } from './LegalPage';
import en from './content/en';
import fr from './content/fr';
import ar from './content/ar';

// The text of /privacy and /terms in each language (Step 12.7, DOCS.md §9 and §12.7). Long legal text with
// lists, tables and links doesn't fit short ICU messages, so each language is a JSX file in ./content with
// the same sections and ids; the page picks the one for the visitor's language. Server only: the pages ship
// no JavaScript, and only the chosen language ends up in the HTML.
export interface LegalDocuments {
  privacy: LegalDocument;
  terms: LegalDocument;
}

export const LEGAL_DOCUMENTS: Record<Locale, LegalDocuments> = { en, fr, ar };
