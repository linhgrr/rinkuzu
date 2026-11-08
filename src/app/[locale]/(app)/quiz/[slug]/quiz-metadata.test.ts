import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getQuizMetadataBySlug } = vi.hoisted(() => ({ getQuizMetadataBySlug: vi.fn() }));

vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({ getQuizMetadataBySlug }),
}));

import { siteUrl } from '@/lib/seo';
import { buildQuizMetadata } from './quiz-metadata';

function metadataFor(slug: string, options: { locale?: string; mode?: string | null } = {}) {
  return buildQuizMetadata({ locale: options.locale ?? 'en', slug, mode: options.mode ?? null });
}

function quizMetadata(overrides: Record<string, unknown>) {
  return {
    id: 'quiz-1',
    title: 'Biology basics',
    description: 'Cells and photosynthesis',
    slug: 'biology-basics',
    author: { id: 'owner-1', name: 'Lan' },
    folder: null,
    visibility: 'public',
    questionCount: 10,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ownerIndexable: true,
    ...overrides,
  };
}

function ogImageOf(metadata: Awaited<ReturnType<typeof buildQuizMetadata>>): URL {
  const images = metadata.openGraph?.images;
  const first = Array.isArray(images) ? images[0] : images;
  const url = typeof first === 'object' && first !== null && 'url' in first ? first.url : first;
  return new URL(String(url));
}

describe('quiz robots metadata', () => {
  beforeEach(() => {
    getQuizMetadataBySlug.mockReset();
  });

  it('indexes a public quiz of an indexable owner', async () => {
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({}));

    await expect(metadataFor('biology-basics')).resolves.toMatchObject({
      robots: { index: true, follow: true },
    });
  });

  // RIN-840: QA and company accounts' public quizzes stay out of search.
  it('marks a public quiz of a test or company owner noindex, nofollow', async () => {
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({ ownerIndexable: false }));

    const metadata = await metadataFor('photosynthesis-qa-w45-retest-000001');

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.title).toBe('Biology basics | RinKuzu');
  });

  it('keeps a personal quiz noindex', async () => {
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({ visibility: 'personal' }));

    await expect(metadataFor('biology-basics')).resolves.toMatchObject({
      robots: { index: false, follow: false },
    });
  });
});

describe('quiz OG card (RIN-1180)', () => {
  beforeEach(() => {
    getQuizMetadataBySlug.mockReset();
  });

  it('puts the question count and language on a public quiz card', async () => {
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({ questionCount: 42 }));

    const metadata = await metadataFor('biology-basics', { locale: 'vi' });
    const image = ogImageOf(metadata);

    expect(image.pathname).toBe('/og');
    expect(image.searchParams.get('title')).toBe('Biology basics | RinKuzu');
    expect(image.searchParams.get('count')).toBe('42');
    expect(image.searchParams.get('lang')).toBe('vi');
    expect(image.searchParams.has('quick')).toBe(false);
  });

  it('adds quick=1 for a quick link to a quiz of more than 15 questions', async () => {
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({ questionCount: 16 }));

    const metadata = await metadataFor('biology-basics', { mode: 'quick' });
    const image = ogImageOf(metadata);

    expect(image.searchParams.get('count')).toBe('16');
    expect(image.searchParams.get('lang')).toBe('en');
    expect(image.searchParams.get('quick')).toBe('1');
    // Canonical and og:url never carry the query (RIN-840).
    const canonical = `${siteUrl.origin}/en/quiz/biology-basics`;
    expect(metadata.alternates?.canonical).toBe(canonical);
    expect(metadata.openGraph?.url).toBe(canonical);
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it('does not add quick=1 for a 15-question quiz', async () => {
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({ questionCount: 15 }));

    const image = ogImageOf(await metadataFor('biology-basics', { mode: 'quick' }));

    expect(image.searchParams.get('count')).toBe('15');
    expect(image.searchParams.has('quick')).toBe(false);
  });

  it('does not add quick=1 without mode=quick', async () => {
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({ questionCount: 40 }));

    const image = ogImageOf(await metadataFor('biology-basics', { mode: 'full' }));

    expect(image.searchParams.has('quick')).toBe(false);
  });

  it('keeps the title-only card for a private quiz', async () => {
    getQuizMetadataBySlug.mockResolvedValue(
      quizMetadata({ visibility: 'private', questionCount: 40 }),
    );

    const image = ogImageOf(await metadataFor('biology-basics', { mode: 'quick' }));

    expect([...image.searchParams.keys()]).toEqual(['title']);
  });

  it('keeps the title-only default card when the quiz is not found (premium slugs)', async () => {
    getQuizMetadataBySlug.mockResolvedValue(null);

    const image = ogImageOf(await metadataFor('premium-biology', { mode: 'quick' }));

    expect([...image.searchParams.keys()]).toEqual(['title']);
  });
});

// RIN-1265: /en pages of a Vietnamese quiz point search engines at /vi.
describe('quiz language metadata', () => {
  beforeEach(() => {
    getQuizMetadataBySlug.mockReset();
  });

  it('canonicalizes /en of a Vietnamese quiz to /vi with a vi-only hreflang', async () => {
    getQuizMetadataBySlug.mockResolvedValue(
      quizMetadata({ title: 'Cách ghi nhớ những gì bạn học', slug: 'cach-ghi-nho' }),
    );

    const metadata = await metadataFor('cach-ghi-nho', { locale: 'en' });
    const viUrl = `${siteUrl.origin}/vi/quiz/cach-ghi-nho`;

    expect(metadata.alternates?.canonical).toBe(viUrl);
    expect(metadata.alternates?.languages).toEqual({ vi: viUrl, 'x-default': viUrl });
    expect(metadata.openGraph?.url).toBe(viUrl);
  });

  it('keeps the self canonical and both locales for a quiz with no Vietnamese text', async () => {
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({}));

    const metadata = await metadataFor('biology-basics', { locale: 'en' });

    expect(metadata.alternates?.canonical).toBe(`${siteUrl.origin}/en/quiz/biology-basics`);
    expect(metadata.alternates?.languages).toEqual({
      vi: `${siteUrl.origin}/vi/quiz/biology-basics`,
      en: `${siteUrl.origin}/en/quiz/biology-basics`,
      'x-default': `${siteUrl.origin}/vi/quiz/biology-basics`,
    });
  });
});
