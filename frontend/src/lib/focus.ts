// Everything a keyboard user can Tab to inside an overlay.
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type TabKeyEvent = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>;

// Keeps Tab / Shift+Tab cycling inside `container`. Call it from the container's onKeyDown.
// Works with React and native events, so any overlay (popover, drawer, modal) can share it.
export const trapTabKey = (event: TabKeyEvent, container: HTMLElement) => {
  if (event.key !== 'Tab') return;

  const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && (active === first || active === container)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
};
