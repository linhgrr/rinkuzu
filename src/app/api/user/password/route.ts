import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { changePasswordSchema, flattenZodError } from '@/lib/validation/auth';
import { getAccountService } from '@/lib/account-factory';
import { readJsonBody } from '@/lib/api/request';

const accountService = getAccountService();

export const PUT = withAuth(async (request: NextRequest, { email }) => {
  if (!email) return apiErr('unauthorized', 'Authentication required', 401);
  const body = await readJsonBody(request);
  if (!body.success) return apiErr('validation_error', body.error, 400);

  let input;
  try {
    input = changePasswordSchema.parse(body.data);
  } catch (error) {
    if (error instanceof ZodError) {
      const { detail, fields } = flattenZodError(error);
      return apiErr('validation_error', detail, 400, { fields });
    }
    throw error;
  }

  const result = await accountService.changePassword(
    email,
    input.currentPassword,
    input.newPassword,
  );
  return result.success
    ? apiOk(null, 200, { meta: { message: 'Password updated successfully' } })
    : apiServiceErr(result);
});
