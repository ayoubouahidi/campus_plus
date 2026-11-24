import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FortyTwoButton } from '@/components/auth/FortyTwoButton';
import { LoginDivider } from '@/components/auth/LoginPanel';
import { loginHref } from '@/lib/login';

export interface RegisterPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  next: string; // already cleaned with safeNextPath(), carried to the login link and the 42 sign-in
  // Server action that starts the 42 sign-in (app/auth/login/actions.ts signInWith42). A first 42 login
  // creates the account, so 42 is a way to sign up too.
  fortyTwoAction: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode; // <RegisterForm>
}

const linkStyles =
  'rounded font-medium text-violet-700 underline underline-offset-2 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-400 dark:hover:text-violet-300';

// Links inside a sentence: t.rich puts each <tag>…</tag> of a message into one of these, so the word order
// (and where the link sits) stays the translator's choice (Step 12.6).
const inlineLink = (href: string) => {
  const InlineLink = (chunks: React.ReactNode) => (
    <Link href={href} className={linkStyles}>
      {chunks}
    </Link>
  );
  return InlineLink;
};

// The form column of /auth/register (goes in <LoginLayout>, like LoginPanel): heading, the two ways to sign
// up (DOCS.md §24), and the way back to login:
//  1. "Continue with 42 Intra": optional (it needs the 42 app keys); nothing to fill in, 42 creates the account;
//  2. "or sign up with email": the form, 1337 student email only, confirmed with a code sent by email (SMTP).
// Server Component.
export const RegisterPanel = React.forwardRef<HTMLDivElement, RegisterPanelProps>(
  ({ next, fortyTwoAction, children, className = '', ...props }, ref) => {
    const t = useTranslations('Auth');
    return (
      <div ref={ref} className={className} {...props}>
        <h1 className="text-[1.75rem] font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('registerTitle')}</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {t('registerIntro')}
        </p>

        <form action={fortyTwoAction} className="mt-7">
          <input type="hidden" name="redirectTo" value={next} />
          <FortyTwoButton />
        </form>

        <LoginDivider label={t('orSignUpEmail')} />

        {children}

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          {t('haveAccount')}{' '}
          <Link href={loginHref(next)} className={linkStyles}>
            {t('logIn')}
          </Link>
        </p>
        <p className="mt-3 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {t.rich('accept', { terms: inlineLink('/terms'), privacy: inlineLink('/privacy') })}
        </p>
      </div>
    );
  }
);

RegisterPanel.displayName = 'RegisterPanel';
