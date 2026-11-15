'use client';

import {
  useRef,
  type ComponentProps,
  type FocusEvent,
  type PointerEvent,
  type TouchEvent,
} from 'react';

import { Link, useRouter } from '@/i18n/navigation';

type LinkProps = ComponentProps<typeof Link>;

/**
 * Link for repeated item lists (cards, chips, post teasers). The default `<Link>` prefetches
 * every target that enters the viewport, which is one server render per dynamic target, so a
 * 30-card list costs dozens of renders before anyone clicks (RIN-1678). This one prefetches a
 * target once, on pointer hover, keyboard focus or touch start. Markup is identical to `Link`.
 * Primary navigation (header, bottom nav, single CTAs) keeps the plain `Link`.
 */
export function IntentPrefetchLink({
  href,
  onPointerEnter,
  onFocus,
  onTouchStart,
  ...rest
}: LinkProps) {
  const router = useRouter();
  const prefetched = useRef(false);

  function prefetchOnce() {
    if (prefetched.current) return;
    prefetched.current = true;
    router.prefetch(href as Parameters<typeof router.prefetch>[0]);
  }

  return (
    <Link
      {...rest}
      href={href}
      prefetch={false}
      onPointerEnter={(event: PointerEvent<HTMLAnchorElement>) => {
        onPointerEnter?.(event);
        prefetchOnce();
      }}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
        onFocus?.(event);
        prefetchOnce();
      }}
      onTouchStart={(event: TouchEvent<HTMLAnchorElement>) => {
        onTouchStart?.(event);
        prefetchOnce();
      }}
    />
  );
}
