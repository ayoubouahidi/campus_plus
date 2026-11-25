import type { Locale } from './config';
import type { Messages } from './messages/en';

// next-intl type safety (Step 12.1): t('Some.key') only compiles if the key exists in the English messages,
// and the locale is one of ours.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
