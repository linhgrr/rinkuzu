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
          updatedAt: '2026-07-02T01:00:00.000Z',
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
      updatedAt: '2026-07-02T01:00:00.000Z',
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
    expect(result).not.toHaveProperty('description');
    expect(result).not.toHaveProperty('folder');
    expect(result).not.toHaveProperty('pdfUrl');
    expect(result.questions[0]).not.toHaveProperty('questionImage');
  });

  describe('list item optional presence and omission', () => {
    const pagination = {
      currentPage: 1,
      totalPages: 1,
      totalItems: 1,
      itemsPerPage: 12,
      hasNextPage: false,
      hasPrevPage: false,
    } as const;

    it('includes description and folder when present and maps public visibility', () => {
      const result = toAdminQuizListViewModel({
        quizzes: [
          {
            id: 'quiz-public',
            title: 'Public quiz',
            description: 'Listed description',
            slug: 'public-quiz',
            author: { id: 'author-1', email: 'author@example.com' },
            folder: 'folder-1',
            isPrivate: false,
            questionCount: 2,
            createdAt: '2026-07-02T00:00:00.000Z',
            updatedAt: '2026-07-02T01:00:00.000Z',
          },
        ],
        pagination: { ...pagination },
      });

      const [quiz] = result.quizzes;
      expect(quiz).toMatchObject({
        id: 'quiz-public',
        description: 'Listed description',
        folder: 'folder-1',
        visibilityLabelKey: 'public',
        isPrivate: false,
      });
      expect(quiz.description).toBe('Listed description');
      expect(quiz.folder).toBe('folder-1');
    });

    it('retains folder null while omitting absent description', () => {
      const result = toAdminQuizListViewModel({
        quizzes: [
          {
            id: 'quiz-null-folder',
            title: 'Unfiled quiz',
            slug: 'unfiled-quiz',
            author: { id: 'author-1' },
            folder: null,
            isPrivate: true,
            questionCount: 0,
            createdAt: '2026-07-02T00:00:00.000Z',
            updatedAt: '2026-07-02T01:00:00.000Z',
          },
        ],
        pagination: { ...pagination },
      });

      const [quiz] = result.quizzes;
      expect(quiz.folder).toBeNull();
      expect(quiz).not.toHaveProperty('description');
      expect(quiz.visibilityLabelKey).toBe('private');
    });

    it('preserves questionCount 0 as a present zero value', () => {
      const result = toAdminQuizListViewModel({
        quizzes: [
          {
            id: 'quiz-zero-questions',
            title: 'Empty quiz',
            slug: 'empty-quiz',
            author: { id: 'author-1' },
            isPrivate: false,
            questionCount: 0,
            createdAt: '2026-07-02T00:00:00.000Z',
            updatedAt: '2026-07-02T01:00:00.000Z',
          },
        ],
        pagination: { ...pagination },
      });

      const [quiz] = result.quizzes;
      expect(quiz).toHaveProperty('questionCount', 0);
      expect(quiz.questionCount).toBe(0);
      expect(Object.hasOwn(quiz, 'questionCount')).toBe(true);
    });

    it('preserves empty-string description as present (not omission)', () => {
      const result = toAdminQuizListViewModel({
        quizzes: [
          {
            id: 'quiz-empty-description',
            title: 'Blank description quiz',
            description: '',
            slug: 'blank-description-quiz',
            author: { id: 'author-1' },
            isPrivate: false,
            questionCount: 1,
            createdAt: '2026-07-02T00:00:00.000Z',
            updatedAt: '2026-07-02T01:00:00.000Z',
          },
        ],
        pagination: { ...pagination },
      });

      const [quiz] = result.quizzes;
      expect(quiz).toHaveProperty('description', '');
      expect(quiz.description).toBe('');
      expect(Object.hasOwn(quiz, 'description')).toBe(true);
    });

    it('omits description and folder keys when absent from the dto', () => {
      const result = toAdminQuizListViewModel({
        quizzes: [
          {
            id: 'quiz-sparse',
            title: 'Sparse quiz',
            slug: 'sparse-quiz',
            author: { id: 'author-1' },
            isPrivate: false,
            questionCount: 1,
            createdAt: '2026-07-02T00:00:00.000Z',
            updatedAt: '2026-07-02T01:00:00.000Z',
          },
        ],
        pagination: { ...pagination },
      });

      const [quiz] = result.quizzes;
      expect(quiz).not.toHaveProperty('description');
      expect(quiz).not.toHaveProperty('folder');
      expect(Object.hasOwn(quiz, 'description')).toBe(false);
      expect(Object.hasOwn(quiz, 'folder')).toBe(false);
    });
  });

  describe('question discriminators and question optional fields', () => {
    const detailBase = {
      id: 'quiz-1',
      title: 'Quiz',
      slug: 'quiz',
      author: { id: 'author-1' },
      isPrivate: false,
      questionCount: 2,
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T01:00:00.000Z',
    } as const;

    it('maps single questions with correctIndex and omits multiple-only keys', () => {
      const result = toAdminQuizDetailViewModel({
        ...detailBase,
        questions: [
          {
            id: 'question-single',
            type: 'single',
            question: 'Pick one?',
            options: ['A', 'B', 'C'],
            correctIndex: 0,
          },
        ],
      });

      const [question] = result.questions;
      expect(question).toEqual({
        id: 'question-single',
        type: 'single',
        question: 'Pick one?',
        options: ['A', 'B', 'C'],
        correctIndex: 0,
      });
      expect(question.type).toBe('single');
      expect(question).toHaveProperty('correctIndex', 0);
      expect(question).not.toHaveProperty('correctIndexes');
      expect(question).not.toHaveProperty('questionImage');
      expect(question).not.toHaveProperty('optionImages');
      expect(Object.hasOwn(question, 'correctIndexes')).toBe(false);
      expect(Object.hasOwn(question, 'questionImage')).toBe(false);
      expect(Object.hasOwn(question, 'optionImages')).toBe(false);
    });

    it('maps multiple questions with correctIndexes and omits single-only keys', () => {
      const result = toAdminQuizDetailViewModel({
        ...detailBase,
        questions: [
          {
            id: 'question-multiple',
            type: 'multiple',
            question: 'Pick all that apply?',
            options: ['A', 'B', 'C'],
            correctIndexes: [0, 2],
          },
        ],
      });

      const [question] = result.questions;
      expect(question).toEqual({
        id: 'question-multiple',
        type: 'multiple',
        question: 'Pick all that apply?',
        options: ['A', 'B', 'C'],
        correctIndexes: [0, 2],
      });
      expect(question.type).toBe('multiple');
      expect(question).toHaveProperty('correctIndexes', [0, 2]);
      expect(question).not.toHaveProperty('correctIndex');
      expect(question).not.toHaveProperty('questionImage');
      expect(question).not.toHaveProperty('optionImages');
      expect(Object.hasOwn(question, 'correctIndex')).toBe(false);
    });

    it('maps both discriminators in one detail payload', () => {
      const result = toAdminQuizDetailViewModel({
        ...detailBase,
        questions: [
          {
            id: 'q-single',
            type: 'single',
            question: 'One?',
            options: ['Yes', 'No'],
            correctIndex: 1,
          },
          {
            id: 'q-multiple',
            type: 'multiple',
            question: 'Many?',
            options: ['A', 'B'],
            correctIndexes: [0, 1],
          },
        ],
      });

      expect(result.questions).toHaveLength(2);
      expect(result.questions[0]).toMatchObject({
        type: 'single',
        correctIndex: 1,
      });
      expect(result.questions[0]).not.toHaveProperty('correctIndexes');
      expect(result.questions[1]).toMatchObject({
        type: 'multiple',
        correctIndexes: [0, 1],
      });
      expect(result.questions[1]).not.toHaveProperty('correctIndex');
    });

    it('includes questionImage and optionImages when defined, including empty optionImages', () => {
      const result = toAdminQuizDetailViewModel({
        ...detailBase,
        questions: [
          {
            id: 'q-media-single',
            type: 'single',
            question: 'With media?',
            options: ['A', 'B'],
            correctIndex: 1,
            questionImage: 'https://example.com/q.png',
            optionImages: [undefined, 'https://example.com/b.png'],
          },
          {
            id: 'q-empty-option-images',
            type: 'multiple',
            question: 'Empty images array?',
            options: ['A', 'B'],
            correctIndexes: [0],
            optionImages: [],
          },
        ],
      });

      expect(result.questions[0]).toEqual({
        id: 'q-media-single',
        type: 'single',
        question: 'With media?',
        options: ['A', 'B'],
        correctIndex: 1,
        questionImage: 'https://example.com/q.png',
        optionImages: [undefined, 'https://example.com/b.png'],
      });
      expect(result.questions[0]).toHaveProperty('questionImage', 'https://example.com/q.png');
      expect(result.questions[0]).toHaveProperty('optionImages');

      expect(result.questions[1]).toEqual({
        id: 'q-empty-option-images',
        type: 'multiple',
        question: 'Empty images array?',
        options: ['A', 'B'],
        correctIndexes: [0],
        optionImages: [],
      });
      expect(result.questions[1]).toHaveProperty('optionImages', []);
      expect(result.questions[1]).not.toHaveProperty('questionImage');
      expect(result.questions[1]).not.toHaveProperty('correctIndex');
    });

    it('strips undefined questionImage and optionImages so keys are absent (EOTP)', () => {
      const result = toAdminQuizDetailViewModel({
        ...detailBase,
        questions: [
          {
            id: 'q-undefined-media',
            type: 'single',
            question: 'No media keys?',
            options: ['A', 'B'],
            correctIndex: 0,
            questionImage: undefined,
            optionImages: undefined,
          },
        ],
      });

      const [question] = result.questions;
      expect(question).toEqual({
        id: 'q-undefined-media',
        type: 'single',
        question: 'No media keys?',
        options: ['A', 'B'],
        correctIndex: 0,
      });
      expect(question).not.toHaveProperty('questionImage');
      expect(question).not.toHaveProperty('optionImages');
      expect(Object.hasOwn(question, 'questionImage')).toBe(false);
      expect(Object.hasOwn(question, 'optionImages')).toBe(false);
      // Leaked `undefined` keys would fail not.toHaveProperty and hasOwn checks above.
      expect('questionImage' in question).toBe(false);
      expect('optionImages' in question).toBe(false);
    });
  });

  describe('detail optional presence and omission contracts', () => {
    it('includes pdfUrl, tags, description, and folder when present', () => {
      const result = toAdminQuizDetailViewModel({
        id: 'quiz-full',
        title: 'Full quiz',
        description: 'Detail description',
        slug: 'full-quiz',
        author: { id: 'author-1', name: 'Ada' },
        folder: 'folder-9',
        isPrivate: true,
        questionCount: 1,
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T01:00:00.000Z',
        pdfUrl: 'https://example.com/quiz.pdf',
        tags: ['algebra', 'exam'],
        questions: [
          {
            id: 'q1',
            type: 'multiple',
            question: 'All?',
            options: ['A', 'B'],
            correctIndexes: [0, 1],
          },
        ],
      });

      expect(result.description).toBe('Detail description');
      expect(result.folder).toBe('folder-9');
      expect(result.pdfUrl).toBe('https://example.com/quiz.pdf');
      expect(result.tags).toEqual(['algebra', 'exam']);
      expect(result.visibilityLabelKey).toBe('private');
      expect(result).toHaveProperty('pdfUrl', 'https://example.com/quiz.pdf');
      expect(result).toHaveProperty('tags', ['algebra', 'exam']);
      expect(result.questions[0]).toMatchObject({
        type: 'multiple',
        correctIndexes: [0, 1],
      });
      expect(result.questions[0]).not.toHaveProperty('correctIndex');
    });

    it('omits pdfUrl and tags when absent and does not leak undefined keys', () => {
      const result = toAdminQuizDetailViewModel({
        id: 'quiz-no-extras',
        title: 'No extras',
        slug: 'no-extras',
        author: { id: 'author-1' },
        isPrivate: false,
        questionCount: 1,
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T01:00:00.000Z',
        questions: [
          {
            id: 'q1',
            type: 'single',
            question: 'Q?',
            options: ['A', 'B'],
            correctIndex: 1,
          },
        ],
      });

      expect(result).not.toHaveProperty('description');
      expect(result).not.toHaveProperty('folder');
      expect(result).not.toHaveProperty('pdfUrl');
      expect(result).not.toHaveProperty('tags');
      expect(Object.hasOwn(result, 'description')).toBe(false);
      expect(Object.hasOwn(result, 'folder')).toBe(false);
      expect(Object.hasOwn(result, 'pdfUrl')).toBe(false);
      expect(Object.hasOwn(result, 'tags')).toBe(false);
      expect(result.questions[0]).not.toHaveProperty('questionImage');
      expect(result.questions[0]).not.toHaveProperty('optionImages');
      expect(result.questions[0]).not.toHaveProperty('correctIndexes');
    });

    it('preserves empty tags array when provided (presence vs omission)', () => {
      const result = toAdminQuizDetailViewModel({
        id: 'quiz-empty-tags',
        title: 'Empty tags',
        slug: 'empty-tags',
        author: { id: 'author-1' },
        isPrivate: false,
        questionCount: 1,
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T01:00:00.000Z',
        tags: [],
        questions: [
          {
            id: 'q1',
            type: 'single',
            question: 'Q?',
            options: ['A', 'B'],
            correctIndex: 0,
          },
        ],
      });

      expect(result).toHaveProperty('tags', []);
      expect(result.tags).toEqual([]);
      expect(result).not.toHaveProperty('pdfUrl');
      expect(Object.hasOwn(result, 'tags')).toBe(true);
      expect(Object.hasOwn(result, 'pdfUrl')).toBe(false);
    });

    it('preserves detail questionCount 0 and empty-string description', () => {
      const result = toAdminQuizDetailViewModel({
        id: 'quiz-detail-zeros',
        title: 'Detail zeros',
        description: '',
        slug: 'detail-zeros',
        author: { id: 'author-1' },
        isPrivate: false,
        questionCount: 0,
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T01:00:00.000Z',
        questions: [],
      });

      expect(result).toHaveProperty('questionCount', 0);
      expect(result.questionCount).toBe(0);
      expect(result).toHaveProperty('description', '');
      expect(result.description).toBe('');
      expect(Object.hasOwn(result, 'questionCount')).toBe(true);
      expect(Object.hasOwn(result, 'description')).toBe(true);
    });
  });
});
