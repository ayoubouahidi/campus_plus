import { getSessionState, updateSession } from '@/auth';
import { ApiError, ApiUnavailable, hasBackend } from '@/lib/api/client';
import { getBackendToken } from '@/lib/api/token';
import { deleteMyAvatar, uploadMyAvatar } from '@/lib/data';
import { AVATAR_SNIFF_BYTES, checkAvatarFile, sniffAvatarType, type AvatarErrorKey } from '@/lib/avatar';

// POST /profile/photo (multipart `file`) and DELETE /profile/photo: the student's profile photo (Step 26,
// DOCS.md §26). The browser can't call Django itself (the Django token stays in the encrypted cookie), so this
// handler checks the request, then forwards it with the token.
//
// Why a route handler and not a server action like the phone (§21.2):
//  - progress: the dialog shows an upload progress bar, which needs XMLHttpRequest's upload events; a server
//    action is called through fetch, which has no upload progress;
//  - size: server actions refuse bodies over 1 MB by default, and photos go up to 2 MB.
// Not under /api/: nginx sends /api/* to Django (only /api/auth/ comes to us), so /profile/photo it is.
//
// Server actions get CSRF protection from Next.js (Origin check); a route handler doesn't, so it is done here:
// the session cookie is sent with any form post from another site, and SameSite=Lax doesn't stop a same-site
// subdomain. The Origin must be this site.

export type PhotoError = AvatarErrorKey | 'signed-out' | 'forbidden' | 'invalid' | 'unavailable';
export type PhotoResult = { ok: true; avatarUrl: string | null } | { ok: false; error: PhotoError; message?: string };

const reply = (status: number, result: PhotoResult) => Response.json(result, { status, headers: { 'Cache-Control': 'no-store' } });

const isSameOrigin = (request: Request): boolean => {
  const origin = request.headers.get('origin');
  // nginx forwards the public Host ("localhost", "campushub.ma"); the dev server without nginx gets it directly.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

// Shared guard: same origin, signed in, a real Django token. Returns the token or the error response.
const authorize = async (request: Request): Promise<string | Response> => {
  if (!isSameOrigin(request)) return reply(403, { ok: false, error: 'forbidden' });
  if ((await getSessionState()).status !== 'signed-in') return reply(401, { ok: false, error: 'signed-out' });
  if (!hasBackend()) return reply(503, { ok: false, error: 'unavailable' }); // mocks: nowhere to store a file
  const token = await getBackendToken();
  return token ?? reply(401, { ok: false, error: 'signed-out' }); // e.g. the dev login (no Django token)
};

// Django's answer → ours. 400 carries Django's own message ({"file": ["…"]}), shown as written.
const fromDjangoError = (error: unknown): Response => {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return reply(401, { ok: false, error: 'signed-out' });
    if (error.status === 400 || error.status === 413) {
      const messages = (error.body as { file?: unknown } | null)?.file;
      const first = Array.isArray(messages) ? messages[0] : messages;
      return reply(400, { ok: false, error: 'invalid', ...(typeof first === 'string' ? { message: first } : {}) });
    }
  }
  if (error instanceof ApiError || error instanceof ApiUnavailable) {
    console.error(error);
    return reply(503, { ok: false, error: 'unavailable' });
  }
  throw error;
};

export async function POST(request: Request): Promise<Response> {
  const token = await authorize(request);
  if (token instanceof Response) return token;

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get('file');
  } catch {
    return reply(400, { ok: false, error: 'missing' }); // not multipart, or a broken body
  }
  if (!(file instanceof File)) return reply(400, { ok: false, error: 'missing' });

  // Same rules as the browser (lib/avatar.ts): declared type, size, then the real first bytes.
  const check = checkAvatarFile(file);
  if (!check.ok) return reply(400, { ok: false, error: check.error });
  const head = new Uint8Array(await file.slice(0, AVATAR_SNIFF_BYTES).arrayBuffer());
  if (sniffAvatarType(head) === null) return reply(400, { ok: false, error: 'content' });

  try {
    const avatarUrl = await uploadMyAvatar(file, file.name || 'photo', token);
    await updateSession({}); // the navbar's picture comes from the cookie: refresh it from Django (auth.ts)
    return reply(200, { ok: true, avatarUrl });
  } catch (error) {
    return fromDjangoError(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const token = await authorize(request);
  if (token instanceof Response) return token;
  try {
    const avatarUrl = await deleteMyAvatar(token);
    await updateSession({});
    return reply(200, { ok: true, avatarUrl });
  } catch (error) {
    return fromDjangoError(error);
  }
}
