/** @vitest-environment jsdom */

import { act, use } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { prerender } from 'react-dom/static';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/Button';
import { markQuickRoundSeen } from '@/features/quiz/lib/quick-round-draw';
import QuizPlayerClient from './QuizPlayerClient';

// RIN-1133: on a slow phone the layout chunk is still loading when React hydrates the player, so
// the server-rendered layout waits in a dehydrated Suspense boundary. If the player re-renders
// before that chunk arrives, React 19 throws the server nodes away and renders the boundary again
// on the client, without logging an error, and a tap that landed on the server options is lost.
// A tap before the chunk arrives is still dropped by React, so the options also render disabled
// until hydrated (QuizOptions.hydration.test.tsx).

type Answer = number | number[];
type LayoutProps = {
  questions: { id: string }[];
  userAnswers: Answer[];
  selectAnswer?: (answerIndex: number) => void;
};

const { router, progressApi, layoutChunk } = vi.hoisted(() => ({
  router: { push: () => undefined, back: () => undefined, refresh: () => undefined },
  progressApi: {
    loadProgress: () => Promise.resolve(null),
    saveProgress: () => undefined,
    flushSave: () => undefined,
    clearProgress: () => Promise.resolve(),
  },
  // The layout suspends until this promise resolves, as the layout chunk still on the network.
  layoutChunk: { arrived: Promise.resolve() },
}));

vi.mock('next/dynamic', () => import('next/dist/api/app-dynamic'));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => router }));
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('@/features/quiz/hooks/useQuizProgress', () => ({ useQuizProgress: () => progressApi }));
vi.mock('@/components/ui/ConfirmModal', () => ({ ConfirmModal: () => null }));
vi.mock('@/components/ui/preloadMathRenderer', () => ({
  preloadMathRenderer: () => Promise.resolve(),
}));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: () => undefined,
  captureAnalyticsEventOnce: () => undefined,
}));
vi.mock('@/features/quiz/components/player/DesktopQuizLayout', () => {
  function DesktopQuizLayout({ questions, userAnswers, selectAnswer }: LayoutProps) {
    use(layoutChunk.arrived);
    const answered = userAnswers.filter((answer) => answer !== -1).length;
    return (
      <div data-testid="layout" data-ids={questions.map((question) => question.id).join(',')}>
        <Button onClick={() => selectAnswer?.(0)}>Fake answer A</Button>
        <p data-testid="answered">{`${answered}/${userAnswers.length} answered`}</p>
      </div>
    );
  }
  return { DesktopQuizLayout };
});

function player(questionCount = 1, mode?: 'quick') {
  return (
    <QuizPlayerClient
      initialErrorCode={null}
      initialErrorStatus={null}
      initialQuiz={{
        id: 'quiz-1',
        title: 'Fake quiz',
        slug: 'fake-quiz',
        author: null,
        folder: null,
        visibility: 'public',
        questionCount,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        questions: Array.from({ length: questionCount }, (_, index) => ({
          id: `q${index}`,
          question: `Fake prompt ${index}`,
          options: ['a', 'b'],
          type: 'single' as const,
        })),
      }}
      slug="fake-quiz"
      shuffleSeed={3}
      initialMobile={false}
      {...(mode ? { mode } : {})}
    />
  );
}

async function serverContainer(element: React.ReactElement) {
  const { prelude } = await prerender(element);
  const container = document.createElement('div');
  container.innerHTML = await new Response(prelude).text();
  document.body.append(container);
  return container;
}

const playedIds = (container: HTMLElement) =>
  container.querySelector('[data-testid="layout"]')?.getAttribute('data-ids')?.split(',');
const answered = (container: HTMLElement) =>
  container.querySelector('[data-testid="answered"]')?.textContent;

let root: Root | null = null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  window.sessionStorage.clear();
  layoutChunk.arrived = Promise.resolve();
});

describe('QuizPlayerClient hydration (RIN-1133)', () => {
  async function hydrateBeforeLayoutChunk(element: React.ReactElement) {
    const container = await serverContainer(element);
    const serverOption = container.querySelector('button');
    expect(serverOption?.textContent).toBe('Fake answer A');

    // The client has not loaded the layout chunk yet.
    let deliverChunk: () => void = () => undefined;
    layoutChunk.arrived = new Promise<void>((resolve) => {
      deliverChunk = resolve;
    });
    const recoverableErrors: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(container, element, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });
    await act(async () => {
      deliverChunk();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return { container, serverOption, recoverableErrors };
  }

  it('adopts the server-rendered options when the layout chunk arrives after hydration', async () => {
    const { container, serverOption, recoverableErrors } = await hydrateBeforeLayoutChunk(player());

    expect(recoverableErrors).toEqual([]);
    expect(container.querySelector('button')).toBe(serverOption);
    await act(async () => serverOption?.click());
    expect(answered(container)).toBe('1/1 answered');
  });

  it("hydrates the server's quick round and leaves the tab's seen questions to client mounts", async () => {
    const seen = Array.from({ length: 10 }, (_, index) => index);
    const serverIds = playedIds(await serverContainer(player(20, 'quick')));
    document.body.innerHTML = '';
    markQuickRoundSeen('fake-quiz', seen);

    const hydrated = await hydrateBeforeLayoutChunk(player(20, 'quick'));
    expect(hydrated.recoverableErrors).toEqual([]);
    expect(hydrated.container.querySelector('button')).toBe(hydrated.serverOption);
    expect(playedIds(hydrated.container)).toEqual(serverIds);
    act(() => root?.unmount());

    // "Play another quick round" mounts on the client: the round avoids what this tab has seen.
    const container = document.createElement('div');
    document.body.append(container);
    await act(async () => {
      root = createRoot(container);
      root.render(player(20, 'quick'));
    });
    const clientIds = playedIds(container) ?? [];
    expect(clientIds).toHaveLength(10);
    expect(clientIds.filter((id) => seen.includes(Number(id.slice(1))))).toEqual([]);
  });
});
