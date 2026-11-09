'use client';

import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { capturePaywallEvent, usePaywallEventOnMount } from '@/lib/analytics/paywall';

/** Sends `pricing_viewed` once per view of the server-rendered pricing page (RIN-1269). */
export function PricingViewTracker(): null {
  const locale = useLocale();
  usePaywallEventOnMount('pricing_viewed', { locale, plan: null, source: 'pricing_page' });
  return null;
}

interface PricingPlanCtaLinkProps {
  href: string;
  planId: string;
  className: string;
  children: ReactNode;
}

/** A Premium plan CTA on the pricing page that records `upgrade_clicked` (RIN-1269). */
export function PricingPlanCtaLink({ href, planId, className, children }: PricingPlanCtaLinkProps) {
  const locale = useLocale();
  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        capturePaywallEvent('upgrade_clicked', { locale, plan: planId, source: 'pricing_page' })
      }
    >
      {children}
    </Link>
  );
}
