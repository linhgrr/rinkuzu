import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }));

import type { IQuizIndexNowNotifier } from '@/interfaces/services/IIndexNowNotifier';
import {
  notifyQuizIndexNow,
  notifyQuizSearchChange,
  type QuizSearchFacts,
} from '@/lib/seo/quiz-search-change';

const QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5'].map((question) => ({ question }));

function facts(overrides: Partial<QuizSearchFacts> = {}): QuizSearchFacts {
  return { visibility: 'public', title: 'Fake biology', questions: QUESTIONS, ...overrides };
}

/** Whether a change from `before` to `after` reaches the notifier. */
function quizSearchChanged(before: QuizSearchFacts, after: QuizSearchFacts): boolean {
  const notifier = { quizChanged: vi.fn() };
  notifyQuizSearchChange(notifier, before, { ...after, id: 'fake-quiz-id', slug: 'fake-slug' });
  return notifier.quizChanged.mock.calls.length > 0;
}

const FLAGGED = { personalData: true };
const CLEARED = { personalData: false, clearedBy: 'fake-admin' };

describe('quizSearchChanged (RIN-1500)', () => {
  it.each([
    ['hidden', facts(), facts({ visibility: 'personal' })],
    ['shown again', facts({ visibility: 'personal' }), facts()],
    ['held by a report', facts(), facts({ indexHold: { reason: 'reported' } })],
    ['hold lifted', facts({ indexHold: { reason: 'reported' } }), facts()],
    ['flag cleared', facts({ contentFlags: FLAGGED }), facts({ contentFlags: CLEARED })],
    ['grew to 5 questions', facts({ questions: QUESTIONS.slice(0, 4) }), facts()],
    ['title edited', facts(), facts({ title: 'Fake biology, revised' })],
    [
      'question edited',
      facts(),
      facts({ questions: [...QUESTIONS.slice(1), { question: 'new' }] }),
    ],
  ])('is true when the quiz was %s', (_case, before, after) => {
    expect(quizSearchChanged(before, after)).toBe(true);
  });

  it.each([
    ['a no-op save', facts(), facts()],
    [
      'an edit of a hidden quiz',
      facts({ visibility: 'personal' }),
      facts({ visibility: 'personal', title: 'Renamed' }),
    ],
    [
      'a hold on a hidden quiz',
      facts({ visibility: 'personal' }),
      facts({ visibility: 'personal', indexHold: { reason: 'reported' } }),
    ],
    [
      'a thin quiz staying thin',
      facts({ questions: QUESTIONS.slice(0, 2) }),
      facts({ questions: QUESTIONS.slice(0, 3) }),
    ],
  ])('is false for %s', (_case, before, after) => {
    expect(quizSearchChanged(before, after)).toBe(false);
  });

  it('counts the stored questionCount when the questions are not loaded', () => {
    expect(
      quizSearchChanged(
        facts({ questions: [], questionCount: 12, visibility: 'personal' }),
        facts({ questions: [], questionCount: 12 }),
      ),
    ).toBe(true);
  });
});

describe('notifyQuizSearchChange', () => {
  const after = { ...facts({ visibility: 'personal' }), id: 'fake-quiz-id', slug: 'fake-slug' };

  it('notifies a flip with the quiz id and slug', () => {
    const notifier = { quizChanged: vi.fn() };
    notifyQuizSearchChange(notifier, facts(), after);
    expect(notifier.quizChanged).toHaveBeenCalledWith({
      quizId: 'fake-quiz-id',
      slug: 'fake-slug',
      cause: 'indexability',
    });
  });

  it('does nothing for a no-op or without a notifier', () => {
    const notifier = { quizChanged: vi.fn() };
    notifyQuizSearchChange(notifier, after, after);
    notifyQuizSearchChange(undefined, facts(), after);
    expect(notifier.quizChanged).not.toHaveBeenCalled();
  });

  it('never throws when the notifier does', () => {
    const notifier: IQuizIndexNowNotifier = {
      quizChanged: () => {
        throw new Error('fake failure');
      },
    };
    expect(() => notifyQuizSearchChange(notifier, facts(), after)).not.toThrow();
    expect(() =>
      notifyQuizIndexNow(notifier, { quizId: 'id', slug: 's', cause: 'index-hold' }),
    ).not.toThrow();
  });
});
