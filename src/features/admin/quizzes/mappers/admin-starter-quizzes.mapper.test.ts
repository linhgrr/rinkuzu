import { describe, expect, it } from 'vitest';
import {
  getStarterMarkBlockReason,
  moveStarterQuiz,
  toAdminStarterQuizViewModels,
} from '@/features/admin/quizzes/mappers/admin-starter-quizzes.mapper';
import type { AdminStarterQuizViewModel } from '@/features/admin/quizzes/types/admin-starter-quizzes-view-model';

function starter(id: string, order: number): AdminStarterQuizViewModel {
  return {
    id,
    quizId: `quiz-${id}`,
    title: `Fake ${id}`,
    questionCount: 5,
    locale: 'vi',
    order,
    quick: false,
    dropReason: null,
  };
}

describe('admin starter quizzes mapper', () => {
  it('sorts by order, keeps the drop reason and treats an unknown locale as vi', () => {
    const result = toAdminStarterQuizViewModels({
      items: [
        {
          id: 's2',
          quizId: 'q2',
          slug: null,
          title: null,
          questionCount: 0,
          locale: 'en',
          order: 2,
          quick: false,
          status: 'dropped',
          dropReason: 'missing',
        },
        {
          id: 's1',
          quizId: 'q1',
          slug: 'fake-one',
          title: 'Fake one',
          questionCount: 20,
          locale: 'fr',
          order: 1,
          quick: true,
          status: 'live',
        },
      ],
    });

    expect(result).toEqual([
      {
        id: 's1',
        quizId: 'q1',
        title: 'Fake one',
        questionCount: 20,
        locale: 'vi',
        order: 1,
        quick: true,
        dropReason: null,
      },
      {
        id: 's2',
        quizId: 'q2',
        title: null,
        questionCount: 0,
        locale: 'en',
        order: 2,
        quick: false,
        dropReason: 'missing',
      },
    ]);
  });

  it('moves a starter to a 1-based position and renumbers the list', () => {
    const items = [starter('a', 1), starter('b', 2), starter('c', 3)];

    expect(moveStarterQuiz(items, 'c', 1).map(({ id, order }) => [id, order])).toEqual([
      ['c', 1],
      ['a', 2],
      ['b', 3],
    ]);
    expect(moveStarterQuiz(items, 'a', 9).map(({ id }) => id)).toEqual(['b', 'c', 'a']);
    expect(moveStarterQuiz(items, 'missing', 1)).toBe(items);
  });

  it('blocks marking a quiz that is already a starter, personal or empty', () => {
    const starterIds = new Set(['q-starter']);
    const quiz = { id: 'q1', visibility: 'public' as const, questionCount: 4 };

    expect(getStarterMarkBlockReason(quiz, starterIds)).toBeNull();
    expect(getStarterMarkBlockReason({ ...quiz, id: 'q-starter' }, starterIds)).toBe('starter');
    expect(getStarterMarkBlockReason({ ...quiz, visibility: 'personal' }, starterIds)).toBe(
      'not-public',
    );
    expect(getStarterMarkBlockReason({ ...quiz, questionCount: 0 }, starterIds)).toBe('empty');
  });
});
