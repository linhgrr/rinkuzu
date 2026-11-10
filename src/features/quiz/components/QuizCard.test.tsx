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
    // RIN-1527: ink/70 alone is 5.5:1 at rest; stacking opacity-70 on it made 3:1.
    expect(screen.getByLabelText('quizActions')).toHaveClass('text-ink/70');
    expect(screen.getByLabelText('quizActions').className).not.toMatch(/(^|\s)opacity-/);
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

// RIN-1469: one card everywhere, as on Explore: always the author line, never a play button.
describe('QuizCard link and author', () => {
  const quiz = {
    title: 'Đề sinh 1',
    slug: 'de-sinh-1',
    author: { displayName: 'Lan Anh', avatar: null },
    visibility: 'public' as const,
    questionCount: 8,
  };

  it('links to a given href, with the author and no play button', async () => {
    const { container } = render(
      <QuizCard quiz={quiz} href="/quiz/de-sinh-1?entry=hub&topic=sinh-hoc" />,
    );

    const link = screen.getByRole('link', { name: /Đề sinh 1/ });
    expect(link).toHaveAttribute('href', '/quiz/de-sinh-1?entry=hub&topic=sinh-hoc');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('Lan Anh')).toBeInTheDocument();
    expect(screen.queryByText('Chơi ngay')).toBeNull();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('falls back to "RinKuzu learner" without an author', () => {
    render(<QuizCard quiz={{ ...quiz, author: null }} />);

    expect(screen.getByText('RinKuzu learner')).toBeInTheDocument();
  });

  it('encodes the slug in the default landing link', () => {
    render(<QuizCard quiz={{ ...quiz, slug: 'đề sinh' }} />);

    expect(screen.getByRole('link', { name: /Đề sinh 1/ })).toHaveAttribute(
      'href',
      `/quiz/${encodeURIComponent('đề sinh')}`,
    );
  });
});
