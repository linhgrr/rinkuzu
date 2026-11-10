/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ status: 'unauthenticated' as string }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
const swrKeys = vi.hoisted(() => [] as unknown[]);
const swrData = vi.hoisted(() => ({ byKey: (_key: string): unknown => undefined }));
const cards = vi.hoisted(
  () => [] as { slug: string; play?: { href: string; label: string; ariaLabel: string } }[],
);

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
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, string>) =>
    [namespace, key, values?.['title']].filter(Boolean).join(':'),
  useLocale: () => 'en',
}));

vi.mock('swr', () => ({
  default: (key: unknown) => {
    swrKeys.push(key);
    const data = typeof key === 'string' ? swrData.byKey(key) : undefined;
    return { data, error: undefined, isLoading: key !== null && !data, mutate: vi.fn() };
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
  QuizCard: (props: { quiz: { slug: string }; play?: (typeof cards)[number]['play'] }) => {
    cards.push({ slug: props.quiz.slug, ...(props.play ? { play: props.play } : {}) });
    return null;
  },
  QuizCardSkeleton: () => <div data-testid="quiz-skeleton" />,
}));

import { ExplorePageClient } from './ExplorePageClient';

function requestedKeys() {
  return swrKeys.filter((key): key is string => typeof key === 'string');
}

function fakeQuiz(slug: string, questionCount: number, visibility = 'public') {
  return {
    id: `id-${slug}`,
    title: `Title ${slug}`,
    slug,
    author: null,
    folderId: null,
    visibility,
    questionCount,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function fakeList(quizzes: ReturnType<typeof fakeQuiz>[]) {
  return {
    quizzes,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: quizzes.length,
      itemsPerPage: 12,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

beforeEach(() => {
  swrKeys.length = 0;
  cards.length = 0;
  search.params = new URLSearchParams();
  swrData.byKey = () => undefined;
});

describe('ExplorePageClient "Chơi ngay" on community cards (RIN-1469)', () => {
  beforeEach(() => {
    session.status = 'authenticated';
    swrData.byKey = (key) => {
      if (!key.startsWith('/api/quizzes')) return undefined;
      return key.includes('mine=true')
        ? fakeList([fakeQuiz('mine-1', 30)])
        : fakeList([
            fakeQuiz('community-long', 16),
            fakeQuiz('community-short', 15),
            fakeQuiz('community-premium', 30, 'personal'),
          ]);
    };
  });

  it.each(['', 'type=quizzes'])(
    'community cards play with entry=explore and the hub copy (%s)',
    (query) => {
      search.params = new URLSearchParams(query);
      render(<ExplorePageClient />);

      const bySlug = new Map(cards.map((card) => [card.slug, card]));
      expect(bySlug.get('community-long')?.play).toEqual({
        href: '/quiz/community-long?mode=quick&entry=explore',
        label: 'explore.hub:play',
        ariaLabel: 'explore.hub:playAria:Title community-long',
      });
      expect(bySlug.get('community-short')?.play?.href).toBe(
        '/quiz/community-short?mode=full&entry=explore',
      );
      expect(bySlug.get('community-premium')?.play).toBeUndefined();
    },
  );

  it.each(['', 'type=mine'])('owned cards keep no play button (%s)', (query) => {
    search.params = new URLSearchParams(query);
    render(<ExplorePageClient />);

    const owned = cards.filter((card) => card.slug === 'mine-1');
    expect(owned.length).toBeGreaterThan(0);
    for (const card of owned) expect(card.play).toBeUndefined();
  });
});

describe('ExplorePageClient session gating (RIN-680)', () => {
  it('signed out: never builds the owned or adaptive SWR keys, and prompts sign-in', () => {
    session.status = 'unauthenticated';
    render(<ExplorePageClient />);

    const keys = requestedKeys();
    expect(keys.some((key) => key.includes('mine=true'))).toBe(false);
    expect(keys).not.toContain('/api/adaptive/subjects');
    // Public quizzes are still requested.
    expect(keys.some((key) => key.startsWith('/api/quizzes') && !key.includes('mine'))).toBe(true);

    expect(screen.getByText('explore:sections.mine.signedOut')).toBeInTheDocument();
    expect(screen.getByText('explore:sections.adaptive.signedOut')).toBeInTheDocument();
    const ctas = screen.getAllByRole('link', { name: 'explore:signInCta' });
    expect(ctas).toHaveLength(2);
    expect(ctas[0]).toHaveAttribute('href', '/login?callbackUrl=%2Fexplore');
    // No endless skeleton for the per-user sections.
    expect(screen.queryByTestId('adaptive-skeleton')).not.toBeInTheDocument();
  });

  it('signed out: the Sign in link has a visible keyboard focus ring and a 44px touch target (RIN-761)', () => {
    session.status = 'unauthenticated';
    render(<ExplorePageClient />);

    for (const cta of screen.getAllByRole('link', { name: 'explore:signInCta' })) {
      // Same tokenized ring as `.btn:focus-visible` in globals.css.
      expect(cta).toHaveClass(
        'focus-visible:outline',
        'focus-visible:outline-[3px]',
        'focus-visible:outline-offset-2',
        'focus-visible:outline-[var(--focus-ring)]',
      );
      // min-h-11 = 44px; min-h-10 (40px) is under the touch-target minimum.
      expect(cta).toHaveClass('min-h-11');
      expect(cta).not.toHaveClass('min-h-10');
    }
  });

  it('signed out on the "mine" tab: prompts sign-in and keeps the search in the callback', () => {
    session.status = 'unauthenticated';
    search.params = new URLSearchParams('type=mine&q=bio');
    render(<ExplorePageClient />);

    expect(requestedKeys()).toEqual([]);
    expect(screen.getByRole('link', { name: 'explore:signInCta' })).toHaveAttribute(
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
    expect(screen.queryByText('explore:sections.mine.signedOut')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('adaptive-skeleton').length).toBeGreaterThan(0);
  });

  it('signed in: requests owned, community and adaptive data as before', () => {
    session.status = 'authenticated';
    render(<ExplorePageClient />);

    const keys = requestedKeys();
    expect(keys.some((key) => key.includes('mine=true'))).toBe(true);
    expect(keys).toContain('/api/adaptive/subjects');
    expect(screen.queryByRole('link', { name: 'explore:signInCta' })).not.toBeInTheDocument();
  });
});
