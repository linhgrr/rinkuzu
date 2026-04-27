import React from 'react';
import { cn } from '@/lib/utils';

interface TextShimmerProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  duration?: number;
}

export function TextShimmer({
  children,
  duration = 8,
  className,
  style,
  ...props
}: TextShimmerProps) {
  return (
    <span
      className={cn(
        'relative inline-block overflow-hidden',
        'bg-clip-text text-transparent',
        'bg-gradient-to-r from-neutral-500 via-white to-neutral-500 bg-[length:200%_auto]',
        'animate-text-shimmer',
        className,
      )}
      style={{ animationDuration: `${duration}s`, ...style }}
      {...props}
    >
      {children}
    </span>
  );
}
