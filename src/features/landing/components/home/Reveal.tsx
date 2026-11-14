'use client';

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** Reduced motion: no offset, no fade (framer's `initial={false}` before). */
const REDUCED_MOTION_CLASSES =
  'motion-reduce:!opacity-100 motion-reduce:!transform-none motion-reduce:!transition-none';

type RevealPhase = 'hidden' | 'visible';

interface RevealProps {
  children: ReactNode;
  /** Seconds before the reveal starts once in view. */
  delay?: number;
  /** Starting vertical offset in px. */
  y?: number;
  /** Starting scale. */
  scale?: number;
  /** Reveal duration in seconds. */
  duration?: number;
  /** Share of the element that must be visible to start, like IntersectionObserver threshold. */
  amount?: number;
  className?: string;
}

function revealStyle(
  phase: RevealPhase,
  { delay, y, scale, duration }: Required<Omit<RevealProps, 'children' | 'className' | 'amount'>>,
): CSSProperties {
  if (phase === 'hidden') {
    return { opacity: 0, transform: `translateY(${y}px) scale(${scale})` };
  }
  return {
    opacity: 1,
    transform: 'none',
    transition: `opacity ${duration}s ${EASE_OUT} ${delay}s, transform ${duration}s ${EASE_OUT} ${delay}s`,
  };
}

/**
 * Fade-up reveal when the element scrolls into view. Fires once. No hover motion: the
 * landing cards that use it are not clickable (RIN-1555).
 *
 * IntersectionObserver and a CSS transition, not framer-motion: framer was ~16 KB gzip of
 * the 220 KiB marketing-static first load for four fade-ups (RIN-1370). Same easing,
 * durations, offsets and thresholds as the framer `whileInView` it replaces.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  scale = 1,
  duration = 0.6,
  amount = 0.3,
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<RevealPhase>('hidden');

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setPhase('visible');
      },
      { threshold: amount },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [amount]);

  return (
    <div
      ref={ref}
      className={className ? `${className} ${REDUCED_MOTION_CLASSES}` : REDUCED_MOTION_CLASSES}
      style={revealStyle(phase, { delay, y, scale, duration })}
    >
      {children}
    </div>
  );
}
