'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { toBrowserPath } from '@/lib/routing/pathname';

type LandingCta = 'play_first' | 'upload' | 'register';
type LandingCtaPosition = 'hero' | 'bottom';

interface LandingCtaLinkProps {
  /** Locale-unprefixed path, as for the `@/i18n/navigation` Link. */
  href: string;
  cta: LandingCta;
  position: LandingCtaPosition;
  locale: string;
  className?: string;
  children: ReactNode;
}

/**
 * Homepage CTA link that reports `landing_cta_clicked` (RIN-1178). The only client JS
 * the play-first change adds to the static homepage; analytics stays consent-gated in
 * captureAnalyticsEvent, and the properties are cta, position and locale only.
 *
 * Uses `next/link` with the pure `toBrowserPath` prefix instead of the next-intl Link:
 * the next-intl client Link pulls use-intl's message formatter (~12 KB gzip) into the
 * 220 KiB marketing-static budget, which no other landing client component needs (RIN-1370).
 */
export function LandingCtaLink({
  href,
  cta,
  position,
  locale,
  className,
  children,
}: LandingCtaLinkProps) {
  return (
    <Link
      href={toBrowserPath(href, locale)}
      className={className}
      onClick={() => captureAnalyticsEvent('landing_cta_clicked', { cta, position, locale })}
    >
      {children}
    </Link>
  );
}
