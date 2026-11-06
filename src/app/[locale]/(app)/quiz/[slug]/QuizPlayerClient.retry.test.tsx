/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizPlayerClient from './QuizPlayerClient';

// Stable identities: the player's load effect depends on the router and progress callbacks.
const { router, progress, session, submission, media } = vi.hoisted(() => ({
  media: { isMobile: false },
  router: { push: vi.fn(), back: () => undefined, refresh: () => undefined },
  progress: {
    enabled: null as boolean | null,
    api: {
      loadProgress: () => Promise.resolve(null),
      saveProgress: () => undefined,
      flushSave: () => undefined,
      clearProgress: () => Promise.resolve(),
    },
  },
  session: {
    data: { user: { email: 'learner@example.test' } },
    status: 'authenticated',
  },
  submission: { retryOfAttemptId: 'unset' as string | undefined },
}));

vi.mock('next-auth/react', () => ({ useSession: () => session }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/quiz/fake-quiz',
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const translate = (key: string, values?: Record<string, unknown>) =>
  values?.['count'] !== undefined ? `${key}:${String(values['count'])}` : key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('@/features/quiz/hooks/useQuizProgress', () => ({
  useQuizProgress: ({ enabled }: { enabled: boolean }) => {
    progress.enabled = enabled;
    return progress.api;
  },
}));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => media.isMobile }));
// The real layouts load lazily; these stubs only show the title badge the player hands them.
function LayoutStub(name: string) {
  function Layout({ titleBadge }: { titleBadge?: string }) {
    return <div data-testid={name}>{titleBadge}</div>;
  }
  return Layout;
}
vi.mock('@/features/quiz/components/player/DesktopQuizLayout', () => ({
  DesktopQuizLayout: LayoutStub('desktop-layout'),
}));
vi.mock('@/features/quiz/components/player/MobileQuizLayout', () => ({
  MobileQuizLayout: LayoutStub('mobile-layout'),
}));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: vi.fn(),
  captureAnalyticsEventOnce: vi.fn(),
}));
vi.mock('@/features/quiz/hooks/useQuizSubmission', () => ({
  useQuizSubmission: (options: { retryOfAttemptId?: string }) => {
    submission.retryOfAttemptId = options.retryOfAttemptId;
    return {
      submitting: false,
      showSubmitConfirm: false,
      setShowSubmitConfirm: () => undefined,
      unansweredCount: 0,
      handleQuizComplete: () => true,
      completeSubmit: () => undefined,
      submitQuiz: () => Promise.resolve(true),
    };
  },
}));

const ATTEMPT_ID = '6a8ed20a3d0a1892cacdfe0b';
const baseQuiz = {
  id: 'quiz-1',
  title: 'Fake quiz',
  slug: 'fake-quiz',
  author: null,
  folder: null,
  visibility: 'personal' as const,
  questionCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  questions: [
    { id: 'q2', question: 'Two plus two?', options: ['3', '4'], type: 'single' as const },
    { id: 'q4', question: 'Three plus one?', options: ['4', '5'], type: 'single' as const },
  ],
};

function renderPlayer(
  quiz: typeof baseQuiz & { retry?: { ofAttemptId: string; questionIndices: number[] } },
) {
  return render(
    <QuizPlayerClient
      initialErrorCode={null}
      initialErrorStatus={null}
      initialQuiz={quiz}
      slug="fake-quiz"
    />,
  );
}

describe('QuizPlayerClient retry-missed session (RIN-917)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    media.isMobile = false;
    progress.enabled = null;
    submission.retryOfAttemptId = 'unset';
  });

  it.each([
    { layout: 'desktop-layout', isMobile: false },
    { layout: 'mobile-layout', isMobile: true },
  ])('shows the retry pill on the $layout and submits as a retry', async (view) => {
    media.isMobile = view.isMobile;
    renderPlayer({ ...baseQuiz, retry: { ofAttemptId: ATTEMPT_ID, questionIndices: [1, 3] } });

    expect(await screen.findByTestId(view.layout)).toHaveTextContent('resultActions.retryPill:2');
    await waitFor(() => expect(submission.retryOfAttemptId).toBe(ATTEMPT_ID));
    // A retry is a subset of the quiz: it never reads or writes the full quiz's saved progress.
    expect(progress.enabled).toBe(false);
  });

  it('plays the full quiz with no pill and saved progress otherwise', async () => {
    renderPlayer(baseQuiz);

    expect(await screen.findByTestId('desktop-layout')).toBeEmptyDOMElement();
    expect(submission.retryOfAttemptId).toBeUndefined();
    expect(progress.enabled).toBe(true);
  });
});
