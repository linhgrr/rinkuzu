/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import QuizPlayerClient from './QuizPlayerClient';

// Stable identities: the player's load effect depends on the router and progress callbacks.
const { router, progress, session, submission, media } = vi.hoisted(() => ({
  media: { isMobile: false },
  router: { push: vi.fn(), back: () => undefined, refresh: () => undefined },
  progress: {
    loadProgress: () => Promise.resolve(null),
    saveProgress: () => undefined,
    flushSave: () => undefined,
    clearProgress: () => Promise.resolve(),
  },
  session: {
    data: { user: { email: 'learner@example.test' } },
    status: 'authenticated',
  },
  submission: {
    onSubmitSuccess: null as null | ((attemptId: string, score: number) => Promise<void>),
  },
}));

vi.mock('next-auth/react', () => ({ useSession: () => session }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/quiz/fake-starter',
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('@/features/quiz/hooks/useQuizProgress', () => ({ useQuizProgress: () => progress }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => media.isMobile }));
// The real layouts load lazily and take seconds on a cold worker; these stubs only
// show what the player hands them (the notice slot and the id of question 1).
interface LayoutStubProps {
  notice?: React.ReactNode;
  questions?: { id: string }[];
  quiz?: { questions: { id: string }[] };
}
function LayoutStub(name: string) {
  function Layout({ notice, questions, quiz }: LayoutStubProps) {
    return (
      <div data-testid={name} data-first-question={(questions ?? quiz?.questions)?.[0]?.id}>
        {notice}
      </div>
    );
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
  useQuizSubmission: (options: {
    onSubmitSuccess: (attemptId: string, score: number) => Promise<void>;
  }) => {
    submission.onSubmitSuccess = options.onSubmitSuccess;
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

const quiz = {
  id: 'quiz-1',
  title: 'Fake starter',
  slug: 'fake-starter',
  author: null,
  folder: null,
  visibility: 'public' as const,
  questionCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  questions: [
    { id: 'q1', question: 'Two plus two?', options: ['3', '4'], type: 'single' as const },
  ],
};

function renderPlayer(entry?: string | null) {
  return render(
    <QuizPlayerClient
      initialErrorCode={null}
      initialErrorStatus={null}
      initialQuiz={quiz}
      slug="fake-starter"
      {...(entry === undefined ? {} : { entry })}
    />,
  );
}

async function completeQuiz() {
  await waitFor(() => expect(submission.onSubmitSuccess).not.toBeNull());
  await submission.onSubmitSuccess?.('attempt-1', 80);
  return vi
    .mocked(captureAnalyticsEvent)
    .mock.calls.find(([event]) => event === 'quiz_completed')?.[1];
}

describe('QuizPlayerClient post-sign-in starter entry (RIN-913)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submission.onSubmitSuccess = null;
    media.isMobile = false;
  });

  it.each([
    { layout: 'desktop-layout', isMobile: false },
    { layout: 'mobile-layout', isMobile: true },
  ])('hands the intro with Skip to the $layout for entry=post_signin_starter', async (view) => {
    media.isMobile = view.isMobile;
    renderPlayer('post_signin_starter');

    const layout = await screen.findByTestId(view.layout);
    expect(layout).toHaveTextContent('starterIntro');
    expect(layout).toHaveAttribute('data-first-question', 'q1');
    expect(screen.getByRole('link', { name: 'starterSkip' })).toHaveAttribute('href', '/dashboard');
  });

  it.each([undefined, null, 'newsletter'])('shows no intro for entry=%s', async (entry) => {
    renderPlayer(entry);

    const layout = await screen.findByTestId('desktop-layout');
    expect(layout).toHaveAttribute('data-first-question', 'q1');
    expect(screen.queryByText('starterIntro')).not.toBeInTheDocument();
  });

  it('tags quiz_completed with the entry on the starter path', async () => {
    renderPlayer('post_signin_starter');

    expect(await completeQuiz()).toMatchObject({ entry: 'post_signin_starter', score: 80 });
  });

  it('tags quiz_completed with entry=activation_email, without the starter intro (RIN-1000)', async () => {
    renderPlayer('activation_email');

    expect(await screen.findByTestId('desktop-layout')).toHaveAttribute(
      'data-first-question',
      'q1',
    );
    expect(screen.queryByText('starterIntro')).not.toBeInTheDocument();
    expect(await completeQuiz()).toMatchObject({ entry: 'activation_email', score: 80 });
  });

  it.each([undefined, 'newsletter'])(
    'leaves entry out of quiz_completed for entry=%s',
    async (entry) => {
      renderPlayer(entry);

      expect(await completeQuiz()).not.toHaveProperty('entry');
    },
  );
});
