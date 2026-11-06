import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { locales, type Locale } from '@/i18n/config';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { unsubscribeWithToken } from '@/lib/communication/review-reminder';
import {
  unsubscribeCampaign,
  type UnsubscribeCampaign,
} from '@/lib/communication/review-reminder-policy';
import { logger } from '@/lib/logger';

/**
 * One-click unsubscribe from the 2-day review email (RIN-915, RFC 8058).
 *
 * - `POST ?t=<token>` with `List-Unsubscribe=One-Click`: sent by mail
 *   providers, signed out and cross-site (CSRF-exempt). Returns 200 with no
 *   body for every token, valid or not, so it is no oracle.
 * - `POST ?t=<token>` from the confirm page's form (`locale` field): same
 *   write, then 303 back to the page, which reads the result from the database.
 * - `GET ?t=<token>`: a client that opens the header URL lands on the page.
 *
 * The token itself is never logged.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };

const unsubscribeQuerySchema = z.object({
  t: z.string().max(256).default(''),
  c: z.string().max(32).optional(),
});

interface UnsubscribeLink {
  token: string;
  campaign: UnsubscribeCampaign | null;
}

/**
 * The `?t=` token and the `?c=` campaign (RIN-1044). Anything malformed reads
 * as an empty (invalid) token; an unknown campaign reads as none.
 */
function linkOf(request: NextRequest): UnsubscribeLink {
  const query = readAndValidateSearchParams(request, unsubscribeQuerySchema);
  if (!query.success) return { token: '', campaign: null };
  return { token: query.data.t, campaign: unsubscribeCampaign(query.data.c) };
}

function pageUrl(
  request: NextRequest,
  link: UnsubscribeLink,
  locale: string | null,
  failed = false,
) {
  const url = new URL(locale ? `/${locale}/unsubscribe` : '/unsubscribe', request.nextUrl.origin);
  url.searchParams.set('t', link.token);
  if (link.campaign) url.searchParams.set('c', link.campaign);
  if (failed) url.searchParams.set('result', 'error');
  return url;
}

async function formLocale(request: NextRequest): Promise<string | null> {
  try {
    const value = (await request.formData()).get('locale');
    return locales.find((locale: Locale) => locale === value) ?? null;
  } catch {
    return null;
  }
}

export function GET(request: NextRequest) {
  return NextResponse.redirect(pageUrl(request, linkOf(request), null), {
    status: 303,
    headers: NO_STORE,
  });
}

export async function POST(request: NextRequest) {
  const link = linkOf(request);
  const pageLocale = await formLocale(request);
  const { ip } = extractRequestContext(request);
  const rate = await checkAuthRateLimit('unsubscribe_ip', ip ?? 'unknown');
  if (!rate.allowed) return rateLimitResponse(rate);

  try {
    await unsubscribeWithToken(link.token, ip, link.campaign);
  } catch (error) {
    logger.error({ error, operation: 'one-click-unsubscribe' }, 'Unsubscribe failed');
    if (pageLocale) {
      return NextResponse.redirect(pageUrl(request, link, pageLocale, true), {
        status: 303,
        headers: NO_STORE,
      });
    }
    return new NextResponse(null, { status: 500, headers: NO_STORE });
  }
  if (pageLocale) {
    return NextResponse.redirect(pageUrl(request, link, pageLocale), {
      status: 303,
      headers: NO_STORE,
    });
  }
  return new NextResponse(null, { status: 200, headers: NO_STORE });
}
