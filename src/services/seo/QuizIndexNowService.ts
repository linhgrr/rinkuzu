import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IQuizTopicHubRepository } from '@/interfaces/repositories/IQuizTopicHubRepository';
import type { QuizIndexNowChange } from '@/interfaces/services/IIndexNowNotifier';
import { isPersonalDataFlagged } from '@/lib/quiz/personal-data';
import { routePathSegment } from '@/lib/routing/routeParams';
import { canonicalFor } from '@/lib/seo';
import { detectQuizContentLocale, isQuizIndexable } from '@/lib/seo/quiz-indexability';
import { topicHubPath } from '@/lib/seo/topic-hub-urls';
import { isNonIndexableQuizOwner } from '@/shared/constants/analytics-exclusions';

export interface QuizIndexNowServiceDeps {
  quizzes: Pick<IQuizRepository, 'findMetadataBySlug' | 'findById'>;
  topics: Pick<IQuizTopicHubRepository, 'findPublishedTopicByQuizId'>;
}

/**
 * The public URLs to re-crawl after a quiz changed for search (RIN-1500): the
 * quiz page in its own language (the one URL that is indexed, RIN-1241 D14)
 * and the published topic hub that lists it. A quiz of a test or company
 * account (RIN-840) was never indexable, so it yields nothing.
 */
export class QuizIndexNowService {
  constructor(private readonly deps: QuizIndexNowServiceDeps) {}

  async urlsFor(change: QuizIndexNowChange): Promise<string[]> {
    const slug = await this.slugFor(change);
    if (slug === null) return [];
    const record = await this.deps.quizzes.findMetadataBySlug(slug);
    if (!record || record.quiz.id !== change.quizId) return [];
    if (record.owner && isNonIndexableQuizOwner(record.owner)) return [];
    const { quiz } = record;
    // A hold set or lifted on a hidden, thin or flagged quiz changes nothing
    // public. A quiz made public counts only when it is now indexable: it was
    // private before, so a held, thin or flagged one stays out either way.
    if (
      change.cause !== 'indexability' &&
      !isQuizIndexable({
        visibility: quiz.visibility,
        ownerIndexable: true,
        questionCount: quiz.questionCount ?? quiz.questions.length,
        personalDataFlagged: isPersonalDataFlagged(quiz.contentFlags),
        indexHold: change.cause === 'made-public' && quiz.indexHold !== undefined,
      })
    ) {
      return [];
    }

    const locale = detectQuizContentLocale(quiz.title, record.leadQuestionTexts ?? []);
    const urls = [canonicalFor(locale, `/quiz/${routePathSegment(quiz.slug)}`)];
    const topic = await this.deps.topics.findPublishedTopicByQuizId(change.quizId);
    if (topic) urls.push(canonicalFor(topic.locale, topicHubPath(topic.slug)));
    return urls;
  }

  private async slugFor(change: QuizIndexNowChange): Promise<string | null> {
    if (change.cause !== 'made-public') return change.slug;
    const stored = await this.deps.quizzes.findById(change.quizId);
    return stored?.slug ?? null;
  }
}
