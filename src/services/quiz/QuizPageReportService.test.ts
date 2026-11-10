import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Quiz } from '@/entities/Quiz';
import type { Report } from '@/entities/Report';
import { QuizPageReportService } from '@/services/quiz/QuizPageReportService';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const now = new Date('2026-11-10T08:00:00Z');

function quiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '507f191e810c19729de860ea',
    title: 'Algebra',
    slug: 'algebra',
    author: '507f191e810c19729de860eb',
    questions: [],
    visibility: 'public',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function storedReport(): Report {
  return {
    id: 'report-1',
    quizId: '507f191e810c19729de860ea',
    quizTitle: 'Algebra',
    quizSlug: 'algebra',
    reporterEmail: '',
    reporterName: '',
    content: '',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

describe('QuizPageReportService', () => {
  const findSummaryBySlug = vi.fn<(slug: string) => Promise<Quiz | null>>();
  const createQuizPageReport = vi.fn();
  const holdForReport = vi.fn<(quizId: string, since: Date) => Promise<boolean>>();
  const releaseReportHold = vi.fn<(quizId: string) => Promise<boolean>>();
  const quizIndexNow = { quizChanged: vi.fn() };
  const service = new QuizPageReportService(
    { findSummaryBySlug },
    { createQuizPageReport },
    { holdForReport, releaseReportHold },
    () => now,
    quizIndexNow,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    findSummaryBySlug.mockResolvedValue(quiz());
    createQuizPageReport.mockResolvedValue(storedReport());
    holdForReport.mockResolvedValue(true);
  });

  it('stores an anonymous report with the hash and no reporter fields', async () => {
    const result = await service.report('algebra', { reason: 'wrong_content', ipHash: 'h1' });

    expect(result).toEqual({ success: true, data: { reportId: 'report-1' } });
    expect(createQuizPageReport).toHaveBeenCalledWith({
      quizId: '507f191e810c19729de860ea',
      quizTitle: 'Algebra',
      quizSlug: 'algebra',
      reason: 'wrong_content',
      ipHash: 'h1',
    });
  });

  it('passes details and reporter identity through when given', async () => {
    await service.report('algebra', {
      reason: 'offensive',
      ipHash: 'h1',
      details: 'slur in Q3',
      reporterEmail: 'learner@example.com',
      reporterName: 'Learner',
    });

    expect(createQuizPageReport).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'slur in Q3',
        reporterEmail: 'learner@example.com',
        reporterName: 'Learner',
      }),
    );
  });

  it.each(['copyright', 'personal_data'] as const)(
    'puts the quiz on hold for %s',
    async (reason) => {
      await service.report('algebra', { reason, ipHash: 'h1' });

      expect(holdForReport).toHaveBeenCalledWith('507f191e810c19729de860ea', now);
    },
  );

  it.each(['wrong_content', 'offensive'] as const)(
    'does not hold the quiz for %s',
    async (reason) => {
      await service.report('algebra', { reason, ipHash: 'h1' });

      expect(holdForReport).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing', null],
    ['not public', quiz({ visibility: 'personal' })],
  ])('returns 404 when the quiz is %s and stores nothing', async (_label, found) => {
    findSummaryBySlug.mockResolvedValueOnce(found);

    const result = await service.report('algebra', { reason: 'copyright', ipHash: 'h1' });

    expect(result).toMatchObject({ success: false, statusCode: 404 });
    expect(createQuizPageReport).not.toHaveBeenCalled();
    expect(holdForReport).not.toHaveBeenCalled();
  });

  it('returns 500 when storage fails', async () => {
    createQuizPageReport.mockRejectedValueOnce(new Error('db down'));

    const result = await service.report('algebra', { reason: 'copyright', ipHash: 'h1' });

    expect(result).toMatchObject({ success: false, statusCode: 500 });
  });

  describe('IndexNow (RIN-1500)', () => {
    it('queues the quiz when a copyright report sets its hold', async () => {
      await service.report('algebra', { reason: 'copyright', ipHash: 'h1' });
      expect(quizIndexNow.quizChanged).toHaveBeenCalledWith({
        quizId: '507f191e810c19729de860ea',
        slug: 'algebra',
        cause: 'index-hold',
      });
    });

    it('queues nothing when the quiz was already held or the reason holds nothing', async () => {
      holdForReport.mockResolvedValue(false);
      await service.report('algebra', { reason: 'copyright', ipHash: 'h1' });
      await service.report('algebra', { reason: 'wrong_content', ipHash: 'h1' });
      expect(quizIndexNow.quizChanged).not.toHaveBeenCalled();
    });

    it('still stores the report when the notifier throws', async () => {
      quizIndexNow.quizChanged.mockImplementationOnce(() => {
        throw new Error('fake notifier failure');
      });
      const result = await service.report('algebra', { reason: 'copyright', ipHash: 'h1' });
      expect(result).toEqual({ success: true, data: { reportId: 'report-1' } });
    });
  });
});
