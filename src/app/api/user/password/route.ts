import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { changePasswordSchema } from '@/lib/validation/auth';
import { getAccountService } from '@/lib/account-factory';
import { readAndValidateJson } from '@/lib/api/request';

const accountService = getAccountService();

export const PUT = withAuth(async (request: NextRequest, { email }) => {
  if (!email) return apiErr('unauthorized', 'Authentication required', 401);
  const input = await readAndValidateJson(request, changePasswordSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const result = await accountService.changePassword(
    email,
    input.data.currentPassword,
    input.data.newPassword,
  );
  return result.success
    ? apiOk(null, 200, { meta: { message: 'Password updated successfully' } })
    : apiServiceErr(result);
});
