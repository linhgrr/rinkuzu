import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { hasDueInboxWorkMock, processInboxMock } = vi.hoisted(() => ({
  hasDueInboxWorkMock: vi.fn<(nowMs: number) => Promise<boolean>>(),
  processInboxMock: vi.fn(),
}));

// The HMAC and nonce boundary has its own tests; here the tick is let through
// so what is under test is only what the route does once it is authenticated.
vi.mock('@/lib/api/internal-billing-tick', () => ({
  withInternalBillingTick:
    (_scope: string, run: (service: unknown, tick: string) => Promise<unknown>) => async () =>
      Response.json({ data: await run({ processInbox: processInboxMock }, 'tick-1') }),
}));
vi.mock('@/lib/billing-factory', () => ({
  createBillingIdleProbe: () => ({ hasDueInboxWork: hasDueInboxWorkMock }),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

import { POST } from '@/app/api/internal/billing/process/route';

const tick = (): NextRequest =>
  new NextRequest('https://rinkuzu.test/api/internal/billing/process', { method: 'POST' });

describe('POST /api/internal/billing/process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processInboxMock.mockResolvedValue({ claimed: 1, processed: 1, exhaustedBudget: false });
  });

  it('exits on the idle check without opening a drain when nothing is due', async () => {
    hasDueInboxWorkMock.mockResolvedValue(false);

    const response = await POST(tick());

    expect(hasDueInboxWorkMock).toHaveBeenCalledTimes(1);
    expect(processInboxMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      data: { claimed: 0, processed: 0, exhaustedBudget: false },
    });
  });

  it('drains a row whose webhook kick was lost on the next tick', async () => {
    hasDueInboxWorkMock.mockResolvedValue(true);

    const response = await POST(tick());

    expect(processInboxMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      data: { claimed: 1, processed: 1, exhaustedBudget: false },
    });
  });
});
