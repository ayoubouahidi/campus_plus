import React from "react";
import { EventCategory } from "@/types/api";

export type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral';
export type BadgeVariant = StatusVariant | EventCategory;

export interface BadgeProps extends React.HtmlHTMLAttributes<HTMLSpanElement>{
    variant?: BadgeVariant;
    isActive?: boolean;
    isClickable?: boolean;
    hasDot?: boolean;
}

const categoryStyles: Record<EventCategory, string> = {
  Tech: 'bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-500/30',
  Media: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
  Music: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  Sports: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
  Business: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  Gaming: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/30',
  EventsOrganization: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
};

const statusStyles: Record<StatusVariant, { badge: string; dot: string }> = {
  success: {
    badge:
      'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  warning: {
    badge:
      'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  danger: {
    badge:
      'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  neutral: {
    badge:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
};

export const Badge = ({
  children,
  variant = 'neutral',
  isActive = false,
  isClickable = false,
  hasDot = false,
  className = '',
  ...props
}: BadgeProps) => {
  let styleClasses = '';
  let dotColor = '';

  if (variant in categoryStyles) {
    styleClasses = categoryStyles[variant as EventCategory];
  } else if (variant in statusStyles) {
    const config = statusStyles[variant as StatusVariant];
    styleClasses = config.badge;
    dotColor = config.dot;
  }
  const interactiveClasses = isClickable
    ? isActive
      ? 'bg-violet-600 text-white border-violet-600 dark:bg-violet-600 dark:text-white shadow-sm'
      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
    : '';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors select-none ${
        isClickable ? interactiveClasses : styleClasses
      } ${className}`}
      {...props}
    >
      {hasDot && dotColor && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
      )}
      <span>{children}</span>
    </span>
  );
};

Badge.displayName = 'Badge';