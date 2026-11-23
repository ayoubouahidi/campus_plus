import type { FieldError } from '@/lib/login';

// The phone number rule (Step 21.2, DOCS.md §21.2), the same in the browser (EditProfileDialog, before sending)
// and in the server action (before calling Django): the subject requires validation on both sides. Django
// should apply the same rule too (TEAM_NEEDS BE12); until then this is the only real check.
//
// Accepted: Moroccan mobile numbers, the way people actually type them, all stored the same way (E.164):
//   06 12 34 56 78 · 0612345678 · +212 6 12 34 56 78 · +212612345678 · 00212612345678 · 07-12-34-56-78
//   → "+212612345678"
// An empty field means "no phone number" (it removes a saved one).

const SEPARATORS = /[\s().-]/g; // spaces, dots, dashes, brackets: ignored
const MOROCCAN_MOBILE = /^(?:\+212|00212|0)([67]\d{8})$/; // 06 / 07 + 8 digits, or the same after +212 / 00212

export type PhoneCheck = { ok: true; value: string } | { ok: false; error: FieldError };

export const normalizePhone = (raw: string): PhoneCheck => {
  const compact = raw.replace(SEPARATORS, '');
  if (compact === '') return { ok: true, value: '' };
  const match = MOROCCAN_MOBILE.exec(compact);
  return match ? { ok: true, value: `+212${match[1]}` } : { ok: false, error: { key: 'phoneInvalid' } };
};

// "+212612345678" → "+212 6 12 34 56 78" (how Moroccan numbers are usually written). Anything else as is.
export const formatPhone = (value: string): string => {
  const match = /^\+212([67])(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value);
  return match ? `+212 ${match.slice(1).join(' ')}` : value;
};
