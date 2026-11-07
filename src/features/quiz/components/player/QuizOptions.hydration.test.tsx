/** @vitest-environment jsdom */

import { act, type ReactElement } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuizPlayQuestionViewModel } from '@/features/quiz/types/quiz-play-view-model';
import { MobileQuizLayout } from './MobileQuizLayout';
import { QuizQuestionCard } from './QuizQuestionCard';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui/ConfirmModal', () => ({ ConfirmModal: () => null }));
vi.mock('@/features/quiz/components/ReportQuiz', () => ({ default: () => null }));

const question: QuizPlayQuestionViewModel = {
  id: 'q0',
  question: 'Fake prompt',
  options: ['Fake answer A', 'Fake answer B'],
  type: 'single',
};

function mobilePlayer() {
  return (
    <MobileQuizLayout
      quiz={{ questions: [question], slug: 'fake-quiz', title: 'Fake quiz' }}
      userAnswers={[-1]}
      currentQuestionIndex={0}
      onAnswersChange={() => undefined}
      onIndexChange={() => undefined}
      onComplete={() => true}
      onExit={() => undefined}
      submitting={false}
    />
  );
}

function desktopCard() {
  return (
    <QuizQuestionCard
      question={question}
      questionIndex={0}
      questionCount={1}
      answer={-1}
      onSelectAnswer={() => undefined}
      onPrevious={() => undefined}
      onNext={() => undefined}
      onSubmit={() => undefined}
      t={(key) => key}
    />
  );
}

function optionControls(container: HTMLElement) {
  return [
    ...container.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      '[role="radio"], input[type="radio"]',
    ),
  ];
}

const containers: HTMLElement[] = [];

/** Server HTML in a container, as the browser shows it before the bundle runs. */
function serverRendered(element: ReactElement) {
  const container = document.createElement('div');
  container.innerHTML = renderToString(element);
  document.body.append(container);
  containers.push(container);
  return container;
}

afterEach(() => {
  containers.splice(0).forEach((container) => container.remove());
});

// RIN-1133: the guest first question is server-rendered (RIN-1032). A tap on its options
// before React hydrates hit inert markup and was silently lost, so they wait for hydration.
describe.each([
  ['mobile player', mobilePlayer, 2],
  ['desktop card', desktopCard, 2],
])('%s options before and after hydration (RIN-1133)', (_name, element, optionCount) => {
  it('are disabled in the server HTML', () => {
    const container = serverRendered(element());
    const controls = optionControls(container);

    expect(controls).toHaveLength(optionCount);
    controls.forEach((control) => expect(control.disabled).toBe(true));
  });

  it('become interactive once React hydrates them', async () => {
    const container = serverRendered(element());
    const recoverableErrors: unknown[] = [];

    await act(async () => {
      hydrateRoot(container, element(), {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });

    const controls = optionControls(container);
    expect(controls).toHaveLength(optionCount);
    controls.forEach((control) => expect(control.disabled).toBe(false));
    expect(recoverableErrors).toEqual([]);
  });
});

describe('options mounted on the client (RIN-1133)', () => {
  it('are interactive at once when the player mounts without server HTML', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    containers.push(container);

    await act(async () => {
      createRoot(container).render(mobilePlayer());
    });

    const controls = optionControls(container);
    expect(controls).toHaveLength(2);
    controls.forEach((control) => expect(control.disabled).toBe(false));
  });
});
