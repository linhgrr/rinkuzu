import { NextRequest, after } from 'next/server';
import { ZodError } from 'zod';

import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { hashPassword } from '@/lib/password';
import { apiOk, apiErr } from '@/lib/api/response';
import { flattenZodError, registerSchema } from '@/lib/validation/auth';
import { createSecureToken } from '@/lib/auth-tokens';
import { buildVerifyEmailMessage, sendTransactionalMail } from '@/lib/mail';
import { recordAuthEvent, extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { logger } from '@/lib/logger';

const VERIFICATION_TTL_MS = 24 * 60 * 60_000;

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiErr('validation_error', 'Request body must be valid JSON', 400);
  }

  let input;
  try {
    input = registerSchema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      const { detail, fields } = flattenZodError(error);
      return apiErr('validation_error', detail, 400, { fields });
    }
    throw error;
  }

  const { ip, userAgent } = extractRequestContext(request);
  const rateKey = ip || 'unknown';
  const rate = await checkAuthRateLimit('register_ip', rateKey);
  if (!rate.allowed) return rateLimitResponse(rate);

  const neutralMessage =
    'If the email is valid, a verification link has been sent. Check your inbox.';

  try {
    await connectDB();

    const existing = await User.findOne({ email: input.email }).select('_id').lean();
    if (existing) {
      // Neutral response — never leak account existence to anonymous callers.
      // Audit write is a side effect; defer it so the response returns immediately.
      after(() =>
        recordAuthEvent({
          event: 'register',
          email: input.email,
          ip,
          userAgent,
          metadata: { reason: 'duplicate_email' },
        }),
      );
      return apiOk({ email: input.email }, 201, { meta: { message: neutralMessage } });
    }

    const hashedPassword = await hashPassword(input.password);
    const verification = createSecureToken();
    const user = await User.create({
      email: input.email,
      password: hashedPassword,
      role: 'user',
      ...(input.displayName ? { displayName: input.displayName } : {}),
      emailVerificationTokenHash: verification.hash,
      emailVerificationExpires: new Date(Date.now() + VERIFICATION_TTL_MS),
    });

    try {
      await sendTransactionalMail(await buildVerifyEmailMessage(user.email, verification.raw));
    } catch (mailError) {
      // Don't fail registration if mail provider is down — surface in audit log.
      logger.error({ mailError }, 'register: failed to send verification email');
    }

    // Audit writes are non-blocking side effects — defer until after the response.
    after(() =>
      Promise.all([
        recordAuthEvent({
          event: 'register',
          userId: user._id,
          email: user.email,
          ip,
          userAgent,
        }),
        recordAuthEvent({
          event: 'email_verification_sent',
          userId: user._id,
          email: user.email,
          ip,
          userAgent,
        }),
      ]),
    );

    return apiOk(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      201,
      { meta: { message: neutralMessage } },
    );
  } catch (error) {
    logger.error({ error }, 'Registration error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
