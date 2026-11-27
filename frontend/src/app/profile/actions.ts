'use server';

import { getSessionState } from '@/auth';
import { ApiError, ApiUnavailable } from '@/lib/api/client';
import { getBackendToken } from '@/lib/api/token';
import { mocksOnly, updateMyPhone } from '@/lib/data';
import type { FieldError } from '@/lib/login';
import { normalizePhone } from '@/lib/phone';

// Saves the signed-in student's phone number (Step 21.2, DOCS.md §21.2), for EditProfileDialog.
// Like the other actions: the Django token stays in the encrypted cookie, and expected failures are returned,
// never thrown, so the dialog can show them next to the field or as a message.
//
// Validated twice: by the dialog before sending (quick feedback), and here, because a server action is a public
// endpoint anyone can call with any value. The value sent to Django is always the normalized one.

export type ProfileEditError = 'invalid' | 'signed-out' | 'conflict' | 'unavailable';
export type ProfileEditResult =
  | { ok: true; phone: string }
  | { ok: false; error: ProfileEditError; fieldError?: FieldError };

export async function updatePhoneAction(rawPhone: string): Promise<ProfileEditResult> {
  if ((await getSessionState()).status !== 'signed-in') return { ok: false, error: 'signed-out' };

  // Same rule as the browser (lib/phone.ts). The action can receive anything over the network: a value that
  // isn't text is refused (treating it as "" would silently remove the saved number).
  if (typeof rawPhone !== 'string') return { ok: false, error: 'invalid', fieldError: { key: 'phoneInvalid' } };
  const check = normalizePhone(rawPhone.slice(0, 40));
  if (!check.ok) return { ok: false, error: 'invalid', fieldError: check.error };

  const token = await getBackendToken();
  if (!token && !mocksOnly()) return { ok: false, error: 'signed-out' }; // e.g. a dev login while Django is set

  try {
    return { ok: true, phone: await updateMyPhone(check.value, token ?? '') };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) return { ok: false, error: 'signed-out' };
      // Django found phone data it must reconcile first (accounts/views.py `me`): an administrator's job.
      if (error.status === 409) return { ok: false, error: 'conflict' };
      if (error.status === 400) {
        // DRF field errors: { "phone": ["…"] }. Shown as Django wrote it (once BE12 adds a real check).
        const messages = (error.body as { phone?: unknown } | null)?.phone;
        const first = Array.isArray(messages) ? messages[0] : messages;
        return { ok: false, error: 'invalid', fieldError: typeof first === 'string' ? { text: first } : { key: 'phoneInvalid' } };
      }
    }
    if (error instanceof ApiError || error instanceof ApiUnavailable) {
      console.error(error);
      return { ok: false, error: 'unavailable' };
    }
    throw error;
  }
}
