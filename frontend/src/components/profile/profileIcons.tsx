import React from 'react';

// Icons from the Figma profile design ("ft_transcendence-ui" › Profile ui), same paths, viewBoxes and stroke
// widths. Drawn with currentColor instead of the baked hex so they follow light/dark text colours (the dark
// frame uses lighter tints). Decorative: aria-hidden. Server-safe.
type IconProps = React.SVGProps<SVGSVGElement>;

// box = the design's viewBox/size in px, weight = its stroke width.
const Svg = ({ box, weight, children, className = '', ...props }: IconProps & { box: number; weight: number }) => (
  <svg
    width={box}
    height={box}
    viewBox={`0 0 ${box} ${box}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={weight}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={`shrink-0 ${className}`}
    {...props}
  >
    {children}
  </svg>
);

export const LogoutIcon = (props: IconProps) => (
  <Svg box={18} weight={1.275} {...props}>
    <path d="M6.75 3H3V15H6.75M11.25 12.75L15 9L11.25 5.25M15 9H6" />
  </Svg>
);

export const ChevronIcon = (props: IconProps) => (
  <Svg box={18} weight={1.275} {...props}>
    <path d="M6.75 3.75L12 9L6.75 14.25" />
  </Svg>
);

export const StatCalendarIcon = (props: IconProps) => (
  <Svg box={20} weight={1.41667} {...props}>
    <path d="M4.16667 4.16667H15.8333C16.7538 4.16667 17.5 4.91286 17.5 5.83333V15.8333C17.5 16.7538 16.7538 17.5 15.8333 17.5H4.16667C3.24619 17.5 2.5 16.7538 2.5 15.8333V5.83333C2.5 4.91286 3.24619 4.16667 4.16667 4.16667Z" />
    <path d="M5.83333 2.5V5.83333M14.1667 2.5V5.83333M2.5 9.16667H17.5" />
  </Svg>
);

export const StatCheckIcon = (props: IconProps) => (
  <Svg box={20} weight={1.41667} {...props}>
    <path d="M4.16667 10L7.5 13.3333L15.8333 5" />
  </Svg>
);

export const StatClubIcon = (props: IconProps) => (
  <Svg box={20} weight={1.41667} {...props}>
    <path d="M10 6.66667C10 8.04738 8.88071 9.16667 7.5 9.16667C6.11929 9.16667 5 8.04738 5 6.66667C5 5.28596 6.11929 4.16667 7.5 4.16667C8.88071 4.16667 10 5.28596 10 6.66667Z" />
    <path d="M1.66667 17.5V15C1.66667 13.4529 2.28125 11.9692 3.37521 10.8752C4.46917 9.78125 5.9529 9.16667 7.5 9.16667C9.0471 9.16667 10.5308 9.78125 11.6248 10.8752C12.7188 11.9692 13.3333 13.4529 13.3333 15V17.5M14.1667 4.16667C14.8297 4.16667 15.4656 4.43006 15.9344 4.8989C16.4033 5.36774 16.6667 6.00363 16.6667 6.66667C16.6667 7.32971 16.4033 7.96559 15.9344 8.43443C15.4656 8.90328 14.8297 9.16667 14.1667 9.16667M15.8333 12.5C16.7006 12.9896 17.402 13.7272 17.8474 14.618C18.2928 15.5088 18.462 16.5124 18.3333 17.5" />
  </Svg>
);
