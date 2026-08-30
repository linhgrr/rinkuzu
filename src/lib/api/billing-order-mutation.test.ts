import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, recordAdjustmentMock, resolveExcessMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  recordAdjustmentMock: vi.fn(),
  resolveExcessMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/billing-factory', () => ({ createAdjustmentDeps: () => ({}) }));
vi.mock('@/services/billing/adjustments/record-adjustment', () => ({
  recordExternalMoneyAdjustment: recordAdjustmentMock,
  resolveOrderExcess: resolveExcessMock,
}));

import { POST as adjustmentRoute } from '@/app/api/admin/billing/orders/[orderId]/external-adjustments/route';
import { POST as excessRoute } from '@/app/api/admin/billing/orders/[orderId]/excess-resolution/route';
import { BillingDomainError } from '@/services/billing/billing-domain';

const ORDER_ID = 'a3b0c442-98fc-1c14-9afb-4c4d0f3ab000';
const CSRF = 'a-billing-csrf-token-value';
const ORIGIN = 'http://localhost';

function adminSession(role = 'admin') {
  return { user: { id: 'admin-1', email: 'ops@example.test', role } };
}

function mutationRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${ORIGIN}/api/admin/billing/orders/${ORDER_ID}/external-adjustments`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      'sec-fetch-site': 'same-origin',
      'x-billing-csrf': CSRF,
      cookie: `rk_billing_csrf=${CSRF}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const routeContext = { params: Promise.resolve({ orderId: ORDER_ID }) };

const ADJUSTMENT = {
  orderId: ORDER_ID,
  type: 'refund',
  externalReference: 'bank-ref-1',
  amount: 100_000,
  currency: 'VND',
  allocation: 'principal',
  occurredAt: '2026-08-28T09:00:00.000Z',
};

const VERDICT = {
  orderId: ORDER_ID,
  command: 'refund',
  reason: 'Returned to the payer bank account',
};

/**
 * Both of these routes are a hand on the ledger. Everything that has to hold
 * before money moves — an admin session, a same-origin token, a body that
 * matches the route, and the operator's identity riding into the write — lives
 * in one wrapper precisely so a route cannot quietly ship without one of them.
 * These tests are that wrapper's contract, exercised through both routes.
 */
describe('recording external money', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
    recordAdjustmentMock.mockResolvedValue({ id: ORDER_ID, settlementStatus: 'refunded' });
  });

  it('records the adjustment against the operator who submitted it', async () => {
    const response = await adjustmentRoute(mutationRequest(ADJUSTMENT), routeContext);

    expect(response.status).toBe(200);
    expect(recordAdjustmentMock).toHaveBeenCalledWith(expect.anything(), {
      ...ADJUSTMENT,
      recordedBy: 'admin-1',
    });
  });

  it('is closed to anyone who is not an admin', async () => {
    authMock.mockResolvedValue(adminSession('user'));

    const response = await adjustmentRoute(mutationRequest(ADJUSTMENT), routeContext);

    expect(response.status).toBeGreaterThanOrEqual(401);
    expect(recordAdjustmentMock).not.toHaveBeenCalled();
  });

  it('refuses a cross-origin submission', async () => {
    const response = await adjustmentRoute(
      mutationRequest(ADJUSTMENT, { origin: 'https://evil.test' }),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(recordAdjustmentMock).not.toHaveBeenCalled();
  });

  it('refuses a body that names a different order than the route', async () => {
    // Otherwise a page showing one order could record money against another.
    const response = await adjustmentRoute(
      mutationRequest({ ...ADJUSTMENT, orderId: '11111111-2222-4333-8444-555555555555' }),
      routeContext,
    );

    expect(response.status).toBe(400);
    expect(recordAdjustmentMock).not.toHaveBeenCalled();
  });

  it('refuses an adjustment type the ledger does not understand', async () => {
    const response = await adjustmentRoute(
      mutationRequest({ ...ADJUSTMENT, type: 'goodwill' }),
      routeContext,
    );

    expect(response.status).toBe(400);
    expect(recordAdjustmentMock).not.toHaveBeenCalled();
  });

  it('refuses an amount that is not a positive whole number of dong', async () => {
    for (const amount of [0, -1, 1.5]) {
      const response = await adjustmentRoute(
        mutationRequest({ ...ADJUSTMENT, amount }),
        routeContext,
      );
      expect(response.status).toBe(400);
    }
    expect(recordAdjustmentMock).not.toHaveBeenCalled();
  });

  /**
   * The 400s below are checked for their `fields` payload, not just their
   * status. That payload is what lets the operator console highlight the field
   * it refused instead of showing a bare "invalid request", and it is the part
   * a rewrite drops silently — the status stays 400 either way. Both wrappers
   * produce it through the same `parseParamsAndBody`; these tests are what
   * would notice if this one stopped.
   */
  it('names the field it refused, so the console can point at it', async () => {
    const response = await adjustmentRoute(
      mutationRequest({ ...ADJUSTMENT, amount: 0 }),
      routeContext,
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe('validation_error');
    expect(payload.error.meta.fields).toHaveProperty('amount');
    expect(recordAdjustmentMock).not.toHaveBeenCalled();
  });

  it('refuses a malformed order id in the route before it ever reads the body', async () => {
    const response = await adjustmentRoute(mutationRequest(ADJUSTMENT), {
      params: Promise.resolve({ orderId: 'not-an-order-id' }),
    });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe('validation_error');
    expect(payload.error.meta.fields).toHaveProperty('orderId');
    expect(recordAdjustmentMock).not.toHaveBeenCalled();
  });

  it('passes a ledger refusal through with the status it earned', async () => {
    recordAdjustmentMock.mockRejectedValue(
      new BillingDomainError('reversal_without_chargeback', 'Nothing to reverse', 409),
    );

    const response = await adjustmentRoute(mutationRequest(ADJUSTMENT), routeContext);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'reversal_without_chargeback' },
    });
  });
});

describe('closing an overpayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
    resolveExcessMock.mockResolvedValue({ id: ORDER_ID, excessResolution: 'refunded' });
  });

  it('records the verdict against the operator who made it', async () => {
    const response = await excessRoute(mutationRequest(VERDICT), routeContext);

    expect(response.status).toBe(200);
    expect(resolveExcessMock).toHaveBeenCalledWith(expect.anything(), {
      ...VERDICT,
      recordedBy: 'admin-1',
    });
  });

  it('requires a stated reason, because nothing else can justify the choice', async () => {
    for (const reason of ['', '  ', 'x']) {
      const response = await excessRoute(mutationRequest({ ...VERDICT, reason }), routeContext);
      expect(response.status).toBe(400);
    }
    expect(resolveExcessMock).not.toHaveBeenCalled();
  });

  it('accepts only the three disposals an operator can actually make', async () => {
    for (const command of ['refund', 'credit', 'write_off']) {
      await excessRoute(mutationRequest({ ...VERDICT, command }), routeContext);
    }
    expect(resolveExcessMock).toHaveBeenCalledTimes(3);

    const rejected = await excessRoute(
      mutationRequest({ ...VERDICT, command: 'ignore' }),
      routeContext,
    );
    expect(rejected.status).toBe(400);
    expect(resolveExcessMock).toHaveBeenCalledTimes(3);
  });

  it('is closed to anyone who is not an admin', async () => {
    authMock.mockResolvedValue(null);

    const response = await excessRoute(mutationRequest(VERDICT), routeContext);

    expect(response.status).toBe(401);
    expect(resolveExcessMock).not.toHaveBeenCalled();
  });

  it('reports a second verdict as a conflict rather than quietly succeeding', async () => {
    resolveExcessMock.mockRejectedValue(
      new BillingDomainError('excess_not_resolvable', 'Already resolved', 409),
    );

    const response = await excessRoute(mutationRequest(VERDICT), routeContext);

    expect(response.status).toBe(409);
  });
});
