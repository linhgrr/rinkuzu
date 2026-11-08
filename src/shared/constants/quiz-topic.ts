/**
 * Topic hubs (RIN-1248, spec RIN-1241). Shared by the admin API (server) and the
 * admin topic form (client), so both judge an intro the same way.
 */
export const QUIZ_TOPIC_LOCALES = ['vi'] as const;

/** ASCII kebab-case: the hub URL is /<locale>/chu-de/<slug>. */
export const QUIZ_TOPIC_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A published topic's intro must have this many words; a draft may have fewer. */
export const QUIZ_TOPIC_INTRO_MIN_WORDS = 120;
export const QUIZ_TOPIC_INTRO_MAX_WORDS = 400;

/** A hub is indexable from this many indexable quizzes. */
const QUIZ_TOPIC_MIN_INDEXABLE_QUIZZES = 3;

export function countIntroWords(intro: string): number {
  return intro.split(/\s+/).filter(Boolean).length;
}

export function isTopicIntroPublishable(intro: string): boolean {
  const words = countIntroWords(intro);
  return words >= QUIZ_TOPIC_INTRO_MIN_WORDS && words <= QUIZ_TOPIC_INTRO_MAX_WORDS;
}

export interface TopicIndexabilityInput {
  published: boolean;
  intro: string;
  /** Assigned quizzes that pass `isQuizIndexable` (RIN-1246). */
  indexableQuizCount: number;
}

/**
 * Spec B5: a hub is indexable when it is published, has a publishable intro and
 * holds at least three indexable quizzes.
 * @public Consumed by the topic hub read service and pages (RIN-1249); drop this tag there.
 */
export function isTopicIndexable(topic: TopicIndexabilityInput): boolean {
  return (
    topic.published &&
    isTopicIntroPublishable(topic.intro) &&
    topic.indexableQuizCount >= QUIZ_TOPIC_MIN_INDEXABLE_QUIZZES
  );
}
