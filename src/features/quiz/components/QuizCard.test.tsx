/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { QuizCard } from './QuizCard';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    key === 'questionCount' ? `${values?.count ?? 0} questions` : key,
}));

describe('QuizCard', () => {
  it('keeps native composite actions accessible and semantic', async () => {
    const { container } = render(
      <QuizCard
        quizId="quiz-id"
        quiz={{
          title: 'Accessible quiz',
          slug: 'accessible-quiz',
          author: { displayName: 'RinKuzu learner' },
          visibility: 'public',
          questionCount: 4,
        }}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('quizActions')).toHaveClass('size-11');
    expect(screen.getByRole('button', { name: 'deleteQuiz' })).toHaveClass('text-error');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('labels a submission the owner withdrew from Premium (RIN-1346)', () => {
    render(
      <QuizCard
        quizId="quiz-id"
        quiz={{
          title: 'Withdrawn quiz',
          slug: 'withdrawn-quiz',
          author: { displayName: 'RinKuzu learner' },
          visibility: 'public',
          questionCount: 4,
          premiumSubmissionStatus: 'withdrawn',
        }}
      />,
    );

    expect(screen.getByText('premiumStatus_withdrawn')).toBeInTheDocument();
  });
});

// RIN-1466: one card everywhere. Hubs and related quizzes carry no author, and the
// hub adds a one-tap play link next to the landing link.
describe('QuizCard play CTA and author', () => {
  const quiz = {
    title: 'Đề sinh 1',
    slug: 'de-sinh-1',
    author: null,
    visibility: 'public' as const,
    questionCount: 8,
  };

  it('adds a labelled play link below the landing link', async () => {
    const { container } = render(
      <QuizCard
        quiz={quiz}
        showAuthor={false}
        play={{
          href: '/quiz/de-sinh-1?mode=quick&entry=hub&topic=sinh-hoc',
          label: 'Chơi ngay',
          ariaLabel: 'Chơi ngay: Đề sinh 1',
        }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Đề sinh 1' })).toHaveAttribute(
      'href',
      '/quiz/de-sinh-1',
    );
    const play = screen.getByRole('link', { name: 'Chơi ngay: Đề sinh 1' });
    expect(play).toHaveAttribute('href', '/quiz/de-sinh-1?mode=quick&entry=hub&topic=sinh-hoc');
    expect(play).toHaveTextContent('Chơi ngay');
    expect(play).toHaveClass('min-h-11');
    expect(screen.queryByText('RinKuzu learner')).toBeNull();
    expect(screen.queryByLabelText('quizActions')).toBeNull();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('keeps the author line and no play link by default', () => {
    render(<QuizCard quizId="quiz-id" quiz={quiz} />);

    expect(screen.getByText('RinKuzu learner')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('encodes the slug in the landing link', () => {
    render(<QuizCard quiz={{ ...quiz, slug: 'đề sinh' }} showAuthor={false} />);

    expect(screen.getByRole('link', { name: 'Đề sinh 1' })).toHaveAttribute(
      'href',
      `/quiz/${encodeURIComponent('đề sinh')}`,
    );
  });
});

describe('QuizCard height floor', () => {
  it('drops the height floor without the author row', () => {
    const quiz = {
      title: 'Short',
      slug: 'short',
      author: null,
      visibility: 'public' as const,
      questionCount: 3,
    };
    const { rerender } = render(<QuizCard quiz={quiz} />);
    expect(screen.getByRole('article')).not.toHaveClass('min-h-0');

    rerender(<QuizCard quiz={quiz} showAuthor={false} />);
    expect(screen.getByRole('article')).toHaveClass('min-h-0');
  });
});
