'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

/* --------------------------------- Types ---------------------------------- */

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // duration in milliseconds before auto-dismiss
}

export type ToastOptions = Omit<Toast, 'id'>;

export interface ToastContextValue {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

/* ------------------------------- Context ---------------------------------- */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error(
      'useToast() must be used within a <ToastProvider>. Wrap your layout or component tree in <ToastProvider>.'
    );
  }
  return context;
}

/* ------------------------------ Provider ---------------------------------- */

export interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    // Generate a unique ID using timestamp and random salt
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast: Toast = {
      id,
      duration: 4000, // default 4s auto-dismiss
      ...options,
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      {/* Floating Toast Viewport Container */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/* ----------------------------- ToastItem ---------------------------------- */

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const toastVariantConfig: Record<
  ToastVariant,
  { container: string; icon: React.ReactNode }
> = {
  success: {
    container:
      'border-emerald-500/30 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400',
    icon: (
      <svg className="h-5 w-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  danger: {
    container:
      'border-rose-500/30 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400',
    icon: (
      <svg className="h-5 w-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  warning: {
    container:
      'border-amber-500/30 bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400',
    icon: (
      <svg className="h-5 w-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  info: {
    container:
      'border-violet-500/30 bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400',
    icon: (
      <svg className="h-5 w-5 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export const ToastItem = ({ toast, onDismiss }: ToastItemProps) => {
  const { title, description, variant = 'info', duration = 4000 } = toast;
  const config = toastVariantConfig[variant];

  // Auto-dismiss countdown timer with unmount cleanup
  React.useEffect(() => {
    if (!duration || duration === Infinity) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-4 shadow-lg shadow-slate-950/5 transition-all dark:shadow-slate-950/40 ${config.container}`}
    >
      <div className="pt-0.5">{config.icon}</div>

      <div className="flex-1 space-y-1 text-left">
        <h4 className="text-sm font-semibold leading-none text-slate-900 dark:text-slate-100">
          {title}
        </h4>
        {description && (
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

ToastItem.displayName = 'ToastItem';

