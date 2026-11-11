'use client';

import React, { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Club, EventItem } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ModalTitle } from '@/components/ui/Modal';
import { NAV_ICONS, SearchIcon } from '@/components/ui/layout/navIcons';
import { useCampusSearch } from '@/hooks/useCampusSearch';
import { CATEGORY_LABELS } from '@/lib/events';

/* --------------------------------- Types ---------------------------------- */

export interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// One flat list of everything the arrow keys can reach, in display order.
type PaletteOption =
  | { kind: 'event'; key: string; href: string; event: EventItem }
  | { kind: 'club'; key: string; href: string; club: Club };

interface PaletteGroup {
  id: string;
  label: string;
  options: PaletteOption[];
}

const CalendarIcon = NAV_ICONS.calendar;

const toEventOption = (event: EventItem): PaletteOption => ({
  kind: 'event',
  key: `event-${event.id}`,
  href: `/events/${event.id}`,
  event,
});

const toClubOption = (club: Club): PaletteOption => ({ kind: 'club', key: `club-${club.id}`, href: `/clubs/${club.slug}`, club });

const describeResults = (count: number, hasQuery: boolean): string => {
  if (!hasQuery) return '';
  return count === 0 ? 'No results' : `${count} ${count === 1 ? 'result' : 'results'}`;
};

/* ------------------------------ SearchPalette ----------------------------- */

// ⌘K palette (WAI-ARIA combobox with a listbox popup). Focus stays in the input; ↑ / ↓ move the active
// option (aria-activedescendant), Enter opens it, Escape closes (Modal). Results come from useCampusSearch.
export const SearchPalette = ({ isOpen, onClose }: SearchPaletteProps) => {
  const router = useRouter();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const { results, suggestions } = useCampusSearch(query);

  const hasQuery = query.trim().length > 0;
  const groups: PaletteGroup[] = hasQuery
    ? [
        { id: `${baseId}-events`, label: 'Events', options: results.events.map(toEventOption) },
        { id: `${baseId}-clubs`, label: 'Clubs', options: results.clubs.map(toClubOption) },
      ].filter((group) => group.options.length > 0)
    : [{ id: `${baseId}-upcoming`, label: 'Coming up', options: suggestions.map(toEventOption) }];
  const options = groups.flatMap((group) => group.options);
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
      <ModalTitle className="sr-only">Search events and clubs</ModalTitle>

      <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 dark:border-slate-800">
        <SearchIcon className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          type="text"
          role="combobox"
          aria-label="Search events and clubs"
          aria-expanded={options.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={options.length > 0 ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search events and clubs…"
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
        {describeResults(options.length, hasQuery)}
      </p>

      <div id={listboxId} role="listbox" aria-label="Search results" className="max-h-[60vh] overflow-y-auto p-2">
        {hasQuery && options.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No events or clubs match “{query.trim()}”.
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
                          {option.event.club_name} · {option.event.location} · {CATEGORY_LABELS[option.event.category]}
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
                          Club · {option.club.department_name}
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
      </div>
    </Modal>
  );
};
