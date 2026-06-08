'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { matchesMedia } from '@/hooks/useMediaQuery';

const MOBILE_BREAKPOINT_PX = 768;

type Variant = 'desktop' | 'mobile';

/**
 * Sends desktop browsers visiting /create/mobile to /create, and mobile
 * browsers visiting /create to /create/mobile. Returns `true` while the
 * decision is pending so the caller can render a skeleton instead of
 * flashing the wrong layout.
 */
export function useCreateResponsiveRedirect(currentVariant: Variant): boolean {
  const { replace } = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsRedirecting(false);
      return;
    }

    const isMobileViewport = matchesMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const target: Variant = isMobileViewport ? 'mobile' : 'desktop';

    if (target === currentVariant) {
      setIsRedirecting(false);
      return;
    }

    const path = window.location.pathname;
    const nextPath =
      target === 'mobile'
        ? path.endsWith('/create')
          ? `${path}/mobile`
          : path.replace(/\/create$/, '/create/mobile')
        : path.replace(/\/create\/mobile$/, '/create');

    replace(nextPath + window.location.search);
  }, [currentVariant, replace]);

  return isRedirecting;
}
