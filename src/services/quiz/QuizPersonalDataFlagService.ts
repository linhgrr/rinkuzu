import type { AdminQuizPersonalDataFlagClearDto } from '@/dtos/admin-quiz';
import type { IAdminAuditRepository } from '@/interfaces/repositories/IAdminAuditRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IQuizIndexNowNotifier } from '@/interfaces/services/IIndexNowNotifier';
import type { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { notifyQuizSearchChange } from '@/lib/seo/quiz-search-change';
import { AdminQuizDtoMapper } from '@/mappers/quiz/AdminQuizDtoMapper';

interface PersonalDataFlagActor {
  id: string;
  email: string;
}

type PersonalDataFlagQuizRepository = Pick<IQuizRepository, 'findById' | 'update'>;

const CLEAR_FAILED: ServiceResult<never> = {
  success: false,
  code: 'internal_error',
  error: 'Failed to clear the personal-data flag',
  statusCode: 500,
};

/**
 * Admin Clear flag for the personal-data check (RIN-1336 Part 3 AC4, RIN-1342).
 *
 * A clear keeps the kinds recorded at clear time; a later save re-flags the quiz
 * only when it holds a new kind (`resolveQuizContentFlags`). Every clear is
 * audited fail-closed: if the audit write throws, the flag is put back.
 */
export class QuizPersonalDataFlagService {
  constructor(
    private readonly quizRepository: PersonalDataFlagQuizRepository,
    private readonly auditRepository: IAdminAuditRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly quizIndexNow?: IQuizIndexNowNotifier,
  ) {}

  async clear(
    id: string,
    actor: PersonalDataFlagActor,
  ): Promise<ServiceResult<AdminQuizPersonalDataFlagClearDto>> {
    try {
      const quiz = await this.quizRepository.findById(id);
      if (!quiz) {
        return { success: false, code: 'not_found', error: 'Quiz not found', statusCode: 404 };
      }

      const flags = quiz.contentFlags;
      if (flags?.personalData !== true) {
        return { success: true, data: AdminQuizDtoMapper.toPersonalDataFlagClear(quiz, false) };
      }

      const contentFlags = {
        personalData: false,
        kinds: [...flags.kinds],
        checkedAt: flags.checkedAt,
        clearedBy: actor.id,
        clearedAt: this.now(),
      };
      await this.quizRepository.update(quiz.id, { contentFlags });

      try {
        await this.auditRepository.record({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'quiz.personal_data_flag.cleared',
          entityType: 'quiz',
          entityId: quiz.id,
          details: { slug: quiz.slug, kinds: flags.kinds.join(',') },
        });
      } catch (auditError) {
        logger.error(
          { error: auditError, quizId: quiz.id },
          'Personal-data flag clear audit write failed; restoring the flag',
        );
        await this.quizRepository.update(quiz.id, { contentFlags: flags });
        return CLEAR_FAILED;
      }

      notifyQuizSearchChange(this.quizIndexNow, quiz, { ...quiz, contentFlags });
      return { success: true, data: AdminQuizDtoMapper.toPersonalDataFlagClear(quiz, true) };
    } catch (error) {
      logger.error({ error, quizId: id }, 'Clear personal-data flag error');
      return CLEAR_FAILED;
    }
  }
}
