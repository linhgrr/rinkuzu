import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { createPostizConnector, PostizConnectorError } from '@/lib/postiz/connector';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

const querySchema = z
  .object({
    operation: z.enum(['capabilities', 'posts', 'analytics']).default('capabilities'),
    integrationId: z.string().min(1).optional(),
    startDate: z.iso.datetime().optional(),
    endDate: z.iso.datetime().optional(),
    postId: z.string().min(1).optional(),
    date: z.coerce.number().int().min(1).max(365).default(30),
  })
  .strict();

function connectorFromEnvironment() {
  const baseUrl = process.env['POSTIZ_PUBLIC_API_URL'];
  const apiKey = process.env['POSTIZ_API_KEY'];
  const ownedIntegrationIds = new Set(
    (process.env['POSTIZ_OWNED_INTEGRATION_IDS'] ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (!baseUrl || !apiKey || ownedIntegrationIds.size === 0) {
    throw new PostizConnectorError(
      'POSTIZ_CONNECTOR_NOT_CONFIGURED',
      'Postiz URL, API key, and owned integration allowlist are required.',
      503,
    );
  }
  return createPostizConnector({ baseUrl, apiKey, ownedIntegrationIds });
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new PostizConnectorError('INVALID_REQUEST', `Missing query parameter: ${name}.`, 400);
  }
  return value;
}

function errorResponse(error: unknown) {
  if (error instanceof PostizConnectorError) {
    return apiErr(error.code, error.message, error.status, error.details);
  }
  return apiErr('POSTIZ_CONNECTOR_FAILURE', 'Unexpected Postiz connector failure.', 502);
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const parsed = parseSearchParams(request, querySchema);
    if (!parsed.ok) return parsed.response;
    const { operation } = parsed.data;
    const connector = connectorFromEnvironment();
    if (operation === 'capabilities') return apiOk(connector.capabilities);
    const integrationId = required(parsed.data.integrationId, 'integrationId');
    const startDate = required(parsed.data.startDate, 'startDate');
    const endDate = required(parsed.data.endDate, 'endDate');
    if (operation === 'posts') {
      return apiOk(await connector.listPosts({ integrationId, startDate, endDate }));
    }
    if (operation === 'analytics') {
      const postId = required(parsed.data.postId, 'postId');
      const { date } = parsed.data;
      return apiOk(
        await connector.getAnalytics({ integrationId, postId, date, startDate, endDate }),
      );
    }
    throw new PostizConnectorError('POSTIZ_CAPABILITY_UNSUPPORTED', 'Unknown operation.', 409);
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withAdmin(async () => {
  try {
    return connectorFromEnvironment().reply();
  } catch (error) {
    return errorResponse(error);
  }
});
