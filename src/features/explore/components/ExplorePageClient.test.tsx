/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
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

// Settled responses by key predicate; a key with no match stays loading.
const swrData = vi.hoisted(() => ({ settled: [] as { match: string; data: unknown }[] }));

vi.mock('swr', () => ({
  default: (key: unknown) => {
    swrKeys.push(key);
    const settled =
      typeof key === 'string' ? swrData.settled.find(({ match }) => key.includes(match)) : null;
    if (settled) {
      return { data: settled.data, error: undefined, isLoading: false, mutate: vi.fn() };
    }
    return { data: undefined, error: undefined, isLoading: key !== null, mutate: vi.fn() };
  },
}));

vi.mock('@/features/adaptive/mappers/dashboard.mapper', () => ({
  toDashboardSubject: (subject: { id: string }) => ({
    jobId: subject.id,
    displayTitle: subject.id,
    subjectId: subject.id,
    filename: subject.id,
  }),
}));

vi.mock('@/features/adaptive/hooks/use-start-adaptive-subject', () => ({
  useStartAdaptiveSubject: () => ({ loadingJobId: null, startSubject: vi.fn() }),
}));

vi.mock('@/features/adaptive/components/sections/Library', () => ({
  LibraryCardSkeleton: () => <div data-testid="adaptive-skeleton" />,
  SubjectCard: () => <div data-testid="subject-card" />,
}));

vi.mock('@/features/quiz/components/QuizCard', () => ({
  QuizCard: () => <div data-testid="quiz-card" />,
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

  it('signed out: the Sign in link has a visible keyboard focus ring and a 44px touch target (RIN-761)', () => {
    session.status = 'unauthenticated';
    render(<ExplorePageClient />);

    for (const cta of screen.getAllByRole('link', { name: 'signInCta' })) {
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

/** The section panel whose heading is `titleKey` (the translation mock returns keys). */
function sectionOf(titleKey: string) {
  const section = screen.getByText(titleKey).closest('section');
  if (!section) throw new Error(`no section for ${titleKey}`);
  return within(section);
}

/** Responsive classes of each card slot, in order: what a viewport of each width shows. */
function slotClasses(cards: HTMLElement[]) {
  return cards.map((card) => card.parentElement?.className);
}

const ONE_ROW_SLOTS = ['grid', 'hidden md:grid', 'hidden xl:grid'];
const QUIZ = (id: string) => ({
  id,
  title: id,
  slug: id,
  author: null,
  visibility: 'public',
  questionCount: 3,
});

describe('ExplorePageClient All tab: one row per signed-in section (RIN-1406)', () => {
  beforeEach(() => {
    swrKeys.length = 0;
    swrData.settled = [];
    search.params = new URLSearchParams();
    session.status = 'authenticated';
  });

  it('loading: each per-user section shows one grid row of skeletons (1 mobile, 2 md, 3 xl)', () => {
    render(<ExplorePageClient />);

    const mineSkeletons = sectionOf('sections.mine.title').getAllByTestId('quiz-skeleton');
    expect(slotClasses(mineSkeletons)).toEqual(ONE_ROW_SLOTS);
    const adaptiveSkeletons =
      sectionOf('sections.adaptive.title').getAllByTestId('adaptive-skeleton');
    expect(slotClasses(adaptiveSkeletons)).toEqual(ONE_ROW_SLOTS);
    // The community section is last on the page: nothing below it can shift.
    expect(sectionOf('sections.quizzes.title').getAllByTestId('quiz-skeleton')).toHaveLength(4);
  });

  it('empty: the empty line keeps the height of the skeleton row it replaces', () => {
    swrData.settled = [
      { match: 'mine=true', data: { quizzes: [], pagination: null } },
      { match: '/api/adaptive/subjects', data: [] },
    ];
    render(<ExplorePageClient />);

    expect(screen.queryByTestId('adaptive-skeleton')).not.toBeInTheDocument();
    // QuizCardSkeleton is min-h-36 (144px); LibraryCardSkeleton 196px, 212px from sm (scale: 144/192/208).
    expect(screen.getByText('sections.mine.empty')).toHaveClass('min-h-36');
    expect(screen.getByText('sections.adaptive.empty')).toHaveClass('min-h-48', 'sm:min-h-52');
  });

  it('section cards hold quiz cards with less padding on mobile: no card-in-card squeeze (RIN-1555)', () => {
    swrData.settled = [
      { match: 'mine=true', data: { quizzes: [], pagination: null } },
      { match: '/api/adaptive/subjects', data: [] },
    ];
    render(<ExplorePageClient />);

    for (const titleKey of [
      'sections.mine.title',
      'sections.adaptive.title',
      'sections.quizzes.title',
    ]) {
      const section = screen.getByText(titleKey).closest('section');
      expect(section, titleKey).toHaveClass('p-3', 'sm:p-5');
      expect(section, titleKey).not.toHaveClass('p-4');
    }
  });

  it('populated: shows one row of owned quizzes and subjects, the rest stays behind View all', () => {
    swrData.settled = [
      {
        match: 'mine=true',
        data: { quizzes: ['q1', 'q2', 'q3', 'q4'].map(QUIZ), pagination: null },
      },
      { match: '/api/adaptive/subjects', data: [{ id: 's1' }, { id: 's2' }] },
    ];
    render(<ExplorePageClient />);

    const mineCards = sectionOf('sections.mine.title').getAllByTestId('quiz-card');
    expect(slotClasses(mineCards)).toEqual(ONE_ROW_SLOTS);
    const subjectCards = sectionOf('sections.adaptive.title').getAllByTestId('subject-card');
    expect(slotClasses(subjectCards)).toEqual(ONE_ROW_SLOTS.slice(0, 2));
  });

  it('the Your quizzes tab keeps its full grid of skeletons', () => {
    search.params = new URLSearchParams('type=mine');
    render(<ExplorePageClient />);

    const skeletons = screen.getAllByTestId('quiz-skeleton');
    expect(skeletons).toHaveLength(6);
    expect(skeletons[5]?.parentElement).toHaveClass('grid-cols-1');
  });
});

describe('ExplorePageClient first HTML (RIN-1518)', () => {
  it('server-renders the heading, search and tabs outside any Suspense boundary', () => {
    session.status = 'unauthenticated';
    swrKeys.length = 0;
    search.params = new URLSearchParams();
    const html = renderToString(<ExplorePageClient hubLinks={<nav id="hub-links" />} />);

    // React marks every Suspense boundary with <!--$-->. Since React 19.2 a
    // boundary after a large shell streams as a hidden div shown later by script.
    expect(html).not.toContain('<!--$');
    expect(html).toContain('<h1');
    expect(html).toContain('id="hub-links"');
    expect(html).toContain('aria-label="filterLabel"');
    expect(html).toContain('tabs.quizzes');
  });
});
