import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/api/validated';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit } from '@/lib/auth-rate-limit';
import { ipBucketKey } from '@/lib/client-ip';
import { getUploadCounterService } from '@/lib/upload-counter-factory';
import { uploadRejectionRequestSchema } from '@/dtos/upload-rejection';
import { isAgentUserAgent } from '@/shared/constants/agent-traffic';

export const dynamic = 'force-dynamic';

/**
 * Counts one refused upload (RIN-1785). No sign-in and no consent: the body is
 * four allow-list values and nothing about the learner is stored (no IP, user
 * id, file name or content). Over the per-IP limit, and for our own agents,
 * the answer is the same 204 and nothing is counted.
 */
export async function POST(request: NextRequest) {
  const input = await parseJsonBody(request, uploadRejectionRequestSchema);
  if (!input.ok) return input.response;

  if (isAgentUserAgent(request.headers.get('user-agent'))) {
    return new NextResponse(null, { status: 204 });
  }
  const { ip } = extractRequestContext(request);
  const rate = await checkAuthRateLimit('upload_rejection_ip', ipBucketKey(ip));
  if (rate.allowed) {
    await getUploadCounterService().recordRejection(input.data);
  }
  return new NextResponse(null, { status: 204 });
}
