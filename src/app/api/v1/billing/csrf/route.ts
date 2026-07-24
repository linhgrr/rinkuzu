import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { billingCsrfCookieName } from '@/services/billing/billing-security';

export const POST = withAuth(async () => {
  const token = crypto.randomBytes(32).toString('base64url');
  const response: NextResponse = apiOk({ token });
  response.cookies.set(billingCsrfCookieName(), token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 60,
  });
  return response;
});
