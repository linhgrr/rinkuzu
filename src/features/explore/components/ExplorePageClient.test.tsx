/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ status: 'unauthenticated' as string }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
const swrKeys = vi.hoisted(() => [] as unknown[]);

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: session.status === 'authenticated' ? { user: { id: 'u1' } } : null,
    status: session.status,
  }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => search.params,
}));

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
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('swr', () => ({
  default: (key: unknown) => {
    swrKeys.push(key);
    return { data: undefined, error: undefined, isLoading: key !== null, mutate: vi.fn() };
  },
}));

vi.mock('@/features/adaptive/hooks/use-start-adaptive-subject', () => ({
  useStartAdaptiveSubject: () => ({ loadingJobId: null, startSubject: vi.fn() }),
}));

vi.mock('@/features/adaptive/components/sections/Library', () => ({
  LibraryCardSkeleton: () => <div data-testid="adaptive-skeleton" />,
  SubjectCard: () => null,
}));

vi.mock('@/features/quiz/components/QuizCard', () => ({
  QuizCard: () => null,
  QuizCardSkeleton: () => <div data-testid="quiz-skeleton" />,
}));

import { ExplorePageClient } from './ExplorePageClient';

function requestedKeys() {
  return swrKeys.filter((key): key is string => typeof key === 'string');
}

describe('ExplorePageClient session gating (RIN-680)', () => {
  beforeEach(() => {
    swrKeys.length = 0;
    search.params = new URLSearchParams();
  });

  it('signed out: never builds the owned or adaptive SWR keys, and prompts sign-in', () => {
    session.status = 'unauthenticated';
    render(<ExplorePageClient />);

    const keys = requestedKeys();
    expect(keys.some((key) => key.includes('mine=true'))).toBe(false);
    expect(keys).not.toContain('/api/adaptive/subjects');
    // Public quizzes are still requested.
    expect(keys.some((key) => key.startsWith('/api/quizzes') && !key.includes('mine'))).toBe(true);

    expect(screen.getByText('sections.mine.signedOut')).toBeInTheDocument();
    expect(screen.getByText('sections.adaptive.signedOut')).toBeInTheDocument();
    const ctas = screen.getAllByRole('link', { name: 'signInCta' });
    expect(ctas).toHaveLength(2);
    expect(ctas[0]).toHaveAttribute('href', '/login?callbackUrl=%2Fexplore');
    // No endless skeleton for the per-user sections.
    expect(screen.queryByTestId('adaptive-skeleton')).not.toBeInTheDocument();
  });

  it('signed out on the "mine" tab: prompts sign-in and keeps the search in the callback', () => {
    session.status = 'unauthenticated';
    search.params = new URLSearchParams('type=mine&q=bio');
    render(<ExplorePageClient />);

    expect(requestedKeys()).toEqual([]);
    expect(screen.getByRole('link', { name: 'signInCta' })).toHaveAttribute(
      'href',
      `/login?callbackUrl=${encodeURIComponent('/explore?type=mine&q=bio')}`,
    );
  });

  it('session loading: no per-user requests yet, sections show skeletons', () => {
    session.status = 'loading';
    render(<ExplorePageClient />);

    const keys = requestedKeys();
    expect(keys.some((key) => key.includes('mine=true'))).toBe(false);
    expect(keys).not.toContain('/api/adaptive/subjects');
    expect(screen.queryByText('sections.mine.signedOut')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('adaptive-skeleton').length).toBeGreaterThan(0);
  });

  it('signed in: requests owned, community and adaptive data as before', () => {
    session.status = 'authenticated';
    render(<ExplorePageClient />);

    const keys = requestedKeys();
    expect(keys.some((key) => key.includes('mine=true'))).toBe(true);
    expect(keys).toContain('/api/adaptive/subjects');
    expect(screen.queryByRole('link', { name: 'signInCta' })).not.toBeInTheDocument();
  });
});
