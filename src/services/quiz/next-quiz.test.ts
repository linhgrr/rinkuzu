import { describe, expect, it, vi } from 'vitest';
import type { StarterQuizCandidateRecord } from '@/interfaces/repositories/IStarterQuizReadRepository';
import { NextQuizResolver } from '@/services/quiz/next-quiz';

const slugs = ['vi-one', 'en-one', 'vi-two', 'vi-three'];
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

function createResolver(attempted: string[], candidates = slugs.map((slug) => candidate(slug))) {
  const listStarterQuizEntries = vi.fn().mockResolvedValue(entries);
  const findStarterQuizCandidates = vi.fn().mockResolvedValue(candidates);
  const findAttemptedQuizSlugs = vi.fn().mockResolvedValue(attempted);
  return {
    resolver: new NextQuizResolver(
      { listStarterQuizEntries, findStarterQuizCandidates },
      { findAttemptedQuizSlugs },
    ),
    findAttemptedQuizSlugs,
  };
}

const owner = { userId: '507f191e810c19729de860eb' };

describe('NextQuizResolver', () => {
  it('picks the first starter in the locale the learner has not attempted', async () => {
    const { resolver, findAttemptedQuizSlugs } = createResolver(['vi-two']);

    await expect(resolver.resolve({ owner, currentSlug: 'vi-one', locale: 'vi' })).resolves.toEqual(
      { slug: 'vi-three', title: 'Title vi-three', quick: false },
    );
    expect(findAttemptedQuizSlugs).toHaveBeenCalledWith(owner, ['vi-two', 'vi-three']);
  });

  it('skips starters that are no longer public and free, and marks a long one quick', async () => {
    const { resolver } = createResolver(
      [],
      [
        candidate('vi-one', { visibility: 'private' }),
        candidate('vi-two', { isPremium: true }),
        candidate('vi-three', { questionCount: 30 }),
      ],
    );

    await expect(resolver.resolve({ owner, currentSlug: 'other', locale: 'vi' })).resolves.toEqual({
      slug: 'vi-three',
      title: 'Title vi-three',
      quick: true,
    });
  });

  it('returns null when everything in the locale was attempted', async () => {
    const { resolver } = createResolver(['en-one']);

    await expect(
      resolver.resolve({ owner, currentSlug: 'other', locale: 'en' }),
    ).resolves.toBeNull();
  });

  it('returns null without an attempt lookup when the locale has no other starter', async () => {
    const { resolver, findAttemptedQuizSlugs } = createResolver([]);

    await expect(
      resolver.resolve({ owner, currentSlug: 'en-one', locale: 'en' }),
    ).resolves.toBeNull();
    expect(findAttemptedQuizSlugs).not.toHaveBeenCalled();
  });

  it('fails open to null when a lookup throws', async () => {
    const { resolver, findAttemptedQuizSlugs } = createResolver([]);
    findAttemptedQuizSlugs.mockRejectedValue(new Error('db down'));

    await expect(resolver.resolve({ owner, currentSlug: 'x', locale: 'vi' })).resolves.toBeNull();
  });
});
