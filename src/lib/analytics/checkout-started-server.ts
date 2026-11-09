import 'server-only';

import { after, type NextRequest } from 'next/server';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { captureAnonymousServerEvent } from './server';

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

function knownLocale(value: string | undefined): Locale | undefined {
  return locales.find((locale) => locale === value);
}

function refererLocale(request: NextRequest): Locale | undefined {
  const referer = request.headers.get('referer');
  if (!referer) return undefined;
  try {
    return knownLocale(new URL(referer).pathname.split('/')[1]);
  } catch {
    return undefined;
  }
}

/** `NEXT_LOCALE` is not always set (RIN-1263), so the checkout page's path prefix is the fallback. */
function requestLocale(request: NextRequest): Locale {
  return (
    knownLocale(request.cookies.get('NEXT_LOCALE')?.value) ??
    refererLocale(request) ??
    defaultLocale
  );
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
