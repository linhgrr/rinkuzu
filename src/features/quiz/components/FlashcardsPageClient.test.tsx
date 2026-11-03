/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { FlashcardsPageClient } from './FlashcardsPageClient';

const { fetchFlashcardsMock, fetchPremiumMetadataMock } = vi.hoisted(() => ({
  fetchFlashcardsMock: vi.fn(),
  fetchPremiumMetadataMock: vi.fn(),
}));

// Namespaced keys make a label read from the wrong namespace visible in the DOM.
const translators = new Map<string, (key: string) => string>();
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    let translate = translators.get(namespace);
    if (!translate) {
      translate = (key: string) => `${namespace}.${key}`;
      translators.set(namespace, translate);
    }
    return translate;
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/routing/useRequiredRouteParam', () => ({
  useRequiredRouteParam: () => 'demo-flash',
}));

vi.mock('@/features/quiz/api/premium-quiz-api', () => ({
  fetchPremiumCatalogMetadata: (...args: unknown[]) => fetchPremiumMetadataMock(...args),
}));

vi.mock('@/features/quiz/api/flashcards-api', () => ({
  fetchFlashcardQuizViewModel: (...args: unknown[]) => fetchFlashcardsMock(...args),
  submitFlashcardReview: () => Promise.resolve({}),
}));

vi.mock('@/features/quiz/components/PremiumFlashcardClient', () => ({
  PremiumFlashcardClient: () => null,
}));

vi.mock('@/features/quiz/components/Flashcard', async () => {
  const { Button } = await import('@/components/ui/Button');
  return {
    Flashcard: ({ onSwipe }: { onSwipe: (direction: 'left' | 'right') => void }) => (
      <div>
        <Button onClick={() => onSwipe('left')}>swipe-left</Button>
        <Button onClick={() => onSwipe('right')}>swipe-right</Button>
      </div>
    ),
  };
});

const quiz = {
  id: 'quiz-1',
  title: 'Calculus basics',
  slug: 'demo-flash',
  questions: [
    { id: 'q1', question: 'First?', options: ['A', 'B'], type: 'single', correctIndex: 0 },
    { id: 'q2', question: 'Second?', options: ['A', 'B'], type: 'single', correctIndex: 1 },
  ],
};

describe('FlashcardsPageClient layout inside the app shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPremiumMetadataMock.mockRejectedValue(
      new ApiResponseError({ message: 'not found', status: 404, payload: null }),
    );
    fetchFlashcardsMock.mockResolvedValue(quiz);
  });

  it('keeps the progress header in the content flow, below the top bar', async () => {
    render(<FlashcardsPageClient />);

    const header = await screen.findByTestId('flashcard-progress-header');
    // A viewport-fixed header ignores the sidebar offset and covers the nav (RIN-746).
    expect(header.className).not.toMatch(/(^|\s)fixed(\s|$)/);
    expect(header.className).toMatch(/(^|\s)sticky(\s|$)/);
    expect(header.className).toContain('top-16');
    expect(header.className).toContain('lg:top-[var(--app-chrome-height)]');
    expect(header).toHaveTextContent('quiz.unknown: 0');
    expect(header).toHaveTextContent('1/2');
    expect(header).toHaveTextContent('quiz.known: 0');
  });

  it('does not render a second logo bar inside the app shell', async () => {
    render(<FlashcardsPageClient />);

    await screen.findByTestId('flashcard-progress-header');
    expect(screen.queryByAltText('RinKuzu Logo')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'quiz.takeQuiz' })).toHaveAttribute(
      'href',
      '/quiz/demo-flash',
    );
  });

  it('labels the end-screen counts as known and unknown', async () => {
    render(<FlashcardsPageClient />);

    fireEvent.click(await screen.findByText('swipe-left'));
    fireEvent.click(screen.getByText('swipe-right'));

    expect(await screen.findByText('quiz.unknownQuestions')).toBeInTheDocument();
    expect(screen.queryByAltText('RinKuzu Logo')).not.toBeInTheDocument();
    expect(screen.queryByText('common.questions')).not.toBeInTheDocument();
    expect(screen.getByText('quiz.known')).toBeInTheDocument();
    expect(screen.getByText('quiz.unknown')).toBeInTheDocument();
    expect(screen.getByText('quiz.mastery')).toBeInTheDocument();
  });
});

describe('FlashcardsPageClient design follow-ups (RIN-770)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPremiumMetadataMock.mockRejectedValue(
      new ApiResponseError({ message: 'not found', status: 404, payload: null }),
    );
    fetchFlashcardsMock.mockResolvedValue(quiz);
  });

  it('uses a standard-size Take Quiz button in the header', async () => {
    render(<FlashcardsPageClient />);

    const takeQuiz = (await screen.findByRole('link', { name: 'quiz.takeQuiz' })).querySelector(
      'button',
    );
    const tokens = takeQuiz?.className.split(/\s+/) ?? [];
    expect(tokens).toContain('text-sm');
    expect(tokens).toContain('min-h-11');
    expect(tokens).toContain('sm:min-h-9');
    expect(tokens).not.toContain('text-xs');
  });

  it('stacks the end-screen actions full width on mobile, primary first', async () => {
    render(<FlashcardsPageClient />);

    fireEvent.click(await screen.findByText('swipe-left'));
    fireEvent.click(screen.getByText('swipe-right'));

    const actions = await screen.findByTestId('flashcard-results-actions');
    const tokens = actions.className.split(/\s+/);
    expect(tokens).toContain('flex-col');
    expect(tokens).toContain('sm:flex-row');

    const buttons = Array.from(actions.querySelectorAll('button'));
    expect(buttons.map((button) => button.textContent)).toEqual([
      'quiz.practiceContinue',
      'quiz.takeQuiz',
      'common.browseQuizzes',
    ]);
    for (const button of buttons) {
      expect(button.className.split(/\s+/)).toContain('w-full');
    }
  });

  it('centres every end-screen stat label', async () => {
    render(<FlashcardsPageClient />);

    fireEvent.click(await screen.findByText('swipe-left'));
    fireEvent.click(screen.getByText('swipe-right'));

    for (const label of ['quiz.known', 'quiz.unknown', 'quiz.mastery']) {
      expect((await screen.findByText(label)).className.split(/\s+/)).toContain('text-center');
    }
  });
});

describe('flashcard messages', () => {
  it.each(['en', 'vi'])('keeps the mastery stat label to one short word or two in %s', (locale) => {
    const messages = JSON.parse(
      readFileSync(path.join(process.cwd(), 'messages', locale, 'quiz.json'), 'utf8'),
    ) as Record<string, string>;

    // Three stats share one row at 375px; a long label wraps to four lines.
    expect(messages['mastery']?.split(/\s+/).length).toBeLessThanOrEqual(2);
  });

  it.each(['en', 'vi'])('has the card aria labels in %s', (locale) => {
    const messages = JSON.parse(
      readFileSync(path.join(process.cwd(), 'messages', locale, 'flashcard.json'), 'utf8'),
    ) as Record<string, unknown>;

    expect(typeof messages['showAnswer']).toBe('string');
    expect(typeof messages['showQuestion']).toBe('string');
  });
});
