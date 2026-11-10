import { describe, expect, it } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import { AdminQuizDtoMapper } from '@/mappers/quiz/AdminQuizDtoMapper';

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
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T01:00:00Z'),
};

describe('AdminQuizDtoMapper', () => {
  it('maps quiz list items to admin DTO identity and date fields', () => {
    expect(AdminQuizDtoMapper.toListItem(quiz)).toEqual({
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
      visibility: 'public',
      questionCount: 1,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T01:00:00.000Z',
    });
  });

  // RIN-1342: the admin badge names the kinds of an uncleared flag, never values.
  it('carries the personal-data kinds only while the flag is set', () => {
    const checkedAt = new Date('2026-11-01T00:00:00Z');
    const flagged = AdminQuizDtoMapper.toListItem({
      ...quiz,
      contentFlags: { personalData: true, kinds: ['phone', 'email'], checkedAt },
    });
    const cleared = AdminQuizDtoMapper.toListItem({
      ...quiz,
      contentFlags: {
        personalData: false,
        kinds: ['phone'],
        checkedAt,
        clearedBy: '507f191e810c19729de860ff',
        clearedAt: checkedAt,
      },
    });

    expect(flagged.personalDataKinds).toEqual(['phone', 'email']);
    expect(cleared).not.toHaveProperty('personalDataKinds');
    expect(AdminQuizDtoMapper.toListItem(quiz)).not.toHaveProperty('personalDataKinds');
  });

  it('maps quiz detail without exposing persistence _id keys in the DTO shape', () => {
    const dto = AdminQuizDtoMapper.toDetail(quiz);

    expect(dto).toMatchObject({
      id: '507f191e810c19729de860ea',
      author: { id: '507f191e810c19729de860eb' },
      pdfUrl: 'https://example.com/source.pdf',
      questions: [
        {
          id: '507f191e810c19729de860ed',
          question: '2 + 2 = ?',
          options: ['3', '4'],
          correctIndex: 1,
          type: 'single',
        },
      ],
    });
    expect(dto).not.toHaveProperty('_id');
    expect(dto.author).not.toHaveProperty('_id');
    expect(dto.questions[0]).not.toHaveProperty('correctIndexes');
  });

  it('omits absent optional fields instead of serializing undefined values', () => {
    const dto = AdminQuizDtoMapper.toDetail({
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
    expect(dto).not.toHaveProperty('folder');
    expect(dto).not.toHaveProperty('pdfUrl');
    expect(dto).not.toHaveProperty('tags');
    expect(dto.author).toEqual({ id: '507f191e810c19729de860eb' });
    expect(dto.questions[0]).not.toHaveProperty('questionImage');
    expect(dto.questions[0]).not.toHaveProperty('optionImages');
  });
});
