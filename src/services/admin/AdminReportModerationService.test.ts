import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Report } from '@/entities/Report';
import { AdminReportModerationService } from '@/services/admin/AdminReportModerationService';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const now = new Date('2026-11-10T08:00:00Z');
const actor = { id: 'admin-1', email: 'admin@example.com' };

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: 'report-1',
    quizId: 'quiz-1',
    quizTitle: 'Algebra',
    quizSlug: 'algebra',
    reporterEmail: '',
    reporterName: '',
    content: '',
    reason: 'copyright',
    source: 'quiz_page',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AdminReportModerationService', () => {
  const reports = {
    findById: vi.fn<(id: string) => Promise<Report | null>>(),
    update: vi.fn(),
    countPendingIndexHoldReports: vi.fn<(quizId?: string) => Promise<number>>(),
  };
  const indexHold = {
    holdForReport: vi.fn<(quizId: string, since: Date) => Promise<boolean>>(),
    releaseReportHold: vi.fn<(quizId: string) => Promise<boolean>>(),
  };
  const quizVisibility = { setAdminQuizVisibility: vi.fn() };
  const quizIndexNow = { quizChanged: vi.fn() };
  const service = new AdminReportModerationService({
    reports,
    indexHold,
    quizVisibility,
    quizIndexNow,
    now: () => now,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    reports.findById.mockResolvedValue(report());
    reports.update.mockResolvedValue(report({ status: 'resolved' }));
    reports.countPendingIndexHoldReports.mockResolvedValue(0);
    quizVisibility.setAdminQuizVisibility.mockResolvedValue({ success: true, data: {} });
    indexHold.holdForReport.mockResolvedValue(true);
    indexHold.releaseReportHold.mockResolvedValue(true);
  });

  describe('syncIndexHold', () => {
    it.each(['resolved', 'dismissed'] as const)(
      'releases the hold when the last hold report is %s',
      async (status) => {
        await service.syncIndexHold(report({ status }), status);

        expect(reports.countPendingIndexHoldReports).toHaveBeenCalledWith('quiz-1');
        expect(indexHold.releaseReportHold).toHaveBeenCalledWith('quiz-1');
      },
    );

    it('keeps the hold while another copyright/personal-data report is pending', async () => {
      reports.countPendingIndexHoldReports.mockResolvedValueOnce(1);

      await service.syncIndexHold(report({ reason: 'personal_data' }), 'dismissed');

      expect(indexHold.releaseReportHold).not.toHaveBeenCalled();
    });

    it('holds the quiz again when a hold report is reopened', async () => {
      await service.syncIndexHold(report(), 'pending');

      expect(indexHold.holdForReport).toHaveBeenCalledWith('quiz-1', now);
      expect(indexHold.releaseReportHold).not.toHaveBeenCalled();
    });

    it.each(['none', 'wrong_content', 'offensive'] as const)(
      'leaves the hold alone for reason %s',
      async (reason) => {
        const { reason: _dropped, ...withoutReason } = report();
        await service.syncIndexHold(
          reason === 'none' ? withoutReason : report({ reason }),
          'resolved',
        );

        expect(reports.countPendingIndexHoldReports).not.toHaveBeenCalled();
        expect(indexHold.releaseReportHold).not.toHaveBeenCalled();
        expect(indexHold.holdForReport).not.toHaveBeenCalled();
      },
    );
  });

  describe('hideReportedQuiz', () => {
    it('hides through the audited visibility path, resolves the report and keeps the hold', async () => {
      const result = await service.hideReportedQuiz('report-1', actor, 'from my textbook');

      expect(result).toEqual({
        success: true,
        data: { message: 'Quiz hidden and report resolved' },
      });
      expect(quizVisibility.setAdminQuizVisibility).toHaveBeenCalledTimes(1);
      expect(quizVisibility.setAdminQuizVisibility).toHaveBeenCalledWith(
        'quiz-1',
        'personal',
        actor,
      );
      expect(reports.update).toHaveBeenCalledWith('report-1', {
        status: 'resolved',
        resolution: { resolvedAt: now, resolvedBy: 'admin@example.com' },
        adminNotes: 'from my textbook',
      });
      expect(indexHold.releaseReportHold).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown report and touches nothing', async () => {
      reports.findById.mockResolvedValueOnce(null);

      const result = await service.hideReportedQuiz('missing', actor);

      expect(result).toMatchObject({ success: false, statusCode: 404 });
      expect(quizVisibility.setAdminQuizVisibility).not.toHaveBeenCalled();
    });

    it('leaves the report pending when the visibility change fails', async () => {
      quizVisibility.setAdminQuizVisibility.mockResolvedValueOnce({
        success: false,
        error: 'Failed to change quiz visibility',
        statusCode: 500,
      });

      const result = await service.hideReportedQuiz('report-1', actor);

      expect(result).toMatchObject({ success: false, statusCode: 500 });
      expect(reports.update).not.toHaveBeenCalled();
    });

    it('returns 500 when the report lookup throws', async () => {
      reports.findById.mockRejectedValueOnce(new Error('db down'));

      const result = await service.hideReportedQuiz('report-1', actor);

      expect(result).toEqual({ success: false, error: 'Failed to hide quiz', statusCode: 500 });
      expect(quizVisibility.setAdminQuizVisibility).not.toHaveBeenCalled();
    });

    it('stamps the resolution with the system clock when no clock is injected', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(now);
      try {
        const withSystemClock = new AdminReportModerationService({
          reports,
          indexHold,
          quizVisibility,
        });

        await withSystemClock.hideReportedQuiz('report-1', actor);

        expect(reports.update).toHaveBeenCalledWith('report-1', {
          status: 'resolved',
          resolution: { resolvedAt: now, resolvedBy: 'admin@example.com' },
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('counts pending hold reports across quizzes', async () => {
    reports.countPendingIndexHoldReports.mockResolvedValueOnce(4);

    await expect(service.countPendingIndexHold()).resolves.toBe(4);
    expect(reports.countPendingIndexHoldReports).toHaveBeenCalledWith();
  });

  describe('syncIndexHold IndexNow (RIN-1500)', () => {
    const change = { quizId: 'quiz-1', slug: 'algebra', cause: 'index-hold' };

    it('queues the quiz when the last hold report is settled and the hold lifts', async () => {
      await service.syncIndexHold(report(), 'resolved');
      expect(quizIndexNow.quizChanged).toHaveBeenCalledWith(change);
    });

    it('queues the quiz when a reopened report sets the hold again', async () => {
      await service.syncIndexHold(report({ status: 'resolved' }), 'pending');
      expect(quizIndexNow.quizChanged).toHaveBeenCalledWith(change);
    });

    it('queues nothing when the hold did not change', async () => {
      indexHold.releaseReportHold.mockResolvedValue(false);
      await service.syncIndexHold(report(), 'dismissed');
      reports.countPendingIndexHoldReports.mockResolvedValue(1);
      await service.syncIndexHold(report(), 'resolved');
      await service.syncIndexHold(report({ reason: 'wrong_content' }), 'resolved');
      expect(quizIndexNow.quizChanged).not.toHaveBeenCalled();
    });
  });
});
