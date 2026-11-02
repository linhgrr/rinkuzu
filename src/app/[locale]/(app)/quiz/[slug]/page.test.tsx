import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getQuizForPlay, resolveSlugAlias, getCatalogMetadataBySlug, permanentRedirectMock } =
  vi.hoisted(() => ({
    getQuizForPlay: vi.fn(),
    resolveSlugAlias: vi.fn(),
    getCatalogMetadataBySlug: vi.fn(),
    permanentRedirectMock: vi.fn((target: string): never => {
      throw new Error(`permanentRedirect:${target}`);
    }),
  }));

vi.mock('next/navigation', () => ({ permanentRedirect: permanentRedirectMock }));
vi.mock('@/lib/auth/session', () => ({ getCurrentSession: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({ getQuizForPlay, resolveSlugAlias }),
}));
vi.mock('@/lib/premium-quiz-factory', () => ({
  getPremiumQuizService: () => ({ getCatalogMetadataBySlug }),
}));
vi.mock('@/features/quiz/mappers/quiz-play.mapper', () => ({
  toQuizPlayViewModel: (quiz: unknown) => quiz,
}));
vi.mock('@/components/seo/QuizPageSchema', () => ({ QuizPageSchema: () => null }));
vi.mock('./QuizPlayerClient', () => ({ default: () => null }));
vi.mock('./PremiumQuizPlayerClient', () => ({ default: () => null }));

import QuizPlayerPage from './page';

const OLD_SLUG = 'cch-ghi-nh-quiz-096007';
const NEW_SLUG = 'cach-ghi-nho-quiz-096007';

function renderPage(slug: string, searchParams: Record<string, string | string[]> = {}) {
  return QuizPlayerPage({
    params: Promise.resolve({ locale: 'vi', slug }),
    searchParams: Promise.resolve(searchParams),
  });
}

describe('QuizPlayerPage slug aliases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCatalogMetadataBySlug.mockResolvedValue(null);
  });

  it('permanently redirects a former slug to the canonical slug, keeping locale and query', async () => {
    getQuizForPlay.mockResolvedValue({ success: false, error: 'Quiz not found', statusCode: 404 });
    resolveSlugAlias.mockResolvedValue(NEW_SLUG);

    await expect(renderPage(OLD_SLUG, { ref: 'starter', tag: ['a', 'b'] })).rejects.toThrow(
      `permanentRedirect:/vi/quiz/${NEW_SLUG}?ref=starter&tag=a&tag=b`,
    );
    expect(resolveSlugAlias).toHaveBeenCalledWith(OLD_SLUG);
  });

  it('renders the canonical slug without an alias lookup or redirect', async () => {
    getQuizForPlay.mockResolvedValue({
      success: true,
      data: {
        title: 'Quiz',
        visibility: 'personal',
        questionCount: 7,
        author: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    });

    await expect(renderPage(NEW_SLUG)).resolves.toBeTruthy();
    expect(resolveSlugAlias).not.toHaveBeenCalled();
    expect(permanentRedirectMock).not.toHaveBeenCalled();
  });

  it('keeps the not-found page for an unknown slug', async () => {
    getQuizForPlay.mockResolvedValue({ success: false, error: 'Quiz not found', statusCode: 404 });
    resolveSlugAlias.mockResolvedValue(null);

    await expect(renderPage('unknown-slug')).resolves.toMatchObject({
      props: { initialErrorMessage: 'Quiz not found', initialQuiz: null, slug: 'unknown-slug' },
    });
    expect(permanentRedirectMock).not.toHaveBeenCalled();
  });

  it('does not look up aliases when access is denied (403)', async () => {
    getQuizForPlay.mockResolvedValue({ success: false, error: 'Forbidden', statusCode: 403 });

    await renderPage(NEW_SLUG);
    expect(resolveSlugAlias).not.toHaveBeenCalled();
  });
});
