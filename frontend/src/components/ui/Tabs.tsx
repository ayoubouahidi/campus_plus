'use client';

import React, { createContext, useContext, useState, useId } from 'react';

/* ------------------------------- Context ---------------------------------- */

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(
      'Tabs compound subcomponents (TabsList, TabsTrigger, TabsContent) must be wrapped inside a <Tabs> container.'
    );
  }
  return context;
}

/* --------------------------------- Types ---------------------------------- */

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'segmented' | 'underline';
}

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

/* ---------------------------------- Tabs ---------------------------------- */

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      defaultValue = '',
      value: controlledValue,
      onValueChange,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const isControlled = controlledValue !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
    const baseId = useId();

    // 1. Resolve current active tab source of truth
    const activeTab = isControlled ? controlledValue : uncontrolledValue;

    // 2. Dispatch state updates safely for both patterns
    const setActiveTab = (newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    };

    return (
      <TabsContext.Provider value={{ activeTab, setActiveTab, baseId }}>
        <div ref={ref} className={`w-full space-y-4 ${className}`} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);

Tabs.displayName = 'Tabs';

/* -------------------------------- TabsList -------------------------------- */

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, variant = 'segmented', className = '', ...props }, ref) => {
    const variantStyles = {
      segmented:
        'inline-flex items-center rounded-xl bg-slate-100 p-1 text-slate-500 dark:bg-slate-900 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800',
      underline:
        'inline-flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 w-full',
    };

    return (
      <div
        ref={ref}
        role="tablist"
        className={`${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsList.displayName = 'TabsList';

/* ------------------------------- TabsTrigger ------------------------------ */

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  (
    {
      value,
      disabled = false,
      children,
      className = '',
      onClick,
      ...props
    },
    ref
  ) => {
    const { activeTab, setActiveTab, baseId } = useTabsContext();
    const isActive = activeTab === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`${baseId}-panel-${value}`}
        id={`${baseId}-trigger-${value}`}
        tabIndex={isActive ? 0 : -1}
        disabled={disabled}
        onClick={(e) => {
          setActiveTab(value);
          onClick?.(e);
        }}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:pointer-events-none disabled:opacity-40 ${
          isActive
            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
        } ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TabsTrigger.displayName = 'TabsTrigger';

/* ------------------------------- TabsContent ------------------------------ */

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, children, className = '', ...props }, ref) => {
    const { activeTab, baseId } = useTabsContext();
    const isActive = activeTab === value;

    if (!isActive) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${baseId}-panel-${value}`}
        aria-labelledby={`${baseId}-trigger-${value}`}
        tabIndex={0}
        className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 rounded-lg ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsContent.displayName = 'TabsContent';