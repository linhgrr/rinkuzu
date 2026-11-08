import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getCurrentSession,
  getQuizForPlay,
  getRetryQuizForPlay,
  resolveSlugAlias,
  getCatalogMetadataBySlug,
  getQuizMetadataBySlug,
  getRelatedPublicQuizzes,
  permanentRedirectMock,
  requestHeaders,
} = vi.hoisted(() => ({
  getRelatedPublicQuizzes: vi.fn(),
  getQuizMetadataBySlug: vi.fn(),
  requestHeaders: { current: new Headers() },
  getCurrentSession: vi.fn(),
  getQuizForPlay: vi.fn(),
  getRetryQuizForPlay: vi.fn(),
  resolveSlugAlias: vi.fn(),
  getCatalogMetadataBySlug: vi.fn(),
  permanentRedirectMock: vi.fn((target: string): never => {
    throw new Error(`permanentRedirect:${target}`);
  }),
}));

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(requestHeaders.current) }));
vi.mock('next/navigation', () => ({ permanentRedirect: permanentRedirectMock }));
vi.mock('@/lib/auth/session', () => ({ getCurrentSession }));
vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({
    getQuizForPlay,
    getRetryQuizForPlay,
    resolveSlugAlias,
    getQuizMetadataBySlug,
    getRelatedPublicQuizzes,
  }),
}));
vi.mock('@/lib/premium-quiz-factory', () => ({
  getPremiumQuizService: () => ({ getCatalogMetadataBySlug }),
}));
vi.mock('@/features/quiz/mappers/quiz-play.mapper', () => ({
  toQuizPlayViewModel: (quiz: unknown) => quiz,
}));
vi.mock('@/components/seo/QuizPageSchema', () => ({
  QuizPageSchema: () => null,
  QuizBreadcrumbSchema: () => null,
}));
vi.mock('@/features/quiz/components/landing/QuizLanding', () => ({ QuizLanding: () => null }));
vi.mock('./QuizPlayerClient', () => ({ default: () => null }));
vi.mock('./PremiumQuizPlayerClient', () => ({ default: () => null }));
vi.mock('@/features/quiz/components/PremiumQuizSignInPrompt', () => ({
  PremiumQuizSignInPrompt: () => null,
}));

import type { ReactElement, ReactNode } from 'react';
import { QuizPageSchema } from '@/components/seo/QuizPageSchema';
import QuizPlayerPage, { generateMetadata } from './page';
import QuizPlayerClient from './QuizPlayerClient';
import PremiumQuizPlayerClient from './PremiumQuizPlayerClient';
import { PremiumQuizSignInPrompt } from '@/features/quiz/components/PremiumQuizSignInPrompt';
import { QuizLanding } from '@/features/quiz/components/landing/QuizLanding';

/** Every element in a rendered tree, depth first. */
function elementsOf(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elementsOf);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [element as ReactElement<Record<string, unknown>>, ...elementsOf(element.props.children)];
}

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
    getCurrentSession.mockResolvedValue(null);
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
      props: { initialErrorStatus: 404, initialQuiz: null, slug: 'unknown-slug' },
    });
    expect(permanentRedirectMock).not.toHaveBeenCalled();
  });

  it('does not look up aliases when access is denied (403)', async () => {
    getQuizForPlay.mockResolvedValue({ success: false, error: 'Forbidden', statusCode: 403 });

    await renderPage(NEW_SLUG);
    expect(resolveSlugAlias).not.toHaveBeenCalled();
  });
});

describe('QuizPlayerPage premium quizzes (RIN-747)', () => {
  const premiumMetadata = {
    quizId: 'quiz-1',
    title: 'Nhập môn trí tuệ nhân tạo',
    questionCount: 40,
    description: 'Trắc nghiệm LMS',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getCatalogMetadataBySlug.mockResolvedValue(premiumMetadata);
  });

  it('shows a guest the sign-in prompt and never mounts the session-starting player', async () => {
    getCurrentSession.mockResolvedValue(null);

    const element = await renderPage('premium-ai');

    expect(element).toMatchObject({
      type: PremiumQuizSignInPrompt,
      props: {
        slug: 'premium-ai',
        title: premiumMetadata.title,
        questionCount: 40,
        description: 'Trắc nghiệm LMS',
      },
    });
    expect(getQuizForPlay).not.toHaveBeenCalled();
  });

  it('mounts the player for a signed-in user (unlock and access flows unchanged)', async () => {
    getCurrentSession.mockResolvedValue({ user: { id: 'user-1', role: 'user' } });

    const element = await renderPage('premium-ai');

    expect(element).toMatchObject({
      type: PremiumQuizPlayerClient,
      props: { quizId: 'quiz-1', slug: 'premium-ai', questionCount: 40 },
    });
  });
});

describe('QuizPlayerPage structured data author (RIN-840)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSession.mockResolvedValue(null);
    getCatalogMetadataBySlug.mockResolvedValue(null);
  });

  async function schemaProps(author: Record<string, unknown> | null) {
    getQuizForPlay.mockResolvedValue({
      success: true,
      data: {
        title: 'Quiz',
        visibility: 'public',
        questionCount: 7,
        author,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    });
    const page = (await renderPage(NEW_SLUG)) as ReactElement<{ children: ReactNode }>;
    const schema = elementsOf(page).find((child) => child.type === QuizPageSchema);
    expect(schema).toBeDefined();
    return schema?.props ?? {};
  }

  it('passes the display name, then the name, as the schema author', async () => {
    await expect(
      schemaProps({ id: 'u1', displayName: ' Lan Anh ', name: 'Lan' }),
    ).resolves.toMatchObject({ authorName: 'Lan Anh' });
    await expect(schemaProps({ id: 'u1', displayName: '  ', name: 'Minh' })).resolves.toMatchObject(
      { authorName: 'Minh' },
    );
  });

  it.each([null, { id: 'qa-run@fldubai.com' }, { id: 'u1', name: ' ', displayName: '' }])(
    'passes no author name for %j, so the schema names RinKuzu',
    async (author) => {
      const props = await schemaProps(author);

      expect(props).not.toHaveProperty('authorName');
      expect(JSON.stringify(props)).not.toContain('User');
      expect(JSON.stringify(props)).not.toContain('fldubai');
    },
  );
});

describe('QuizPlayerPage retry-missed session (RIN-917)', () => {
  const ATTEMPT_ID = '6a8ed20a3d0a1892cacdfe0b';
  const quizData = (questionCount: number) => ({
    success: true,
    data: {
      title: 'Quiz',
      visibility: 'personal',
      questionCount,
      author: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getCatalogMetadataBySlug.mockResolvedValue(null);
    getCurrentSession.mockResolvedValue({ user: { id: 'user-1', role: 'user' } });
    getQuizForPlay.mockResolvedValue(quizData(10));
  });

  it('plays only the missed questions for a signed-in learner', async () => {
    getRetryQuizForPlay.mockResolvedValue(quizData(3));

    const page = await renderPage(NEW_SLUG, { retryOf: ATTEMPT_ID });

    expect(getRetryQuizForPlay).toHaveBeenCalledWith(NEW_SLUG, ATTEMPT_ID, 'user-1', 'user');
    expect(getQuizForPlay).not.toHaveBeenCalled();
    expect(page).toBeTruthy();
  });

  it('falls back to the full quiz when the retry cannot be built', async () => {
    getRetryQuizForPlay.mockResolvedValue({ success: false, error: 'Not found', statusCode: 404 });

    await renderPage(NEW_SLUG, { retryOf: ATTEMPT_ID });

    expect(getQuizForPlay).toHaveBeenCalledWith(NEW_SLUG, 'user', 'user-1');
  });

  it.each([
    ['an invalid id', 'not-an-id', { user: { id: 'user-1', role: 'user' } }],
    ['a guest', ATTEMPT_ID, null],
  ])('ignores retryOf for %s', async (_label, retryOf, session) => {
    getCurrentSession.mockResolvedValue(session);

    await renderPage(NEW_SLUG, { retryOf });

    expect(getRetryQuizForPlay).not.toHaveBeenCalled();
    expect(getQuizForPlay).toHaveBeenCalled();
  });
});

describe('QuizPlayerPage server-rendered first question (RIN-1032)', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148';
  const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36';

  beforeEach(() => {
    vi.clearAllMocks();
    getCatalogMetadataBySlug.mockResolvedValue(null);
    getCurrentSession.mockResolvedValue(null);
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
  });

  async function playerProps(headerValues: Record<string, string>) {
    requestHeaders.current = new Headers(headerValues);
    const page = (await renderPage(NEW_SLUG)) as ReactElement<{ children: ReactNode[] }>;
    const player = page.props.children.find(
      (child): child is ReactElement<Record<string, unknown>> =>
        (child as ReactElement | null)?.type === QuizPlayerClient,
    );
    return player?.props ?? {};
  }

  it.each([
    ['a phone user agent', { 'user-agent': IPHONE }, true],
    ['a desktop user agent', { 'user-agent': DESKTOP }, false],
    [
      'the mobile client hint over the user agent',
      { 'user-agent': IPHONE, 'sec-ch-ua-mobile': '?0' },
      false,
    ],
  ])('guesses the layout from %s', async (_label, headerValues, mobile) => {
    const props = await playerProps(headerValues);

    expect(props['initialMobile']).toBe(mobile);
    expect(props['shuffleSeed']).toEqual(expect.any(Number));
  });

  it('draws a new seed for every request', async () => {
    const seeds = new Set<unknown>();
    for (let request = 0; request < 5; request += 1) {
      seeds.add((await playerProps({ 'user-agent': DESKTOP }))['shuffleSeed']);
    }

    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('QuizPlayerPage metadata (RIN-1180)', () => {
  beforeEach(() => {
    getQuizMetadataBySlug.mockReset();
  });

  it('passes ?mode=quick to the share card of a long public quiz', async () => {
    getQuizMetadataBySlug.mockResolvedValue({
      title: 'Sinh học',
      slug: NEW_SLUG,
      visibility: 'public',
      questionCount: 30,
      ownerIndexable: true,
      leadQuestionTexts: ['Quang hợp diễn ra ở đâu?'],
      contentLocale: 'vi',
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'vi', slug: NEW_SLUG }),
      searchParams: Promise.resolve({ mode: ['quick', 'full'] }),
    });

    const images = metadata.openGraph?.images as { url: string }[];
    const image = new URL(images[0]?.url ?? '');
    expect(image.searchParams.get('count')).toBe('30');
    expect(image.searchParams.get('quick')).toBe('1');
    expect(metadata.openGraph?.url).toMatch(new RegExp(`/vi/quiz/${NEW_SLUG}$`, 'u'));
  });
});

// RIN-1241 / RIN-1247: the server landing for an indexable public quiz.
describe('QuizPlayerPage landing (RIN-1247)', () => {
  const quiz = {
    id: 'quiz-1',
    slug: NEW_SLUG,
    title: 'Sinh học 10',
    visibility: 'public',
    questionCount: 20,
    author: { id: 'owner-1', displayName: 'Cô Lan' },
    questions: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
  const metadata = {
    visibility: 'public',
    ownerIndexable: true,
    questionCount: 20,
    leadQuestionTexts: ['Tế bào là gì?'],
    contentLocale: 'vi',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getCatalogMetadataBySlug.mockResolvedValue(null);
    getCurrentSession.mockResolvedValue(null);
    getQuizForPlay.mockResolvedValue({ success: true, data: quiz });
    getQuizMetadataBySlug.mockResolvedValue(metadata);
    getRelatedPublicQuizzes.mockResolvedValue([
      { slug: 'hoa-hoc', title: 'Hóa học', questionCount: 12 },
    ]);
  });

  async function landingOf(searchParams: Record<string, string> = {}) {
    const page = await renderPage(NEW_SLUG, searchParams);
    const landing = elementsOf(page).find((child) => child.type === QuizLanding);
    const player = elementsOf(page).find((child) => child.type === QuizPlayerClient);
    return { landing, player };
  }

  it('shows a guest the landing, not the player, with same-language related quizzes', async () => {
    const { landing, player } = await landingOf();

    expect(player).toBeUndefined();
    expect(landing?.props).toMatchObject({ locale: 'vi', signedIn: false });
    expect(getRelatedPublicQuizzes).toHaveBeenCalledWith({
      excludeSlug: NEW_SLUG,
      contentLocale: 'vi',
      limit: 6,
    });
  });

  it('shows a signed-in non-owner the landing with the short labels', async () => {
    getCurrentSession.mockResolvedValue({ user: { id: 'learner-1', role: 'user' } });

    const { landing } = await landingOf();

    expect(landing?.props).toMatchObject({ signedIn: true });
  });

  it('gives the owner the player as before', async () => {
    getCurrentSession.mockResolvedValue({ user: { id: 'owner-1', role: 'user' } });

    const { landing, player } = await landingOf();

    expect(landing).toBeUndefined();
    expect(player).toBeDefined();
  });

  it.each([{ mode: 'quick' }, { entry: 'quiz_landing' }, { retryOf: 'x' }])(
    'skips the landing when the URL has %j',
    async (searchParams) => {
      const { landing, player } = await landingOf(searchParams);

      expect(landing).toBeUndefined();
      expect(player).toBeDefined();
    },
  );

  it('skips the landing for a quiz that is not indexable', async () => {
    getQuizMetadataBySlug.mockResolvedValue({ ...metadata, ownerIndexable: false });

    const { landing, player } = await landingOf();

    expect(landing).toBeUndefined();
    expect(player).toBeDefined();
    expect(getRelatedPublicQuizzes).not.toHaveBeenCalled();
  });

  it('still renders the landing when the related query fails', async () => {
    getRelatedPublicQuizzes.mockRejectedValue(new Error('db down'));

    const { landing } = await landingOf();

    expect(landing).toBeDefined();
  });
});
