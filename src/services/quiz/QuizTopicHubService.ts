import type {
  QuizTopicContextDto,
  QuizTopicHubDto,
  QuizTopicHubQuizDto,
  QuizTopicHubSummaryDto,
} from '@/dtos/quiz-topic-hub';
import type { QuizTopicRecord } from '@/interfaces/repositories/IQuizTopicAdminRepository';
import type {
  IQuizTopicHubRepository,
  QuizTopicHubQuizRecord,
} from '@/interfaces/repositories/IQuizTopicHubRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { isQuizIndexable } from '@/lib/seo/quiz-indexability';
import { isNonIndexableQuizOwner } from '@/shared/constants/analytics-exclusions';
import { isTopicIndexable } from '@/shared/constants/quiz-topic';

export interface QuizTopicHubDeps {
  hubRepository: IQuizTopicHubRepository;
  /** Owner candidates only: test and company accounts never make a quiz indexable (RIN-840). */
  ownerRepository: Pick<IQuizRepository, 'findNonIndexableOwnerCandidates'>;
}

interface IndexableQuiz {
  quizId: string;
  dto: QuizTopicHubQuizDto;
  lastModified: Date;
}

/**
 * Read side of the topic hubs (RIN-1248 A4, pages in RIN-1249). A hub lists only
 * the assigned quizzes that pass `isQuizIndexable` (RIN-1246), in admin order,
 * and is indexable per spec B5 (`isTopicIndexable`). Draft topics do not exist here.
 */
export class QuizTopicHubService {
  constructor(private readonly deps: QuizTopicHubDeps) {}

  /** Null when no published topic has this slug (the hub page answers 404). */
  async getTopicWithIndexableQuizzes(slug: string): Promise<QuizTopicHubDto | null> {
    const topic = await this.deps.hubRepository.findPublishedTopicBySlug(slug);
    if (!topic) return null;
    const quizzesByTopic = await this.loadIndexableQuizzes([topic]);
    const quizzes = (quizzesByTopic.get(topic.id) ?? []).map(({ dto }) => dto);
    return {
      slug: topic.slug,
      locale: topic.locale,
      name: topic.name,
      intro: topic.intro,
      quizzes,
      indexable: isTopicIndexable({
        published: topic.published,
        intro: topic.intro,
        indexableQuizCount: quizzes.length,
      }),
    };
  }

  /**
   * The quiz page's topic (RIN-1241 C11/C12): the quiz's published topic and up to
   * `limit` other indexable quizzes of it, in hub order. Null without a published topic.
   */
  async getQuizTopicContext(quizId: string, limit: number): Promise<QuizTopicContextDto | null> {
    const topic = await this.deps.hubRepository.findPublishedTopicByQuizId(quizId);
    if (!topic) return null;
    const quizzesByTopic = await this.loadIndexableQuizzes([topic]);
    const quizzes = (quizzesByTopic.get(topic.id) ?? [])
      .filter((entry) => entry.quizId !== quizId)
      .slice(0, limit)
      .map(({ dto }) => dto);
    return { slug: topic.slug, name: topic.name, quizzes };
  }

  /** Published topics that pass `isTopicIndexable`, in admin order. */
  async listIndexableTopics(): Promise<QuizTopicHubSummaryDto[]> {
    const topics = await this.deps.hubRepository.listPublishedTopics();
    if (topics.length === 0) return [];
    const quizzesByTopic = await this.loadIndexableQuizzes(topics);
    return topics.flatMap((topic) => {
      const quizzes = quizzesByTopic.get(topic.id) ?? [];
      const indexable = isTopicIndexable({
        published: topic.published,
        intro: topic.intro,
        indexableQuizCount: quizzes.length,
      });
      if (!indexable) return [];
      // Spec D15: the newest change of the topic itself or of one of its quizzes.
      const newest = Math.max(
        ...quizzes.map(({ lastModified }) => lastModified.getTime()),
        topic.updatedAt?.getTime() ?? 0,
      );
      return [
        {
          slug: topic.slug,
          locale: topic.locale,
          name: topic.name,
          indexableQuizCount: quizzes.length,
          lastModified: new Date(newest).toISOString(),
        },
      ];
    });
  }

  /** Indexable quizzes keyed by topic id, each list in assignment order. */
  private async loadIndexableQuizzes(
    topics: readonly QuizTopicRecord[],
  ): Promise<Map<string, IndexableQuiz[]>> {
    const { hubRepository } = this.deps;
    const assignments = await hubRepository.listAssignmentsByTopicIds(topics.map(({ id }) => id));
    const byTopic = new Map<string, IndexableQuiz[]>();
    if (assignments.length === 0) return byTopic;

    const [quizzes, excludedOwnerIds] = await Promise.all([
      hubRepository.findPublicQuizzesByIds(assignments.map(({ quizId }) => quizId)),
      this.loadExcludedOwnerIds(),
    ]);
    const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));

    for (const assignment of assignments) {
      const quiz = quizById.get(assignment.quizId);
      if (!quiz || !isHubQuizIndexable(quiz, excludedOwnerIds)) continue;
      const list = byTopic.get(assignment.topicId) ?? [];
      list.push(toIndexableQuiz(quiz));
      byTopic.set(assignment.topicId, list);
    }
    return byTopic;
  }

  private async loadExcludedOwnerIds(): Promise<Set<string>> {
    const candidates = await this.deps.ownerRepository.findNonIndexableOwnerCandidates();
    return new Set(
      candidates.filter((owner) => isNonIndexableQuizOwner(owner)).map(({ id }) => id),
    );
  }
}

function isHubQuizIndexable(
  quiz: QuizTopicHubQuizRecord,
  excludedOwnerIds: ReadonlySet<string>,
): boolean {
  return isQuizIndexable({
    visibility: quiz.visibility,
    ownerIndexable: quiz.authorId === null || !excludedOwnerIds.has(quiz.authorId),
    questionCount: quiz.questionCount,
  });
}

function toIndexableQuiz(quiz: QuizTopicHubQuizRecord): IndexableQuiz {
  const lastModified = quiz.updatedAt ?? quiz.createdAt;
  return {
    quizId: quiz.id,
    dto: {
      slug: quiz.slug,
      title: quiz.title,
      questionCount: quiz.questionCount,
      updatedAt: lastModified.toISOString(),
    },
    lastModified,
  };
}
