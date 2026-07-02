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
      authorEmail: 'fallback@example.com',
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

  it('uses stored author email when the author is not populated', () => {
    const dto = QuizDiscussionDtoMapper.toCommentDto({
      id: 'comment-2',
      author: 'user-2',
      authorEmail: 'author@example.com',
      content: 'Thanks',
      isEdited: false,
      createdAt: new Date('2026-07-01T03:00:00Z'),
      updatedAt: new Date('2026-07-01T03:00:00Z'),
    });

    expect(dto.author).toEqual({
      id: 'user-2',
      email: 'author@example.com',
      name: undefined,
      avatar: undefined,
    });
  });

  it('does not expose persistence identity keys in the DTO shape', () => {
    const dto = QuizDiscussionDtoMapper.toDto(discussion);

    expect(dto).not.toHaveProperty('_id');
    expect(dto.comments[0]).not.toHaveProperty('_id');
    expect(dto.comments[0].author).not.toHaveProperty('_id');
  });
});
