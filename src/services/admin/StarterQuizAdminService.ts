import type {
  AdminStarterQuizCreateBodyDto,
  AdminStarterQuizItemDto,
  AdminStarterQuizListDto,
  AdminStarterQuizUpdateBodyDto,
} from '@/dtos/admin-starter-quiz';
import type { IAdminAuditRepository } from '@/interfaces/repositories/IAdminAuditRepository';
import type {
  IStarterQuizAdminRepository,
  StarterQuizRowChange,
  StarterQuizRowRecord,
} from '@/interfaces/repositories/IStarterQuizAdminRepository';
import type {
  IStarterQuizReadRepository,
  StarterQuizCandidateRecord,
} from '@/interfaces/repositories/IStarterQuizReadRepository';
import type { ServiceFailure, ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { getStarterQuizDropReason } from '@/services/dashboard/starter-quizzes';
import { isQuickRoundEligible } from '@/shared/constants/quick-round';

export interface StarterQuizAdminActor {
  id: string;
  email: string;
}

export interface StarterQuizAdminDeps {
  starterRepository: IStarterQuizAdminRepository;
  candidateRepository: IStarterQuizReadRepository;
  auditRepository: IAdminAuditRepository;
}

type StarterQuizAuditAction =
  | 'starter_quiz.marked'
  | 'starter_quiz.updated'
  | 'starter_quiz.unmarked'
  | 'starter_quiz.reordered';

interface StarterQuizAuditInput {
  action: StarterQuizAuditAction;
  quizId: string;
  details: Record<string, string>;
}

type StarterQuizListResult = ServiceResult<AdminStarterQuizListDto>;

const AUDIT_FAILED: ServiceFailure = {
  success: false,
  code: 'internal_error',
  error: 'Failed to record the starter change',
  statusCode: 500,
};

const UPDATE_FAILED: ServiceFailure = {
  success: false,
  code: 'internal_error',
  error: 'Failed to update starter quizzes',
  statusCode: 500,
};

const NOT_FOUND: ServiceFailure = {
  success: false,
  code: 'not_found',
  error: 'Starter quiz not found',
  statusCode: 404,
};

const ALREADY_STARTER: ServiceFailure = {
  success: false,
  code: 'conflict',
  error: 'Quiz is already a starter',
  statusCode: 409,
};

function clampPosition(position: number, length: number): number {
  return Math.min(Math.max(position, 1), length);
}

/** Orders are 1-based and dense: the changes that make `ordered` read 1..n. */
function renumber(ordered: readonly StarterQuizRowRecord[]): StarterQuizRowChange[] {
  return ordered.flatMap((row, index) =>
    row.order === index + 1 ? [] : [{ id: row.id, order: index + 1 }],
  );
}

/** The changes that put `rows` back the way they were. */
function restoreChanges(
  rows: readonly StarterQuizRowRecord[],
  changes: readonly StarterQuizRowChange[],
): StarterQuizRowChange[] {
  const changedIds = new Set(changes.map(({ id }) => id));
  return rows
    .filter(({ id }) => changedIds.has(id))
    .map(({ id, locale, order }) => ({ id, locale, order }));
}

function toItem(
  row: StarterQuizRowRecord,
  candidate: StarterQuizCandidateRecord | undefined,
): AdminStarterQuizItemDto {
  const reason = getStarterQuizDropReason(candidate);
  const questionCount = candidate?.questionCount ?? 0;
  return {
    id: row.id,
    quizId: row.quizId,
    slug: candidate?.slug ?? null,
    title: candidate?.title ?? null,
    questionCount,
    locale: row.locale,
    order: row.order,
    quick: isQuickRoundEligible(questionCount),
    status: reason ? 'dropped' : 'live',
    ...(reason ? { dropReason: reason } : {}),
  };
}

/**
 * Admin curation of the starter quizzes (RIN-1177): mark, change, reorder and
 * unmark. Every write records exactly one audit entry; if that record fails the
 * write is undone and the call fails, so no change goes unaudited.
 */
export class StarterQuizAdminService {
  constructor(private readonly deps: StarterQuizAdminDeps) {}

  async listStarterQuizzes(): Promise<StarterQuizListResult> {
    try {
      return { success: true, data: await this.buildList() };
    } catch (error) {
      logger.error({ error }, 'List admin starter quizzes error');
      return { ...UPDATE_FAILED, error: 'Failed to load starter quizzes' };
    }
  }

  async markStarterQuiz(
    input: AdminStarterQuizCreateBodyDto,
    actor: StarterQuizAdminActor,
  ): Promise<StarterQuizListResult> {
    const { starterRepository, candidateRepository } = this.deps;
    try {
      const rows = await starterRepository.listStarterQuizRows();
      if (rows.some(({ quizId }) => quizId === input.quizId)) return ALREADY_STARTER;

      const [candidate] = await candidateRepository.findStarterQuizCandidates([input.quizId]);
      const reason = getStarterQuizDropReason(candidate);
      if (reason) {
        return {
          success: false,
          code: 'validation_error',
          error: 'Quiz cannot be a starter: ' + reason,
          statusCode: 422,
        };
      }

      const order = clampPosition(input.order ?? rows.length + 1, rows.length + 1);
      const inserted = await starterRepository.insertStarterQuiz({
        quizId: input.quizId,
        locale: input.locale,
        order,
        actorId: actor.id,
      });
      if (!inserted) return ALREADY_STARTER;

      const ordered = [...rows];
      ordered.splice(order - 1, 0, inserted);
      const shifts = renumber(ordered);
      await starterRepository.updateStarterQuizRows(shifts, actor.id);

      const audited = await this.audit(actor, {
        action: 'starter_quiz.marked',
        quizId: input.quizId,
        details: { locale: input.locale, order: String(order) },
      });
      if (!audited) {
        await starterRepository.deleteStarterQuiz(inserted.id);
        await starterRepository.updateStarterQuizRows(restoreChanges(rows, shifts), actor.id);
        return AUDIT_FAILED;
      }
      return { success: true, data: await this.buildList() };
    } catch (error) {
      logger.error({ error, quizId: input.quizId }, 'Mark starter quiz error');
      return UPDATE_FAILED;
    }
  }

  async updateStarterQuiz(
    id: string,
    patch: AdminStarterQuizUpdateBodyDto,
    actor: StarterQuizAdminActor,
  ): Promise<StarterQuizListResult> {
    const { starterRepository } = this.deps;
    try {
      const rows = await starterRepository.listStarterQuizRows();
      const target = rows.find((row) => row.id === id);
      if (!target) return NOT_FOUND;

      const locale = patch.locale ?? target.locale;
      const order = clampPosition(patch.order ?? rows.indexOf(target) + 1, rows.length);
      const ordered = rows.filter((row) => row.id !== id);
      ordered.splice(order - 1, 0, target);

      const localeChanged = locale !== target.locale;
      const changes = renumber(ordered).filter((change) => change.id !== id);
      if (localeChanged || target.order !== order) changes.push({ id, locale, order });
      if (changes.length === 0) return { success: true, data: await this.buildList() };

      await starterRepository.updateStarterQuizRows(changes, actor.id);
      const audited = await this.audit(actor, {
        action: localeChanged ? 'starter_quiz.updated' : 'starter_quiz.reordered',
        quizId: target.quizId,
        details: {
          locale,
          order: String(order),
          previousLocale: target.locale,
          previousOrder: String(target.order),
        },
      });
      if (!audited) {
        await starterRepository.updateStarterQuizRows(restoreChanges(rows, changes), actor.id);
        return AUDIT_FAILED;
      }
      return { success: true, data: await this.buildList() };
    } catch (error) {
      logger.error({ error, starterId: id }, 'Update starter quiz error');
      return UPDATE_FAILED;
    }
  }

  async unmarkStarterQuiz(
    id: string,
    actor: StarterQuizAdminActor,
  ): Promise<StarterQuizListResult> {
    const { starterRepository } = this.deps;
    try {
      const rows = await starterRepository.listStarterQuizRows();
      const target = rows.find((row) => row.id === id);
      if (!target) return NOT_FOUND;
      if (!(await starterRepository.deleteStarterQuiz(id))) return NOT_FOUND;

      const shifts = renumber(rows.filter((row) => row.id !== id));
      await starterRepository.updateStarterQuizRows(shifts, actor.id);

      const audited = await this.audit(actor, {
        action: 'starter_quiz.unmarked',
        quizId: target.quizId,
        details: { locale: target.locale, order: String(target.order) },
      });
      if (!audited) {
        await starterRepository.updateStarterQuizRows(restoreChanges(rows, shifts), actor.id);
        await starterRepository.insertStarterQuiz({ ...target, actorId: actor.id });
        return AUDIT_FAILED;
      }
      return { success: true, data: await this.buildList() };
    } catch (error) {
      logger.error({ error, starterId: id }, 'Unmark starter quiz error');
      return UPDATE_FAILED;
    }
  }

  private async buildList(): Promise<AdminStarterQuizListDto> {
    const rows = await this.deps.starterRepository.listStarterQuizRows();
    if (rows.length === 0) return { items: [] };
    const candidates = await this.deps.candidateRepository.findStarterQuizCandidates(
      rows.map(({ quizId }) => quizId),
    );
    const candidatesById = new Map(candidates.map((candidate) => [candidate.quizId, candidate]));
    return { items: rows.map((row) => toItem(row, candidatesById.get(row.quizId))) };
  }

  /** True when the entry was written; a failure is logged and the caller undoes its write. */
  private async audit(
    actor: StarterQuizAdminActor,
    entry: StarterQuizAuditInput,
  ): Promise<boolean> {
    try {
      await this.deps.auditRepository.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: entry.action,
        entityType: 'quiz',
        entityId: entry.quizId,
        details: entry.details,
      });
      return true;
    } catch (error) {
      logger.error(
        { error, quizId: entry.quizId, action: entry.action },
        'Starter quiz audit write failed; reverting the change',
      );
      return false;
    }
  }
}
