'use client';

import { type ReactNode, useRef } from 'react';
import {
  LazyMotion,
  domAnimation,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';

interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

/** Pulls its child toward the cursor on hover. Collapses to static under reduced motion. */
export function Magnetic({ children, strength = 0.3, className }: MagneticProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const sy = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        ref={ref}
        className={className}
        style={{ x: sx, y: sy }}
        onMouseMove={(e) => {
          const el = ref.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
          y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
        }}
        onMouseLeave={() => {
          x.set(0);
          y.set(0);
        }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
