/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuizQuestionCard } from '@/features/quiz/components/player/QuizQuestionCard';

const question = {
  id: 'question-1',
  question: 'What is 2 + 2?',
  options: ['3', '4', '5'],
  type: 'single' as const,
};

describe('QuizQuestionCard', () => {
  it('shares answer selection and navigation presentation across quiz players', () => {
    const onSelectAnswer = vi.fn();
    const onNext = vi.fn();

    render(
      <QuizQuestionCard
        question={question}
        questionIndex={0}
        questionCount={2}
        answer={1}
        onSelectAnswer={onSelectAnswer}
        onPrevious={vi.fn()}
        onNext={onNext}
        onSubmit={vi.fn()}
        t={(key) => key}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Option B' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Option C' }));
    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    expect(onSelectAnswer).toHaveBeenCalledWith(2);
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('only reserves a minimum button and counter width from sm up, so the 375 px nav row cannot overflow', () => {
    render(
      <QuizQuestionCard
        question={question}
        questionIndex={0}
        questionCount={2}
        answer={null}
        onSelectAnswer={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSubmit={vi.fn()}
        t={(key) => key}
      />,
    );

    const next = screen.getByRole('button', { name: 'next' });
    expect(next).toHaveClass('sm:min-w-32');
    expect(next.className).not.toMatch(/(^|\s)min-w-/);
    const counter = screen.getByText(/^1\s*\//);
    expect(counter).toHaveClass('sm:min-w-16');
    expect(counter.className).not.toMatch(/(^|\s)min-w-/);
  });
});
