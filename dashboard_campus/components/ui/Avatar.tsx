"use client";

import React, { useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
}

const sizeStyles: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const statusStyles: Record<AvatarStatus, string> = {
  online: 'bg-emerald-500',
  offline: 'bg-slate-400',
  busy: 'bg-rose-500',
  away: 'bg-amber-500',
};

const statusSizeStyles: Record<AvatarSize, string> = {
  xs: 'h-1.5 w-1.5 ring-1',
  sm: 'h-2 w-2 ring-1.5',
  md: 'h-2.5 w-2.5 ring-2',
  lg: 'h-3 w-3 ring-2',
  xl: 'h-3.5 w-3.5 ring-2',
};

function getInitials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}


export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      name,
      size = 'md',
      status,
      className = '',
      ...props
    },
    ref
  ) => {
    const [hasError, setHasError] = useState(false);

    // Derived states
    const initials = getInitials(name);
    const accessibleAlt = alt || name || 'Avatar';
    const showImage = Boolean(src) && !hasError;

    return (
      <div
        ref={ref}
        className={`relative inline-flex shrink-0 select-none ${className}`}
        {...props}
      >
        {/* Avatar Surface */}
        <div
          className={`flex items-center justify-center overflow-hidden rounded-full font-semibold border border-slate-200/80 dark:border-slate-800 ${sizeStyles[size]} ${
            showImage
              ? 'bg-slate-100 dark:bg-slate-800'
              : 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
          }`}
        >
          {showImage ? (
            <img
              src={src!}
              alt={accessibleAlt}
              onError={() => setHasError(true)}
              className="h-full w-full object-cover"
            />
          ) : initials ? (
            <span>{initials}</span>
          ) : (
            /* Fallback generic user icon when neither image nor name exists */
            <svg
              className="h-3/5 w-3/5 text-slate-400 dark:text-slate-500"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>

        {/* Status Indicator Dot */}
        {status && (
          <span
            className={`absolute bottom-0 right-0 rounded-full ring-white dark:ring-slate-900 ${statusStyles[status]} ${statusSizeStyles[size]}`}
            aria-hidden="true"
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

/* ------------------------------- AvatarGroup ------------------------------ */

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number;
  total?: number;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  children,
  max = 4,
  total,
  className = '',
  ...props
}) => {
  const childrenArray = React.Children.toArray(children);
  const visibleChildren = childrenArray.slice(0, max);
  const hiddenCount = (total !== undefined ? total - max : childrenArray.length - max);

  return (
    <div
      className={`flex items-center -space-x-2 overflow-hidden ${className}`}
      {...props}
    >
      {visibleChildren.map((child, index) => (
        <div key={index} className="inline-block ring-2 ring-white dark:ring-slate-950 rounded-full">
          {child}
        </div>
      ))}

      {hiddenCount > 0 && (
        <div className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 ring-2 ring-white dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-950">
          +{hiddenCount}
        </div>
      )}
    </div>
  );
};

AvatarGroup.displayName = 'AvatarGroup';