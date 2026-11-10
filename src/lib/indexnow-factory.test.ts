import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  enabled: vi.fn(() => true),
  enqueue: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('next/server', () => ({ after: mocks.after }));
vi.mock('@/lib/logger', () => ({ logger: { warn: mocks.warn, info: vi.fn() } }));
vi.mock('@/lib/seo/indexnow', () => ({
  isIndexNowEnabled: mocks.enabled,
  submitIndexNow: vi.fn(),
}));
vi.mock('@/repositories/IndexNowQueueRepository', () => ({
  IndexNowQueueRepository: class {},
}));
vi.mock('@/services/seo/IndexNowService', () => ({
  IndexNowService: class {
    enqueue = mocks.enqueue;
  },
}));

import { indexNowNotifier, scheduleIndexNow } from '@/lib/indexnow-factory';

const QUIZ_URL = 'https://www.rinkuzu.app/vi/quiz/fake-biology-quiz';

describe('scheduleIndexNow (RIN-1500)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockReturnValue(true);
  });

  it('runs the enqueue after the response, not on the request path', async () => {
    let deferred: (() => Promise<void>) | undefined;
    mocks.after.mockImplementation((task: () => Promise<void>) => {
      deferred = task;
    });

    indexNowNotifier.notifyChanged([QUIZ_URL]);
    expect(mocks.enqueue).not.toHaveBeenCalled();

    await deferred?.();
    expect(mocks.enqueue).toHaveBeenCalledWith([QUIZ_URL]);
  });

  it('does nothing outside production or for no URLs', () => {
    scheduleIndexNow([]);
    mocks.enabled.mockReturnValue(false);
    scheduleIndexNow([QUIZ_URL]);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it('swallows an enqueue failure and logs it without the URLs', async () => {
    mocks.enqueue.mockRejectedValue(new Error('mongo down'));
    mocks.after.mockImplementation(() => {
      throw new Error('after() called outside a request scope');
    });

    expect(() => scheduleIndexNow([QUIZ_URL])).not.toThrow();
    await vi.waitFor(() => expect(mocks.warn).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(mocks.warn.mock.calls[0]?.[0])).not.toContain('rinkuzu.app');
  });
});
