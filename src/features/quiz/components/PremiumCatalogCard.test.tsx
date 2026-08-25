/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { PremiumCatalogCard } from '@/features/quiz/components/PremiumCatalogCard';

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
  useTranslations: () => (key: string, values?: { count?: number }) => {
    if (key === 'questionCount') return `${values?.count ?? 0} questions`;
    return key;
  },
}));

describe('PremiumCatalogCard', () => {
  it('matches the Explore card without exposing questions or answers', async () => {
    const { container } = render(
      <PremiumCatalogCard
        item={{
          quizId: 'quiz-id',
          slug: 'curated-algebra',
          title: 'Curated algebra',
          description: 'Reviewed practice',
          questionCount: 20,
        }}
      />,
    );

    expect(screen.getByText('20 questions')).toBeVisible();
    expect(screen.getByText('RinKuzu learner')).toBeVisible();
    expect(screen.queryByText('Quiz Premium')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Curated algebra/i })).toHaveAttribute(
      'href',
      '/quiz/curated-algebra',
    );
    expect(container.querySelector('article')).toHaveClass(
      'min-h-[146px]',
      'border-secondary-2',
      'bg-surface-blue',
      'shadow-quiz-card',
    );
    expect(container).not.toHaveTextContent('correctIndex');
    expect((await axe(container)).violations).toEqual([]);
  });
});
