import React from 'react';
import { cn } from '@/lib/utils';

type SurfaceCardProps = React.HTMLAttributes<HTMLElement> & {
  ref?: React.Ref<HTMLElement>;
};

/**
 * Section shell from the Figma home design system: soft-rounded surface with a
 * neutral border. Default padding/radius match the dashboard spec; override via
 * `className`.
 */
function SurfaceCard({ className, ref, ...props }: SurfaceCardProps) {
  return (
    <section
      ref={ref}
      className={cn('rounded-panel border border-line bg-surface p-5', className)}
      {...props}
    />
  );
}
SurfaceCard.displayName = 'SurfaceCard';

export { SurfaceCard };
