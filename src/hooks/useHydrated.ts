'use client';

import { useSyncExternalStore } from 'react';

const subscribeToNothing = () => () => undefined;

/**
 * False in the server HTML and while React hydrates it, true once the component is live, and
 * true at once when it mounts on the client. Controls in server-rendered markup ignore a tap
 * until then (RIN-1133), so render them disabled instead of letting the tap be lost.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}
