import { describe, expect, it, vi } from 'vitest';
import type { DashboardStarterQuizCandidateRecord } from '@/interfaces/repositories/IDashboardRepository';
import { LandingStarterResolver } from '@/services/quiz/landing-starter';

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }));

const allowlist = [
  { slug: 'vi-one', locale: 'vi' },
  { slug: 'en-one', locale: 'en' },
  { slug: 'vi-two', locale: 'vi' },
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

function createResolver(candidates = allowlist.map(({ slug }) => candidate(slug))) {
  const findStarterQuizCandidates = vi.fn().mockResolvedValue(candidates);
  return {
    resolver: new LandingStarterResolver({ findStarterQuizCandidates }, allowlist),
    findStarterQuizCandidates,
  };
}

describe('LandingStarterResolver (RIN-1178)', () => {
  it.each([
    ['vi', 'vi-one'],
    ['en', 'en-one'],
  ])('picks the first starter for the %s page', async (locale, slug) => {
    const { resolver, findStarterQuizCandidates } = createResolver();

    await expect(resolver.resolve(locale)).resolves.toBe(slug);
    expect(findStarterQuizCandidates).toHaveBeenCalledWith(
      allowlist.filter((entry) => entry.locale === locale).map((entry) => entry.slug),
    );
  });

  it.each([
    ['missing', [candidate('vi-two')]],
    ['private', [candidate('vi-one', { visibility: 'private' }), candidate('vi-two')]],
    ['too long', [candidate('vi-one', { questionCount: 40 }), candidate('vi-two')]],
    ['premium', [candidate('vi-one', { isPremium: true }), candidate('vi-two')]],
  ])('skips a %s starter for the next eligible one', async (_reason, candidates) => {
    const { resolver } = createResolver(candidates);

    await expect(resolver.resolve('vi')).resolves.toBe('vi-two');
  });

  it('returns null when no starter for the locale is eligible', async () => {
    const { resolver } = createResolver([candidate('vi-one', { isPremium: true })]);

    await expect(resolver.resolve('vi')).resolves.toBeNull();
  });

  it('returns null without a lookup when the locale has no allowlisted starter', async () => {
    const { resolver, findStarterQuizCandidates } = createResolver();

    await expect(resolver.resolve('fr')).resolves.toBeNull();
    expect(findStarterQuizCandidates).not.toHaveBeenCalled();
  });

  it('fails open to null when the lookup throws', async () => {
    const findStarterQuizCandidates = vi.fn().mockRejectedValue(new Error('db down'));
    const resolver = new LandingStarterResolver({ findStarterQuizCandidates }, allowlist);

    await expect(resolver.resolve('en')).resolves.toBeNull();
  });
});
