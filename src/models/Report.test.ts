import { describe, expect, it } from 'vitest';
import Report from '@/models/Report';

const base = {
  quizId: '507f191e810c19729de860ea',
  quizTitle: 'Algebra',
  quizSlug: 'algebra',
  reporterEmail: 'learner@example.com',
  reporterName: 'Learner',
  content: 'Wrong answer',
  status: 'pending' as const,
};

describe('Report model question context', () => {
  it('accepts legacy reports and complete question-level snapshots', async () => {
    await expect(new Report(base).validate()).resolves.toBeUndefined();
    await expect(
      new Report({
        ...base,
        questionId: '507f191e810c19729de860eb',
        questionSnapshot: {
          id: '507f191e810c19729de860eb',
          index: 0,
          question: '2 + 2 = ?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
        },
      }).validate(),
    ).resolves.toBeUndefined();
  });

  it('rejects partial question context that could point admins at the wrong item', async () => {
    await expect(
      new Report({
        ...base,
        questionId: '507f191e810c19729de860eb',
      }).validate(),
    ).rejects.toThrow('Question-level reports require both questionId and questionSnapshot');
  });
});
