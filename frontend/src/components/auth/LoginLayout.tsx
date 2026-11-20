import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export interface LoginLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode; // the form column, usually <LoginPanel>
}

// Full-screen split login layout, same design as the organizer dashboard's login (Ayoub,
// dashboard_campus/app/login): campus photo on the left from lg (1024px), form column on the right.
// Below lg: form only. The app shell hides itself on these routes (isFullScreenRoute in lib/navigation.ts),
// so the "← Campus Hub" link at the top is the way back to the site. Server Component.
export const LoginLayout = React.forwardRef<HTMLDivElement, LoginLayoutProps>(
  ({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={`grid min-h-dvh grid-cols-1 lg:grid-cols-2 ${className}`} {...props}>
      {/* Decorative: the form column carries all the meaning, so alt="" keeps screen readers on the form */}
      <div className="relative hidden lg:block">
        <Image src="/UM6P_Campus.webp" alt="" fill priority sizes="50vw" className="object-cover" />
      </div>

      <div className="flex flex-col bg-white px-6 py-6 dark:bg-slate-950">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-semibold text-slate-700 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-slate-300 dark:hover:text-violet-400"
        >
          <span aria-hidden="true">←</span>
          <Logo decorative className="h-8" />
          <span className="sr-only">Back to Campus Hub</span>
        </Link>

        {/* Centered in the space left under the back link */}
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[22rem]">{children}</div>
        </div>
      </div>
    </div>
  )
);

LoginLayout.displayName = 'LoginLayout';
