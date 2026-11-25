import React from 'react';

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  description?: string;
  icon?: React.ReactNode; // decorative; rendered inside an aria-hidden circle
  action?: React.ReactNode; // usually one secondary Button, e.g. "Clear filters"
}

// "Nothing here" message for lists and grids. Generic on purpose: the feed, the clubs directory and the
// calendar agenda can all use it with their own copy and action.
export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ title, description, icon, action, className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-6 py-16 text-center dark:border-slate-700 ${className}`}
      {...props}
    >
      {icon && (
        <div
          aria-hidden="true"
          className="mb-4 flex size-12 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
        >
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
);

EmptyState.displayName = 'EmptyState';
