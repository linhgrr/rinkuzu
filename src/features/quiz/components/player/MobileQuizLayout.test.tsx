/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { QuizPlayQuestionViewModel } from '@/features/quiz/types/quiz-play-view-model';
import { Button } from '@/components/ui/Button';
import { MobileQuizLayout } from './MobileQuizLayout';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (key === 'questionImageAlt') {
      return `Image for question ${values?.['number'] ?? ''}`;
    }
    if (key === 'optionImageAlt') {
      return `Option ${values?.['option'] ?? ''} image`;
    }
    return key;
  },
}));

vi.mock('@/components/ui/ConfirmModal', () => ({
  ConfirmModal: ({
    isOpen,
    title,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    title: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <Button type="button" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button type="button" onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    ) : null,
}));

vi.mock('@/features/quiz/components/ReportQuiz', () => ({
  default: () => null,
}));

const questions: QuizPlayQuestionViewModel[] = [
  {
    id: 'q0',
    question: 'Pick **one** where $x^2 = 4$',
    options: ['**Alpha**', '$x = -2$'],
    type: 'single',
    questionImage: 'https://cdn.example/q.png',
    optionImages: ['https://cdn.example/a.png', 'https://cdn.example/b.png'],
  },
];

const scrollQuestions: QuizPlayQuestionViewModel[] = [
  {
    id: 'q0',
    question: 'First question',
    options: ['First answer', 'Another answer'],
    type: 'single',
  },
  {
    id: 'q1',
    question: 'Second question',
    options: ['Second answer', 'Last answer'],
    type: 'single',
  },
];

// KaTeX loads on demand (RIN-679); its first import is a cold transform in vitest.
const KATEX_LOAD = { timeout: 10_000 };

describe('MobileQuizLayout', () => {
  it('propagates and renders option images aligned with shuffled options', async () => {
    render(
      <MobileQuizLayout
        quiz={{ slug: 'math', title: 'Math', questions }}
        userAnswers={[-1]}
        currentQuestionIndex={0}
        onAnswersChange={vi.fn()}
        onIndexChange={vi.fn()}
        onComplete={vi.fn()}
        onExit={vi.fn()}
        submitting={false}
      />,
    );
    await waitFor(() => expect(document.querySelectorAll('.katex')).toHaveLength(2), KATEX_LOAD);

    expect(screen.getByAltText('Image for question 1').getAttribute('src')).toBe(
      'https://cdn.example/q.png',
    );
    expect(screen.getByAltText('Option A image').getAttribute('src')).toBe(
      'https://cdn.example/a.png',
    );
    expect(screen.getByAltText('Option B image').getAttribute('src')).toBe(
      'https://cdn.example/b.png',
    );
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Alpha')).toHaveProperty('tagName', 'STRONG');
  });

  it('lets mobile users confirm exiting the quiz', () => {
    const onExit = vi.fn();

    render(
      <MobileQuizLayout
        quiz={{ slug: 'math', title: 'Math', questions }}
        userAnswers={[-1]}
        currentQuestionIndex={0}
        onAnswersChange={vi.fn()}
        onIndexChange={vi.fn()}
        onComplete={vi.fn()}
        onExit={onExit}
        submitting={false}
      />,
    );

    const exitButton = document.querySelector<HTMLButtonElement>('button[aria-label="exitQuiz"]');
    if (!exitButton) throw new Error('Expected mobile exit button');
    fireEvent.click(exitButton);
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).toBeTruthy();
    const confirmButton = dialog?.querySelectorAll<HTMLButtonElement>('button')[1];
    if (!confirmButton) throw new Error('Expected exit confirmation button');
    fireEvent.click(confirmButton);
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('renders every question in one scroll flow and tracks the selected question', () => {
    const onAnswersChange = vi.fn();
    const onIndexChange = vi.fn();

    render(
      <MobileQuizLayout
        quiz={{ slug: 'scroll-quiz', title: 'Scroll quiz', questions: scrollQuestions }}
        userAnswers={[-1, -1]}
        currentQuestionIndex={0}
        onAnswersChange={onAnswersChange}
        onIndexChange={onIndexChange}
        onComplete={vi.fn()}
        onExit={vi.fn()}
        submitting={false}
      />,
    );

    expect(screen.getByText('First question')).toBeTruthy();
    expect(screen.getByText('Second question')).toBeTruthy();
    expect(document.querySelector('button[aria-label="previousQuestion"]')).toBeNull();
    expect(document.querySelector('button[aria-label="nextQuestion"]')).toBeNull();

    const secondAnswerButton = screen.getByText('Second answer').closest('button');
    if (!secondAnswerButton) throw new Error('Expected second question answer button');
    fireEvent.click(secondAnswerButton);

    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(onAnswersChange).toHaveBeenCalledWith([-1, 0]);
  });
});
