'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: ModalSize;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  children: React.ReactNode;
  className?: string;
  /** id of the element that names the dialog (usually its ModalTitle). */
  labelledBy?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export const Modal = ({
  isOpen,
  onClose,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  children,
  className = '',
  labelledBy,
}: ModalProps) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Lock body scroll and listen for Escape key when modal is open
  useEffect(() => {
    if (!isOpen) return;

    // 1. Save original overflow to restore it later
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 2. Focus: move into the dialog (first field, else first control) and back afterwards
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      const surface = surfaceRef.current;
      const target =
        surface?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])') ??
        surface?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }, 0);

    // 3. Escape closes; Tab stays inside the dialog
    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEsc && event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !surfaceRef.current) return;
      const focusable = Array.from(surfaceRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // 3. Cleanup function runs when modal closes or unmounts
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, closeOnEsc, onClose]);

  // Guard: Never render on the server, and don't render if closed
  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* 1. Dimmed Backdrop Scrim */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (closeOnOverlayClick) onClose();
        }}
        aria-hidden="true"
      />

      {/* 2. Modal Dialog Surface */}
      <div
        ref={surfaceRef}
        onClick={(e) => e.stopPropagation()}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 ${sizeStyles[size]} ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

Modal.displayName = 'Modal';

/* ------------------------------- ModalHeader ------------------------------ */

export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export const ModalHeader = ({
  children,
  onClose,
  className = '',
  ...props
}: ModalHeaderProps) => (
  <div
    className={`flex items-start justify-between gap-4 pb-4 ${className}`}
    {...props}
  >
    <div className="space-y-1">{children}</div>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    )}
  </div>
);
ModalHeader.displayName = 'ModalHeader';

/* -------------------------------- ModalTitle ------------------------------- */

export const ModalTitle = ({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={`text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100 ${className}`}
    {...props}
  />
);
ModalTitle.displayName = 'ModalTitle';

/* ----------------------------- ModalDescription ---------------------------- */

export const ModalDescription = ({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className={`text-xs text-slate-500 dark:text-slate-400 ${className}`}
    {...props}
  />
);
ModalDescription.displayName = 'ModalDescription';

/* ------------------------------- ModalContent ------------------------------ */

export const ModalContent = ({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`max-h-[65vh] overflow-y-auto py-2 text-sm text-slate-600 dark:text-slate-300 ${className}`}
    {...props}
  />
);
ModalContent.displayName = 'ModalContent';

/* ------------------------------- ModalFooter ------------------------------- */

export const ModalFooter = ({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`mt-4 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 ${className}`}
    {...props}
  />
);
ModalFooter.displayName = 'ModalFooter';