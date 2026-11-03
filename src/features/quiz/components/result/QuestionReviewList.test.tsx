/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { QuestionReviewList } from './QuestionReviewList';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

// KaTeX loads on demand (RIN-679); its first import is a cold transform in vitest.
const KATEX_LOAD = { timeout: 10_000 };

describe('QuestionReviewList', () => {
  it('uses the shared Markdown contract for prompts, summaries and options', async () => {
    const { container } = render(
      <QuestionReviewList
        questions={[
          {
            id: 'q1',
            question: 'Select **both** roots of $x^2 = 4$.',
            options: ['$x = 2$', '$x = -2$'],
            type: 'multiple',
            correctIndexes: [0, 1],
            userAnswer: [0],
            isCorrect: false,
          },
        ]}
        bookmarkedQuestions={new Set()}
        bookmarkLoading={new Set()}
        onToggleBookmark={vi.fn()}
        onOpenAI={vi.fn()}
        chatTurnsByQuestion={{}}
        formatAnswer={() => '$x = 2$'}
        formatCorrectAnswer={() => '$x = 2$, $x = -2$'}
        t={(key) => key}
        tProfile={(key) => key}
      />,
    );
    await waitFor(
      () => expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(5),
      KATEX_LOAD,
    );

    expect(screen.getByText('both')).toHaveProperty('tagName', 'STRONG');
    expect(container.querySelector('h3')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-rich-text="option"]')).toHaveLength(2);
    expect((await axe(container)).violations).toEqual([]);
  });

  it('preserves bookmark and Ask Rin interactions for each reviewed question', () => {
    const onToggleBookmark = vi.fn();
    const onOpenAI = vi.fn();
    const question = {
      id: 'q1',
      question: 'Question?',
      options: ['A', 'B'],
      type: 'single' as const,
      correctIndex: 0,
      userAnswer: 1,
      isCorrect: false,
    };

    render(
      <QuestionReviewList
        questions={[question]}
        bookmarkedQuestions={new Set()}
        bookmarkLoading={new Set()}
        onToggleBookmark={onToggleBookmark}
        onOpenAI={onOpenAI}
        chatTurnsByQuestion={{}}
        formatAnswer={() => 'B'}
        formatCorrectAnswer={() => 'A'}
        t={(key) => key}
        tProfile={(key) => key}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'bookmark' }));
    fireEvent.click(screen.getByRole('button', { name: 'askRinChan' }));

    expect(onToggleBookmark).toHaveBeenCalledWith(0, question);
    expect(onOpenAI).toHaveBeenCalledWith(question, 0);
  });
});
