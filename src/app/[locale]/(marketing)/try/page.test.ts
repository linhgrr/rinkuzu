import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getLandingStarterSlug, redirectMock } = vi.hoisted(() => ({
  getLandingStarterSlug: vi.fn(),
  redirectMock: vi.fn((target: { href: string; locale: string }): never => {
    throw new Error(`redirect:${target.locale}:${target.href}`);
  }),
}));

vi.mock('@/i18n/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/lib/dashboard-factory', () => ({ getLandingStarterSlug }));

import TryPage from './page';

function renderTry(locale: string) {
  return TryPage({ params: Promise.resolve({ locale }) });
}

describe('/try play-first landing redirect (RIN-1178)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the starter for the page locale with entry=landing', async () => {
    getLandingStarterSlug.mockResolvedValue('fake-vi-starter');

    await expect(renderTry('vi')).rejects.toThrow(
      'redirect:vi:/quiz/fake-vi-starter?entry=landing',
    );
    expect(getLandingStarterSlug).toHaveBeenCalledWith('vi');
  });

  it('falls back to the public quiz list when no starter is eligible', async () => {
    getLandingStarterSlug.mockResolvedValue(null);

    await expect(renderTry('en')).rejects.toThrow('redirect:en:/quizzes');
  });
});
