'use client';

import { useEffect, useState } from 'react';

/**
 * One-shot, SSR-safe media query read. Returns `false` on the server (where
 * `window` is undefined) and the current match on the client. Use this for
 * imperative checks inside effects/callbacks where you don't need to react to
 * later viewport changes (e.g. PWA display-mode detection, viewport gating).
 */
export function matchesMedia(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(query).matches;
}

/**
 * Reactive media query hook. Subscribes to `change` events so the component
 * re-renders only when the boolean match flips — not on every pixel change.
 * Use this when the match drives rendering (derived boolean state).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => matchesMedia(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQuery = window.matchMedia(query);
    const apply = () => setMatches(mediaQuery.matches);

    // Sync immediately in case the query changed between render and effect.
    apply();
    mediaQuery.addEventListener('change', apply);
    return () => mediaQuery.removeEventListener('change', apply);
  }, [query]);

  return matches;
}
