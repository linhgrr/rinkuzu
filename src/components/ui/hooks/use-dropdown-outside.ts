'use client';

import { useEffect } from 'react';
import type React from 'react';

export function useDropdownOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  enabled: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [enabled, onOutside, ref]);
}
