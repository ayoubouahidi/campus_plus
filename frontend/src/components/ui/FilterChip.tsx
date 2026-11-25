import React from 'react';

export interface FilterChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  isSelected: boolean;
  // Optional colour dot (e.g. a category colour such as 'bg-lime-500'). Decorative: the label carries the meaning.
  dotClassName?: string;
}

const selectionStyles: Record<'selected' | 'idle', string> = {
  selected: 'bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600',
  idle: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
};

// A toggle button styled as a pill. Unlike `Badge isClickable` (a <span>), it is focusable, works with
// Enter/Space, and announces its state through aria-pressed ("Tech, toggle button, pressed").
export const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ isSelected, dotClassName, children, className = '', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={isSelected}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 motion-reduce:transition-none dark:focus-visible:ring-offset-slate-950 ${
        selectionStyles[isSelected ? 'selected' : 'idle']
      } ${className}`}
      {...props}
    >
      {dotClassName && (
        // On the violet "selected" fill a coloured dot can disappear (Media is violet too), so it turns white.
        <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : dotClassName}`} aria-hidden="true" />
      )}
      {children}
    </button>
  )
);

FilterChip.displayName = 'FilterChip';
