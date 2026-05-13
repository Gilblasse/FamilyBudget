import * as React from 'react';

const NARROW_BREAKPOINT = 640;

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT - 1}px)`);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.innerWidth < NARROW_BREAKPOINT;
}

function getServerSnapshot() {
  return false;
}

export function useIsNarrowViewport() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
