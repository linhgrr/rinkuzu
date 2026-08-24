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
  visibility: 'public',
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
      visibility: 'public',
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

  describe('discriminator preservation', () => {
    it('preserves single-choice discriminator and omits correctIndexes', () => {
      const entity = QuizPersistenceMapper.toQuestionEntity(singleQuestion, 0);

      expect(entity.type).toBe('single');
      expect(entity).toHaveProperty('correctIndex', 1);
      expect(entity).not.toHaveProperty('correctIndexes');
    });

    it('preserves correctIndex 0 as a present zero value (not omission)', () => {
      const entity = QuizPersistenceMapper.toQuestionEntity(
        {
          ...singleQuestion,
          correctIndex: 0,
        },
        0,
      );

      expect(entity.type).toBe('single');
      expect(entity).toHaveProperty('correctIndex', 0);
      expect(entity.correctIndex).toBe(0);
      expect(Object.hasOwn(entity, 'correctIndex')).toBe(true);
      expect(entity).not.toHaveProperty('correctIndexes');
    });

    it('preserves multiple-choice discriminator and omits correctIndex', () => {
      const entity = QuizPersistenceMapper.toQuestionEntity(multipleQuestion, 1);

      expect(entity.type).toBe('multiple');
      expect(entity).toHaveProperty('correctIndexes', [0, 1]);
      expect(entity).not.toHaveProperty('correctIndex');
    });

    it('preserves discriminators for mixed questions on the quiz entity', () => {
      const entity = QuizPersistenceMapper.toEntity({
        ...record,
        questions: [singleQuestion, multipleQuestion],
      });

      expect(entity.questions).toHaveLength(2);
      expect(entity.questions[0]?.type).toBe('single');
      expect(entity.questions[0]).not.toHaveProperty('correctIndexes');
      expect(entity.questions[1]?.type).toBe('multiple');
      expect(entity.questions[1]).not.toHaveProperty('correctIndex');
    });
  });

  describe('EOTP question variants and optional image contracts', () => {
    it('omits questionImage and optionImages when absent on single questions', () => {
      const entity = QuizPersistenceMapper.toQuestionEntity(singleQuestion, 0);

      expect(entity).not.toHaveProperty('questionImage');
      expect(entity).not.toHaveProperty('optionImages');
    });

    it('omits questionImage and optionImages when absent on multiple questions', () => {
      const entity = QuizPersistenceMapper.toQuestionEntity(multipleQuestion, 1);

      expect(entity).not.toHaveProperty('questionImage');
      expect(entity).not.toHaveProperty('optionImages');
    });

    it('includes questionImage and optionImages when present on single questions', () => {
      const entity = QuizPersistenceMapper.toQuestionEntity(
        {
          ...singleQuestion,
          questionImage: 'https://cdn.example.com/q-single.png',
          optionImages: ['https://cdn.example.com/a.png', undefined],
        },
        0,
      );

      expect(entity.type).toBe('single');
      expect(entity.questionImage).toBe('https://cdn.example.com/q-single.png');
      expect(entity.optionImages).toEqual(['https://cdn.example.com/a.png', undefined]);
      expect(entity).toHaveProperty('correctIndex', 1);
      expect(entity).not.toHaveProperty('correctIndexes');
    });

    it('includes questionImage and optionImages when present on multiple questions', () => {
      const entity = QuizPersistenceMapper.toQuestionEntity(
        {
          ...multipleQuestion,
          questionImage: 'https://cdn.example.com/q-multi.png',
          optionImages: [undefined, 'https://cdn.example.com/b.png'],
        },
        1,
      );

      expect(entity.type).toBe('multiple');
      expect(entity.questionImage).toBe('https://cdn.example.com/q-multi.png');
      expect(entity.optionImages).toEqual([undefined, 'https://cdn.example.com/b.png']);
      expect(entity).toHaveProperty('correctIndexes', [0, 1]);
      expect(entity).not.toHaveProperty('correctIndex');
    });

    it('includes only questionImage when optionImages is omitted', () => {
      const entity = QuizPersistenceMapper.toQuestionEntity(
        {
          ...singleQuestion,
          questionImage: 'https://cdn.example.com/only-q.png',
        },
        0,
      );

      expect(entity.questionImage).toBe('https://cdn.example.com/only-q.png');
      expect(entity).not.toHaveProperty('optionImages');
    });

    it('includes only optionImages when questionImage is omitted', () => {
      const entity = QuizPersistenceMapper.toQuestionEntity(
        {
          ...multipleQuestion,
          optionImages: ['https://cdn.example.com/only-o.png'],
        },
        2,
      );

      expect(entity.optionImages).toEqual(['https://cdn.example.com/only-o.png']);
      expect(entity).not.toHaveProperty('questionImage');
    });

    it('preserves empty optionImages array as present (not omission)', () => {
      const withEmpty = QuizPersistenceMapper.toQuestionEntity(
        {
          ...singleQuestion,
          optionImages: [],
        },
        0,
      );
      const omitted = QuizPersistenceMapper.toQuestionEntity(singleQuestion, 0);

      expect(withEmpty).toHaveProperty('optionImages', []);
      expect(withEmpty.optionImages).toEqual([]);
      expect(Object.hasOwn(withEmpty, 'optionImages')).toBe(true);
      expect(omitted).not.toHaveProperty('optionImages');
      expect(Object.hasOwn(omitted, 'optionImages')).toBe(false);
    });
  });

  describe('optional property presence versus omission contracts', () => {
    it('omits every undefined quiz-level optional field', () => {
      const entity = QuizPersistenceMapper.toEntity(record);

      expect(entity).not.toHaveProperty('description');
      expect(entity).not.toHaveProperty('pdfUrl');
      expect(entity).not.toHaveProperty('tags');
      expect(entity).not.toHaveProperty('sourceDraftId');
      expect(entity).not.toHaveProperty('questionCount');
    });

    it('includes every quiz-level optional field when present', () => {
      const entity = QuizPersistenceMapper.toEntity({
        ...record,
        description: 'Full optional payload',
        pdfUrl: 'https://cdn.example.com/quiz.pdf',
        tags: ['algebra', 'basics'],
        sourceDraftId: 'draft-42',
        questionCount: 7,
      });

      expect(entity.description).toBe('Full optional payload');
      expect(entity.pdfUrl).toBe('https://cdn.example.com/quiz.pdf');
      expect(entity.tags).toEqual(['algebra', 'basics']);
      expect(entity.sourceDraftId).toBe('draft-42');
      expect(entity.questionCount).toBe(7);
    });

    it('preserves questionCount 0 and empty tags as present values (not omission)', () => {
      const withZeros = QuizPersistenceMapper.toEntity({
        ...record,
        tags: [],
        questionCount: 0,
      });
      const omitted = QuizPersistenceMapper.toEntity(record);

      expect(withZeros).toHaveProperty('questionCount', 0);
      expect(withZeros.questionCount).toBe(0);
      expect(Object.hasOwn(withZeros, 'questionCount')).toBe(true);
      expect(withZeros).toHaveProperty('tags', []);
      expect(withZeros.tags).toEqual([]);
      expect(Object.hasOwn(withZeros, 'tags')).toBe(true);

      expect(omitted).not.toHaveProperty('questionCount');
      expect(omitted).not.toHaveProperty('tags');
      expect(Object.hasOwn(omitted, 'questionCount')).toBe(false);
      expect(Object.hasOwn(omitted, 'tags')).toBe(false);
    });

    it('includes each quiz-level optional in isolation when present', () => {
      expect(
        QuizPersistenceMapper.toEntity({ ...record, description: 'only-description' }).description,
      ).toBe('only-description');
      expect(
        QuizPersistenceMapper.toEntity({ ...record, pdfUrl: 'https://cdn.example.com/only.pdf' })
          .pdfUrl,
      ).toBe('https://cdn.example.com/only.pdf');
      expect(QuizPersistenceMapper.toEntity({ ...record, tags: ['solo'] }).tags).toEqual(['solo']);
      expect(
        QuizPersistenceMapper.toEntity({ ...record, sourceDraftId: 'draft-solo' }).sourceDraftId,
      ).toBe('draft-solo');
      expect(QuizPersistenceMapper.toEntity({ ...record, questionCount: 1 }).questionCount).toBe(1);
    });

    it('omits every undefined author preview optional field', () => {
      const entity = QuizPersistenceMapper.toEntity({
        ...record,
        author: { _id: 'user-bare' },
      });

      expect(entity.author).toEqual({ id: 'user-bare' });
      expect(entity.author).not.toHaveProperty('email');
      expect(entity.author).not.toHaveProperty('name');
      expect(entity.author).not.toHaveProperty('displayName');
      expect(entity.author).not.toHaveProperty('avatar');
    });

    it('includes every author preview optional field when present', () => {
      const entity = QuizPersistenceMapper.toEntity({
        ...record,
        author: {
          _id: 'user-full',
          email: 'full@example.com',
          name: 'Full Name',
          displayName: 'Full Display',
          avatar: 'https://cdn.example.com/avatar.png',
        },
      });

      expect(entity.author).toEqual({
        id: 'user-full',
        email: 'full@example.com',
        name: 'Full Name',
        displayName: 'Full Display',
        avatar: 'https://cdn.example.com/avatar.png',
      });
    });

    it('includes each author preview optional in isolation when present', () => {
      const withEmail = QuizPersistenceMapper.toEntity({
        ...record,
        author: { _id: 'user-1', email: 'solo@example.com' },
      });
      expect(withEmail.author).toEqual({ id: 'user-1', email: 'solo@example.com' });
      expect(withEmail.author).not.toHaveProperty('name');
      expect(withEmail.author).not.toHaveProperty('displayName');
      expect(withEmail.author).not.toHaveProperty('avatar');

      const withName = QuizPersistenceMapper.toEntity({
        ...record,
        author: { _id: 'user-1', name: 'Solo Name' },
      });
      expect(withName.author).toEqual({ id: 'user-1', name: 'Solo Name' });
      expect(withName.author).not.toHaveProperty('email');
      expect(withName.author).not.toHaveProperty('displayName');
      expect(withName.author).not.toHaveProperty('avatar');

      const withDisplayName = QuizPersistenceMapper.toEntity({
        ...record,
        author: { _id: 'user-1', displayName: 'Solo Display' },
      });
      expect(withDisplayName.author).toEqual({ id: 'user-1', displayName: 'Solo Display' });
      expect(withDisplayName.author).not.toHaveProperty('email');
      expect(withDisplayName.author).not.toHaveProperty('name');
      expect(withDisplayName.author).not.toHaveProperty('avatar');

      const withAvatar = QuizPersistenceMapper.toEntity({
        ...record,
        author: { _id: 'user-1', avatar: 'https://cdn.example.com/solo-avatar.png' },
      });
      expect(withAvatar.author).toEqual({
        id: 'user-1',
        avatar: 'https://cdn.example.com/solo-avatar.png',
      });
      expect(withAvatar.author).not.toHaveProperty('email');
      expect(withAvatar.author).not.toHaveProperty('name');
      expect(withAvatar.author).not.toHaveProperty('displayName');
    });

    it('maps an unpopulated author id without leaking preview optionals', () => {
      const entity = QuizPersistenceMapper.toEntity({
        ...record,
        author: 'author-id-only',
      });

      expect(entity.author).toBe('author-id-only');
      expect(typeof entity.author).toBe('string');
    });

    it('maps null and missing folder to null without optional leakage', () => {
      expect(QuizPersistenceMapper.toEntity({ ...record, folder: null }).folder).toBeNull();
      const withoutFolder = { ...record };
      delete (withoutFolder as { folder?: typeof record.folder }).folder;
      expect(QuizPersistenceMapper.toEntity(withoutFolder).folder).toBeNull();
    });

    it('surfaces required identity path labels for empty mongo ids', () => {
      expect(() => QuizPersistenceMapper.toEntity({ ...record, _id: '' })).toThrow(
        'quiz._id is required',
      );
      expect(() => QuizPersistenceMapper.toEntity({ ...record, author: '' })).toThrow(
        'quiz.author is required',
      );
      expect(() =>
        QuizPersistenceMapper.toEntity({
          ...record,
          author: { _id: '' },
        }),
      ).toThrow('quiz.author._id is required');
      expect(() => QuizPersistenceMapper.toEntity({ ...record, folder: '' })).toThrow(
        'quiz.folder is required',
      );
    });
  });
});
