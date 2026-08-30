import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { authMock, consumeRateLimitMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/billing-rate-limit', () => ({
  consumeBillingRateLimit: consumeRateLimitMock,
}));

import {
  withBillingUserBodyAction,
  withBillingUserOrderAction,
} from '@/lib/api/billing-user-action';
import { BillingDomainError } from '@/services/billing/billing-domain';

const ORDER_ID = 'a3b0c442-98fc-1c14-9afb-4c4d0f3ab000';
const CSRF = 'a-billing-csrf-token-value';
const ORIGIN = 'http://localhost';

function userSession() {
  return { user: { id: 'user-1', email: 'learner@example.test', role: 'user' } };
}

function request(body?: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${ORIGIN}/api/billing/orders/${ORDER_ID}/cancel`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      'sec-fetch-site': 'same-origin',
      'x-billing-csrf': CSRF,
      cookie: `rk_billing_csrf=${CSRF}`,
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const routeContext = { params: Promise.resolve({ orderId: ORDER_ID }) };

/**
 * These two wrappers are the only place the customer-facing billing writes get
 * their same-origin guard and their per-user rate limit. A route that lost
 * either would still answer 200 on the happy path, so the tests below assert the
 * refusals rather than the success — the success is the part that cannot break
 * quietly.
 */
describe('withBillingUserOrderAction', () => {
  const run = vi.fn();
  const route = withBillingUserOrderAction('order_cancel_user', 'cancel-order', run);

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(userSession());
    consumeRateLimitMock.mockResolvedValue(undefined);
    run.mockResolvedValue({ data: { id: ORDER_ID, status: 'cancelled' } });
  });

  it('charges the caller a rate-limit token before touching the order', async () => {
    const response = await route(request(), routeContext);

    expect(response.status).toBe(200);
    expect(consumeRateLimitMock).toHaveBeenCalledWith('order_cancel_user', 'user-1');
    expect(run).toHaveBeenCalledWith('user-1', ORDER_ID);
  });

  it('refuses a cross-origin submission before the rate limit is charged', async () => {
    const response = await route(request(undefined, { origin: 'https://evil.test' }), routeContext);

    expect(response.status).toBe(403);
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('is closed to anyone without a session', async () => {
    authMock.mockResolvedValue(null);

    const response = await route(request(), routeContext);

    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('lets a rate-limit refusal through with the status it earned', async () => {
    consumeRateLimitMock.mockRejectedValue(
      new BillingDomainError('rate_limited', 'Too many cancellations', 429),
    );

    const response = await route(request(), routeContext);

    expect(response.status).toBe(429);
    expect(run).not.toHaveBeenCalled();
  });

  it('names the malformed route param instead of reaching the order', async () => {
    const response = await route(request(), { params: Promise.resolve({ orderId: 'not-an-id' }) });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe('validation_error');
    expect(payload.error.meta.fields).toHaveProperty('orderId');
    expect(run).not.toHaveBeenCalled();
  });

  it('honours the status an action chooses, so a replay is not reported as new', async () => {
    run.mockResolvedValue({ data: { id: ORDER_ID }, status: 201 });

    const response = await route(request(), routeContext);

    expect(response.status).toBe(201);
  });

  it('passes a ledger refusal through under its own scope', async () => {
    run.mockRejectedValue(new BillingDomainError('order_not_cancellable', 'Already paid', 409));

    const response = await route(request(), routeContext);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'order_not_cancellable' },
    });
  });
});

describe('withBillingUserBodyAction', () => {
  const schema = z.strictObject({ quoteToken: z.string().min(1) });
  const run = vi.fn();
  const route = withBillingUserBodyAction(schema, 'order_create_user', 'create-order', run);

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(userSession());
    consumeRateLimitMock.mockResolvedValue(undefined);
    run.mockResolvedValue({ data: { id: ORDER_ID }, status: 201 });
  });

  it('hands the action the validated body and the raw request', async () => {
    const response = await route(request({ quoteToken: 'quote-1' }), routeContext);

    expect(response.status).toBe(201);
    expect(run).toHaveBeenCalledWith('user-1', { quoteToken: 'quote-1' }, expect.any(NextRequest));
  });

  it('refuses a cross-origin submission before the rate limit is charged', async () => {
    const response = await route(
      request({ quoteToken: 'quote-1' }, { origin: 'https://evil.test' }),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('names the field it refused rather than reaching the ledger', async () => {
    const response = await route(request({ quoteToken: '' }), routeContext);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe('validation_error');
    expect(payload.error.meta.fields).toHaveProperty('quoteToken');
    expect(run).not.toHaveBeenCalled();
  });
});
