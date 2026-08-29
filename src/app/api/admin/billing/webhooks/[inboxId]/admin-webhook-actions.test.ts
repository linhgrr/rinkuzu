import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, revealMock, replayMock, loggerErrorMock, operationDepsMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revealMock: vi.fn(),
  replayMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  operationDepsMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/billing-factory', () => ({
  createWebhookOperationDeps: operationDepsMock,
}));
vi.mock('@/services/billing/webhooks/webhook-operations', () => ({
  revealRetainedWebhookPayload: revealMock,
  replayWebhookEvent: replayMock,
}));

import { POST as revealRoute } from '@/app/api/admin/billing/webhooks/[inboxId]/payload/route';
import { POST as replayRoute } from '@/app/api/admin/billing/webhooks/[inboxId]/replay/route';

const INBOX_ID = '507f1f77bcf86cd799439011';
const CSRF = 'a-billing-csrf-token-value';
const ORIGIN = 'http://localhost';

function adminSession(role = 'admin') {
  return { user: { id: 'admin-1', email: 'ops@example.test', role } };
}

function actionRequest(
  path: string,
  headers: Record<string, string> = {},
  cookie = `rk_billing_csrf=${CSRF}`,
): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'sec-fetch-site': 'same-origin',
      'x-billing-csrf': CSRF,
      cookie,
      ...headers,
    },
  });
}

const routeContext = { params: Promise.resolve({ inboxId: INBOX_ID }) };

/**
 * Both operations touch the most sensitive rows billing keeps: one hands back
 * attacker-controlled provider text that may name a payer, the other puts a
 * webhook back into settlement. Neither may be reachable without an admin
 * session and a same-origin token, and the reveal must never be cacheable.
 */
describe('the retained-payload reveal endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
    operationDepsMock.mockReturnValue({});
    revealMock.mockResolvedValue({
      inboxRef: INBOX_ID,
      payload: '{"data":{"orderCode":4242}}',
      retained: true,
      unreadable: false,
    });
  });

  it('answers no-store, so the body never sits in a cache or a proxy log', async () => {
    const response = await revealRoute(
      actionRequest(`/api/admin/billing/webhooks/${INBOX_ID}/payload`),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('reveals one row, named by the operator asking for it', async () => {
    await revealRoute(
      actionRequest(`/api/admin/billing/webhooks/${INBOX_ID}/payload`),
      routeContext,
    );

    expect(revealMock).toHaveBeenCalledWith(expect.anything(), {
      inboxRef: INBOX_ID,
      operator: { id: 'admin-1', email: 'ops@example.test' },
    });
  });

  it('is closed to anyone who is not an admin', async () => {
    authMock.mockResolvedValue(adminSession('user'));

    const response = await revealRoute(
      actionRequest(`/api/admin/billing/webhooks/${INBOX_ID}/payload`),
      routeContext,
    );

    expect(response.status).toBeGreaterThanOrEqual(401);
    expect(revealMock).not.toHaveBeenCalled();
  });

  it('is closed to an unauthenticated caller', async () => {
    authMock.mockResolvedValue(null);

    const response = await revealRoute(
      actionRequest(`/api/admin/billing/webhooks/${INBOX_ID}/payload`),
      routeContext,
    );

    expect(response.status).toBe(401);
    expect(revealMock).not.toHaveBeenCalled();
  });

  it('refuses a request an admin’s browser was tricked into making', async () => {
    const response = await revealRoute(
      actionRequest(`/api/admin/billing/webhooks/${INBOX_ID}/payload`, {
        origin: 'https://evil.test',
      }),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(revealMock).not.toHaveBeenCalled();
  });

  it('refuses a request with no matching CSRF token', async () => {
    const response = await revealRoute(
      actionRequest(`/api/admin/billing/webhooks/${INBOX_ID}/payload`, {}, 'rk_billing_csrf=other'),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(revealMock).not.toHaveBeenCalled();
  });

  it('refuses a row id that is not one', async () => {
    const response = await revealRoute(
      actionRequest('/api/admin/billing/webhooks/not-an-id/payload'),
      { params: Promise.resolve({ inboxId: 'not-an-id' }) },
    );

    expect(response.status).toBe(400);
    expect(revealMock).not.toHaveBeenCalled();
  });
});

describe('the replay endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
    operationDepsMock.mockReturnValue({});
    replayMock.mockResolvedValue({ inboxRef: INBOX_ID, outcome: 'requeued', duplicate: false });
  });

  it('replays one row on behalf of the admin who asked', async () => {
    const response = await replayRoute(
      actionRequest(`/api/admin/billing/webhooks/${INBOX_ID}/replay`),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(replayMock).toHaveBeenCalledWith(expect.anything(), {
      inboxRef: INBOX_ID,
      operator: { id: 'admin-1', email: 'ops@example.test' },
    });
  });

  it('is closed to anyone who is not an admin', async () => {
    authMock.mockResolvedValue(adminSession('user'));

    const response = await replayRoute(
      actionRequest(`/api/admin/billing/webhooks/${INBOX_ID}/replay`),
      routeContext,
    );

    expect(response.status).toBeGreaterThanOrEqual(401);
    expect(replayMock).not.toHaveBeenCalled();
  });

  it('refuses a cross-origin replay', async () => {
    const response = await replayRoute(
      actionRequest(`/api/admin/billing/webhooks/${INBOX_ID}/replay`, {
        origin: 'https://evil.test',
      }),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(replayMock).not.toHaveBeenCalled();
  });

  it('reports a row that is not waiting on a replay as a conflict', async () => {
    const { BillingDomainError } = await import('@/services/billing/billing-domain');
    replayMock.mockRejectedValue(
      new BillingDomainError('webhook_not_replayable', 'Not waiting on a replay', 409),
    );

    const response = await replayRoute(
      actionRequest(`/api/admin/billing/webhooks/${INBOX_ID}/replay`),
      routeContext,
    );

    expect(response.status).toBe(409);
  });
});
