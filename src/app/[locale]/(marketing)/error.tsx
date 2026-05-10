'use client';

import { useEffect } from 'react';

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[MarketingError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-black px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-900/30">
        <svg
          className="h-8 w-8 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-xl font-semibold text-white">Something went wrong</h2>
      <p className="mb-6 max-w-md text-sm text-neutral-400">
        An unexpected error occurred. Please try refreshing the page.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
      >
        Try again
      </button>
    </div>
  );
}
