// Email sign-up (Step 11.2, DOCS.md §11.2). Pure helpers shared by the form (browser check), the server
// action (the check that counts) and the dev fallback. Field names = Django's POST /api/signup/ body.

import { EMAIL_PATTERN, type FieldError } from '@/lib/login';

export interface RegisterValues {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirm: string; // ours only: never sent to Django
  year_of_study: string; // a <select> value; sent as a number
  department_id: string;
  // No club field (Mouad's decision, 2026-11-23, DOCS.md §23): Django would make the student a member with no
  // board approval. Clubs are joined through the board, never at sign-up.
}

export type RegisterField = keyof RegisterValues;
export type RegisterFieldErrors = Partial<Record<RegisterField, FieldError>>; // keys of Validation, or Django's text

// What the form gets back after a failed attempt. Passwords are never sent back.
export type RegisterPublicValues = Omit<RegisterValues, 'password' | 'password_confirm'>;

//  - email-taken: an account already uses this email (the form offers "Log in instead");
//  - rejected: Django refused for a reason we can't place on a field;
//  - unavailable: Django didn't answer properly. Not the student's fault.
export type RegisterError = 'email-taken' | 'rejected' | 'unavailable';

export interface RegisterState {
  error: RegisterError | null;
  fieldErrors: RegisterFieldErrors;
  values: RegisterPublicValues;
  // Set when Django accepted the sign-up and emailed a code (Step 28, DOCS.md §28): the form shows the code step
  // for this address. The account only exists once the code is confirmed.
  verifyEmail?: string;
}

export const EMPTY_REGISTER_VALUES: RegisterPublicValues = {
  first_name: '',
  last_name: '',
  email: '',
  year_of_study: '',
  department_id: '',
};

export const REGISTER_INITIAL_STATE: RegisterState = { error: null, fieldErrors: {}, values: EMPTY_REGISTER_VALUES };

// Words: Auth.registerErrors.<error>.title / description (Step 12.6).

// Same limits as Django's SignupSerializer (names ≤ 150, password ≥ 8, year 1–7). 128 = Django's password
// field size, so a longer one would be cut.
export const NAME_MAX_LENGTH = 150;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
// Select values; the labels ("1st year", "1re année", "السنة الأولى") are Auth.yearOption.
export const YEARS = [1, 2, 3, 4, 5, 6, 7] as const;

export const readRegisterForm = (formData: FormData): RegisterValues => {
  const text = (name: RegisterField) => String(formData.get(name) ?? '');
  return {
    first_name: text('first_name').trim(),
    last_name: text('last_name').trim(),
    email: text('email').trim(),
    password: text('password'), // not trimmed: spaces can be part of a password
    password_confirm: text('password_confirm'),
    year_of_study: text('year_of_study'),
    department_id: text('department_id'),
  };
};

// Everything except the two passwords (listed field by field, so a new secret field is never copied by accident).
export const toPublicValues = (values: RegisterValues): RegisterPublicValues => ({
  first_name: values.first_name,
  last_name: values.last_name,
  email: values.email,
  year_of_study: values.year_of_study,
  department_id: values.department_id,
});

// The two password rules of Django's own validators that are cheap to mirror (Step 23.1, DOCS.md §23): not
// only digits (NumericPasswordValidator), and not containing the student's name or the start of their email
// (a simple form of UserAttributeSimilarityValidator). Parts shorter than 3 letters are ignored ("Al" is too
// common to forbid). Django should run its full validators too (TEAM_NEEDS BE19).
const SIMILARITY_MIN = 3;
const isTooSimilar = ({ password, first_name, last_name, email }: RegisterValues): boolean => {
  const lowered = password.toLowerCase();
  const parts = [first_name, last_name, email.split('@')[0] ?? '']
    .flatMap((part) => part.toLowerCase().split(/[\s._+-]+/))
    .filter((part) => part.length >= SIMILARITY_MIN);
  return parts.some((part) => lowered.includes(part));
};

// Messages say what to do. Order = form order, so the first error is the first field to fix.
export const validateRegistration = (values: RegisterValues): RegisterFieldErrors => {
  const errors: RegisterFieldErrors = {};
  const tooLongName = { key: 'nameTooLong', values: { max: NAME_MAX_LENGTH } } as const;
  if (!values.first_name.trim()) errors.first_name = { key: 'firstNameRequired' };
  else if (values.first_name.trim().length > NAME_MAX_LENGTH) errors.first_name = tooLongName;
  if (!values.last_name.trim()) errors.last_name = { key: 'lastNameRequired' };
  else if (values.last_name.trim().length > NAME_MAX_LENGTH) errors.last_name = tooLongName;

  if (!values.email.trim()) errors.email = { key: 'emailRequired' };
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = { key: 'emailInvalid' };

  if (!values.password) errors.password = { key: 'passwordChoose' };
  else if (values.password.length < PASSWORD_MIN_LENGTH) errors.password = { key: 'passwordTooShort', values: { min: PASSWORD_MIN_LENGTH } };
  else if (values.password.length > PASSWORD_MAX_LENGTH) errors.password = { key: 'passwordTooLong', values: { max: PASSWORD_MAX_LENGTH } };
  else if (/^\d+$/.test(values.password)) errors.password = { key: 'passwordAllDigits' };
  else if (isTooSimilar(values)) errors.password = { key: 'passwordTooSimilar' };
  if (!values.password_confirm) errors.password_confirm = { key: 'passwordConfirmRequired' };
  else if (values.password && values.password_confirm !== values.password) errors.password_confirm = { key: 'passwordMismatch' };

  if (!YEARS.some((year) => String(year) === values.year_of_study)) errors.year_of_study = { key: 'yearRequired' };
  if (!values.department_id) errors.department_id = { key: 'schoolRequired' };
  return errors;
};

// The order fields appear in, to focus the first one with an error.
export const REGISTER_FIELD_ORDER: readonly RegisterField[] = [
  'first_name',
  'last_name',
  'email',
  'password',
  'password_confirm',
  'year_of_study',
  'department_id',
];

export const firstErrorField = (errors: RegisterFieldErrors): RegisterField | undefined =>
  REGISTER_FIELD_ORDER.find((field) => errors[field]);

// Django REST Framework 400 body → our field errors. DRF sends { field: ["message", …] } and
// { non_field_errors: [...] }. Django's messages are shown as Django wrote them ({ text }), except an email
// "already exists" message, which becomes the email-taken state with our translated wording.
const DJANGO_FIELDS: readonly RegisterField[] = ['first_name', 'last_name', 'email', 'password', 'year_of_study', 'department_id'];

export const fromDjangoErrors = (body: unknown): { error: RegisterError; fieldErrors: RegisterFieldErrors } => {
  const fieldErrors: RegisterFieldErrors = {};
  if (body && typeof body === 'object') {
    for (const field of DJANGO_FIELDS) {
      const messages = (body as Record<string, unknown>)[field];
      const first = Array.isArray(messages) ? messages[0] : messages;
      if (typeof first === 'string') fieldErrors[field] = { text: first };
    }
  }
  const emailError = fieldErrors.email;
  if (emailError && 'text' in emailError && /already|exist|taken|unique/i.test(emailError.text)) {
    return { error: 'email-taken', fieldErrors: { ...fieldErrors, email: { key: 'emailTaken' } } };
  }
  return { error: 'rejected', fieldErrors };
};

// ---------------------------------------------------------------------------------------------------------------
// Step 28 (DOCS.md §28): the 6-digit code Django emails at sign-up (Ayoub's POST /api/signup/ → 202, then
// POST /api/signup/verify/ { email, code } → 201 { token, member }, POST /api/signup/resend/ { email }).
// Any email address can sign up (Mouad, 2026-11-26: 1337 mailboxes don't receive mail today); the code proves the
// student owns it. Django's numbers: the code lives 10 minutes, 5 wrong tries end it, 1 new code per minute.

export const SIGNUP_CODE_LENGTH = 6;
export const SIGNUP_CODE_MINUTES = 10;
export const RESEND_COOLDOWN_SECONDS = 60;

// What the student typed → the 6 digits, or null. Spaces and dashes are dropped ("123 456" pasted from the email).
export const normalizeSignupCode = (raw: string): string | null => {
  const digits = raw.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(digits) ? digits : null; // SIGNUP_CODE_LENGTH digits
};

export const validateSignupCode = (raw: string): FieldError | undefined => {
  if (!raw.trim()) return { key: 'codeRequired' };
  if (!normalizeSignupCode(raw)) return { key: 'codeInvalid', values: { length: SIGNUP_CODE_LENGTH } };
  return undefined;
};

//  - wrong-code: Django said "invalid or expired" (it doesn't say which, on purpose), or 5 wrong tries;
//  - unavailable: Django didn't answer properly.
export type SignupCodeError = 'wrong-code' | 'unavailable';

export interface SignupCodeState {
  error: SignupCodeError | null;
  fieldError?: FieldError;
}

export const SIGNUP_CODE_INITIAL_STATE: SignupCodeState = { error: null };

// "Send a new code": sent, too soon (Django's 1 per minute), or Django down.
export type ResendResult = 'sent' | 'throttled' | 'unavailable';
