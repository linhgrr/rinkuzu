/**
 * Raises a pending flag for the duration of `action` and always lowers it again,
 * whether the action resolves, rejects or throws synchronously.
 *
 * It lives outside components on purpose: React Compiler cannot compile a
 * `try/finally` inside a component or hook, so an inline `finally` costs the
 * whole component its automatic memoization.
 */
export async function withPending<T>(
  setPending: (pending: boolean) => void,
  action: () => Promise<T>,
): Promise<T> {
  setPending(true);
  try {
    return await action();
  } finally {
    setPending(false);
  }
}
