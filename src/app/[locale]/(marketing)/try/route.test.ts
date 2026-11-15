import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getBlogTryHref, getLandingStarterHref } = vi.hoisted(() => ({
  getBlogTryHref: vi.fn(),
  getLandingStarterHref: vi.fn(),
}));

vi.mock('@/lib/dashboard-factory', () => ({ getBlogTryHref, getLandingStarterHref }));

import { GET } from './route';

const CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=86400';
const FALLBACK_CACHE_CONTROL = 'public, s-maxage=60';

function requestTry(locale: string, query = '') {
  const request = new Request(`https://rinkuzu.test/${locale}/try${query}`);
  return GET(request, { params: Promise.resolve({ locale }) });
}

async function expectRedirect(
  response: Promise<Response>,
  location: string,
  cacheControl = location.endsWith('/quizzes') ? FALLBACK_CACHE_CONTROL : CACHE_CONTROL,
) {
  const res = await response;
  expect(res.status).toBe(307);
  expect(res.headers.get('location')).toBe(location);
  expect(res.headers.get('cache-control')).toBe(cacheControl);
  expect(res.headers.get('set-cookie')).toBeNull();
}

describe('/try play-first landing redirect (RIN-1178)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the starter for the page locale with entry=landing', async () => {
    getLandingStarterHref.mockResolvedValue('/quiz/fake-vi-starter?entry=landing');

    await expectRedirect(requestTry('vi'), '/vi/quiz/fake-vi-starter?entry=landing');
    expect(getLandingStarterHref).toHaveBeenCalledWith('vi');
  });

  it('falls back to the public quiz list, cached for a minute only, when no starter is eligible', async () => {
    getLandingStarterHref.mockResolvedValue(null);

    await expectRedirect(requestTry('en'), '/en/quizzes', FALLBACK_CACHE_CONTROL);
  });

  it('answers 404 for an unknown locale without a lookup', async () => {
    const res = await requestTry('xx');
    expect(res.status).toBe(404);
    expect(getLandingStarterHref).not.toHaveBeenCalled();
  });
});

describe('/try?entry=blog from a blog quiz card (RIN-1258)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to the playable quiz with entry and post', async () => {
    getBlogTryHref.mockResolvedValue('/quiz/fake-quiz?entry=blog&post=fake-post');

    await expectRedirect(
      requestTry('en', '?entry=blog&post=fake-post&quiz=fake-quiz'),
      '/en/quiz/fake-quiz?entry=blog&post=fake-post',
    );
    expect(getBlogTryHref).toHaveBeenCalledWith('en', { post: 'fake-post', quiz: 'fake-quiz' });
    expect(getLandingStarterHref).not.toHaveBeenCalled();
  });

  it('goes to the starter the resolver picks when the quiz is not playable', async () => {
    getBlogTryHref.mockResolvedValue('/quiz/fake-vi-starter?entry=blog&post=fake-post');

    await expectRedirect(
      requestTry('vi', '?entry=blog&post=fake-post&quiz=private-quiz'),
      '/vi/quiz/fake-vi-starter?entry=blog&post=fake-post',
    );
  });

  it('goes to the public quiz list, never a 404 or sign-in, when there is no starter', async () => {
    getBlogTryHref.mockResolvedValue(null);

    await expectRedirect(requestTry('vi', '?entry=blog&post=fake-post'), '/vi/quizzes');
  });

  it.each([
    ['?entry=blog&post=Bad_Post&quiz=ok-quiz', { quiz: 'ok-quiz' }],
    ['?entry=blog&post=ok-post&quiz=..%2Fadmin', { post: 'ok-post' }],
    [`?entry=blog&post=a&post=b&quiz=${'x'.repeat(81)}`, {}],
  ])('drops a malformed post or quiz (%s)', async (query, expected) => {
    getBlogTryHref.mockResolvedValue(null);

    await expectRedirect(requestTry('en', query), '/en/quizzes');
    expect(getBlogTryHref).toHaveBeenCalledWith('en', expected);
  });
});
