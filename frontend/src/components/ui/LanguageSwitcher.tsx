'use client';

import React, { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { setLocale } from '@/i18n/actions';
import { LOCALES, LOCALE_INFO, type Locale } from '@/i18n/config';
import { CheckIcon, GlobeIcon } from '@/components/ui/layout/navIcons';

/* --------------------------------- Types ---------------------------------- */

//  - compact: globe + "EN" (navbar, where room is short);
//  - full: globe + "English" (footer, profile settings).
export type LanguageSwitcherVariant = 'compact' | 'full';

export interface LanguageSwitcherProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: LanguageSwitcherVariant;
}

const triggerStyles: Record<LanguageSwitcherVariant, string> = {
  compact: 'h-9 px-2.5',
  full: 'h-10 px-3',
};

/* ---------------------------- LanguageSwitcher ---------------------------- */

// Language switcher (Step 12.1, DOCS.md §12.1). WAI-ARIA "menu button": a button that opens a menu of
// menuitemradio items (one is checked). Choosing saves the NEXT_LOCALE cookie with a Server Action; Next.js
// re-renders the page in the new language in the same round trip (Arabic also flips <html dir> to rtl).
// Keys: Enter / Space / ↓ open on the current language, ↑ on the last; in the menu ↑ ↓ Home End move,
// Enter / Space choose, Esc closes (focus back on the button), Tab closes.
export const LanguageSwitcher = React.forwardRef<HTMLDivElement, LanguageSwitcherProps>(
  ({ variant = 'compact', className = '', ...props }, ref) => {
    const t = useTranslations('LanguageSwitcher');
    const locale = useLocale();
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const menuId = useId();
    const rootRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<Partial<Record<Locale, HTMLButtonElement | null>>>({});

    const setRefs = (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    const focusItem = (index: number) => {
      const target = LOCALES[(index + LOCALES.length) % LOCALES.length];
      itemRefs.current[target]?.focus();
    };

    const open = (focusIndex: number) => {
      setIsOpen(true);
      // The menu renders on this click; focus it on the next frame.
      requestAnimationFrame(() => focusItem(focusIndex));
    };

    const close = (returnFocus: boolean) => {
      setIsOpen(false);
      if (returnFocus) buttonRef.current?.focus();
    };

    // A click anywhere else closes the menu.
    useEffect(() => {
      if (!isOpen) return;
      const handlePointerDown = (event: PointerEvent) => {
        if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
      };
      document.addEventListener('pointerdown', handlePointerDown);
      return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isOpen]);

    const choose = (next: Locale) => {
      close(true);
      if (next === locale) return;
      startTransition(async () => {
        await setLocale(next);
      });
    };

    const currentIndex = LOCALES.indexOf(locale);

    const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(currentIndex);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        open(LOCALES.length - 1);
      }
    };

    const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      const focused = LOCALES.findIndex((code) => itemRefs.current[code] === document.activeElement);
      const moves: Partial<Record<string, () => void>> = {
        ArrowDown: () => focusItem(focused + 1),
        ArrowUp: () => focusItem(focused - 1),
        Home: () => focusItem(0),
        End: () => focusItem(LOCALES.length - 1),
        Escape: () => close(true),
      };
      if (event.key === 'Tab') {
        setIsOpen(false); // let the browser move focus on
        return;
      }
      const move = moves[event.key];
      if (move) {
        event.preventDefault();
        move();
      }
    };

    const info = LOCALE_INFO[locale];

    return (
      <div ref={setRefs} className={`relative ${className}`} {...props}>
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? menuId : undefined}
          aria-label={t('current', { language: info.name })}
          aria-busy={isPending}
          onClick={() => (isOpen ? close(false) : open(currentIndex))}
          onKeyDown={handleButtonKeyDown}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white text-sm font-medium text-slate-600 transition-colors duration-150 hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white ${triggerStyles[variant]} ${isPending ? 'opacity-60' : ''}`}
        >
          <GlobeIcon className={`h-4 w-4 shrink-0 ${isPending ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          <span aria-hidden="true">{variant === 'compact' ? info.short : info.name}</span>
        </button>

        {isOpen && (
          <div
            id={menuId}
            role="menu"
            aria-label={t('label')}
            onKeyDown={handleMenuKeyDown}
            // end-0: under the button's end edge, the right in English, the left in Arabic.
            className="absolute end-0 top-full z-50 mt-2 min-w-44 animate-fade-in rounded-xl border border-slate-200/80 bg-white p-1 shadow-lg motion-reduce:animate-none dark:border-slate-800 dark:bg-slate-900"
          >
            {LOCALES.map((code) => {
              const isCurrent = code === locale;
              return (
                <button
                  key={code}
                  ref={(node) => {
                    itemRefs.current[code] = node;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  tabIndex={-1} // roving: arrows move focus, Tab leaves the menu
                  // Each name in its own language, so screen readers pronounce it right. No dir here: the menu
                  // keeps the page's direction; the browser lays out Arabic letters right to left by itself.
                  lang={code}
                  onClick={() => choose(code)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors duration-150 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800 ${isCurrent ? 'font-semibold text-violet-700 dark:text-violet-400' : 'text-slate-700 dark:text-slate-200'}`}
                >
                  {LOCALE_INFO[code].name}
                  {isCurrent && <CheckIcon className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

LanguageSwitcher.displayName = 'LanguageSwitcher';
