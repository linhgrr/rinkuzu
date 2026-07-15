'use client';

import { type PointerEvent, type ReactNode, useRef } from 'react';

interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

/** Pulls its child toward the cursor on hover. Collapses to static under reduced motion. */
export function Magnetic({ children, strength = 0.3, className }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);

  const resetTransform = () => {
    ref.current?.style.removeProperty('transform');
  };

  const moveTowardPointer = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (
      !element ||
      event.pointerType !== 'mouse' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const x = (event.clientX - (rect.left + rect.width / 2)) * strength;
    const y = (event.clientY - (rect.top + rect.height / 2)) * strength;
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  return (
    <div
      ref={ref}
      className={`motion-safe:transition-transform motion-safe:duration-150 ${className ?? ''}`}
      onPointerMove={moveTowardPointer}
      onPointerLeave={resetTransform}
      onPointerCancel={resetTransform}
    >
      {children}
    </div>
  );
}
