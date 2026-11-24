'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { PhotoError, PhotoResult } from '@/app/profile/photo/route';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  AVATAR_ACCEPT,
  AVATAR_SNIFF_BYTES,
  checkAvatarFile,
  formatFileSize,
  sniffAvatarType,
} from '@/lib/avatar';

// "Change photo" on /profile (Step 26, DOCS.md §26): the file upload module (type and size checks, preview,
// progress, delete). It replaced the disabled "Change photo · Soon" button.
//
//  - Choose: a real <input type="file"> (sr-only, still focusable) behind a label styled as a button, or drop a
//    file on the zone. The picker only offers JPEG, PNG and WebP (accept).
//  - Checked at once in the browser (lib/avatar.ts): type, size < 2 MB, and the first bytes (a renamed text file
//    is refused). The route handler checks the same again, and Django opens the image for real.
//  - Preview: a local object URL of the chosen file in the 104 px avatar, before anything is sent. Revoked when
//    replaced or when the dialog unmounts (no memory kept for a file the student dropped).
//  - Upload: XMLHttpRequest to /profile/photo, because fetch has no upload progress. The bar is a real
//    role="progressbar"; "Cancel upload" aborts the request.
//  - Remove: DELETE /profile/photo (shown when there is a photo). Django then shows the initials.
//  - Done → toast, dialog closed, router.refresh(): /profile re-reads /api/me/, and the route handler already
//    refreshed the login cookie, so the navbar shows the new photo too.

export interface ChangePhotoDialogProps {
  currentUrl: string | null; // the saved photo (Django's avatar_url), null = initials
  name: string; // for the preview's initials and alt text
  className?: string;
}

type Selected = { file: File; previewUrl: string };
type DialogError = PhotoError | 'aborted';
type Busy = 'idle' | 'uploading' | 'removing';

// Reads the first bytes in the browser (check 3 of lib/avatar.ts).
const sniffFile = async (file: File) => sniffAvatarType(new Uint8Array(await file.slice(0, AVATAR_SNIFF_BYTES).arrayBuffer()));

const parseResult = (text: string): PhotoResult | null => {
  try {
    const value = JSON.parse(text) as PhotoResult;
    return typeof value?.ok === 'boolean' ? value : null;
  } catch {
    return null; // e.g. nginx's own 413 page
  }
};

export const ChangePhotoDialog = ({ currentUrl, name, className = '' }: ChangePhotoDialogProps) => {
  const t = useTranslations('Profile.photo');
  const locale = useLocale();
  const { showToast } = useToast();
  const router = useRouter();
  const inputId = useId();
  const rulesId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [error, setError] = useState<{ key: DialogError; message?: string } | null>(null);
  const [busy, setBusy] = useState<Busy>('idle');
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // The object URL lives as long as this selection: revoked when it's replaced, cleared or unmounted.
  useEffect(() => {
    if (!selected) return;
    return () => URL.revokeObjectURL(selected.previewUrl);
  }, [selected]);

  // Closing (or leaving the page) mid-upload cancels it: nothing keeps running in the background.
  useEffect(() => () => xhrRef.current?.abort(), []);

  const open = () => {
    setSelected(null);
    setError(null);
    setProgress(0);
    setIsOpen(true);
  };
  const close = useCallback(() => {
    xhrRef.current?.abort();
    setIsOpen(false);
    setSelected(null);
  }, []);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setProgress(0);
    const check = checkAvatarFile(file);
    if (!check.ok) {
      setSelected(null);
      setError({ key: check.error });
      return;
    }
    if ((await sniffFile(file)) === null) {
      setSelected(null);
      setError({ key: 'content' });
      return;
    }
    setSelected({ file, previewUrl: URL.createObjectURL(file) });
  };

  const done = (result: PhotoResult, kind: 'saved' | 'removed') => {
    if (result.ok) {
      showToast({ title: t(`${kind}.title`), description: t(`${kind}.description`), variant: 'success' });
      setIsOpen(false);
      setSelected(null);
      router.refresh(); // /profile re-reads /api/me/ on the server
    } else {
      setError({ key: result.error, message: result.message });
    }
  };

  const upload = () => {
    if (!selected || busy !== 'idle') return;
    const form = new FormData();
    form.append('file', selected.file, selected.file.name);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    setBusy('uploading');
    setError(null);
    setProgress(0);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    const finish = (result: PhotoResult | null, aborted = false) => {
      xhrRef.current = null;
      setBusy('idle');
      if (aborted) setError({ key: 'aborted' });
      else done(result ?? { ok: false, error: 'unavailable' }, 'saved');
    };
    // 413 without our JSON: a proxy (nginx) refused the size before the app could answer.
    xhr.onload = () => finish(parseResult(xhr.responseText) ?? (xhr.status === 413 ? { ok: false, error: 'size' } : null));
    xhr.onerror = () => finish(null);
    xhr.onabort = () => finish(null, true);
    xhr.open('POST', '/profile/photo');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send(form);
  };

  const remove = async () => {
    if (busy !== 'idle') return;
    setBusy('removing');
    setError(null);
    let result: PhotoResult | null = null;
    try {
      const res = await fetch('/profile/photo', { method: 'DELETE', headers: { Accept: 'application/json' } });
      result = parseResult(await res.text());
    } catch {
      result = null;
    }
    setBusy('idle');
    done(result ?? { ok: false, error: 'unavailable' }, 'removed');
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (busy === 'idle') void choose(event.dataTransfer.files[0]);
  };

  const isUploading = busy === 'uploading';
  const errorText = error ? (error.key === 'invalid' && error.message ? error.message : t(`errors.${error.key}`)) : null;

  return (
    <>
      <Button type="button" variant="secondary" size="lg" onClick={open} className={`h-11 whitespace-nowrap ${className}`}>
        {t('open')}
      </Button>

      <Modal isOpen={isOpen} onClose={close} size="md">
        <ModalHeader onClose={close}>
          <ModalTitle>{t('title')}</ModalTitle>
          <ModalDescription id={rulesId}>{t('rules')}</ModalDescription>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4 py-1">
            {/* Drop zone + preview. The input is visually hidden but stays in the tab order; the label shows
                its focus ring (peer-focus-visible). */}
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center gap-4 rounded-xl border-2 border-dashed p-5 text-center transition-colors sm:flex-row sm:text-start ${
                isDragging
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40'
                  : 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              <Avatar src={selected?.previewUrl ?? currentUrl} name={name} size="2xl" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
                <input
                  id={inputId}
                  type="file"
                  accept={AVATAR_ACCEPT}
                  aria-describedby={rulesId}
                  disabled={busy !== 'idle'}
                  className="peer sr-only"
                  onChange={(event) => {
                    void choose(event.target.files?.[0]);
                    event.target.value = ''; // choosing the same file again still fires onChange
                  }}
                />
                <label
                  htmlFor={inputId}
                  className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-500/20 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  {selected ? t('chooseAnother') : t('choose')}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('dropHint')}</p>
                {selected && (
                  <p className="max-w-full truncate text-sm text-slate-700 dark:text-slate-300">
                    <span dir="auto">{selected.file.name}</span> · {formatFileSize(selected.file.size, locale)}
                  </p>
                )}
              </div>
            </div>

            {isUploading && (
              <div className="space-y-1">
                <div
                  role="progressbar"
                  aria-label={t('progressLabel')}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
                >
                  <div className="h-full rounded-full bg-violet-600 transition-[width] dark:bg-violet-400" style={{ width: `${progress}%` }} />
                </div>
                <p aria-live="polite" className="text-xs text-slate-600 dark:text-slate-400">
                  {t('uploading', { percent: progress })}
                </p>
              </div>
            )}

            {errorText && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {errorText}
              </p>
            )}
          </div>
        </ModalContent>
        <ModalFooter>
          {currentUrl && !selected && (
            <Button type="button" variant="danger" onClick={remove} isLoading={busy === 'removing'} disabled={isUploading} className="me-auto">
              {t('remove')}
            </Button>
          )}
          {isUploading ? (
            <Button type="button" variant="secondary" onClick={() => xhrRef.current?.abort()}>
              {t('cancelUpload')}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={close} disabled={busy !== 'idle'}>
              {t('cancel')}
            </Button>
          )}
          <Button type="button" onClick={upload} disabled={!selected || busy === 'removing'} isLoading={isUploading}>
            {t('upload')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};
