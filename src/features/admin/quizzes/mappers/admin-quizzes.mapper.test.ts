import { describe, expect, it } from 'vitest';
import {
  toAdminQuizDetailViewModel,
  toAdminQuizListViewModel,
} from '@/features/admin/quizzes/mappers/admin-quizzes.mapper';

describe('admin quizzes mapper', () => {
  it('maps list dto pagination and visibility label keys', () => {
    const result = toAdminQuizListViewModel({
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Private quiz',
          slug: 'private-quiz',
          author: { id: 'author-1', email: 'author@example.com' },
          isPrivate: true,
          questionCount: 3,
          createdAt: '2026-07-02T00:00:00.000Z',
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalItems: 13,
        itemsPerPage: 12,
        hasNextPage: true,
        hasPrevPage: false,
      },
    });

    expect(result.quizzes[0]).toMatchObject({
      id: 'quiz-1',
      visibilityLabelKey: 'private',
    });
    expect(result.pagination).toEqual({
      page: 1,
      limit: 12,
      total: 13,
      totalPages: 2,
      hasNextPage: true,
      hasPrevPage: false,
    });
  });

  it('maps detail dto questions for preview', () => {
    const result = toAdminQuizDetailViewModel({
      id: 'quiz-1',
      title: 'Quiz',
      slug: 'quiz',
      author: { id: 'author-1' },
      isPrivate: false,
      questionCount: 1,
      createdAt: '2026-07-02T00:00:00.000Z',
      questions: [
        {
          id: 'question-1',
          type: 'single',
          question: 'Q1',
          options: ['A', 'B'],
          correctIndex: 0,
        },
      ],
    });

    expect(result.visibilityLabelKey).toBe('public');
    expect(result.questions).toHaveLength(1);
  });
});
