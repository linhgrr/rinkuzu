import { NextRequest, after } from 'next/server';
import { ZodError } from 'zod';

import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { apiOk, apiErr } from '@/lib/api/response';
import { recordAuthEvent, extractRequestContext } from '@/lib/audit';
import { createSecureToken, wasIssuedRecently } from '@/lib/auth-tokens';
import { buildPasswordResetMessage, sendTransactionalMail } from '@/lib/mail';
import { flattenZodError, forgotPasswordSchema } from '@/lib/validation/auth';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { logger } from '@/lib/logger';

const RESET_TOKEN_TTL_MS = 30 * 60_000;
const RESET_MIN_INTERVAL_MS = 60_000;

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiErr('validation_error', 'Request body must be valid JSON', 400);
  }

  let input;
  try {
    input = forgotPasswordSchema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      const { detail, fields } = flattenZodError(error);
      return apiErr('validation_error', detail, 400, { fields });
    }
    throw error;
  }

  const { ip, userAgent } = extractRequestContext(request);

  const rate = await checkAuthRateLimit('forgot_password_email', input.email);
  if (!rate.allowed) return rateLimitResponse(rate);

  const neutralResponse = () =>
    apiOk(null, 200, {
      meta: {
        message: 'If the email exists in our system, a reset link has been sent. Check your inbox.',
      },
    });

  try {
    await connectDB();
    const user = await User.findOne({ email: input.email });

    if (user && !user.isAnonymous && user.password) {
      if (
        user.passwordResetTokenHash &&
        wasIssuedRecently(user.passwordResetExpires, RESET_TOKEN_TTL_MS, RESET_MIN_INTERVAL_MS)
      ) {
        return neutralResponse();
      }

      const { raw, hash } = createSecureToken();
      user.passwordResetTokenHash = hash;
      user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();

      // Mail delivery + audit are side effects that don't shape the neutral
      // response, so defer them to keep the request fast and timing-uniform.
      after(async () => {
        await Promise.all([
          sendTransactionalMail(await buildPasswordResetMessage(user.email, raw)),
          recordAuthEvent({
            event: 'password_reset_requested',
            userId: user._id,
            email: user.email,
            ip,
            userAgent,
          }),
        ]);
      });
    } else {
      await recordAuthEvent({
        event: 'password_reset_requested',
        email: input.email,
        ip,
        userAgent,
        metadata: { reason: 'unknown_user_or_oauth' },
      });
    }

    return neutralResponse();
  } catch (error) {
    logger.error({ error }, 'Forgot-password error');
    // Never leak failures to anonymous callers — return same neutral payload.
    return neutralResponse();
  }
}
