import { describe, expect, it } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import { QuizDetailDtoMapper } from '@/mappers/quiz/QuizDetailDtoMapper';

const quiz: Quiz = {
  id: '507f191e810c19729de860ea',
  title: 'Algebra Basics',
  description: 'Linear equations',
  slug: 'algebra-basics',
  author: {
    id: '507f191e810c19729de860eb',
    email: 'teacher@example.com',
    name: 'Teacher',
    displayName: 'Math Teacher',
    avatar: 'https://example.com/avatar.png',
  },
  folder: '507f191e810c19729de860ec',
  questions: [
    {
      id: '507f191e810c19729de860ed',
      question: '2 + 2 = ?',
      options: ['3', '4'],
      correctIndex: 1,
      type: 'single',
    },
  ],
  visibility: 'public',
  pdfUrl: 'https://example.com/source.pdf',
  tags: ['math'],
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T01:00:00Z'),
};

describe('QuizDetailDtoMapper', () => {
  it('maps quiz detail to a DTO with public identity and ISO dates', () => {
    expect(QuizDetailDtoMapper.toDetail(quiz)).toEqual({
      id: '507f191e810c19729de860ea',
      title: 'Algebra Basics',
      description: 'Linear equations',
      slug: 'algebra-basics',
      author: {
        id: '507f191e810c19729de860eb',
        name: 'Teacher',
        displayName: 'Math Teacher',
        avatar: 'https://example.com/avatar.png',
      },
      folder: '507f191e810c19729de860ec',
      visibility: 'public',
      questions: [
        {
          id: '507f191e810c19729de860ed',
          question: '2 + 2 = ?',
          options: ['3', '4'],
          correctIndex: 1,
          type: 'single',
        },
      ],
      questionCount: 1,
      pdfUrl: 'https://example.com/source.pdf',
      tags: ['math'],
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T01:00:00.000Z',
    });
    expect(QuizDetailDtoMapper.toDetail(quiz).questions[0]).not.toHaveProperty('correctIndexes');
  });

  it('does not expose persistence identity keys or author email in the DTO shape', () => {
    const dto = QuizDetailDtoMapper.toDetail(quiz);

    expect(dto).not.toHaveProperty('_id');
    expect(typeof dto.author === 'object' ? dto.author : null).not.toHaveProperty('_id');
    expect(dto.author).not.toHaveProperty('email');
    // Negative key assertion: serialized JSON must not contain email anywhere in author tree.
    expect(JSON.stringify(dto.author)).not.toMatch(/"email"/);
  });

  it('removes correct answers from the play DTO', () => {
    const dto = QuizDetailDtoMapper.toPlayDetail(quiz);

    expect(dto.questions[0]).toEqual({
      id: '507f191e810c19729de860ed',
      question: '2 + 2 = ?',
      options: ['3', '4'],
      type: 'single',
    });
    expect(dto.questions[0]).not.toHaveProperty('correctIndex');
    expect(dto.questions[0]).not.toHaveProperty('correctIndexes');
  });

  it('keeps the source pdfUrl only on the owner/admin detail DTO, never on the play DTO (RIN-1340)', () => {
    expect(QuizDetailDtoMapper.toDetail(quiz)).toHaveProperty(
      'pdfUrl',
      'https://example.com/source.pdf',
    );
    expect(QuizDetailDtoMapper.toPlayDetail(quiz)).not.toHaveProperty('pdfUrl');
    expect(QuizDetailDtoMapper.toRetryPlayDetail(quiz, 'attempt-1', [0])).not.toHaveProperty(
      'pdfUrl',
    );
    expect(JSON.stringify(QuizDetailDtoMapper.toPlayDetail(quiz))).not.toContain('source.pdf');
  });

  it('omits absent optional fields instead of serializing undefined values', () => {
    const dto = QuizDetailDtoMapper.toDetail({
      id: quiz.id,
      title: quiz.title,
      slug: quiz.slug,
      author: { id: '507f191e810c19729de860eb' },
      questions: quiz.questions,
      visibility: quiz.visibility,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
    });

    expect(dto).not.toHaveProperty('description');
    expect(dto).not.toHaveProperty('pdfUrl');
    expect(dto).not.toHaveProperty('tags');
    expect(dto.author).toEqual({ id: '507f191e810c19729de860eb' });
    expect(dto.questions[0]).not.toHaveProperty('questionImage');
    expect(dto.questions[0]).not.toHaveProperty('optionImages');
  });
});
