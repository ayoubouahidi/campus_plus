import React from 'react';
import Image from 'next/image';

/* ---------------------------------- Card ---------------------------------- */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted' | 'outline';
  isHoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      isHoverable = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      default:
        'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm',
      muted:
        'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/80',
      outline:
        'bg-transparent border-slate-300 dark:border-slate-700 border-dashed',
    };

    // "group" class enables child elements (like the banner image) to zoom on card hover
    const hoverStyles = isHoverable
      ? 'group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-violet-300 dark:hover:border-violet-700/60 cursor-pointer motion-reduce:transition-none motion-reduce:hover:translate-y-0'
      : '';

    return (
      <div
        ref={ref}
        className={`overflow-hidden rounded-xl border text-slate-900 dark:text-slate-100 ${variantStyles[variant]} ${hoverStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

/* ------------------------------- CardBanner ------------------------------- */

export interface CardBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string; // '' (decorative) by default: the card title usually sits right below the image
  sizes?: string; // next/image `sizes`: how wide the banner renders, so the browser picks a small enough file
  aspectRatio?: 'video' | 'wide' | 'square';
  overlay?: React.ReactNode;
  fallback?: React.ReactNode; // replaces the default placeholder when there is no src
}

export const CardBanner = React.forwardRef<HTMLDivElement, CardBannerProps>(
  (
    {
      src,
      alt = '',
      sizes = '100vw',
      aspectRatio = 'video',
      overlay,
      fallback,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const aspectStyles = {
      video: 'aspect-video', // 16:9 standard event flyer
      wide: 'aspect-[21/9]',  // Wide banner
      square: 'aspect-square',
    };

    return (
      <div
        ref={ref}
        className={`relative w-full overflow-hidden bg-slate-100 dark:bg-slate-800 ${aspectStyles[aspectRatio]} ${className}`}
        {...props}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : fallback ? (
          fallback
        ) : (
          /* Subtle geometric fallback when an event doesn't have an image uploaded */
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500/10 via-slate-100 to-slate-200 dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-800">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Campus Hub Event
            </span>
          </div>
        )}

        {/* Optional overlay layer for floating status/category badges */}
        {overlay && (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-between bg-gradient-to-b from-black/50 via-transparent to-transparent p-3">
            <div className="pointer-events-auto flex w-full items-center justify-between">
              {overlay}
            </div>
          </div>
        )}

        {children}
      </div>
    );
  }
);
CardBanner.displayName = 'CardBanner';

/* ------------------------------- CardHeader ------------------------------- */

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = '', ...props }, ref) => (
  <div
    ref={ref}
    className={`flex flex-col space-y-1.5 p-5 pb-3 ${className}`}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

/* -------------------------------- CardTitle -------------------------------- */

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as: Component = 'h3', className = '', ...props }, ref) => (
    <Component
      ref={ref}
      className={`text-base font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100 ${className}`}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

/* ----------------------------- CardDescription ----------------------------- */

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = '', ...props }, ref) => (
  <p
    ref={ref}
    className={`text-xs text-slate-500 dark:text-slate-400 ${className}`}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

/* ------------------------------- CardContent ------------------------------ */

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`p-5 pt-0 text-sm ${className}`} {...props} />
));
CardContent.displayName = 'CardContent';

/* ------------------------------- CardFooter ------------------------------- */

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = '', ...props }, ref) => (
  <div
    ref={ref}
    className={`mt-4 flex items-center justify-between border-t border-slate-100 p-5 pt-4 dark:border-slate-800/60 ${className}`}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';