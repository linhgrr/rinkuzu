import { NextRequest } from 'next/server';
import { ZodError } from 'zod';

import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { apiOk, apiErr } from '@/lib/api/response';
import { createSecureToken, wasIssuedRecently } from '@/lib/auth-tokens';
import { buildVerifyEmailMessage, sendTransactionalMail } from '@/lib/mail';
import { recordAuthEvent, extractRequestContext } from '@/lib/audit';
import { flattenZodError, resendVerificationSchema } from '@/lib/validation/auth';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';

const VERIFICATION_TTL_MS = 24 * 60 * 60_000;
const VERIFICATION_MIN_INTERVAL_MS = 60_000;

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiErr('validation_error', 'Request body must be valid JSON', 400);
  }

  let input;
  try {
    input = resendVerificationSchema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      const { detail, fields } = flattenZodError(error);
      return apiErr('validation_error', detail, 400, { fields });
    }
    throw error;
  }

  const { ip, userAgent } = extractRequestContext(request);

  const rate = await checkAuthRateLimit('resend_verification_email', input.email);
  if (!rate.allowed) return rateLimitResponse(rate);

  const neutral = () =>
    apiOk(null, 200, {
      meta: {
        message: 'If the email exists and is unverified, a new verification link has been sent.',
      },
    });

  try {
    await connectDB();
    const user = await User.findOne({ email: input.email });

    if (user && !user.emailVerified && !user.isAnonymous) {
      if (
        user.emailVerificationTokenHash &&
        wasIssuedRecently(
          user.emailVerificationExpires,
          VERIFICATION_TTL_MS,
          VERIFICATION_MIN_INTERVAL_MS,
        )
      ) {
        return neutral();
      }

      const { raw, hash } = createSecureToken();
      user.emailVerificationTokenHash = hash;
      user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
      await user.save();

      await sendTransactionalMail(await buildVerifyEmailMessage(user.email, raw));
      await recordAuthEvent({
        event: 'email_verification_sent',
        userId: user._id,
        email: user.email,
        ip,
        userAgent,
      });
    } else {
      await recordAuthEvent({
        event: 'email_verification_sent',
        email: input.email,
        ip,
        userAgent,
        metadata: { reason: user ? 'already_verified_or_oauth' : 'unknown_user' },
      });
    }

    return neutral();
  } catch (error) {
    console.error('Resend-verification error:', error);
    return neutral();
  }
}
