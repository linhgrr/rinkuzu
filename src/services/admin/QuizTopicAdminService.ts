import type {
  AdminQuizTopicAssignBodyDto,
  AdminQuizTopicCreateBodyDto,
  AdminQuizTopicDetailDto,
  AdminQuizTopicItemDto,
  AdminQuizTopicListDto,
  AdminQuizTopicReorderBodyDto,
  AdminQuizTopicUpdateBodyDto,
} from '@/dtos/admin-quiz-topic';
import type { IAdminAuditRepository } from '@/interfaces/repositories/IAdminAuditRepository';
import type {
  IQuizTopicAdminRepository,
  QuizTopicAssignmentRecord,
  QuizTopicChange,
  QuizTopicRecord,
} from '@/interfaces/repositories/IQuizTopicAdminRepository';
import type { IStarterQuizReadRepository } from '@/interfaces/repositories/IStarterQuizReadRepository';
import type { IIndexNowNotifier } from '@/interfaces/services/IIndexNowNotifier';
import type { ServiceFailure, ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { topicHubChangeUrls } from '@/lib/seo/topic-hub-urls';
import {
  countIntroWords,
  isTopicIntroPublishable,
  QUIZ_TOPIC_INTRO_MAX_WORDS,
  QUIZ_TOPIC_INTRO_MIN_WORDS,
} from '@/shared/constants/quiz-topic';

export interface QuizTopicAdminActor {
  id: string;
  email: string;
}

export interface QuizTopicAdminDeps {
  topicRepository: IQuizTopicAdminRepository;
  /** Visibility, slug, title and question count of a quiz; nothing else leaves the DB. */
  quizRepository: IStarterQuizReadRepository;
  auditRepository: IAdminAuditRepository;
  /** Tells search engines which hub URLs changed (RIN-1500); fire-and-forget. */
  indexNow?: IIndexNowNotifier;
}

type QuizTopicAuditAction =
  | 'quiz_topic.created'
  | 'quiz_topic.updated'
  | 'quiz_topic.published'
  | 'quiz_topic.unpublished'
  | 'quiz_topic.quiz_assigned'
  | 'quiz_topic.quiz_reordered'
  | 'quiz_topic.quiz_unassigned';

interface QuizTopicAuditInput {
  action: QuizTopicAuditAction;
  topicId: string;
  details: Record<string, string>;
}

interface OrderChange {
  id: string;
  order: number;
}

interface TopicQuizContext {
  topic: QuizTopicRecord;
  rows: QuizTopicAssignmentRecord[];
  target: QuizTopicAssignmentRecord;
}

type EditableTopicField = 'slug' | 'name' | 'intro' | 'order' | 'published';

type TopicListResult = ServiceResult<AdminQuizTopicListDto>;
type TopicDetailResult = ServiceResult<AdminQuizTopicDetailDto>;

function failure(code: string, error: string, statusCode: number): ServiceFailure {
  return { success: false, code, error, statusCode };
}

const WRITE_FAILED = failure('internal_error', 'Failed to update quiz topics', 500);
const AUDIT_FAILED = failure('internal_error', 'Failed to record the topic change', 500);
const TOPIC_NOT_FOUND = failure('not_found', 'Topic not found', 404);
const QUIZ_NOT_IN_TOPIC = failure('not_found', 'Quiz is not in this topic', 404);
const SLUG_TAKEN = failure('conflict', 'Topic slug is already used', 409);
const QUIZ_HAS_TOPIC = failure('conflict', 'Quiz already belongs to a topic', 409);
const INTRO_NOT_PUBLISHABLE = failure(
  'validation_error',
  `A published topic needs an intro of ${QUIZ_TOPIC_INTRO_MIN_WORDS} to ${QUIZ_TOPIC_INTRO_MAX_WORDS} words`,
  422,
);

function clampPosition(position: number, length: number): number {
  return Math.min(Math.max(position, 1), length);
}

/** Orders are 1-based and dense: the changes that make `rows` read 1..n. */
function renumber(rows: readonly OrderChange[]): OrderChange[] {
  return rows.flatMap((row, index) =>
    row.order === index + 1 ? [] : [{ id: row.id, order: index + 1 }],
  );
}

/** `rows` with `item` placed at the 1-based `position` (removed first if present). */
function placeAt<T extends OrderChange>(rows: readonly T[], item: T, position: number): T[] {
  const next = rows.filter((row) => row.id !== item.id);
  next.splice(position - 1, 0, item);
  return next;
}

/** The order changes that put `rows` back the way they were. */
function restoreOrders(
  rows: readonly OrderChange[],
  changes: readonly OrderChange[],
): OrderChange[] {
  const changedIds = new Set(changes.map(({ id }) => id));
  return rows.filter(({ id }) => changedIds.has(id)).map(({ id, order }) => ({ id, order }));
}

function toItem(topic: QuizTopicRecord, quizCount: number): AdminQuizTopicItemDto {
  return { ...topic, introWords: countIntroWords(topic.intro), quizCount };
}

/** The fields of `next` that differ from `target`. */
function changedFields(target: QuizTopicRecord, next: QuizTopicRecord): EditableTopicField[] {
  const fields: EditableTopicField[] = ['slug', 'name', 'intro', 'order', 'published'];
  return fields.filter((field) => next[field] !== target[field]);
}

function pickFields(
  topic: QuizTopicRecord,
  fields: readonly EditableTopicField[],
): QuizTopicChange {
  const change: QuizTopicChange = { id: topic.id };
  for (const field of fields) Object.assign(change, { [field]: topic[field] });
  return change;
}

function updateAction(target: QuizTopicRecord, next: QuizTopicRecord): QuizTopicAuditAction {
  if (next.published === target.published) return 'quiz_topic.updated';
  return next.published ? 'quiz_topic.published' : 'quiz_topic.unpublished';
}

/**
 * Admin curation of topic hubs (RIN-1248): create, edit, publish/unpublish, and
 * assign/reorder/unassign public quizzes. Every write records exactly one audit
 * entry; if that record fails the write is undone and the call fails.
 */
export class QuizTopicAdminService {
  constructor(private readonly deps: QuizTopicAdminDeps) {}

  async listTopics(): Promise<TopicListResult> {
    try {
      return { success: true, data: await this.buildList() };
    } catch (error) {
      logger.error({ error }, 'List quiz topics error');
      return { ...WRITE_FAILED, error: 'Failed to load quiz topics' };
    }
  }

  async getTopic(topicId: string): Promise<TopicDetailResult> {
    try {
      const topic = await this.findTopic(topicId);
      if (!topic) return TOPIC_NOT_FOUND;
      return { success: true, data: await this.buildDetail(topic) };
    } catch (error) {
      logger.error({ error, topicId }, 'Get quiz topic error');
      return { ...WRITE_FAILED, error: 'Failed to load the quiz topic' };
    }
  }

  async createTopic(
    input: AdminQuizTopicCreateBodyDto,
    actor: QuizTopicAdminActor,
  ): Promise<TopicListResult> {
    const { topicRepository } = this.deps;
    try {
      const topics = await topicRepository.listTopics();
      const order = clampPosition(input.order ?? topics.length + 1, topics.length + 1);
      const inserted = await topicRepository.insertTopic({ ...input, order, actorId: actor.id });
      if (!inserted) return SLUG_TAKEN;

      const shifts = renumber(placeAt(topics, inserted, order));
      await topicRepository.updateTopics(shifts, actor.id);

      const audited = await this.audit(actor, {
        action: 'quiz_topic.created',
        topicId: inserted.id,
        details: { slug: inserted.slug, locale: inserted.locale, order: String(order) },
      });
      if (!audited) {
        await topicRepository.deleteTopic(inserted.id);
        await topicRepository.updateTopics(restoreOrders(topics, shifts), actor.id);
        return AUDIT_FAILED;
      }
      return { success: true, data: await this.buildList() };
    } catch (error) {
      logger.error({ error }, 'Create quiz topic error');
      return WRITE_FAILED;
    }
  }

  async updateTopic(
    topicId: string,
    patch: AdminQuizTopicUpdateBodyDto,
    actor: QuizTopicAdminActor,
  ): Promise<TopicListResult> {
    const { topicRepository } = this.deps;
    try {
      const topics = await topicRepository.listTopics();
      const target = topics.find(({ id }) => id === topicId);
      if (!target) return TOPIC_NOT_FOUND;

      const order = clampPosition(patch.order ?? topics.indexOf(target) + 1, topics.length);
      const next: QuizTopicRecord = {
        ...target,
        slug: patch.slug ?? target.slug,
        name: patch.name ?? target.name,
        intro: patch.intro ?? target.intro,
        published: patch.published ?? target.published,
        order,
      };
      if (next.published && !isTopicIntroPublishable(next.intro)) return INTRO_NOT_PUBLISHABLE;

      const fields = changedFields(target, next);
      const shifts = renumber(placeAt(topics, next, order)).filter(({ id }) => id !== topicId);
      if (fields.length === 0 && shifts.length === 0) {
        return { success: true, data: await this.buildList() };
      }

      // The target goes first: a slug clash stops the ordered batch before any write.
      const written = await topicRepository.updateTopics(
        [pickFields(next, fields), ...shifts],
        actor.id,
      );
      if (!written) return SLUG_TAKEN;

      const audited = await this.audit(actor, {
        action: updateAction(target, next),
        topicId,
        details: {
          fields: fields.join(','),
          slug: next.slug,
          previousSlug: target.slug,
          published: String(next.published),
          order: String(order),
        },
      });
      if (!audited) {
        await topicRepository.updateTopics(
          [pickFields(target, fields), ...restoreOrders(topics, shifts)],
          actor.id,
        );
        return AUDIT_FAILED;
      }
      this.notifyHubChange(target, next);
      return { success: true, data: await this.buildList() };
    } catch (error) {
      logger.error({ error, topicId }, 'Update quiz topic error');
      return WRITE_FAILED;
    }
  }

  async assignQuiz(
    topicId: string,
    input: AdminQuizTopicAssignBodyDto,
    actor: QuizTopicAdminActor,
  ): Promise<TopicDetailResult> {
    const { topicRepository, quizRepository } = this.deps;
    try {
      const topic = await this.findTopic(topicId);
      if (!topic) return TOPIC_NOT_FOUND;
      if (await topicRepository.findAssignmentByQuiz(input.quizId)) return QUIZ_HAS_TOPIC;

      const [quiz] = await quizRepository.findStarterQuizCandidates([input.quizId]);
      if (!quiz) return failure('not_found', 'Quiz not found', 404);
      if (quiz.visibility !== 'public') {
        return failure('validation_error', 'Only public quizzes can be added to a topic', 422);
      }

      const rows = await topicRepository.listAssignments(topicId);
      const order = clampPosition(input.order ?? rows.length + 1, rows.length + 1);
      const inserted = await topicRepository.insertAssignment({
        quizId: input.quizId,
        topicId,
        order,
        actorId: actor.id,
      });
      if (!inserted) return QUIZ_HAS_TOPIC;

      const shifts = renumber(placeAt(rows, inserted, order));
      await topicRepository.updateAssignmentOrders(shifts);

      const audited = await this.audit(actor, {
        action: 'quiz_topic.quiz_assigned',
        topicId,
        details: { quizId: input.quizId, order: String(order) },
      });
      if (!audited) {
        await topicRepository.deleteAssignment(inserted.id);
        await topicRepository.updateAssignmentOrders(restoreOrders(rows, shifts));
        return AUDIT_FAILED;
      }
      this.notifyHubChange(topic, topic);
      return { success: true, data: await this.buildDetail(topic) };
    } catch (error) {
      logger.error({ error, topicId, quizId: input.quizId }, 'Assign quiz to topic error');
      return WRITE_FAILED;
    }
  }

  async reorderQuiz(
    topicId: string,
    quizId: string,
    input: AdminQuizTopicReorderBodyDto,
    actor: QuizTopicAdminActor,
  ): Promise<TopicDetailResult> {
    const { topicRepository } = this.deps;
    try {
      const loaded = await this.loadTopicQuiz(topicId, quizId);
      if ('success' in loaded) return loaded;
      const { topic, rows, target } = loaded;

      const order = clampPosition(input.order, rows.length);
      const changes = renumber(placeAt(rows, target, order));
      if (changes.length === 0) return { success: true, data: await this.buildDetail(topic) };

      await topicRepository.updateAssignmentOrders(changes);
      const audited = await this.audit(actor, {
        action: 'quiz_topic.quiz_reordered',
        topicId,
        details: { quizId, order: String(order), previousOrder: String(target.order) },
      });
      if (!audited) {
        await topicRepository.updateAssignmentOrders(restoreOrders(rows, changes));
        return AUDIT_FAILED;
      }
      this.notifyHubChange(topic, topic);
      return { success: true, data: await this.buildDetail(topic) };
    } catch (error) {
      logger.error({ error, topicId, quizId }, 'Reorder topic quiz error');
      return WRITE_FAILED;
    }
  }

  async unassignQuiz(
    topicId: string,
    quizId: string,
    actor: QuizTopicAdminActor,
  ): Promise<TopicDetailResult> {
    try {
      const context = await this.loadTopicQuiz(topicId, quizId);
      if ('success' in context) return context;
      const repository = this.deps.topicRepository;
      if (!(await repository.deleteAssignment(context.target.id))) return QUIZ_NOT_IN_TOPIC;

      const shifts = renumber(context.rows.filter((row) => row.id !== context.target.id));
      await repository.updateAssignmentOrders(shifts);

      const audited = await this.audit(actor, {
        action: 'quiz_topic.quiz_unassigned',
        topicId,
        details: { quizId, order: String(context.target.order) },
      });
      if (!audited) {
        await repository.updateAssignmentOrders(restoreOrders(context.rows, shifts));
        await repository.insertAssignment({ ...context.target, actorId: actor.id });
        return AUDIT_FAILED;
      }
      this.notifyHubChange(context.topic, context.topic);
      return { success: true, data: await this.buildDetail(context.topic) };
    } catch (error) {
      logger.error({ error, topicId, quizId }, 'Unassign topic quiz error');
      return WRITE_FAILED;
    }
  }

  /**
   * Queues the public URLs the change touched. Never awaited and never fails the
   * admin's write: the notifier runs after the response, and a throw here is logged.
   */
  private notifyHubChange(before: QuizTopicRecord, after: QuizTopicRecord): void {
    try {
      const urls = topicHubChangeUrls(before, after);
      if (urls.length > 0) this.deps.indexNow?.notifyChanged(urls);
    } catch (error) {
      logger.warn({ error, topicId: after.id }, 'IndexNow notify for a topic change failed');
    }
  }

  /** The topic, its assignments in order, and the assignment of `quizId`; or a 404. */
  private async loadTopicQuiz(
    topicId: string,
    quizId: string,
  ): Promise<TopicQuizContext | ServiceFailure> {
    const topic = await this.findTopic(topicId);
    if (!topic) return TOPIC_NOT_FOUND;
    const rows = await this.deps.topicRepository.listAssignments(topicId);
    const target = rows.find((row) => row.quizId === quizId);
    return target ? { topic, rows, target } : QUIZ_NOT_IN_TOPIC;
  }

  private async findTopic(topicId: string): Promise<QuizTopicRecord | undefined> {
    const topics = await this.deps.topicRepository.listTopics();
    return topics.find(({ id }) => id === topicId);
  }

  private async buildList(): Promise<AdminQuizTopicListDto> {
    const { topicRepository } = this.deps;
    const [topics, counts] = await Promise.all([
      topicRepository.listTopics(),
      topicRepository.countAssignmentsByTopic(),
    ]);
    return { items: topics.map((topic) => toItem(topic, counts.get(topic.id) ?? 0)) };
  }

  private async buildDetail(topic: QuizTopicRecord): Promise<AdminQuizTopicDetailDto> {
    const rows = await this.deps.topicRepository.listAssignments(topic.id);
    const quizzes =
      rows.length === 0
        ? []
        : await this.deps.quizRepository.findStarterQuizCandidates(
            rows.map(({ quizId }) => quizId),
          );
    const quizzesById = new Map(quizzes.map((quiz) => [quiz.quizId, quiz]));
    return {
      topic: toItem(topic, rows.length),
      quizzes: rows.map((row) => {
        const quiz = quizzesById.get(row.quizId);
        return {
          quizId: row.quizId,
          order: row.order,
          slug: quiz?.slug ?? null,
          title: quiz?.title ?? null,
          questionCount: quiz?.questionCount ?? 0,
          isPublic: quiz?.visibility === 'public',
        };
      }),
    };
  }

  /** True when the entry was written; a failure is logged and the caller undoes its write. */
  private async audit(actor: QuizTopicAdminActor, entry: QuizTopicAuditInput): Promise<boolean> {
    try {
      await this.deps.auditRepository.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: entry.action,
        entityType: 'quiz_topic',
        entityId: entry.topicId,
        details: entry.details,
      });
      return true;
    } catch (error) {
      logger.error(
        { error, topicId: entry.topicId, action: entry.action },
        'Quiz topic audit write failed; reverting the change',
      );
      return false;
    }
  }
}
