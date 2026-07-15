import { beforeEach, describe, expect, it, vi } from 'vitest';

const getQuizzes = vi.fn();

vi.mock('@/lib/serviceFactory', () => ({
  serviceFactory: {
    getQuizService: () => ({ getQuizzes }),
  },
}));

import sitemap from './sitemap';

describe('sitemap', () => {
  beforeEach(() => {
    getQuizzes.mockReset();
  });

  it('propagates quiz repository failures instead of caching an incomplete sitemap', async () => {
    getQuizzes.mockRejectedValue(new Error('database unavailable'));

    await expect(sitemap()).rejects.toThrow('database unavailable');
  });
});
