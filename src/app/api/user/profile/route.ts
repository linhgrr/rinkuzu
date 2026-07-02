import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { updateProfileRequestSchema } from '@/dtos/account';
import { getAccountService } from '@/lib/account-factory';
import { readJsonBody } from '@/lib/api/request';

export const dynamic = 'force-dynamic';
const accountService = getAccountService();

export const GET = withAuth(async (_request, { email }) => {
  if (!email) return apiErr('unauthorized', 'Authentication required', 401);
  const result = await accountService.getProfile(email);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

export const PUT = withAuth(async (request: NextRequest, { email }) => {
  if (!email) return apiErr('unauthorized', 'Authentication required', 401);
  const body = await readJsonBody(request);
  if (!body.success) return apiErr('validation_error', body.error, 400);
  const parsed = updateProfileRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiErr('validation_error', parsed.error.issues[0]?.message ?? 'Invalid request', 400);
  }
  const result = await accountService.updateProfile(email, parsed.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
