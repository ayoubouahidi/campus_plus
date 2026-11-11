'use client';

import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FOCUSABLE_SELECTOR, trapTabKey } from '@/lib/focus';

// Lets <ModalTitle> name the dialog (aria-labelledby) without the caller wiring ids.
const ModalContext = createContext<{ titleId: string } | null>(null);

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
export type ModalPosition = 'center' | 'top';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: ModalSize;
  // 'top' for command palettes: results grow downwards without the box jumping as they change.
  position?: ModalPosition;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  children: React.ReactNode;
  className?: string;
}

const positionStyles: Record<ModalPosition, string> = {
  center: 'items-center',
  top: 'items-start pt-[12vh] sm:pt-[15vh]',
};

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
  position = 'center',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  children,
  className = '',
}: ModalProps) => {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Run on mount (browser only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll and listen for Escape key when modal is open
  useEffect(() => {
    if (!isOpen) return;

    // 1. Save original overflow to restore it later
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 2. Escape key listener
    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEsc && event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // 3. Cleanup function runs when modal closes or unmounts
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOnEsc, onClose]);

  // Focus: move into the dialog on open (first focusable, usually the close button; else the surface),
  // and give it back to whatever opened it (the trigger) on close. Deps are only isOpen/mounted, so a
  // new onClose function on re-render doesn't steal focus back.
  useEffect(() => {
    if (!isOpen || !mounted) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const surface = surfaceRef.current;
    (surface?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? surface)?.focus();
    return () => previous?.focus();
  }, [isOpen, mounted]);

  // Guard: Never render on the server, and don't render if closed
  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex justify-center p-4 sm:p-6 ${positionStyles[position]}`}>
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
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        // Tab / Shift+Tab cycle inside the dialog (shared helper, DOCS.md §3.7).
        onKeyDown={(e) => surfaceRef.current && trapTabKey(e, surfaceRef.current)}
        className={`relative w-full rounded-2xl focus:outline-none border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 ${sizeStyles[size]} ${className}`}
      >
        <ModalContext.Provider value={{ titleId }}>{children}</ModalContext.Provider>
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
        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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

// Gets the dialog's title id from context, so the dialog is announced by its title.
export const ModalTitle = ({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => {
  const context = useContext(ModalContext);
  return (
    <h2
      id={context?.titleId}
      className={`text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100 ${className}`}
      {...props}
    />
  );
};
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