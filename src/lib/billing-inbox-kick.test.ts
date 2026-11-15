import { beforeEach, describe, expect, it, vi } from 'vitest';

const { afterMock, processInboxMock, warnMock } = vi.hoisted(() => ({
  afterMock: vi.fn<(task: () => Promise<void>) => void>(),
  processInboxMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock('next/server', () => ({ after: afterMock }));
vi.mock('@/lib/billing-factory', () => ({
  createBillingService: () => ({ processInbox: processInboxMock }),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: warnMock } }));

import { kickWebhookInboxDrain } from '@/lib/billing-inbox-kick';

function scheduledTask(): () => Promise<void> {
  const task = afterMock.mock.calls[0]?.[0];
  if (!task) throw new Error('no task was scheduled');
  return task;
}

describe('kickWebhookInboxDrain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processInboxMock.mockResolvedValue({ claimed: 1, processed: 1, exhaustedBudget: false });
  });

  it('drains the inbox after the response, not before it', async () => {
    kickWebhookInboxDrain();

    expect(processInboxMock).not.toHaveBeenCalled();
    await scheduledTask()();
    expect(processInboxMock).toHaveBeenCalledTimes(1);
  });

  it('swallows a failed drain so the scheduler can pick the row up', async () => {
    processInboxMock.mockRejectedValue(new Error('mongo down'));
    kickWebhookInboxDrain();

    await expect(scheduledTask()()).resolves.toBeUndefined();
    expect(warnMock).toHaveBeenCalledTimes(1);
  });
});
