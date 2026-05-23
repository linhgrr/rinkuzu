import { NextRequest } from 'next/server';
import { ZodError } from 'zod';

import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { apiOk, apiErr } from '@/lib/api/response';
import { hashToken } from '@/lib/auth-tokens';
import { recordAuthEvent, extractRequestContext } from '@/lib/audit';
import { flattenZodError, verifyEmailSchema } from '@/lib/validation/auth';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiErr('validation_error', 'Request body must be valid JSON', 400);
  }

  let input;
  try {
    input = verifyEmailSchema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      const { detail, fields } = flattenZodError(error);
      return apiErr('validation_error', detail, 400, { fields });
    }
    throw error;
  }

  const { ip, userAgent } = extractRequestContext(request);

  const rate = await checkAuthRateLimit('verify_email_ip', ip || 'unknown');
  if (!rate.allowed) return rateLimitResponse(rate);

  try {
    await connectDB();
    const tokenHash = hashToken(input.token);
    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return apiErr('validation_error', 'Verification link is invalid or has expired', 400);
    }

    user.emailVerified = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    await user.save();

    await recordAuthEvent({
      event: 'email_verified',
      userId: user._id,
      email: user.email,
      ip,
      userAgent,
    });

    return apiOk({ email: user.email }, 200, {
      meta: { message: 'Email verified. You can now sign in.' },
    });
  } catch (error) {
    logger.error({ error }, 'Verify-email error');
    return apiErr('internal_error', 'Failed to verify email', 500);
  }
}
