import type { ReportQuizResponseDto } from '@/dtos/quiz';
import type { IQuizIndexHoldRepository } from '@/interfaces/repositories/IQuizIndexHoldRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IQuizPageReportRepository } from '@/interfaces/repositories/IReportRepository';
import type { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { QuizDiscussionDtoMapper } from '@/mappers/quiz/QuizDiscussionDtoMapper';
import { holdsQuizIndex, type ReportReason } from '@/shared/constants/report-reason';

export interface QuizPageReportInput {
  reason: ReportReason;
  details?: string;
  /** The session email when signed in, else whatever the reporter typed, if anything. */
  reporterEmail?: string;
  reporterName?: string;
  ipHash: string;
}

type QuizSummaryReader = Pick<IQuizRepository, 'findSummaryBySlug'>;

/**
 * The quiz-level "Report this quiz" flow (RIN-1336 Part 2b, RIN-1343). Open to
 * anyone, on public quizzes only. A copyright or personal-data report puts the
 * quiz on an index hold until an admin settles it.
 */
export class QuizPageReportService {
  constructor(
    private readonly quizRepository: QuizSummaryReader,
    private readonly reportRepository: IQuizPageReportRepository,
    private readonly indexHoldRepository: IQuizIndexHoldRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async report(
    slug: string,
    input: QuizPageReportInput,
  ): Promise<ServiceResult<ReportQuizResponseDto>> {
    try {
      const quiz = await this.quizRepository.findSummaryBySlug(slug);
      if (!quiz || quiz.visibility !== 'public') {
        return { success: false, error: 'Quiz not found', statusCode: 404 };
      }

      const report = await this.reportRepository.createQuizPageReport({
        quizId: quiz.id,
        quizTitle: quiz.title,
        quizSlug: quiz.slug,
        reason: input.reason,
        ipHash: input.ipHash,
        ...(input.details ? { content: input.details } : {}),
        ...(input.reporterEmail ? { reporterEmail: input.reporterEmail } : {}),
        ...(input.reporterName ? { reporterName: input.reporterName } : {}),
      });

      if (holdsQuizIndex(input.reason)) {
        await this.indexHoldRepository.holdForReport(quiz.id, this.now());
      }

      return { success: true, data: QuizDiscussionDtoMapper.toReportResponseDto(report.id) };
    } catch (error) {
      // Only the error: the details, email and address hash stay out of logs.
      logger.error({ error }, 'Quiz page report error');
      return { success: false, error: 'Failed to report quiz', statusCode: 500 };
    }
  }
}
