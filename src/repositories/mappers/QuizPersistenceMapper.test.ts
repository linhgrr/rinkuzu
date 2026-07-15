import { describe, expect, it } from 'vitest';
import { QuizPersistenceMapper } from '@/repositories/mappers/QuizPersistenceMapper';
import type { QuizPersistenceRecord } from '@/repositories/types/QuizPersistence';

const record: QuizPersistenceRecord = {
  _id: 'quiz-1',
  title: 'Mapped quiz',
  slug: 'mapped-quiz',
  author: {
    _id: 'user-1',
    email: 'owner@example.com',
  },
  folder: 'folder-1',
  questions: [
    {
      _id: 'question-1',
      question: '2 + 2 = ?',
      options: ['3', '4'],
      correctIndex: 1,
      type: 'single',
    },
  ],
  isPrivate: false,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T01:00:00.000Z'),
};

describe('QuizPersistenceMapper', () => {
  it('converts Mongo identifiers at the persistence boundary', () => {
    expect(QuizPersistenceMapper.toEntity(record)).toEqual({
      id: 'quiz-1',
      title: 'Mapped quiz',
      description: undefined,
      slug: 'mapped-quiz',
      author: {
        id: 'user-1',
        email: 'owner@example.com',
        name: undefined,
        displayName: undefined,
        avatar: undefined,
      },
      folder: 'folder-1',
      questions: [
        {
          id: 'question-1',
          question: '2 + 2 = ?',
          options: ['3', '4'],
          correctIndex: 1,
          correctIndexes: undefined,
          type: 'single',
          questionImage: undefined,
          optionImages: undefined,
        },
      ],
      isPrivate: false,
      pdfUrl: undefined,
      tags: undefined,
      questionCount: undefined,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T01:00:00.000Z'),
    });
  });

  it('rejects persisted questions without an identifier', () => {
    const firstQuestion = record.questions[0];
    if (!firstQuestion) throw new Error('Expected a persisted question fixture');
    const invalidRecord = {
      ...record,
      questions: [{ ...firstQuestion, _id: '' }],
    };

    expect(() => QuizPersistenceMapper.toEntity(invalidRecord)).toThrow(
      'quiz.questions[0]._id is required',
    );
  });
});
