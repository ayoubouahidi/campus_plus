import React, { useId } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder,
      children,
      className = '',
      id,
      disabled,
      defaultValue,
      value,
      ...props
    },
    ref
  ) => {
    const reactId = useId();
    const selectId = id || reactId;
    const helperId = `${selectId}-helper`;
    const errorId = `${selectId}-error`;

    const hasError = Boolean(error);

    return (
      <div className="w-full space-y-1.5 text-left">
        {/* Label */}
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        {/* Select & Custom Chevron Wrapper */}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            value={value}
            defaultValue={defaultValue}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? errorId : helperText ? helperId : undefined
            }
            className={`w-full appearance-none rounded-lg border bg-white px-3.5 py-2 pr-10 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 ${
              hasError
                ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500 dark:focus:ring-rose-500/20'
                : 'border-slate-300 focus:border-violet-600 focus:ring-violet-500/20 dark:border-slate-700 dark:focus:border-violet-500'
            } ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}

            {/* Support both structured options prop and raw <option> children */}
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          {/* Styled Trailing Chevron Icon */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 dark:text-slate-500">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* Error or Helper Text */}
        {hasError ? (
          <p id={errorId} className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-slate-500 dark:text-slate-400">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';