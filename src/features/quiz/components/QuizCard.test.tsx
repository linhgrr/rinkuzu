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
});
