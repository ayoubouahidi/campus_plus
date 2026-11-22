import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { FieldError } from '@/lib/login';

// Turns a field error from lib/login.ts or lib/register.ts into text in the visitor's language (Step 12.6):
// a Validation key is translated (with its numbers), a backend message ({ text }) is shown as written.
export const useFieldError = () => {
  const t = useTranslations('Validation');
  return useCallback(
    (error: FieldError | undefined): string | undefined => {
      if (!error) return undefined;
      return 'text' in error ? error.text : t(error.key, error.values);
    },
    [t]
  );
};
