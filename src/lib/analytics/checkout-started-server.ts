import 'server-only';

import { after, type NextRequest } from 'next/server';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { captureAnonymousServerEvent } from './server';

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

function requestLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get('NEXT_LOCALE')?.value;
  return locales.find((locale) => locale === cookie) ?? defaultLocale;
}

function requestCountry(request: NextRequest): string | null {
  const header = request.headers.get('x-vercel-ip-country');
  return header !== null && COUNTRY_CODE_PATTERN.test(header) ? header : null;
}

/**
 * Counts a new checkout order (RIN-1269), the input for the ">=20 non-VN
 * paywall hits" trigger. Independent of analytics consent because it carries no
 * user id, email or person profile: only locale, plan and the edge's country.
 * Sent after the response, so the order never waits on PostHog.
 */
export function scheduleCheckoutStartedServerEvent(request: NextRequest, planId: string): void {
  const properties = {
    locale: requestLocale(request),
    plan: planId,
    country: requestCountry(request),
  };
  after(async () => {
    await captureAnonymousServerEvent('checkout_started_server', properties);
  });
}
