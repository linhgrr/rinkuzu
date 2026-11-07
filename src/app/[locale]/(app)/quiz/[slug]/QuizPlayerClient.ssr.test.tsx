/** @vitest-environment node */

import { prerender } from 'react-dom/static';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizPlayerClient from './QuizPlayerClient';

type LayoutProps = {
  titleBadge?: string;
  questions?: { id: string }[];
  quiz?: { questions: { id: string }[] };
};

// Stable identities: the player's load effect depends on the router and progress callbacks.
const { router, progressApi, session } = vi.hoisted(() => ({
  router: { push: () => undefined, back: () => undefined, refresh: () => undefined },
  progressApi: {
    loadProgress: () => Promise.resolve(null),
    saveProgress: () => undefined,
    flushSave: () => undefined,
    clearProgress: () => Promise.resolve(),
  },
  session: {
    current: { data: null as null | { user: { email: string } }, status: 'unauthenticated' },
  },
}));

// The production build aliases next/dynamic to the App Router loader (React.lazy), which the
// server renders and streams; vitest would otherwise pick the Pages Router loader.
vi.mock('next/dynamic', () => import('next/dist/api/app-dynamic'));
vi.mock('next-auth/react', () => ({ useSession: () => session.current }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const translate = (key: string, values?: Record<string, unknown>) =>
  values?.['count'] !== undefined ? `${key}:${String(values['count'])}` : key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('@/features/quiz/hooks/useQuizProgress', () => ({ useQuizProgress: () => progressApi }));
function layoutStub(testId: string) {
  function LayoutStub({ titleBadge, questions, quiz }: LayoutProps) {
    const ids = (questions ?? quiz?.questions ?? []).map((question) => question.id).join(',');
    return (
      <div data-testid={testId} data-ids={ids}>
        {titleBadge ?? 'none'}
      </div>
    );
  }
  return LayoutStub;
}
vi.mock('@/features/quiz/components/player/DesktopQuizLayout', () => ({
  DesktopQuizLayout: layoutStub('desktop-layout'),
}));
vi.mock('@/features/quiz/components/player/MobileQuizLayout', () => ({
  MobileQuizLayout: layoutStub('mobile-layout'),
}));
vi.mock('@/components/ui/ConfirmModal', () => ({ ConfirmModal: () => null }));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: () => undefined,
  captureAnalyticsEventOnce: () => undefined,
}));

function fakeQuiz(questionCount: number) {
  return {
    id: 'quiz-1',
    title: 'Fake long quiz',
    slug: 'fake-quiz',
    author: null,
    folder: null,
    visibility: 'public' as const,
    questionCount,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    questions: Array.from({ length: questionCount }, (_, index) => ({
      id: `q${index}`,
      question: `Fake prompt ${index}`,
      options: ['a', 'b', 'c'],
      type: 'single' as const,
    })),
  };
}

async function serverHtml(options: { mode?: string; seed: number; mobile?: boolean }) {
  const { prelude } = await prerender(
    <QuizPlayerClient
      initialErrorCode={null}
      initialErrorStatus={null}
      initialQuiz={fakeQuiz(30)}
      slug="fake-quiz"
      shuffleSeed={options.seed}
      initialMobile={options.mobile ?? false}
      {...(options.mode ? { mode: options.mode } : {})}
    />,
  );
  return new Response(prelude).text();
}

function playedIds(html: string, testId: string) {
  const match = new RegExp(`data-testid="${testId}" data-ids="([^"]*)"`).exec(html);
  return match?.[1]?.split(',') ?? null;
}

describe('QuizPlayerClient server render (RIN-1032)', () => {
  beforeEach(() => {
    session.current = { data: null, status: 'unauthenticated' };
  });

  it('puts the first quick-round question in the server HTML, drawn from the seed', async () => {
    const html = await serverHtml({ mode: 'quick', seed: 7 });

    const ids = playedIds(html, 'desktop-layout');
    expect(ids).toHaveLength(10);
    expect(html).toContain('quickRound.pill');
    expect(html).not.toContain('loadingQuiz');
    // Hydration renders the same seed again, so it must draw the same round.
    expect(playedIds(await serverHtml({ mode: 'quick', seed: 7 }), 'desktop-layout')).toEqual(ids);
    expect(playedIds(await serverHtml({ mode: 'quick', seed: 8 }), 'desktop-layout')).not.toEqual(
      ids,
    );
  });

  it('renders the mobile layout on the server when the request looks like a phone', async () => {
    const html = await serverHtml({ mode: 'quick', seed: 7, mobile: true });

    expect(playedIds(html, 'mobile-layout')).toHaveLength(10);
    expect(html).not.toContain('desktop-layout');
  });

  it('puts a guest full quiz in the server HTML in a seeded order', async () => {
    const html = await serverHtml({ mode: 'full', seed: 3 });

    const ids = playedIds(html, 'desktop-layout');
    expect(ids).toHaveLength(30);
    expect(playedIds(await serverHtml({ mode: 'full', seed: 3 }), 'desktop-layout')).toEqual(ids);
  });

  it('shows the quick-round choice to a guest on a long quiz without ?mode', async () => {
    const html = await serverHtml({ seed: 3 });

    expect(html).toContain('quickRound.start:10');
    expect(html).not.toContain('desktop-layout');
  });

  it('still waits for saved progress before a signed-in learner plays the full quiz', async () => {
    session.current = {
      data: { user: { email: 'learner@example.test' } },
      status: 'authenticated',
    };

    const html = await serverHtml({ mode: 'full', seed: 3 });

    expect(html).toContain('loadingQuiz');
    expect(html).not.toContain('desktop-layout');
  });
});
