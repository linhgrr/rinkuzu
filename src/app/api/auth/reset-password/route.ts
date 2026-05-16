import { NextRequest } from 'next/server';
import { ZodError } from 'zod';

import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { apiOk, apiErr } from '@/lib/api/response';
import { hashPassword } from '@/lib/password';
import { hashToken } from '@/lib/auth-tokens';
import { buildPasswordChangedMessage, sendTransactionalMail } from '@/lib/mail';
import { recordAuthEvent, extractRequestContext } from '@/lib/audit';
import { flattenZodError, resetPasswordSchema } from '@/lib/validation/auth';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiErr('validation_error', 'Request body must be valid JSON', 400);
  }

  let input;
  try {
    input = resetPasswordSchema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      const { detail, fields } = flattenZodError(error);
      return apiErr('validation_error', detail, 400, { fields });
    }
    throw error;
  }

  const { ip, userAgent } = extractRequestContext(request);

  const rate = await checkAuthRateLimit('reset_password_token_ip', ip || 'unknown');
  if (!rate.allowed) return rateLimitResponse(rate);

  try {
    await connectDB();
    const tokenHash = hashToken(input.token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return apiErr('validation_error', 'Reset link is invalid or has expired', 400);
    }

    user.password = await hashPassword(input.password);
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    user.failedLoginAttempts = 0;
    user.failedLoginWindowStart = null;
    user.lockedUntil = null;
    // Reset link click implies email ownership — promote to verified.
    if (!user.emailVerified) {
      user.emailVerified = new Date();
      user.emailVerificationTokenHash = null;
      user.emailVerificationExpires = null;
    }
    await user.save();

    await sendTransactionalMail(await buildPasswordChangedMessage(user.email));
    await recordAuthEvent({
      event: 'password_reset_completed',
      userId: user._id,
      email: user.email,
      ip,
      userAgent,
    });

    return apiOk(null, 200, {
      meta: { message: 'Password updated. Please sign in with your new password.' },
    });
  } catch (error) {
    console.error('Reset-password error:', error);
    return apiErr('internal_error', 'Failed to reset password', 500);
  }
}
