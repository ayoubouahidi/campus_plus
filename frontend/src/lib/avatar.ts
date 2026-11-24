// The profile photo rules (Step 26, DOCS.md §26), the same in the browser (ChangePhotoDialog, before uploading)
// and in the route handler (app/profile/photo/route.ts, before calling Django), and the same as Django's
// POST /api/me/avatar/ (Ayoub, TEAM_NEEDS BE16): JPEG, PNG or WebP, strictly under 2 MB.
//
// Three checks, cheapest first:
//  1. the type the browser reports (`file.type`, from the extension: easy to fake, but catches honest mistakes);
//  2. the size;
//  3. the first bytes of the file ("magic numbers"): a text file renamed photo.jpg is refused. The browser runs it
//     too (file.slice(0, 12)), so the student learns at once; the server runs it because anyone can post anything.
// Django then opens the image with Pillow, the real proof it's a picture.

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // Django: "strictly under 2MB"

export type AvatarType = 'image/jpeg' | 'image/png' | 'image/webp';
export const AVATAR_TYPES: readonly AvatarType[] = ['image/jpeg', 'image/png', 'image/webp'];

// For <input type="file" accept>: the picker shows only these (the user can still choose "All files").
export const AVATAR_ACCEPT = AVATAR_TYPES.join(',');

export type AvatarErrorKey = 'type' | 'size' | 'content' | 'missing';
export type AvatarCheck = { ok: true } | { ok: false; error: AvatarErrorKey };

const isAvatarType = (type: string): type is AvatarType => (AVATAR_TYPES as readonly string[]).includes(type);

// Checks 1 and 2: what can be known without reading the file.
export const checkAvatarFile = (file: { type: string; size: number }): AvatarCheck => {
  if (!isAvatarType(file.type)) return { ok: false, error: 'type' };
  if (file.size <= 0) return { ok: false, error: 'missing' };
  if (file.size >= AVATAR_MAX_BYTES) return { ok: false, error: 'size' };
  return { ok: true };
};

// Check 3: the real format from the first 12 bytes, or null when it is none of the three.
//   JPEG  FF D8 FF
//   PNG   89 50 4E 47 0D 0A 1A 0A
//   WebP  "RIFF" <4 bytes size> "WEBP"
export const AVATAR_SNIFF_BYTES = 12;
export const sniffAvatarType = (bytes: Uint8Array): AvatarType | null => {
  const at = (offset: number, expected: number[]) => expected.every((byte, i) => bytes[offset + i] === byte);
  if (at(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
  return null;
};

// "1.4 MB", "820 KB": shown next to the chosen file. Locale-aware number, unit kept short in every language.
export const formatFileSize = (bytes: number, locale: string): string => {
  const format = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return bytes >= 1024 * 1024 ? `${format(bytes / (1024 * 1024))} MB` : `${format(Math.max(1, Math.round(bytes / 1024)))} KB`;
};
