'use client';

import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { captureAnalyticsEvent } from '@/lib/analytics/client';

type LandingCta = 'play_first' | 'upload' | 'register';
type LandingCtaPosition = 'hero' | 'bottom';

interface LandingCtaLinkProps {
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
      href={href}
      className={className}
      onClick={() => captureAnalyticsEvent('landing_cta_clicked', { cta, position, locale })}
    >
      {children}
    </Link>
  );
}
