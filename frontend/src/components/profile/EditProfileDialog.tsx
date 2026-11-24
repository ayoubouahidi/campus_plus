'use client';

import React, { useCallback, useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { updatePhoneAction, type ProfileEditError } from '@/app/profile/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useFieldError } from '@/hooks/useFieldError';
import type { FieldError } from '@/lib/login';
import { formatPhone, normalizePhone } from '@/lib/phone';

// "Edit profile" on /profile (Step 21.2, DOCS.md §21.2). The only field Django lets a student change today is
// the phone number (PATCH /api/me/); name and email come from 42 or the sign-up (TEAM_NEEDS BE18 for names).
//
//  - The trigger is a real button, "Edit number" ("Add number" when none is saved), Mouad's wording; it replaced
//    the disabled "Edit profile · Soon" of the design.
//  - The dialog (Modal: focus trap, Escape, focus back to the button) holds a GET-less form: Enter saves.
//  - Checked in the browser with lib/phone.ts before sending, then again by the server action (both sides).
//  - The error shows under the field once the student has left it or tried to save, not while typing the first
//    digits; it disappears as soon as the value becomes valid.
//  - Saved → toast, dialog closed, router.refresh(): the server re-reads /api/me/ and the profile shows the
//    new number. Other failures stay in the dialog (role="alert"), so nothing typed is lost.

export interface EditProfileDialogProps {
  phone: string; // the saved number ("" if none), as Django returned it
  className?: string;
}

type GeneralError = Exclude<ProfileEditError, 'invalid'>;

export const EditProfileDialog = ({ phone, className = '' }: EditProfileDialogProps) => {
  const t = useTranslations('Profile');
  const fieldErrorText = useFieldError();
  const { showToast } = useToast();
  const router = useRouter();
  const formId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverFieldError, setServerFieldError] = useState<FieldError | undefined>(undefined);
  const [generalError, setGeneralError] = useState<GeneralError | null>(null);
  const [isSaving, startSaving] = useTransition();

  const open = () => {
    // Each opening starts from the saved number, written the readable way.
    setValue(phone ? formatPhone(phone) : '');
    setTouched(false);
    setServerFieldError(undefined);
    setGeneralError(null);
    setIsOpen(true);
  };
  const close = useCallback(() => setIsOpen(false), []);

  const check = normalizePhone(value);
  const fieldError = serverFieldError ?? (touched && !check.ok ? check.error : undefined);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!check.ok) return; // the error shows under the field; nothing is sent
    setGeneralError(null);
    startSaving(async () => {
      let result;
      try {
        result = await updatePhoneAction(check.value);
      } catch {
        result = { ok: false as const, error: 'unavailable' as const };
      }
      if (result.ok) {
        const kind = result.phone ? 'saved' : 'removed';
        showToast({ title: t(`${kind}.title`), description: t(`${kind}.description`), variant: 'success' });
        setIsOpen(false);
        router.refresh(); // /profile re-reads /api/me/ on the server
        return;
      }
      if (result.error === 'invalid') setServerFieldError(result.fieldError ?? { key: 'phoneInvalid' });
      else setGeneralError(result.error);
    });
  };

  return (
    <>
      <Button type="button" variant="secondary" size="lg" onClick={open} className={`h-11 whitespace-nowrap ${className}`}>
        {phone ? t('editNumber') : t('addNumber')}
      </Button>

      <Modal isOpen={isOpen} onClose={close} size="md">
        <ModalHeader onClose={close}>
          <ModalTitle>{t('editTitle')}</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4 py-1">
            <Input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              // Numbers read left to right in every language, Arabic included.
              dir="ltr"
              label={t('phone')}
              placeholder={t('phonePlaceholder')}
              helperText={fieldError ? undefined : t('phoneHelp')}
              error={fieldErrorText(fieldError)}
              value={value}
              maxLength={20}
              onChange={(event) => {
                setValue(event.target.value);
                setServerFieldError(undefined);
              }}
              onBlur={() => setTouched(true)}
            />
            {generalError && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {t(`editErrors.${generalError}`)}
              </p>
            )}
          </form>
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={close} disabled={isSaving}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} isLoading={isSaving}>
            {t('save')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};
