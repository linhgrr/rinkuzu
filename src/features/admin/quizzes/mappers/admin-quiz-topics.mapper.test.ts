import { describe, expect, it } from 'vitest';
import type { AdminQuizTopicDetailDto } from '@/dtos/admin-quiz-topic';
import {
  moveTopicQuiz,
  toAdminQuizTopicDetailViewModel,
  toAdminQuizTopicViewModels,
} from './admin-quiz-topics.mapper';

const topicDto = {
  id: 't1',
  slug: 'fake-topic',
  locale: 'vi',
  name: 'Fake topic',
  intro: 'fake intro',
  introWords: 2,
  order: 2,
  published: false,
  quizCount: 2,
};

function quizDto(quizId: string, order: number) {
  return { quizId, order, slug: `${quizId}-slug`, title: quizId, questionCount: 4, isPublic: true };
}

describe('admin quiz topic mappers (RIN-1248)', () => {
  it('sorts topics by order and drops fields the panel does not use', () => {
    const items = toAdminQuizTopicViewModels({
      items: [topicDto, { ...topicDto, id: 't0', order: 1 }],
    });
    expect(items.map(({ id }) => id)).toEqual(['t0', 't1']);
    expect(items[0]).not.toHaveProperty('locale');
  });

  it('sorts a topic’s quizzes by order', () => {
    const detail: AdminQuizTopicDetailDto = {
      topic: topicDto,
      quizzes: [quizDto('b', 2), quizDto('a', 1)],
    };
    expect(toAdminQuizTopicDetailViewModel(detail).quizzes.map(({ quizId }) => quizId)).toEqual([
      'a',
      'b',
    ]);
  });

  it('moves a quiz to a clamped position and renumbers 1..n', () => {
    const quizzes = toAdminQuizTopicDetailViewModel({
      topic: topicDto,
      quizzes: [quizDto('a', 1), quizDto('b', 2), quizDto('c', 3)],
    }).quizzes;
    expect(moveTopicQuiz(quizzes, 'a', 3).map(({ quizId, order }) => `${order}:${quizId}`)).toEqual(
      ['1:b', '2:c', '3:a'],
    );
    expect(moveTopicQuiz(quizzes, 'c', 0).map(({ quizId }) => quizId)).toEqual(['c', 'a', 'b']);
    expect(moveTopicQuiz(quizzes, 'missing', 1)).toEqual(quizzes);
  });
});
