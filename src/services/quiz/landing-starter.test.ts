import { describe, expect, it, vi } from 'vitest';
import type { StarterQuizCandidateRecord } from '@/interfaces/repositories/IStarterQuizReadRepository';
import { BlogTryResolver, LandingStarterResolver } from '@/services/quiz/landing-starter';

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }));

const slugs = ['vi-one', 'en-one', 'vi-two'];
const entries = slugs.map((slug, index) => ({
  quizId: `id-${slug}`,
  locale: slug.slice(0, 2),
  order: index + 1,
}));

function candidate(slug: string, extra: Partial<StarterQuizCandidateRecord> = {}) {
  return {
    quizId: `id-${slug}`,
    slug,
    title: `Title ${slug}`,
    visibility: 'public',
    questionCount: 7,
    isPremium: false,
    ...extra,
  };
}

function createResolver(candidates = slugs.map((slug) => candidate(slug))) {
  const listStarterQuizEntries = vi.fn().mockResolvedValue(entries);
  const findStarterQuizCandidates = vi.fn().mockResolvedValue(candidates);
  return {
    resolver: new LandingStarterResolver({ listStarterQuizEntries, findStarterQuizCandidates }),
    findStarterQuizCandidates,
  };
}

describe('LandingStarterResolver (RIN-1178, RIN-1177)', () => {
  it.each([
    ['vi', '/quiz/vi-one?entry=landing'],
    ['en', '/quiz/en-one?entry=landing'],
  ])('links the first stored starter for the %s page', async (locale, href) => {
    const { resolver, findStarterQuizCandidates } = createResolver();

    await expect(resolver.resolveHref(locale)).resolves.toBe(href);
    expect(findStarterQuizCandidates).toHaveBeenCalledWith(entries.map(({ quizId }) => quizId));
  });

  it.each([
    ['missing', [candidate('vi-two')]],
    ['private', [candidate('vi-one', { visibility: 'private' }), candidate('vi-two')]],
    ['premium', [candidate('vi-one', { isPremium: true }), candidate('vi-two')]],
    ['empty', [candidate('vi-one', { questionCount: 0 }), candidate('vi-two')]],
  ])('skips a %s starter for the next eligible one', async (_reason, candidates) => {
    const { resolver } = createResolver(candidates);

    await expect(resolver.resolveHref('vi')).resolves.toBe('/quiz/vi-two?entry=landing');
  });

  it('opens a long starter as a quick round', async () => {
    const { resolver } = createResolver([candidate('vi-one', { questionCount: 40 })]);

    await expect(resolver.resolveHref('vi')).resolves.toBe('/quiz/vi-one?mode=quick&entry=landing');
  });

  it('returns null when no starter for the locale is eligible', async () => {
    const { resolver } = createResolver([candidate('vi-one', { isPremium: true })]);

    await expect(resolver.resolveHref('vi')).resolves.toBeNull();
    await expect(resolver.resolveHref('fr')).resolves.toBeNull();
  });

  it('fails open to null when the lookup throws', async () => {
    const resolver = new LandingStarterResolver({
      listStarterQuizEntries: vi.fn().mockRejectedValue(new Error('db down')),
      findStarterQuizCandidates: vi.fn(),
    });

    await expect(resolver.resolveHref('en')).resolves.toBeNull();
  });
});

describe('BlogTryResolver (RIN-1258)', () => {
  function createBlogResolver(found: StarterQuizCandidateRecord | null | Error) {
    const findQuizCandidateBySlug = vi.fn(() =>
      found instanceof Error ? Promise.reject(found) : Promise.resolve(found),
    );
    const { resolver: starters } = createResolver();
    return {
      resolver: new BlogTryResolver({ findQuizCandidateBySlug }, starters),
      findQuizCandidateBySlug,
    };
  }

  it('opens a playable quiz with entry=blog and the post', async () => {
    const { resolver, findQuizCandidateBySlug } = createBlogResolver(candidate('blog-quiz'));

    await expect(
      resolver.resolveHref('en', { post: 'fake-post', quiz: 'blog-quiz' }),
    ).resolves.toBe('/quiz/blog-quiz?entry=blog&post=fake-post');
    expect(findQuizCandidateBySlug).toHaveBeenCalledWith('blog-quiz');
  });

  it('opens a long quiz as a quick round, under its current slug', async () => {
    const { resolver } = createBlogResolver(candidate('renamed-quiz', { questionCount: 40 }));

    await expect(resolver.resolveHref('vi', { post: 'p', quiz: 'old-quiz' })).resolves.toBe(
      '/quiz/renamed-quiz?mode=quick&entry=blog&post=p',
    );
  });

  it.each([
    ['missing', null],
    ['private', candidate('blog-quiz', { visibility: 'private' })],
    ['premium', candidate('blog-quiz', { isPremium: true })],
    ['empty', candidate('blog-quiz', { questionCount: 0 })],
    ['unreadable', new Error('db down')],
  ])('falls back to the locale starter for a %s quiz', async (_reason, found) => {
    const { resolver } = createBlogResolver(found);

    await expect(resolver.resolveHref('vi', { post: 'p', quiz: 'blog-quiz' })).resolves.toBe(
      '/quiz/vi-one?entry=blog&post=p',
    );
  });

  it('opens the starter without a post from the /blog index', async () => {
    const { resolver, findQuizCandidateBySlug } = createBlogResolver(null);

    await expect(resolver.resolveHref('en', {})).resolves.toBe('/quiz/en-one?entry=blog');
    expect(findQuizCandidateBySlug).not.toHaveBeenCalled();
  });
});
