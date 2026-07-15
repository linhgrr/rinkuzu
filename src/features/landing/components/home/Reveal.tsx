import { type ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

/** Keeps landing content visible in the server response and out of the hydration critical path. */
export function Reveal({ children, className }: RevealProps) {
  return <div className={className}>{children}</div>;
}
