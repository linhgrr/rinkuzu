import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, consumeRateLimitMock, createOrderMock, afterCallbacks, fetchMock } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    consumeRateLimitMock: vi.fn(),
    createOrderMock: vi.fn(),
    afterCallbacks: [] as Array<() => unknown>,
    fetchMock: vi.fn(),
  }),
);

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => {
    afterCallbacks.push(callback);
  },
}));
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/billing-rate-limit', () => ({ consumeBillingRateLimit: consumeRateLimitMock }));
vi.mock('@/lib/billing-factory', () => ({
  createBillingOrderRepository: () => ({ createOrder: createOrderMock }),
}));

import { POST } from '@/app/api/billing/orders/route';
import { BillingDomainError } from '@/services/billing/billing-domain';

const CSRF = 'a-billing-csrf-token-value';
const ORIGIN = 'http://localhost';
const USER_ID = 'user-fake-1';
const USER_EMAIL = 'learner@example.test';
const QUOTE_TOKEN = 'q'.repeat(40);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function orderRequest(
  headers: Record<string, string> = {},
  body: unknown = { quoteToken: QUOTE_TOKEN },
): NextRequest {
  return new NextRequest(`${ORIGIN}/api/billing/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      'sec-fetch-site': 'same-origin',
      'x-billing-csrf': CSRF,
      'idempotency-key': 'idem-fake-1',
      cookie: `rk_billing_csrf=${CSRF}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function createdOrder(status = 201) {
  return {
    status,
    order: { id: 'order-fake-1', plan: { id: 'plan_monthly', name: 'Monthly' } },
  };
}

async function runAfterCallbacks(): Promise<void> {
  for (const callback of afterCallbacks.splice(0)) await callback();
}

function capturedPayloads(): Array<Record<string, unknown>> {
  return fetchMock.mock.calls.map(
    ([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>,
  );
}

const routeContext = { params: Promise.resolve({}) };

describe('POST /api/billing/orders checkout_started_server (RIN-1269)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    authMock.mockResolvedValue({ user: { id: USER_ID, email: USER_EMAIL, role: 'user' } });
    consumeRateLimitMock.mockResolvedValue(undefined);
    createOrderMock.mockResolvedValue(createdOrder());
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_fake');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://posthog.example.test');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('answers before the capture and then sends an anonymous event with country and locale', async () => {
    const response = await POST(
      orderRequest({
        'x-vercel-ip-country': 'DE',
        cookie: `rk_billing_csrf=${CSRF}; NEXT_LOCALE=en`,
      }),
      routeContext,
    );

    expect(response.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);

    await runAfterCallbacks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://posthog.example.test/i/v0/e/');
    const [payload] = capturedPayloads();
    expect(payload).toMatchObject({
      event: 'checkout_started_server',
      properties: {
        locale: 'en',
        plan: 'plan_monthly',
        country: 'DE',
        $process_person_profile: false,
      },
    });
    expect(payload?.['distinct_id']).toMatch(UUID_PATTERN);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(USER_ID);
    expect(serialized).not.toContain(USER_EMAIL);
    expect(Object.keys(payload?.['properties'] as object).sort()).toEqual([
      '$lib',
      '$process_person_profile',
      'country',
      'locale',
      'plan',
    ]);
  });

  it('uses a fresh distinct id per order', async () => {
    await POST(orderRequest(), routeContext);
    await POST(orderRequest(), routeContext);
    await runAfterCallbacks();

    const [first, second] = capturedPayloads();
    expect(first?.['distinct_id']).toMatch(UUID_PATTERN);
    expect(second?.['distinct_id']).toMatch(UUID_PATTERN);
    expect(first?.['distinct_id']).not.toBe(second?.['distinct_id']);
  });

  it('sends a null country without the header and falls back to the vi locale', async () => {
    await POST(orderRequest(), routeContext);
    await runAfterCallbacks();

    expect(capturedPayloads()[0]?.['properties']).toMatchObject({ country: null, locale: 'vi' });
  });

  it.each(['de', 'XX1', 'D', '<script>'])('drops a malformed country header %s', async (value) => {
    await POST(
      orderRequest({
        'x-vercel-ip-country': value,
        cookie: `rk_billing_csrf=${CSRF}; NEXT_LOCALE=fr`,
      }),
      routeContext,
    );
    await runAfterCallbacks();

    expect(capturedPayloads()[0]?.['properties']).toMatchObject({ country: null, locale: 'vi' });
  });

  it('emits nothing for an idempotent replay of an existing order', async () => {
    createOrderMock.mockResolvedValue(createdOrder(200));

    const response = await POST(orderRequest(), routeContext);
    await runAfterCallbacks();

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emits nothing when the order fails', async () => {
    createOrderMock.mockRejectedValue(new BillingDomainError('quote_stale', 'Quote is stale'));

    const response = await POST(orderRequest({ 'x-vercel-ip-country': 'US' }), routeContext);
    await runAfterCallbacks();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(afterCallbacks).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emits nothing when the body fails validation', async () => {
    const response = await POST(orderRequest({}, { quoteToken: 'short' }), routeContext);
    await runAfterCallbacks();

    expect(response.status).toBe(400);
    expect(createOrderMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
