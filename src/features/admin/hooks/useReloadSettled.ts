import { useCallback, useRef } from 'react';

export interface ReloadSettled {
  /** A promise for ErrorState's Retry: it settles when the next load settles. */
  waitForReload: () => Promise<void>;
  /** Call when a load finishes, success or failure, to release every waiting Retry. */
  settleReload: () => void;
}

/**
 * Lets an effect-driven list hand ErrorState a Retry promise, so the button stays pending
 * until the refetch settles instead of returning at once (RIN-1166).
 */
export function useReloadSettled(): ReloadSettled {
  const waiting = useRef<Array<() => void>>([]);

  const waitForReload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiting.current.push(resolve);
      }),
    [],
  );

  const settleReload = useCallback(() => {
    const resolvers = waiting.current;
    waiting.current = [];
    for (const resolve of resolvers) resolve();
  }, []);

  return { waitForReload, settleReload };
}
