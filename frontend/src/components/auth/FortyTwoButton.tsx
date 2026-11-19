'use client';

import React from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/Button';

// The 42 mark, drawn as a small dark tile (same look as the organizer dashboard's button).
const FortyTwoMark = () => (
  <span
    aria-hidden="true"
    className="grid h-[22px] w-[22px] place-items-center rounded-md bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900"
  >
    42
  </span>
);

export type FortyTwoButtonProps = Omit<ButtonProps, 'type' | 'isLoading' | 'leftIcon' | 'children'>;

// Submit button for the login <form>. useFormStatus() reads the *parent* form's pending state, so the
// spinner shows while the server action runs (and until the browser leaves for 42), with no useState here.
// Must be rendered inside a <form>; outside one, `pending` is always false.
export const FortyTwoButton = React.forwardRef<HTMLButtonElement, FortyTwoButtonProps>(
  ({ variant = 'secondary', size = 'md', className = '', ...props }, ref) => {
    const { pending } = useFormStatus();

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
        {pending ? 'Opening 42 Intra…' : 'Continue with 42 Intra'}
      </Button>
    );
  }
);

FortyTwoButton.displayName = 'FortyTwoButton';
