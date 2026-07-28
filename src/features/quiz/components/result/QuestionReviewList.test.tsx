/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { QuestionReviewList } from './QuestionReviewList';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

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

    expect(screen.getByText('both')).toHaveProperty('tagName', 'STRONG');
    expect(container.querySelector('h3')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-rich-text="option"]')).toHaveLength(2);
    expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(5);
    expect((await axe(container)).violations).toEqual([]);
  });
});
