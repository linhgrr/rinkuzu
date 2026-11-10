import type { QuizTopicHubDto, QuizTopicHubSummaryDto } from '@/dtos/quiz-topic-hub';
import { getQuizTopicHubService } from '@/lib/quiz-topic-hub-factory';
import { logger } from '@/lib/logger';
import { markdownToPlainText } from '@/lib/markdown/plain-text';
import { routePathSegment } from '@/lib/routing/routeParams';
import { canonicalFor } from '@/lib/seo';
import { HUB_ENTRY } from '@/shared/constants/starter-quiz';

/**
 * Topic hubs `/vi/explore/<topic>` (RIN-1249, spec RIN-1241 B). Hubs exist in
 * Vietnamese only until an `en` topic does.
 */
export const TOPIC_HUB_LOCALE = 'vi';

/** A hub lists at most this many quizzes; the footer link covers the rest. */
export const TOPIC_HUB_QUIZ_LIMIT = 30;

/** `/vi/explore` shows at most this many hub links. */
export const EXPLORE_HUB_LINK_LIMIT = 12;

const META_DESCRIPTION_MAX = 155;

export function topicHubPath(slug: string): string {
  return `/explore/${routePathSegment(slug)}`;
}

/** The intro as plain text, cut at a word boundary to about 155 characters (B4). */
export function buildTopicHubDescription(intro: string): string {
  const text = markdownToPlainText(intro);
  if (text.length <= META_DESCRIPTION_MAX) return text;
  const cut = text.slice(0, META_DESCRIPTION_MAX - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

/**
 * A hub card's link (E17, RIN-1469): the quiz's landing with `entry=hub` and the
 * topic slug, which the landing's CTAs carry on into the round. Nothing about
 * the learner is in the link.
 */
export function topicHubQuizHref(quizSlug: string, topicSlug: string): string {
  const params = new URLSearchParams({ entry: HUB_ENTRY, topic: topicSlug });
  return `/quiz/${routePathSegment(quizSlug)}?${params.toString()}`;
}

interface TopicHubJsonLdLabels {
  home: string;
  explore: string;
}

/** B7: BreadcrumbList Trang chủ › Khám phá › {topic}, and the ItemList of its quizzes. */
export function buildTopicHubJsonLd(
  hub: Pick<QuizTopicHubDto, 'slug' | 'name' | 'quizzes'>,
  labels: TopicHubJsonLdLabels,
): Record<string, unknown> {
  const hubUrl = canonicalFor(TOPIC_HUB_LOCALE, topicHubPath(hub.slug));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { name: labels.home, item: canonicalFor(TOPIC_HUB_LOCALE, '/') },
          { name: labels.explore, item: canonicalFor(TOPIC_HUB_LOCALE, '/explore') },
          { name: hub.name, item: hubUrl },
        ].map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, ...crumb })),
      },
      {
        '@type': 'ItemList',
        name: hub.name,
        url: hubUrl,
        numberOfItems: hub.quizzes.length,
        itemListElement: hub.quizzes.map((quiz, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: quiz.title,
          url: canonicalFor(TOPIC_HUB_LOCALE, `/quiz/${routePathSegment(quiz.slug)}`),
        })),
      },
    ],
  };
}

/**
 * Indexable hubs for the sitemap and `/vi/explore`. A failed read leaves hubs
 * out rather than failing the page or the sitemap.
 */
export async function loadIndexableTopicHubs(
  failureMessage: string,
): Promise<QuizTopicHubSummaryDto[]> {
  try {
    return await getQuizTopicHubService().listIndexableTopics();
  } catch (error) {
    logger.error({ error }, failureMessage);
    return [];
  }
}
