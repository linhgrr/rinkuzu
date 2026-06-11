interface FullPageSpinnerProps {
  label: string;
}

/**
 * Full-viewport centered loading spinner on the warm page surface. Used by
 * route-level loading/verifying states (e.g. payment flows).
 */
export function FullPageSpinner({ label }: FullPageSpinnerProps) {
  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center">
      <div className="text-center">
        <div
          className="size-12 animate-spin rounded-full border-2 border-line border-t-accent mx-auto"
          role="status"
          aria-label={label}
        />
        <p className="mt-4 text-ink-muted">{label}</p>
      </div>
    </div>
  );
}
