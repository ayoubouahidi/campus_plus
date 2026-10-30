import React from 'react';
import { NavIconName } from '@/types/navigation';

export type NavIconProps = React.SVGProps<SVGSVGElement>;

// Shared stroke geometry so every nav icon has the same weight and optical size.
// Exported so other shell icons (e.g. notification kinds) match it.
export const IconBase = ({ children, className = 'h-5 w-5', ...props }: NavIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={className}
    {...props}
  >
    {children}
  </svg>
);

// Exhaustive: adding a NavIconName without an icon here is a compile error.
export const NAV_ICONS: Record<NavIconName, (props: NavIconProps) => React.JSX.Element> = {
  discover: (props) => (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2z" />
    </IconBase>
  ),
  calendar: (props) => (
    <IconBase {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </IconBase>
  ),
  clubs: (props) => (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.1.7 3.5 2.8 3.5 5.7" />
    </IconBase>
  ),
  profile: (props) => (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </IconBase>
  ),
};

// Action icons, not routes, so they stay out of NAV_ICONS.
export const SearchIcon = (props: NavIconProps) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </IconBase>
);

export const BellIcon = (props: NavIconProps) => (
  <IconBase {...props}>
    <path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6.5 2.5 7.5h-17C4.5 15.5 6 13.5 6 9z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </IconBase>
);

export const MenuIcon = (props: NavIconProps) => (
  <IconBase {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </IconBase>
);

export const CloseIcon = (props: NavIconProps) => (
  <IconBase {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </IconBase>
);

// Marks links that open another site in a new tab
export const ExternalIcon = (props: NavIconProps) => (
  <IconBase {...props}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </IconBase>
);

export const CheckIcon = (props: NavIconProps) => (
  <IconBase {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </IconBase>
);

export const MapPinIcon = (props: NavIconProps) => (
  <IconBase {...props}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </IconBase>
);
