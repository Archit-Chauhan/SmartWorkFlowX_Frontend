import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'swfx-sidebar';
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

let collapsed = readCollapsed();

export function setSidebarCollapsed(next: boolean) {
  collapsed = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'collapsed' : 'expanded');
  } catch {
    /* storage unavailable: the choice still applies for this session */
  }
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Desktop sidebar state (icon rail or full width). Persisted; the mobile drawer is unaffected. */
export function useSidebarCollapsed() {
  const isCollapsed = useSyncExternalStore(subscribe, () => collapsed, () => false);
  return { collapsed: isCollapsed, setCollapsed: setSidebarCollapsed, toggle: () => setSidebarCollapsed(!isCollapsed) };
}
