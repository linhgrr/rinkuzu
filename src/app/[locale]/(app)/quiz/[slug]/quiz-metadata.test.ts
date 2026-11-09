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
    personalDataFlagged: false,
    indexHold: false,
    leadQuestionTexts: ['What do chloroplasts do?'],
    contentLocale: 'en',
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

  // RIN-840: QA and company accounts' public quizzes stay out of search, but
  // the page still passes its links on (RIN-1241 D13).
  it('marks a public quiz of a test or company owner noindex, follow', async () => {
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({ ownerIndexable: false }));

    const metadata = await metadataFor('photosynthesis-qa-w45-retest-000001');

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  // RIN-1241 D13: fewer than 5 questions is too thin to index.
  it('marks a public quiz with fewer than 5 questions noindex, follow', async () => {
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({ questionCount: 4 }));

    await expect(metadataFor('biology-basics')).resolves.toMatchObject({
      robots: { index: false, follow: true },
    });
  });

  // RIN-1341: flagged or held quizzes stay playable but out of search; clearing
  // the flag or the hold indexes them again on the next request (no cache).
  it.each([{ personalDataFlagged: true }, { indexHold: true }])(
    'marks a public quiz with %o noindex, follow',
    async (block) => {
      getQuizMetadataBySlug.mockResolvedValue(quizMetadata(block));

      await expect(metadataFor('biology-basics')).resolves.toMatchObject({
        robots: { index: false, follow: true },
      });
    },
  );

  it('keeps a personal quiz noindex, nofollow', async () => {
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({ visibility: 'personal' }));

    const metadata = await metadataFor('biology-basics');

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.title).toBe('Biology basics | RinKuzu');
    expect(metadata.alternates?.canonical).toBe(`${siteUrl.origin}/en/quiz/biology-basics`);
  });
});

// RIN-1241 D14: one locale per quiz.
describe('quiz canonical per locale', () => {
  beforeEach(() => {
    getQuizMetadataBySlug.mockReset();
  });

  const viQuiz = quizMetadata({
    title: 'Chương 1 KTPM',
    description: '',
    slug: 'chuong-1-ktpm',
    contentLocale: 'vi',
    leadQuestionTexts: ['Kiểm thử phần mềm là gì?'],
  });

  it('indexes the content-locale page with a self canonical and no hreflang pair', async () => {
    getQuizMetadataBySlug.mockResolvedValue(viQuiz);

    const metadata = await metadataFor('chuong-1-ktpm', { locale: 'vi' });

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe(`${siteUrl.origin}/vi/quiz/chuong-1-ktpm`);
    expect(metadata.alternates?.languages).toBeUndefined();
  });

  it('points the other-locale page at the content-locale URL, noindex, follow', async () => {
    getQuizMetadataBySlug.mockResolvedValue(viQuiz);

    const metadata = await metadataFor('chuong-1-ktpm', { locale: 'en' });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(`${siteUrl.origin}/vi/quiz/chuong-1-ktpm`);
    expect(metadata.openGraph?.url).toBe(`${siteUrl.origin}/vi/quiz/chuong-1-ktpm`);
    expect(metadata.alternates?.languages).toBeUndefined();
  });

  it('writes the title and description in the quiz language on either page', async () => {
    getQuizMetadataBySlug.mockResolvedValue(viQuiz);

    for (const locale of ['vi', 'en']) {
      const metadata = await metadataFor('chuong-1-ktpm', { locale });

      expect(metadata.title).toBe('Chương 1 KTPM – 10 câu trắc nghiệm có đáp án | RinKuzu');
      expect(metadata.description).toBe(
        'Đề trắc nghiệm Chương 1 KTPM: 10 câu hỏi có đáp án và giải thích. Câu 1: Kiểm thử phần mềm là gì?',
      );
    }
  });

  it('keeps an owner description of 50+ characters', async () => {
    const description = 'Cells, chloroplasts and photosynthesis for grade 10 biology revision.';
    getQuizMetadataBySlug.mockResolvedValue(quizMetadata({ description }));

    const metadata = await metadataFor('biology-basics');

    expect(metadata.title).toBe('Biology basics – 10 quiz questions with answers | RinKuzu');
    expect(metadata.description).toBe(description);
  });

  it('drops the hreflang pair on the not-found default too', async () => {
    getQuizMetadataBySlug.mockResolvedValue(null);

    const metadata = await metadataFor('premium-biology');

    expect(metadata.alternates?.languages).toBeUndefined();
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
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
