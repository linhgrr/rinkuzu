/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizPlayerClient from './QuizPlayerClient';

// Stable identities: the player's load effect depends on the router and progress callbacks.
const { refreshMock, router, progress } = vi.hoisted(() => {
  const refresh = vi.fn();
  return {
    refreshMock: refresh,
    router: { push: () => undefined, back: () => undefined, refresh },
    progress: {
      loadProgress: () => Promise.resolve(null),
      saveProgress: () => undefined,
      flushSave: () => undefined,
      clearProgress: () => Promise.resolve(),
    },
  };
});
const noSession = { data: null, status: 'unauthenticated' };

vi.mock('next-auth/react', () => ({
  useSession: () => noSession,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/quiz/private-quiz',
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Stable identity, like next-intl's memoized `t`.
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));

vi.mock('@/features/quiz/hooks/useQuizProgress', () => ({
  useQuizProgress: () => progress,
}));

vi.mock('@/features/quiz/components/PremiumRequiredModal', () => ({
  PremiumRequiredModal: () => <div>premium-required-modal</div>,
}));

function renderFailedLoad(status: number | null, code: string | null = null) {
  return render(
    <QuizPlayerClient
      initialErrorCode={code}
      initialErrorStatus={status}
      initialQuiz={null}
      slug="private-quiz"
    />,
  );
}

describe('QuizPlayerClient load failures (RIN-753)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks a guest to sign in and come back to this quiz on 401', async () => {
    renderFailedLoad(401, 'unauthorized');

    expect(
      await screen.findByRole('heading', { name: 'errors.api.authRequiredTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'errors.api.actions.signIn' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fquiz%2Fprivate-quiz',
    );
  });

  it('opens the Premium upsell on premium_required, not an error page', async () => {
    renderFailedLoad(403, 'premium_required');

    expect(await screen.findByText('premium-required-modal')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /errors\.api/ })).not.toBeInTheDocument();
  });

  it.each([
    { status: 403, code: 'forbidden', title: 'errors.api.forbiddenTitle' },
    { status: 404, code: null, title: 'errors.api.notFoundTitle' },
    { status: 429, code: null, title: 'errors.api.rateLimitedTitle' },
  ])('maps a $status to its page error', async ({ status, code, title }) => {
    renderFailedLoad(status, code);

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('offers a retry that re-runs the server load on a 500', async () => {
    renderFailedLoad(500, 'internal_error');

    expect(
      await screen.findByRole('heading', { name: 'errors.api.serverTitle' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(refreshMock).toHaveBeenCalledOnce();
  });
});

// RIN-682 (QA on the PR): the guest start screen failed Lighthouse color-contrast.
// White on --brand-action is 2.57:1 and text-accent on bg-green-50 2.44:1;
// the strong action fill and the trust text token clear 4.5:1.
describe('QuizPlayerClient guest start screen contrast (RIN-682)', () => {
  const quiz = {
    id: 'quiz-1',
    title: 'Fake quiz',
    slug: 'private-quiz',
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

  it('puts white labels on the strong action fill and the sign-in hint on trust text', async () => {
    render(
      <QuizPlayerClient
        initialErrorCode={null}
        initialErrorStatus={null}
        initialQuiz={quiz}
        slug="private-quiz"
      />,
    );

    for (const name of ['startQuiz', 'flashcards']) {
      const button = await screen.findByRole('button', { name });
      expect(button).toHaveClass('bg-brand-action-strong', 'text-white');
    }
    const hint = screen.getByText('loginToTrack', { exact: false }).parentElement;
    expect(hint).toHaveClass('text-brand-trust');
    expect(hint).not.toHaveClass('text-accent');
  });
});
