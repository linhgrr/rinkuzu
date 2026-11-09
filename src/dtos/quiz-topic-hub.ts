/** One indexable quiz on a topic hub (RIN-1248, rendered by RIN-1249). */
export interface QuizTopicHubQuizDto {
  slug: string;
  title: string;
  questionCount: number;
  /** ISO date of the last change, for the hub's sitemap `lastModified`. */
  updatedAt: string;
}

/** A published topic with its indexable quizzes in hub order. */
export interface QuizTopicHubDto {
  slug: string;
  locale: 'vi';
  name: string;
  intro: string;
  quizzes: QuizTopicHubQuizDto[];
  /** Spec B5 (`isTopicIndexable`): false → the hub renders with `noindex`. */
  indexable: boolean;
}

/** An indexable hub, for the sitemap and the hub index. */
export interface QuizTopicHubSummaryDto {
  slug: string;
  locale: 'vi';
  name: string;
  indexableQuizCount: number;
  /** ISO date of the newest change among its indexable quizzes. */
  lastModified: string;
}
