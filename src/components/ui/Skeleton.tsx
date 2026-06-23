import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('skeleton-shimmer', className)} {...props} />;
}
