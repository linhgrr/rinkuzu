import { getQuizService } from '@/lib/quiz-factory';
import type {
  QuizPlayAuthorViewModel,
  QuizPlayViewModel,
} from '@/features/quiz/types/quiz-play-view-model';
import { QuizBreadcrumbSchema, QuizPageSchema } from '@/components/seo/QuizPageSchema';
import { toQuizLandingViewModel } from '@/features/quiz/mappers/quiz-landing.mapper';
import type { QuizLandingViewModel } from '@/features/quiz/types/quiz-landing-view-model';
import { buildQuizSeoDescription, isQuizIndexable } from '@/lib/seo/quiz-indexability';
import { logger } from '@/lib/logger';
import { getQuizTopicHubService } from '@/lib/quiz-topic-hub-factory';
import { TOPIC_HUB_LOCALE, topicHubPath } from '@/lib/seo/topic-hub';
import { HUB_ENTRY } from '@/shared/constants/starter-quiz';
import { QUIZ_TOPIC_SLUG_PATTERN } from '@/shared/constants/quiz-topic';
import { loadQuizMetadata } from './quiz-metadata';

/**
 * The parts of the quiz page that depend only on the quiz, never on the viewer
 * (RIN-1647): the dynamic route and the cached signed-out twin render the
 * landing and the structured data from the same code. Nothing here reads the
 * session, cookies or headers (tests/ui/public-cache-session-free-contract).
 */

export type QuizTopic = Awaited<
  ReturnType<ReturnType<typeof getQuizTopicHubService>['getQuizTopicContext']>
>;

export type QuizPageSearchParams = Record<string, string | string[] | undefined>;

export function firstValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/** Related quiz links on the landing (RIN-1241 C12). */
const RELATED_QUIZ_LIMIT = 6;

/**
 * The quiz's published topic and its other indexable quizzes (RIN-1241 C11/C12).
 * Hubs exist in Vietnamese only. A failed read drops the topic, never the page.
 */
export async function loadQuizTopic(quizId: string, locale: string): Promise<QuizTopic> {
  if (locale !== TOPIC_HUB_LOCALE) return null;
  return getQuizTopicHubService()
    .getQuizTopicContext(quizId, RELATED_QUIZ_LIMIT)
    .catch((error: unknown) => {
      logger.error({ error, quizId }, 'topic of the quiz page failed');
      return null;
    });
}

/** `?entry=hub` from a hub card, with its topic when the slug is valid; null for any other entry. */
function landingHubEntry(query: QuizPageSearchParams): QuizLandingViewModel['hubEntry'] {
  if (firstValue(query['entry']) !== HUB_ENTRY) return null;
  const topic = firstValue(query['topic']);
  return { topic: topic && QUIZ_TOPIC_SLUG_PATTERN.test(topic) ? topic : null };
}

interface LandingRequest {
  slug: string;
  locale: string;
  quiz: QuizPlayViewModel;
  topic: QuizTopic;
  query: QuizPageSearchParams;
  viewerId: string | undefined;
  authorName: string | undefined;
}

/**
 * The landing view (RIN-1241, Designer spec on RIN-1247) shows for an indexable
 * public quiz opened without `mode`, `entry` or `retryOf`, to anyone but its
 * owner. Everyone else gets the player exactly as before. A topic hub card's
 * `entry=hub` link also gets the landing, and its CTAs keep that entry (RIN-1469).
 */
export async function loadQuizLanding({
  slug,
  locale,
  quiz,
  topic,
  query,
  viewerId,
  authorName,
}: LandingRequest): Promise<QuizLandingViewModel | null> {
  if (quiz.visibility !== 'public') return null;
  const hubEntry = landingHubEntry(query);
  if (query['mode'] !== undefined || (query['entry'] !== undefined && !hubEntry)) return null;
  if (query['retryOf'] !== undefined) return null;
  if (viewerId && quiz.author?.id === viewerId) return null;
  const metadata = await loadQuizMetadata(slug);
  if (!metadata || !isQuizIndexable(metadata)) return null;

  // C12: same-topic quizzes first; a quiz without other topic quizzes gets recent ones.
  const sameTopic = topic && topic.quizzes.length > 0 ? topic.quizzes : null;
  const related =
    sameTopic ??
    (await getQuizService()
      .getRelatedPublicQuizzes({
        excludeSlug: slug,
        contentLocale: metadata.contentLocale,
        limit: RELATED_QUIZ_LIMIT,
      })
      .catch((error: unknown) => {
        // The links are extra; the landing still renders without them.
        logger.error({ error, slug }, 'related quizzes for the quiz landing failed');
        return [];
      }));
  return toQuizLandingViewModel({
    slug,
    quiz,
    description: buildQuizSeoDescription({
      title: quiz.title,
      description: quiz.description ?? null,
      questionCount: quiz.questionCount,
      firstQuestionText: metadata.leadQuestionTexts[0] ?? null,
      locale: metadata.contentLocale,
    }),
    authorName: authorName ?? null,
    related,
    relatedSameTopic: sameTopic !== null,
    topic: topic ? { name: topic.name, href: `/${locale}${topicHubPath(topic.slug)}` } : null,
    hubEntry,
  });
}

/**
 * Structured data names a person only from a real name, never an email, its
 * local part or a placeholder (RIN-840); otherwise RinKuzu is the author.
 */
export function schemaAuthorNameOf(author: QuizPlayAuthorViewModel | null): string | undefined {
  return author?.displayName?.trim() || author?.name?.trim() || undefined;
}

interface QuizSchemaProps {
  slug: string;
  locale: string;
  quiz: QuizPlayViewModel;
  topic: QuizTopic;
  authorName: string | undefined;
}

/**
 * The quiz and breadcrumb JSON-LD elements of a public quiz page; null for any
 * other quiz. A function, not a component, so the page's element tree is unchanged.
 */
export function quizStructuredData({ slug, locale, quiz, topic, authorName }: QuizSchemaProps) {
  if (quiz.visibility !== 'public') return null;
  return (
    <>
      <QuizPageSchema
        locale={locale}
        quizSlug={slug}
        quizTitle={quiz.title}
        {...(quiz.description ? { quizDescription: quiz.description } : {})}
        {...(authorName ? { authorName } : {})}
        {...(topic ? { topicName: topic.name } : {})}
        createdAt={quiz.createdAt}
        updatedAt={quiz.updatedAt}
      />
      <QuizBreadcrumbSchema
        locale={locale}
        quizSlug={slug}
        quizTitle={quiz.title}
        {...(topic ? { topic: { name: topic.name, path: topicHubPath(topic.slug) } } : {})}
      />
    </>
  );
}
