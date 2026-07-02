import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { updateProfileRequestSchema } from '@/dtos/account';
import { getAccountService } from '@/lib/account-factory';
import { readAndValidateJson } from '@/lib/api/request';

export const dynamic = 'force-dynamic';
const accountService = getAccountService();

export const GET = withAuth(async (_request, { email }) => {
  if (!email) return apiErr('unauthorized', 'Authentication required', 401);
  const result = await accountService.getProfile(email);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

export const PUT = withAuth(async (request: NextRequest, { email }) => {
  if (!email) return apiErr('unauthorized', 'Authentication required', 401);
  const input = await readAndValidateJson(request, updateProfileRequestSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }
  const result = await accountService.updateProfile(email, input.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
