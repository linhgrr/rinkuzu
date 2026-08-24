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
    if (key === 'catalogQuestionCount') return `${values?.count ?? 0} questions`;
    if (key === 'catalogBadge') return 'Quiz Premium';
    if (key === 'catalogAccessHint') return 'Premium or 1 credit to unlock forever';
    return key;
  },
}));

describe('PremiumCatalogCard', () => {
  it('advertises curated access without exposing questions or answers', async () => {
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

    expect(screen.getByText('Quiz Premium')).toBeVisible();
    expect(screen.getByText('20 questions')).toBeVisible();
    expect(screen.getByText('Premium or 1 credit to unlock forever')).toBeVisible();
    expect(screen.getByRole('link', { name: /Curated algebra/i })).toHaveAttribute(
      'href',
      '/quiz/curated-algebra',
    );
    expect(container).not.toHaveTextContent('correctIndex');
    expect((await axe(container)).violations).toEqual([]);
  });
});
