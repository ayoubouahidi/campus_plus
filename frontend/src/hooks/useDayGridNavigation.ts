import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { addDays, addMonths, weekdayIndex, type DayKey } from '@/lib/calendar';

// WAI-ARIA grid / date-picker keys, shared by MonthGrid and WeekGrid. Moving selects the day
// (like Tabs' automatic activation).
type GridNavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown';

const GRID_MOVES: Record<GridNavKey, (key: DayKey, isRtl: boolean) => DayKey> = {
  ArrowRight: (key, isRtl) => addDays(key, isRtl ? -1 : 1),
  ArrowLeft: (key, isRtl) => addDays(key, isRtl ? 1 : -1),
  ArrowUp: (key) => addDays(key, -7),
  ArrowDown: (key) => addDays(key, 7),
  Home: (key) => addDays(key, -weekdayIndex(key)), // Monday of this week
  End: (key) => addDays(key, 6 - weekdayIndex(key)), // Sunday of this week
  PageUp: (key) => addMonths(key, -1),
  PageDown: (key) => addMonths(key, 1),
};

const isGridNavKey = (key: string): key is GridNavKey => Object.hasOwn(GRID_MOVES, key);

interface DayGridNavigation<T extends HTMLElement> {
  gridRef: RefObject<T | null>;
  // Use for clicks too: it keeps focus on the day even when it re-renders in another month/week.
  selectDay: (key: DayKey) => void;
  handleKeyDown: (event: KeyboardEvent<T>) => void;
}

// Day buttons inside the grid must carry `data-day={key}`; only the selected one has tabIndex 0.
export const useDayGridNavigation = <T extends HTMLElement>(
  selectedKey: DayKey,
  onSelectDay: (key: DayKey) => void
): DayGridNavigation<T> => {
  const gridRef = useRef<T>(null);

  // Set when the user moves the selection from inside the grid. After React re-renders (the day may
  // now be a new button in another month/week), the effect moves focus onto it. Changes from outside
  // (e.g. the header's Today button) don't set it, so they never steal focus.
  const focusPending = useRef(false);

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${selectedKey}"]`)?.focus();
  }, [selectedKey]);

  const selectDay = (key: DayKey) => {
    focusPending.current = true;
    onSelectDay(key);
  };

  const handleKeyDown = (event: KeyboardEvent<T>) => {
    if (event.defaultPrevented || !isGridNavKey(event.key)) return;
    if (!(event.target instanceof HTMLElement) || !event.target.dataset.day) return;

    event.preventDefault();
    const isRtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    selectDay(GRID_MOVES[event.key](selectedKey, isRtl));
  };

  return { gridRef, selectDay, handleKeyDown };
};
