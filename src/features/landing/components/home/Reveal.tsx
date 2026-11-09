'use client';

import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const HOVER_TRANSITION = `transform 0.3s ${EASE_OUT}`;
/** Reduced motion: no offset, no fade, no hover lift (framer's `initial={false}` before). */
const REDUCED_MOTION_CLASSES =
  'motion-reduce:!opacity-100 motion-reduce:!transform-none motion-reduce:!transition-none';

type RevealPhase = 'hidden' | 'revealing' | 'settled';

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
  /** Px the element rises while a mouse hovers it, after the reveal. */
  hoverLift?: number;
  className?: string;
}

function revealStyle(
  phase: RevealPhase,
  hovered: boolean,
  {
    delay,
    y,
    scale,
    duration,
    hoverLift,
  }: Required<Omit<RevealProps, 'children' | 'className' | 'amount'>>,
): CSSProperties {
  if (phase === 'hidden') {
    return { opacity: 0, transform: `translateY(${y}px) scale(${scale})` };
  }
  return {
    opacity: 1,
    transform: hovered && hoverLift ? `translateY(${-hoverLift}px)` : 'none',
    transition:
      phase === 'revealing'
        ? `opacity ${duration}s ${EASE_OUT} ${delay}s, transform ${duration}s ${EASE_OUT} ${delay}s`
        : HOVER_TRANSITION,
  };
}

/**
 * Fade-up reveal when the element scrolls into view. Fires once.
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
  hoverLift = 0,
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<RevealPhase>('hidden');
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setPhase('revealing');
      },
      { threshold: amount },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [amount]);

  // Like framer's whileHover: mouse only, never touch.
  const onHover = (isHovered: boolean) => (event: PointerEvent<HTMLDivElement>) => {
    if (hoverLift && event.pointerType === 'mouse') setHovered(isHovered);
  };

  return (
    <div
      ref={ref}
      className={className ? `${className} ${REDUCED_MOTION_CLASSES}` : REDUCED_MOTION_CLASSES}
      style={revealStyle(phase, hovered, { delay, y, scale, duration, hoverLift })}
      onPointerEnter={onHover(true)}
      onPointerLeave={onHover(false)}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && phase === 'revealing') setPhase('settled');
      }}
    >
      {children}
    </div>
  );
}
