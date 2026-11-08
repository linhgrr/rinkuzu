'use client';

import { useEffect, useRef } from 'react';
import { captureAnalyticsEvent } from './client';

/** The surface a paywall event came from (RIN-1269). */
type PaywallSource = 'pricing_page' | 'upgrade_modal' | 'subscription_page' | 'checkout';

type PaywallEventName = 'pricing_viewed' | 'upgrade_clicked' | 'checkout_started';

export interface PaywallEventProperties {
  locale: string;
  /** The plan id, or `null` when the event is not about one plan. */
  plan: string | null;
  source: PaywallSource;
}

/**
 * The paywall funnel events carry exactly `locale`, `plan` and `source`; the
 * country comes from PostHog's own `$geoip_country_code`. Building the object
 * here keeps a caller from passing anything else along.
 */
export function capturePaywallEvent(
  event: PaywallEventName,
  { locale, plan, source }: PaywallEventProperties,
): void {
  captureAnalyticsEvent(event, { locale, plan, source });
}

/**
 * Fires a paywall event once per mount. The ref survives React's dev/strict
 * double effect, so the simulated remount does not send it twice.
 */
export function usePaywallEventOnMount(
  event: PaywallEventName,
  properties: PaywallEventProperties | null,
): void {
  const sent = useRef(false);
  const locale = properties?.locale;
  const plan = properties?.plan;
  const source = properties?.source;

  useEffect(() => {
    if (sent.current || locale === undefined || plan === undefined || source === undefined) return;
    sent.current = true;
    capturePaywallEvent(event, { locale, plan, source });
  }, [event, locale, plan, source]);
}
