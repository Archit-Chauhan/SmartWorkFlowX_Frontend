import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Makes a container behave like a modal dialog: focus moves in, Tab stays inside,
 * Escape closes (unless `locked`), and focus returns to where it was when the dialog goes away.
 * Elements with `data-autofocus` get the first focus.
 */
export function useDialogA11y(ref: RefObject<HTMLElement | null>, onClose: () => void, locked = false) {
  const lockedRef = useRef(locked);
  const closeRef = useRef(onClose);

  // Keep the latest props available to the key handler without re-running the focus setup.
  useEffect(() => {
    lockedRef.current = locked;
    closeRef.current = onClose;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = node.querySelector<HTMLElement>('[data-autofocus]') ?? node.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (!node.contains(document.activeElement)) return;
      if (e.key === 'Escape' && !lockedRef.current) {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [ref]);
}
