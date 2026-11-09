import type { AdminMessageDto } from '@/dtos/admin-user';
import type { Report } from '@/entities/Report';
import type { QuizVisibility } from '@/entities/Quiz';
import type { IQuizIndexHoldRepository } from '@/interfaces/repositories/IQuizIndexHoldRepository';
import type {
  IIndexHoldReportRepository,
  IReportRepository,
} from '@/interfaces/repositories/IReportRepository';
import type { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { AdminMessageDtoMapper } from '@/mappers/admin/AdminMessageDtoMapper';
import { holdsQuizIndex } from '@/shared/constants/report-reason';
import type { ReportStatus } from '@/shared/constants/report-status';

interface AdminActor {
  id: string;
  email: string;
}

/** The audited visibility change behind `PATCH /api/admin/quizzes/[id]`. */
interface QuizVisibilityModerator {
  setAdminQuizVisibility(
    id: string,
    visibility: QuizVisibility,
    actor: AdminActor,
  ): Promise<ServiceResult<unknown>>;
}

interface AdminReportModerationDeps {
  reports: Pick<IReportRepository, 'findById' | 'update'> & IIndexHoldReportRepository;
  indexHold: IQuizIndexHoldRepository;
  quizVisibility: QuizVisibilityModerator;
  now?: () => Date;
}

/**
 * Admin side of the quiz-level report flow (RIN-1343): keeps the quiz's index
 * hold in step with its copyright/personal-data reports, and hides a reported
 * quiz in one step.
 */
export class AdminReportModerationService {
  private readonly now: () => Date;

  constructor(private readonly deps: AdminReportModerationDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  countPendingIndexHold(): Promise<number> {
    return this.deps.reports.countPendingIndexHoldReports();
  }

  /**
   * After a report's status changed: reopening one re-holds the quiz; the hold
   * lifts once no copyright/personal-data report on the quiz is still pending.
   */
  async syncIndexHold(report: Report, status: ReportStatus): Promise<void> {
    if (!holdsQuizIndex(report.reason)) return;
    if (status === 'pending') {
      await this.deps.indexHold.holdForReport(report.quizId, this.now());
      return;
    }
    const stillPending = await this.deps.reports.countPendingIndexHoldReports(report.quizId);
    if (stillPending === 0) await this.deps.indexHold.releaseReportHold(report.quizId);
  }

  /**
   * Hides the reported quiz through the audited visibility path (its one audit
   * entry) and marks the report resolved. The index hold stays: the quiz is no
   * longer public, and republishing it is a deliberate admin act.
   */
  async hideReportedQuiz(
    reportId: string,
    actor: AdminActor,
    adminNotes?: string,
  ): Promise<ServiceResult<AdminMessageDto>> {
    try {
      const report = await this.deps.reports.findById(reportId);
      if (!report) return { success: false, error: 'Report not found', statusCode: 404 };

      const hidden = await this.deps.quizVisibility.setAdminQuizVisibility(
        report.quizId,
        'personal',
        actor,
      );
      if (!hidden.success) return hidden;

      await this.deps.reports.update(reportId, {
        status: 'resolved',
        resolution: { resolvedAt: this.now(), resolvedBy: actor.email },
        ...(adminNotes !== undefined && { adminNotes }),
      });
      return {
        success: true,
        data: AdminMessageDtoMapper.toDto('Quiz hidden and report resolved'),
      };
    } catch (error) {
      logger.error({ error }, 'Hide reported quiz error');
      return { success: false, error: 'Failed to hide quiz', statusCode: 500 };
    }
  }
}
