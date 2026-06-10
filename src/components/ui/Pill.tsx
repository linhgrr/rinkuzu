import React from 'react';
import { cn } from '@/lib/utils';

const PILL_TONES = {
  warm: 'bg-accent-pale',
  cool: 'bg-badge-cool',
  neutral: 'bg-surface-warm',
} as const;

type PillProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof PILL_TONES;
  ref?: React.Ref<HTMLSpanElement>;
};

/**
 * Rounded category pill from the Figma home design system.
 */
function Pill({ tone = 'cool', className, ref, ...props }: PillProps) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex rounded-full px-2.5 py-1.5 font-home text-sm font-normal leading-[1.4] text-ink',
        PILL_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
Pill.displayName = 'Pill';

export { Pill };
