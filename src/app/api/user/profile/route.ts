import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { updateProfileRequestSchema } from '@/dtos/account';
import { getAccountService } from '@/lib/account-factory';
import { parseJsonBody } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';
const accountService = getAccountService();

export const GET = withAuth(async (_request, { email }) => {
  if (!email) return apiErr('unauthorized', 'Authentication required', 401);
  const result = await accountService.getProfile(email);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

export const PUT = withAuth(async (request: NextRequest, { email }) => {
  if (!email) return apiErr('unauthorized', 'Authentication required', 401);
  const input = await parseJsonBody(request, updateProfileRequestSchema);
  if (!input.ok) return input.response;
  const result = await accountService.updateProfile(email, {
    ...(input.data.displayName !== undefined ? { displayName: input.data.displayName } : {}),
    ...(input.data.bio !== undefined ? { bio: input.data.bio } : {}),
  });
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
