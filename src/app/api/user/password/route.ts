import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { hashPassword, verifyPassword } from '@/lib/password';
import { apiErr, apiOk } from '@/lib/api/response';
import { changePasswordSchema, flattenZodError } from '@/lib/validation/auth';

export const PUT = withAuth(async (request: NextRequest, { email }) => {
  try {
    if (!email) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return apiErr('validation_error', 'Request body must be valid JSON', 400);
    }

    let input;
    try {
      input = changePasswordSchema.parse(payload);
    } catch (error) {
      if (error instanceof ZodError) {
        const { detail, fields } = flattenZodError(error);
        return apiErr('validation_error', detail, 400, { fields });
      }
      throw error;
    }

    await connectDB();

    const user = await User.findOne({ email }).select('password isAnonymous');

    if (!user) {
      return apiErr('not_found', 'User not found', 404);
    }

    if (user.isAnonymous || !user.password) {
      return apiErr('validation_error', 'Password change is not available for this account', 400);
    }

    const isValid = await verifyPassword(input.currentPassword, user.password);
    if (!isValid) {
      return apiErr('validation_error', 'Current password is incorrect', 400);
    }

    const hashedPassword = await hashPassword(input.newPassword);
    await User.updateOne({ email }, { password: hashedPassword });

    return apiOk(null, 200, { meta: { message: 'Password updated successfully' } });
  } catch (error) {
    console.error('Change password error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
