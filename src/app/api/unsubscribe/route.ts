import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { locales, type Locale } from '@/i18n/config';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { unsubscribeWithToken } from '@/lib/communication/review-reminder';
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

const unsubscribeQuerySchema = z.object({ t: z.string().max(256).default('') });

/** The `?t=` token; anything malformed reads as an empty (invalid) token. */
function tokenOf(request: NextRequest): string {
  const query = readAndValidateSearchParams(request, unsubscribeQuerySchema);
  return query.success ? query.data.t : '';
}

function pageUrl(request: NextRequest, token: string, locale: string | null, failed = false) {
  const url = new URL(locale ? `/${locale}/unsubscribe` : '/unsubscribe', request.nextUrl.origin);
  url.searchParams.set('t', token);
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
  const token = tokenOf(request);
  return NextResponse.redirect(pageUrl(request, token, null), { status: 303, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const token = tokenOf(request);
  const pageLocale = await formLocale(request);
  const { ip } = extractRequestContext(request);
  const rate = await checkAuthRateLimit('unsubscribe_ip', ip ?? 'unknown');
  if (!rate.allowed) return rateLimitResponse(rate);

  try {
    await unsubscribeWithToken(token, ip);
  } catch (error) {
    logger.error({ error, operation: 'one-click-unsubscribe' }, 'Unsubscribe failed');
    if (pageLocale) {
      return NextResponse.redirect(pageUrl(request, token, pageLocale, true), {
        status: 303,
        headers: NO_STORE,
      });
    }
    return new NextResponse(null, { status: 500, headers: NO_STORE });
  }
  if (pageLocale) {
    return NextResponse.redirect(pageUrl(request, token, pageLocale), {
      status: 303,
      headers: NO_STORE,
    });
  }
  return new NextResponse(null, { status: 200, headers: NO_STORE });
}
