/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// RIN-1469: "Chơi ngay" on /quizzes cards. Fake quizzes only.

const cards = vi.hoisted(
  () => [] as { slug: string; play?: { href: string; label: string; ariaLabel: string } }[],
);
const list = vi.hoisted(() => ({ data: undefined as unknown }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, string>) =>
    [namespace, key, values?.['title']].filter(Boolean).join(':'),
}));

vi.mock('swr', () => ({
  default: () => ({ data: list.data, error: undefined, isLoading: false, mutate: vi.fn() }),
}));

vi.mock('@/features/quiz/components/QuizCard', () => ({
  QuizCard: (props: { quiz: { slug: string }; play?: (typeof cards)[number]['play'] }) => {
    cards.push({ slug: props.quiz.slug, ...(props.play ? { play: props.play } : {}) });
    return null;
  },
  QuizCardSkeleton: () => null,
}));

import { QuizzesPageClient } from './QuizzesPageClient';

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

describe('QuizzesPageClient "Chơi ngay" (RIN-1469)', () => {
  beforeEach(() => {
    cards.length = 0;
    list.data = {
      quizzes: [fakeQuiz('long', 16), fakeQuiz('short', 15), fakeQuiz('premium', 30, 'personal')],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 3,
        itemsPerPage: 12,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  });

  it('public cards play with entry=quizzes and the hub copy; a personal quiz gets none', () => {
    render(<QuizzesPageClient />);

    const bySlug = new Map(cards.map((card) => [card.slug, card]));
    expect(bySlug.get('long')?.play).toEqual({
      href: '/quiz/long?mode=quick&entry=quizzes',
      label: 'explore.hub:play',
      ariaLabel: 'explore.hub:playAria:Title long',
    });
    expect(bySlug.get('short')?.play?.href).toBe('/quiz/short?mode=full&entry=quizzes');
    expect(bySlug.has('premium')).toBe(true);
    expect(bySlug.get('premium')?.play).toBeUndefined();
  });
});
