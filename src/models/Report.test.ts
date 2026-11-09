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

describe('Report model quiz-page reports (RIN-1343)', () => {
  const quizPage = {
    quizId: '507f191e810c19729de860ea',
    quizTitle: 'Algebra',
    quizSlug: 'algebra',
    status: 'pending' as const,
    source: 'quiz_page' as const,
    reason: 'copyright' as const,
  };

  it('accepts an anonymous quiz-page report without email, name or content', async () => {
    await expect(new Report(quizPage).validate()).resolves.toBeUndefined();
  });

  it('keeps email, name and content required for per-question reports', async () => {
    const { reporterEmail: _e, reporterName: _n, content: _c, ...withoutReporter } = base;
    const error = await new Report(withoutReporter).validate().catch((caught: unknown) => caught);
    expect(String(error)).toMatch(/reporterEmail/);
    expect(String(error)).toMatch(/reporterName/);
    expect(String(error)).toMatch(/content/);
  });

  it('rejects a quiz-page report without a reason or with an unknown one', async () => {
    const { reason: _r, ...withoutReason } = quizPage;
    await expect(new Report(withoutReason).validate()).rejects.toThrow('require a reason');
    await expect(new Report({ ...quizPage, reason: 'spam' }).validate()).rejects.toThrow();
  });
});
