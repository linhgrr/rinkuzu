import React, { useMemo } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

// Extend HTMLMotionProps instead of standard HTMLAttributes to prevent conflicts
// specifically with properties like 'onDrag'.
interface TextShimmerProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  duration?: number;
}

export function TextShimmer({ children, duration = 1.0, className, ...props }: TextShimmerProps) {
  return (
    <motion.div
      className={cn(
        'relative inline-block overflow-hidden',
        'text-transparent bg-clip-text',
        'bg-gradient-to-r from-gray-500 via-white to-gray-500 bg-[length:200%_auto]',
        className
      )}
      animate={{
        backgroundPosition: ['200% center', '-200% center'],
      }}
      transition={{
        repeat: Infinity,
        duration: duration,
        ease: 'linear',
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

