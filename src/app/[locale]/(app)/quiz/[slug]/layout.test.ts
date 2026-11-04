import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getQuizMetadataBySlug } = vi.hoisted(() => ({ getQuizMetadataBySlug: vi.fn() }));

vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({ getQuizMetadataBySlug }),
}));

import { generateMetadata } from './layout';

function metadataFor(slug: string) {
  return generateMetadata({
    children: null,
    params: Promise.resolve({ locale: 'en', slug }),
  });
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

describe('quiz layout robots metadata', () => {
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
