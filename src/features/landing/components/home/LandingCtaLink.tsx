'use client';

import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import type { MarketingHeaderPosition } from '@/lib/routing/pathname';

type LandingCta = 'play_first' | 'upload' | 'guest_pdf' | 'register' | 'signin' | 'dashboard';
/** Homepage spots (RIN-1178), the blog quiz card's (RIN-1258) and the content-page header's (RIN-1519). */
type LandingCtaPosition =
  | 'hero'
  | 'bottom'
  | 'blog_inline'
  | 'blog_end'
  | 'blog_index'
  | MarketingHeaderPosition;

interface LandingCtaLinkProps {
  href: string;
  cta: LandingCta;
  position: LandingCtaPosition;
  locale: string;
  /** Blog post slug of a post's quiz card; absent elsewhere (and on the /blog index). */
  post?: string;
  className?: string;
  /** Runs after the event is reported, e.g. to close the header menu (RIN-1519). */
  onNavigate?: () => void;
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
  onNavigate,
  children,
}: LandingCtaLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        captureAnalyticsEvent('landing_cta_clicked', {
          cta,
          position,
          locale,
          ...(post ? { post } : {}),
        });
        onNavigate?.();
      }}
    >
      {children}
    </Link>
  );
}
