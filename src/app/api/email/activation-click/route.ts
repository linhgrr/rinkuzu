import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readAndValidateSearchParams } from '@/lib/api/request';
import { recordActivationClick } from '@/lib/communication/activation-nudge';

/**
 * Tracked CTA of the activation nudge email (RIN-1000). `GET ?t=<token>&l=<locale>`
 * stamps the first click on the learner's nudge row, emits
 * `activation_email_clicked`, and 302s to the locale-matched starter quiz with
 * `entry=activation_email`. Every token, valid or not, gets the same redirect,
 * so the response is no oracle. The token is never logged.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };

const clickQuerySchema = z.object({
  t: z.string().max(128).default(''),
  l: z.string().max(8).optional(),
});

export async function GET(request: NextRequest) {
  const query = readAndValidateSearchParams(request, clickQuerySchema);
  const token = query.success ? query.data.t : '';
  const locale = query.success ? (query.data.l ?? null) : null;
  const destination = await recordActivationClick(token, locale);
  return NextResponse.redirect(destination, { status: 302, headers: NO_STORE });
}
