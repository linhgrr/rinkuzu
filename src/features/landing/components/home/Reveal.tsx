'use client';

import { type ReactNode } from 'react';
import { LazyMotion, m, useReducedMotion } from 'framer-motion';
import { loadMotionFeatures } from './motion-features';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

/** Fade-up reveal when the element scrolls into view. Fires once. */
export function Reveal({ children, delay = 0, y = 24, className }: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <LazyMotion features={loadMotionFeatures}>
      <m.div
        className={className}
        initial={reduce ? false : { opacity: 0, y }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, delay, ease: EASE_OUT }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
