// Facts shared by the Privacy Policy and the Terms of Service (DOCS.md §9). One place, so both pages
// always agree on who to contact and when the text last changed.

// The team's shared inbox (created 2026-11-20, every member can read it). People write here about their data
// or these terms; the policy promises an answer within 30 days, so someone must check it.
export const LEGAL_CONTACT_EMAIL = 'campushub.1337.team@gmail.com';

// Bump both when the text changes in a way users should know about. A plain string, not a Date: the label
// is the same on the server and in every browser, whatever their time zone.
export const LEGAL_LAST_UPDATED = { iso: '2026-11-20', label: '20 November 2026' } as const;

// Auth.js keeps a signed-in session for 30 days by default (src/auth.ts sets no maxAge).
export const SESSION_LIFETIME_DAYS = 30;
