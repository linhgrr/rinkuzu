import { describe, expect, it } from 'vitest';
import { QuizPersistenceMapper } from '@/repositories/mappers/QuizPersistenceMapper';
import type {
  QuizPersistenceRecord,
  QuizQuestionPersistenceRecord,
} from '@/repositories/types/QuizPersistence';

const singleQuestion: QuizQuestionPersistenceRecord = {
  _id: 'question-1',
  question: '2 + 2 = ?',
  options: ['3', '4'],
  correctIndex: 1,
  type: 'single',
};

const multipleQuestion: QuizQuestionPersistenceRecord = {
  _id: 'question-2',
  question: 'Select primes',
  options: ['2', '3', '4'],
  correctIndexes: [0, 1],
  type: 'multiple',
};

const record: QuizPersistenceRecord = {
  _id: 'quiz-1',
  title: 'Mapped quiz',
  slug: 'mapped-quiz',
  author: {
    _id: 'user-1',
    email: 'owner@example.com',
  },
  folder: 'folder-1',
  questions: [singleQuestion],
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

  it('maps canonical single-choice questions with correctIndex only', () => {
    expect(QuizPersistenceMapper.toQuestionEntity(singleQuestion, 0)).toEqual({
      id: 'question-1',
      question: '2 + 2 = ?',
      options: ['3', '4'],
      type: 'single',
      correctIndex: 1,
    });
  });

  it('maps canonical multiple-choice questions with correctIndexes only', () => {
    expect(QuizPersistenceMapper.toQuestionEntity(multipleQuestion, 1)).toEqual({
      id: 'question-2',
      question: 'Select primes',
      options: ['2', '3', '4'],
      type: 'multiple',
      correctIndexes: [0, 1],
    });
  });

  it('throws a deterministic TypeError for an unknown runtime discriminator', () => {
    // Simulate a corrupt persistence row that violates the typed union at runtime.
    const malformedQuestion: QuizQuestionPersistenceRecord = Object.assign(Object.create(null), {
      ...singleQuestion,
      type: 'boolean',
    });

    expect(() => QuizPersistenceMapper.toQuestionEntity(malformedQuestion, 0)).toThrow(TypeError);
    expect(() => QuizPersistenceMapper.toQuestionEntity(malformedQuestion, 0)).toThrow(
      'quiz.questions[0].type has invalid discriminator: boolean',
    );
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
