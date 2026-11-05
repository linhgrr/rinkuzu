import { describe, expect, it, vi } from 'vitest';
import type { DashboardStarterQuizCandidateRecord } from '@/interfaces/repositories/IDashboardRepository';
import { NextQuizResolver } from '@/services/quiz/next-quiz';

const allowlist = [
  { slug: 'vi-one', locale: 'vi' },
  { slug: 'en-one', locale: 'en' },
  { slug: 'vi-two', locale: 'vi' },
  { slug: 'vi-three', locale: 'vi' },
];

function candidate(slug: string, extra: Partial<DashboardStarterQuizCandidateRecord> = {}) {
  return {
    slug,
    title: `Title ${slug}`,
    visibility: 'public',
    questionCount: 7,
    isPremium: false,
    ...extra,
  };
}

function createResolver(
  attempted: string[],
  candidates = allowlist.map(({ slug }) => candidate(slug)),
) {
  const findStarterQuizCandidates = vi.fn().mockResolvedValue(candidates);
  const findAttemptedQuizSlugs = vi.fn().mockResolvedValue(attempted);
  return {
    resolver: new NextQuizResolver(
      { findStarterQuizCandidates },
      { findAttemptedQuizSlugs },
      allowlist,
    ),
    findStarterQuizCandidates,
    findAttemptedQuizSlugs,
  };
}

const owner = { userId: '507f191e810c19729de860eb' };

describe('NextQuizResolver', () => {
  it('picks the first allowlisted quiz in the locale the learner has not attempted', async () => {
    const { resolver, findAttemptedQuizSlugs } = createResolver(['vi-two']);

    await expect(resolver.resolve({ owner, currentSlug: 'vi-one', locale: 'vi' })).resolves.toEqual(
      {
        slug: 'vi-three',
        title: 'Title vi-three',
      },
    );
    expect(findAttemptedQuizSlugs).toHaveBeenCalledWith(owner, ['vi-two', 'vi-three']);
  });

  it('skips allowlisted quizzes that are no longer public, short and free', async () => {
    const { resolver } = createResolver(
      [],
      [
        candidate('vi-one', { visibility: 'private' }),
        candidate('vi-two', { isPremium: true }),
        candidate('vi-three'),
      ],
    );

    await expect(resolver.resolve({ owner, currentSlug: 'other', locale: 'vi' })).resolves.toEqual({
      slug: 'vi-three',
      title: 'Title vi-three',
    });
  });

  it('returns null when everything in the locale was attempted', async () => {
    const { resolver } = createResolver(['en-one']);

    await expect(
      resolver.resolve({ owner, currentSlug: 'other', locale: 'en' }),
    ).resolves.toBeNull();
  });

  it('returns null without querying when the locale has no other entry', async () => {
    const { resolver, findStarterQuizCandidates } = createResolver([]);

    await expect(
      resolver.resolve({ owner, currentSlug: 'en-one', locale: 'en' }),
    ).resolves.toBeNull();
    expect(findStarterQuizCandidates).not.toHaveBeenCalled();
  });

  it('fails open to null when a lookup throws', async () => {
    const { resolver, findAttemptedQuizSlugs } = createResolver([]);
    findAttemptedQuizSlugs.mockRejectedValue(new Error('db down'));

    await expect(resolver.resolve({ owner, currentSlug: 'x', locale: 'vi' })).resolves.toBeNull();
  });
});
