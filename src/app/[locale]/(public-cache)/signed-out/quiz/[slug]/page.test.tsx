import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getQuizForPlay,
  resolveSlugAlias,
  getCatalogMetadataBySlug,
  getQuizMetadataBySlug,
  getRelatedPublicQuizzes,
  getQuizTopicContext,
  setRequestLocale,
} = vi.hoisted(() => ({
  getQuizForPlay: vi.fn(),
  resolveSlugAlias: vi.fn(),
  getCatalogMetadataBySlug: vi.fn(),
  getQuizMetadataBySlug: vi.fn(),
  getRelatedPublicQuizzes: vi.fn(() => Promise.resolve([])),
  getQuizTopicContext: vi.fn(() => Promise.resolve(null as unknown)),
  setRequestLocale: vi.fn(),
}));

vi.mock('next-intl/server', () => ({ setRequestLocale }));
vi.mock('next/navigation', () => ({
  permanentRedirect: (target: string): never => {
    throw new Error(`permanentRedirect:${target}`);
  },
}));
vi.mock('@/i18n/navigation', () => ({
  redirect: (target: { href: string; locale: string }): never => {
    throw new Error(`redirect:${target.locale}:${target.href}`);
  },
}));
vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({
    getQuizForPlay,
    resolveSlugAlias,
    getQuizMetadataBySlug,
    getRelatedPublicQuizzes,
  }),
}));
vi.mock('@/lib/quiz-topic-hub-factory', () => ({
  getQuizTopicHubService: () => ({ getQuizTopicContext }),
}));
vi.mock('@/lib/premium-quiz-factory', () => ({
  getPremiumQuizService: () => ({ getCatalogMetadataBySlug }),
}));
vi.mock('@/features/quiz/mappers/quiz-play.mapper', () => ({
  toQuizPlayViewModel: (quiz: unknown) => quiz,
}));
vi.mock('@/features/quiz/mappers/quiz-landing.mapper', () => ({
  toQuizLandingViewModel: (input: { slug: string; hubEntry: unknown }) => ({
    slug: input.slug,
    hubEntry: input.hubEntry,
  }),
}));
vi.mock('@/components/seo/QuizPageSchema', () => ({
  QuizPageSchema: () => null,
  QuizBreadcrumbSchema: () => null,
}));
vi.mock('@/features/quiz/components/landing/QuizLanding', () => ({ QuizLanding: () => null }));
vi.mock('@/app/[locale]/(app)/quiz/[slug]/QuizPlayerClient', () => ({ default: () => null }));
vi.mock('@/features/quiz/components/PremiumQuizSignInPrompt', () => ({
  PremiumQuizSignInPrompt: () => null,
}));

import type { ReactElement, ReactNode } from 'react';
import { QuizPageSchema } from '@/components/seo/QuizPageSchema';
import { QuizLanding } from '@/features/quiz/components/landing/QuizLanding';
import { PremiumQuizSignInPrompt } from '@/features/quiz/components/PremiumQuizSignInPrompt';
import QuizPlayerClient from '@/app/[locale]/(app)/quiz/[slug]/QuizPlayerClient';
import SignedOutQuizPage, { generateMetadata, generateStaticParams, revalidate } from './page';

function elementsOf(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elementsOf);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [element as ReactElement<Record<string, unknown>>, ...elementsOf(element.props.children)];
}

const SLUG = 'dai-so-tuyen-tinh';

const publicQuiz = {
  id: 'quiz-1',
  title: 'Fake linear algebra quiz',
  visibility: 'public',
  questionCount: 12,
  author: { id: 'author-1', displayName: 'Fake Author' },
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
};

const indexableMetadata = {
  visibility: 'public',
  title: 'Fake linear algebra quiz',
  contentLocale: 'vi',
  questionCount: 12,
  ownerIndexable: true,
  personalDataFlagged: false,
  indexHold: false,
  leadQuestionTexts: ['Fake question text?'],
};

function render(slug = SLUG, locale = 'vi') {
  return SignedOutQuizPage({ params: Promise.resolve({ locale, slug }) });
}

describe('signed-out quiz twin page (RIN-1647)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCatalogMetadataBySlug.mockResolvedValue(null);
    getQuizMetadataBySlug.mockResolvedValue(indexableMetadata);
    getQuizForPlay.mockResolvedValue({ success: true, data: publicQuiz });
  });

  it('is cached for ten minutes and renders each quiz on its first visit', () => {
    expect(revalidate).toBe(600);
    expect(generateStaticParams()).toEqual([]);
  });

  it('renders the landing for a signed-out visitor, with no viewer data', async () => {
    const page = await render();
    const landing = elementsOf(page as ReactNode).find((child) => child.type === QuizLanding);

    expect(setRequestLocale).toHaveBeenCalledWith('vi');
    expect(getQuizForPlay).toHaveBeenCalledWith(SLUG);
    expect(landing?.props).toMatchObject({
      locale: 'vi',
      signedIn: false,
      viewerEmail: null,
      ownedByViewer: false,
      landing: { slug: SLUG, hubEntry: null },
    });
    expect(elementsOf(page as ReactNode).some((child) => child.type === QuizPageSchema)).toBe(true);
  });

  it('shows the Premium sign-in prompt without reading the quiz', async () => {
    getCatalogMetadataBySlug.mockResolvedValue({
      quizId: 'quiz-9',
      title: 'Fake premium quiz',
      questionCount: 40,
      description: 'Fake description',
    });

    await expect(render('premium-ai')).resolves.toMatchObject({
      type: PremiumQuizSignInPrompt,
      props: { slug: 'premium-ai', title: 'Fake premium quiz', questionCount: 40, entry: null },
    });
    expect(getQuizForPlay).not.toHaveBeenCalled();
  });

  it('sends a guest draft slug to the guest draft player', async () => {
    await expect(render('guest-draft-play')).rejects.toThrow('redirect:vi:/try/pdf/play');
    expect(getQuizForPlay).not.toHaveBeenCalled();
  });

  it('permanently redirects a former slug to the canonical slug', async () => {
    getQuizForPlay.mockResolvedValue({ success: false, error: 'Quiz not found', statusCode: 404 });
    resolveSlugAlias.mockResolvedValue('slug-moi');

    await expect(render('slug-cu', 'en')).rejects.toThrow('permanentRedirect:/en/quiz/slug-moi');
  });

  it.each([404, 403])(
    'keeps the same error state for a missing or hidden quiz (%s)',
    async (status) => {
      getQuizForPlay.mockResolvedValue({
        success: false,
        code: 'not_found',
        error: 'Quiz not found',
        statusCode: status,
      });
      resolveSlugAlias.mockResolvedValue(null);

      await expect(render('an-hoac-khong-co')).resolves.toMatchObject({
        type: QuizPlayerClient,
        props: { initialErrorStatus: status, initialQuiz: null, slug: 'an-hoac-khong-co' },
      });
    },
  );

  it('never caches a failed read: a 5xx throws', async () => {
    getQuizForPlay.mockResolvedValue({ success: false, error: 'Internal', statusCode: 500 });

    await expect(render()).rejects.toThrow('signed-out twin (500)');
    expect(resolveSlugAlias).not.toHaveBeenCalled();
  });

  it.each([
    ['a quiz that is not indexable', { ...indexableMetadata, questionCount: 3 }],
    ['a quiz missing from the metadata read', null],
  ])('hands %s to the player on the dynamic route', async (_, metadata) => {
    getQuizMetadataBySlug.mockResolvedValue(metadata);

    await expect(render()).rejects.toThrow(`redirect:vi:/quiz/${SLUG}?view=play`);
  });

  it('hands a non-public quiz to the dynamic route too', async () => {
    getQuizForPlay.mockResolvedValue({
      success: true,
      data: { ...publicQuiz, visibility: 'personal' },
    });

    await expect(render()).rejects.toThrow(`redirect:vi:/quiz/${SLUG}?view=play`);
  });

  it('uses the same metadata as the dynamic page without a query', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'vi', slug: SLUG }),
    });

    expect(JSON.stringify(metadata.alternates)).toContain(`/vi/quiz/${SLUG}`);
  });
});
