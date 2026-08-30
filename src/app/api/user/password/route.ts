import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { changePasswordSchema } from '@/lib/validation/auth';
import { getAccountService } from '@/lib/account-factory';
import { parseJsonBody } from '@/lib/api/validated';

const accountService = getAccountService();

export const PUT = withAuth(async (request: NextRequest, { email }) => {
  if (!email) return apiErr('unauthorized', 'Authentication required', 401);
  const input = await parseJsonBody(request, changePasswordSchema);
  if (!input.ok) return input.response;

  const result = await accountService.changePassword(
    email,
    input.data.currentPassword,
    input.data.newPassword,
  );
  return result.success
    ? apiOk(result.data, 200, { meta: { message: 'Password updated successfully' } })
    : apiServiceErr(result);
});
