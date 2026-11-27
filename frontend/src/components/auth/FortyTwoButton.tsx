'use client';

import React from 'react';
import Image from 'next/image';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Button, type ButtonProps } from '@/components/ui/Button';

// The official 42 logo (black, transparent background; inverted to white in dark mode). Decorative: the
// button's text already says "42". Same file and size as the organizer dashboard's button.
const FortyTwoMark = () => (
  <Image src="/42-logo.png" alt="" width={24} height={17} className="h-[17px] w-6 dark:invert" />
);

export type FortyTwoButtonProps = Omit<ButtonProps, 'type' | 'isLoading' | 'leftIcon' | 'children'>;

// Submit button for the login <form>. useFormStatus() reads the *parent* form's pending state, so the
// spinner shows while the server action runs (and until the browser leaves for 42), with no useState here.
// Must be rendered inside a <form>; outside one, `pending` is always false.
export const FortyTwoButton = React.forwardRef<HTMLButtonElement, FortyTwoButtonProps>(
  ({ variant = 'secondary', size = 'md', className = '', ...props }, ref) => {
    const { pending } = useFormStatus();
    const t = useTranslations('Auth');

    return (
      <Button
        ref={ref}
        type="submit"
        variant={variant}
        size={size}
        isLoading={pending}
        leftIcon={<FortyTwoMark />}
        className={`w-full ${className}`}
        {...props}
      >
        {t(pending ? 'fortyTwoPending' : 'fortyTwo')}
      </Button>
    );
  }
);

FortyTwoButton.displayName = 'FortyTwoButton';
