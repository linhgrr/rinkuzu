import 'server-only';

import type { NextRequest } from 'next/server';
import { apiErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { CommunicationError } from './internal';

export function assertCommunicationMutationRequest(request: NextRequest): void {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    throw new CommunicationError('unsupported_media_type', 'JSON request body required', 415);
  }
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (origin !== new URL(request.url).origin || fetchSite !== 'same-origin') {
    throw new CommunicationError('forbidden', 'Same-origin request required', 403);
  }
}

export function communicationHttpError(error: unknown, operation: string): Response {
  if (error instanceof CommunicationError) {
    return apiErr(error.code, error.message, error.status, error.meta);
  }
  logger.error({ error, operation }, 'Communication request failed');
  return apiErr('internal_error', 'Communication request failed', 500);
}
