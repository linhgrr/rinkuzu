'use client';

import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

const isMobileViewport = () =>
  typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;

export function useQuizViewport() {
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileViewport());

  useEffect(() => {
    const checkMobile = () => setIsMobile(isMobileViewport());
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return { isMobile };
}
