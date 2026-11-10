'use client';

import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { captureAnalyticsEvent } from '@/lib/analytics/client';

type LandingCta = 'play_first' | 'upload' | 'guest_pdf' | 'register';
/** Homepage spots (RIN-1178) and the blog quiz card's (RIN-1258). */
type LandingCtaPosition = 'hero' | 'bottom' | 'blog_inline' | 'blog_end' | 'blog_index';

interface LandingCtaLinkProps {
  href: string;
  cta: LandingCta;
  position: LandingCtaPosition;
  locale: string;
  /** Blog post slug of a post's quiz card; absent elsewhere (and on the /blog index). */
  post?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Homepage CTA link that reports `landing_cta_clicked` (RIN-1178). The only client JS
 * the play-first change adds to the static homepage; analytics stays consent-gated in
 * captureAnalyticsEvent, and the properties are cta, position and locale, plus the post
 * slug on a blog post's quiz card (RIN-1258).
 */
export function LandingCtaLink({
  href,
  cta,
  position,
  locale,
  post,
  className,
  children,
}: LandingCtaLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        captureAnalyticsEvent('landing_cta_clicked', {
          cta,
          position,
          locale,
          ...(post ? { post } : {}),
        })
      }
    >
      {children}
    </Link>
  );
}
