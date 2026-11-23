'use client';

import React, { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Club, EventItem } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ModalTitle } from '@/components/ui/Modal';
import { NAV_ICONS, SearchIcon } from '@/components/ui/layout/navIcons';
import { useCampusSearch } from '@/hooks/useCampusSearch';
import { DEFAULT_SEARCH, buildSearchHref } from '@/lib/advancedSearch';

/* --------------------------------- Types ---------------------------------- */

export interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// One flat list of everything the arrow keys can reach, in display order.
type PaletteOption =
  | { kind: 'event'; key: string; href: string; event: EventItem }
  | { kind: 'club'; key: string; href: string; club: Club }
  // "See all results" → the /search page (Step 18.2, DOCS.md §18.2), always last.
  | { kind: 'all'; key: string; href: string };

// What the result groups hold: events and clubs, never "See all".
type ResultOption = Exclude<PaletteOption, { kind: 'all' }>;

interface PaletteGroup {
  id: string;
  label: string;
  options: ResultOption[];
}

const CalendarIcon = NAV_ICONS.calendar;

const toEventOption = (event: EventItem): ResultOption => ({
  kind: 'event',
  key: `event-${event.id}`,
  href: `/events/${event.id}`,
  event,
});

const toClubOption = (club: Club): ResultOption => ({ kind: 'club', key: `club-${club.id}`, href: `/clubs/${club.slug}`, club });

/* ------------------------------ SearchPalette ----------------------------- */

// ⌘K palette (WAI-ARIA combobox with a listbox popup). Focus stays in the input; ↑ / ↓ move the active
// option (aria-activedescendant), Enter opens it, Escape closes (Modal). Results come from useCampusSearch.
export const SearchPalette = ({ isOpen, onClose }: SearchPaletteProps) => {
  const router = useRouter();
  const t = useTranslations('Search');
  const tCategory = useTranslations('Categories');
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const { results, suggestions, status } = useCampusSearch(query);

  const hasQuery = query.trim().length > 0;
  const groups: PaletteGroup[] = hasQuery
    ? [
        { id: `${baseId}-events`, label: t('events'), options: results.events.map(toEventOption) },
        { id: `${baseId}-clubs`, label: t('clubs'), options: results.clubs.map(toClubOption) },
      ].filter((group) => group.options.length > 0)
    : [{ id: `${baseId}-upcoming`, label: t('comingUp'), options: suggestions.map(toEventOption) }];
  // The palette is the site's one search box; /search is its full results page (filters, sorting, pages). With
  // words typed, the last option opens it with those words and "Any time", since the palette lists past events
  // too. Enter reaches it directly when nothing matched (it is then the only option).
  const seeAll: PaletteOption | null = hasQuery
    ? { kind: 'all', key: 'all', href: buildSearchHref({ ...DEFAULT_SEARCH, q: query.trim().slice(0, 200), when: 'all' }) }
    : null;
  const resultCount = groups.reduce((sum, group) => sum + group.options.length, 0);
  const options = [...groups.flatMap((group) => group.options), ...(seeAll ? [seeAll] : [])];
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const active = Math.min(activeIndex, Math.max(options.length - 1, 0));

  // Keep the active option visible while arrowing through a scrolled list.
  useEffect(() => {
    document.getElementById(`${baseId}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, baseId]);

  // Reopening starts empty.
  const close = () => {
    setQuery('');
    setActiveIndex(0);
    onClose();
  };

  const open = (option: PaletteOption | undefined) => {
    if (!option) return;
    close();
    router.push(option.href);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (options.length === 0) return;
    const moves: Partial<Record<string, () => number>> = {
      ArrowDown: () => (active + 1) % options.length,
      ArrowUp: () => (active - 1 + options.length) % options.length,
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault(); // keep the caret where it is
      setActiveIndex(move());
    } else if (event.key === 'Enter') {
      event.preventDefault();
      open(options[active]);
    }
  };

  let flatIndex = -1; // running index across groups, for option ids and the active state

  return (
    <Modal isOpen={isOpen} onClose={close} size="lg" position="top" className="overflow-hidden p-0!">
      <ModalTitle className="sr-only">{t('title')}</ModalTitle>

      <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 dark:border-slate-800">
        <SearchIcon className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          type="text"
          role="combobox"
          aria-label={t('title')}
          aria-expanded={options.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={options.length > 0 ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={t('placeholder')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0); // new query → start from the top
          }}
          onKeyDown={handleKeyDown}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
        />
        <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 sm:inline dark:border-slate-700 dark:text-slate-400">
          Esc
        </kbd>
      </div>

      {/* Announces the result count while typing (the listbox itself isn't a live region). */}
      <p aria-live="polite" className="sr-only">
        {hasQuery ? t('count', { count: resultCount }) : ''}
      </p>

      <div id={listboxId} role="listbox" aria-label={t('results')} className="max-h-[60vh] overflow-y-auto p-2">
        {/* While the data loads (first open) or if it couldn't load, say so instead of "no match". */}
        {status !== 'ready' && (
          <p role="status" className="px-3 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {t(status === 'loading' ? 'loading' : 'unavailable')}
          </p>
        )}
        {status === 'ready' && hasQuery && resultCount === 0 && (
          <p className="px-3 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('noMatch', { query: query.trim() })}
          </p>
        )}

        {groups.map((group) => (
          <div key={group.id} role="group" aria-labelledby={group.id} className="py-1">
            <p
              id={group.id}
              className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
            >
              {group.label}
            </p>
            {group.options.map((option) => {
              flatIndex += 1;
              const index = flatIndex;
              const isActive = index === active;
              return (
                <div
                  key={option.key}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isActive}
                  // Mouse: hover follows the keyboard's active option, click opens it. mousedown is
                  // prevented so focus stays in the input.
                  onMouseMove={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => open(option)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${
                    isActive ? 'bg-violet-50 dark:bg-violet-500/10' : ''
                  }`}
                >
                  {option.kind === 'event' ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {option.event.title}
                        </span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {option.event.club_name} · {option.event.location} · {tCategory(option.event.category)}
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Avatar name={option.club.name} src={option.club.logo_url || null} size="sm" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {option.club.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {t('club')} · {option.club.department_name}
                        </span>
                      </span>
                    </>
                  )}
                  {isActive && (
                    <kbd aria-hidden="true" className="hidden text-xs text-slate-400 sm:inline">
                      ↵
                    </kbd>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {seeAll && (
          <div className="mt-1 border-t border-slate-200/80 pt-1 dark:border-slate-800">
            <div
              id={optionId(options.length - 1)}
              role="option"
              aria-selected={active === options.length - 1}
              onMouseMove={() => setActiveIndex(options.length - 1)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => open(seeAll)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${
                active === options.length - 1 ? 'bg-violet-50 dark:bg-violet-500/10' : ''
              }`}
            >
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              >
                <SearchIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-violet-700 dark:text-violet-400">
                  {t('seeAll', { query: query.trim() })}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{t('seeAllHint')}</span>
              </span>
              {active === options.length - 1 && (
                <kbd aria-hidden="true" className="hidden text-xs text-slate-400 sm:inline">
                  ↵
                </kbd>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
