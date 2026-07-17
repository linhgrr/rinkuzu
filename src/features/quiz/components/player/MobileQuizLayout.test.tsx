/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { QuizPlayQuestionViewModel } from '@/features/quiz/types/quiz-play-view-model';
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
    return key;
  },
}));

vi.mock('@/components/ui/ConfirmModal', () => ({
  ConfirmModal: () => null,
}));

const questions: QuizPlayQuestionViewModel[] = [
  {
    id: 'q0',
    question: 'Pick one',
    options: ['Alpha', 'Beta'],
    type: 'single',
    questionImage: 'https://cdn.example/q.png',
    optionImages: ['https://cdn.example/a.png', 'https://cdn.example/b.png'],
  },
];

describe('MobileQuizLayout', () => {
  it('propagates and renders option images aligned with shuffled options', () => {
    render(
      <MobileQuizLayout
        quiz={{ questions }}
        userAnswers={[-1]}
        currentQuestionIndex={0}
        onAnswersChange={vi.fn()}
        onIndexChange={vi.fn()}
        onComplete={vi.fn()}
        onExit={vi.fn()}
        submitting={false}
      />,
    );

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
    expect(screen.getByText('Beta')).toBeTruthy();
  });
});
