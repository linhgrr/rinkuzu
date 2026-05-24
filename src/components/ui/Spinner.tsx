const SIZES = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-7 w-7',
  '2xl': 'h-8 w-8',
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZES;
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <output
      className={`animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust ${SIZES[size]} ${className}`}
      aria-label="Loading"
    >
      <span className="sr-only">Loading…</span>
    </output>
  );
}
