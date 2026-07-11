'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { matchesMedia } from '@/hooks/useMediaQuery';
import { MEDIA_MAX_MD } from '@/shared/constants/breakpoints';

type Variant = 'desktop' | 'mobile';

/**
 * Sends desktop browsers visiting /create/mobile to /create, and mobile
 * browsers visiting /create to /create/mobile. Returns `true` while the
 * decision is pending so the caller can render a skeleton instead of
 * flashing the wrong layout.
 */
export function useCreateResponsiveRedirect(currentVariant: Variant): boolean {
  const { replace } = useRouter();
  const pathname = usePathname();
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      queueMicrotask(() => setIsRedirecting(false));
      return;
    }

    const isMobileViewport = matchesMedia(MEDIA_MAX_MD);
    const target: Variant = isMobileViewport ? 'mobile' : 'desktop';

    if (target === currentVariant) {
      queueMicrotask(() => setIsRedirecting(false));
      return;
    }

    // usePathname is locale-stripped; next-intl router re-applies the prefix.
    const nextPath =
      target === 'mobile'
        ? pathname.endsWith('/create')
          ? `${pathname}/mobile`
          : pathname.replace(/\/create$/, '/create/mobile')
        : pathname.replace(/\/create\/mobile$/, '/create');

    replace(nextPath + window.location.search);
  }, [currentVariant, pathname, replace]);

  return isRedirecting;
}
