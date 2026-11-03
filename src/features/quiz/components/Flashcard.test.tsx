/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Flashcard } from './Flashcard';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@/components/ui/QuestionContent', () => ({
  QuestionContent: ({ content, className }: { content: string; className?: string }) => (
    <div className={className}>{content}</div>
  ),
}));

const classTokens = (element: Element) => element.className.split(/\s+/);

function renderCard() {
  render(
    <Flashcard
      question="Which option is last?"
      options={['Alpha', 'Bravo', 'Charlie', 'Delta']}
      correctIndex={3}
      type="single"
      onSwipe={() => {}}
      isLast={false}
    />,
  );
  return screen.getByRole('button', { name: 'flashcard.showAnswer' });
}

describe('Flashcard sizing (RIN-770)', () => {
  it('grows with its content instead of a fixed height', () => {
    const card = renderCard();
    const tokens = classTokens(card);

    // A fixed height made the card scroll internally and clip option D at 375px.
    expect(tokens.some((token) => /^h-\[/.test(token) || /^max-h-/.test(token))).toBe(false);
    expect(tokens.some((token) => token.startsWith('min-h-'))).toBe(true);
  });

  it('stacks both faces in one grid cell so the taller face sets the height', () => {
    renderCard();
    const front = screen.getByText('Which option is last?').closest('[data-flashcard-face]');
    const back = screen.getByText('flashcard.correctAnswer').closest('[data-flashcard-face]');

    for (const face of [front, back]) {
      expect(face).not.toBeNull();
      const tokens = classTokens(face as Element);
      expect(tokens).not.toContain('absolute');
      expect(tokens).not.toContain('h-full');
      expect(tokens).toContain('[grid-area:1/1]');
      expect(face?.querySelector('.overflow-y-auto')).toBeNull();
    }
  });
});
