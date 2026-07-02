import { describe, expect, it } from 'vitest';
import type { Discussion } from '@/entities/Discussion';
import { QuizDiscussionDtoMapper } from '@/mappers/quiz/QuizDiscussionDtoMapper';

const discussion: Discussion = {
  id: 'discussion-1',
  quiz: 'quiz-1',
  questionIndex: 2,
  comments: [
    {
      id: 'comment-1',
      author: {
        id: 'user-1',
        email: 'learner@example.com',
        name: 'Learner',
        displayName: 'Rin Learner',
        avatar: 'https://example.com/avatar.png',
      },
      content: 'Can someone explain this option?',
      isEdited: false,
      createdAt: new Date('2026-07-01T01:00:00Z'),
      updatedAt: new Date('2026-07-01T01:30:00Z'),
    },
  ],
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T02:00:00Z'),
};

describe('QuizDiscussionDtoMapper', () => {
  it('maps discussion entities to DTO identity and date fields', () => {
    expect(QuizDiscussionDtoMapper.toDto(discussion)).toEqual({
      id: 'discussion-1',
      questionIndex: 2,
      comments: [
        {
          id: 'comment-1',
          author: {
            id: 'user-1',
            email: 'learner@example.com',
            name: 'Rin Learner',
            avatar: 'https://example.com/avatar.png',
          },
          content: 'Can someone explain this option?',
          isEdited: false,
          createdAt: '2026-07-01T01:00:00.000Z',
          updatedAt: '2026-07-01T01:30:00.000Z',
        },
      ],
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T02:00:00.000Z',
    });
  });

  it('does not expose persistence identity keys in the DTO shape', () => {
    const dto = QuizDiscussionDtoMapper.toDto(discussion);

    expect(dto).not.toHaveProperty('_id');
    expect(dto.comments[0]).not.toHaveProperty('_id');
    expect(dto.comments[0].author).not.toHaveProperty('_id');
  });
});
