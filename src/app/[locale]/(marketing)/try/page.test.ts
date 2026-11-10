import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getBlogTryHref, getLandingStarterHref, redirectMock } = vi.hoisted(() => ({
  getBlogTryHref: vi.fn(),
  getLandingStarterHref: vi.fn(),
  redirectMock: vi.fn((target: { href: string; locale: string }): never => {
    throw new Error(`redirect:${target.locale}:${target.href}`);
  }),
}));

vi.mock('@/i18n/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/lib/dashboard-factory', () => ({ getBlogTryHref, getLandingStarterHref }));

import TryPage from './page';

function renderTry(locale: string, query: Record<string, string | string[]> = {}) {
  return TryPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) });
}

describe('/try play-first landing redirect (RIN-1178)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the starter for the page locale with entry=landing', async () => {
    getLandingStarterHref.mockResolvedValue('/quiz/fake-vi-starter?entry=landing');

    await expect(renderTry('vi')).rejects.toThrow(
      'redirect:vi:/quiz/fake-vi-starter?entry=landing',
    );
    expect(getLandingStarterHref).toHaveBeenCalledWith('vi');
  });

  it('falls back to the public quiz list when no starter is eligible', async () => {
    getLandingStarterHref.mockResolvedValue(null);

    await expect(renderTry('en')).rejects.toThrow('redirect:en:/quizzes');
  });
});

describe('/try?entry=blog from a blog quiz card (RIN-1258)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to the playable quiz with entry and post', async () => {
    getBlogTryHref.mockResolvedValue('/quiz/fake-quiz?entry=blog&post=fake-post');

    await expect(
      renderTry('en', { entry: 'blog', post: 'fake-post', quiz: 'fake-quiz' }),
    ).rejects.toThrow('redirect:en:/quiz/fake-quiz?entry=blog&post=fake-post');
    expect(getBlogTryHref).toHaveBeenCalledWith('en', { post: 'fake-post', quiz: 'fake-quiz' });
    expect(getLandingStarterHref).not.toHaveBeenCalled();
  });

  it('goes to the starter the resolver picks when the quiz is not playable', async () => {
    getBlogTryHref.mockResolvedValue('/quiz/fake-vi-starter?entry=blog&post=fake-post');

    await expect(
      renderTry('vi', { entry: 'blog', post: 'fake-post', quiz: 'private-quiz' }),
    ).rejects.toThrow('redirect:vi:/quiz/fake-vi-starter?entry=blog&post=fake-post');
  });

  it('goes to the public quiz list, never a 404 or sign-in, when there is no starter', async () => {
    getBlogTryHref.mockResolvedValue(null);

    await expect(renderTry('vi', { entry: 'blog', post: 'fake-post' })).rejects.toThrow(
      'redirect:vi:/quizzes',
    );
  });

  it.each([
    [{ entry: 'blog', post: 'Bad_Post', quiz: 'ok-quiz' }, { quiz: 'ok-quiz' }],
    [{ entry: 'blog', post: 'ok-post', quiz: '../admin' }, { post: 'ok-post' }],
    [{ entry: 'blog', post: ['a', 'b'], quiz: 'x'.repeat(81) }, {}],
  ])('drops a malformed post or quiz (%j)', async (query, expected) => {
    getBlogTryHref.mockResolvedValue(null);

    await expect(renderTry('en', query)).rejects.toThrow('redirect:en:/quizzes');
    expect(getBlogTryHref).toHaveBeenCalledWith('en', expected);
  });
});
