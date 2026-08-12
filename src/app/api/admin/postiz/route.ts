import type { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { createPostizConnector, PostizConnectorError } from '@/lib/postiz/connector';

export const dynamic = 'force-dynamic';

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

function required(search: URLSearchParams, name: string): string {
  const value = search.get(name);
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
    const operation = request.nextUrl.searchParams.get('operation') ?? 'capabilities';
    const connector = connectorFromEnvironment();
    if (operation === 'capabilities') return apiOk(connector.capabilities);
    const integrationId = required(request.nextUrl.searchParams, 'integrationId');
    const startDate = required(request.nextUrl.searchParams, 'startDate');
    const endDate = required(request.nextUrl.searchParams, 'endDate');
    if (operation === 'posts') {
      return apiOk(await connector.listPosts({ integrationId, startDate, endDate }));
    }
    if (operation === 'analytics') {
      const postId = required(request.nextUrl.searchParams, 'postId');
      const date = Number(request.nextUrl.searchParams.get('date') ?? '30');
      if (!Number.isInteger(date) || date < 1 || date > 365) {
        throw new PostizConnectorError('INVALID_REQUEST', 'date must be 1..365 days.', 400);
      }
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
