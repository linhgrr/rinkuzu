import type {
  QuizTopicAssignmentRecord,
  QuizTopicRecord,
} from '@/interfaces/repositories/IQuizTopicAdminRepository';

/** The fields a topic hub needs from one assigned quiz, nothing else (RIN-1248). */
export interface QuizTopicHubQuizRecord {
  id: string;
  slug: string;
  title: string;
  visibility: string;
  authorId: string | null;
  questionCount: number;
  createdAt: Date;
  updatedAt?: Date;
}

/** Public-side reads on `quiztopics`, `quiztopicassignments` and the assigned quizzes. */
export interface IQuizTopicHubRepository {
  /** The published topic with this slug, or null. */
  findPublishedTopicBySlug(slug: string): Promise<QuizTopicRecord | null>;
  /** Published topics, sorted by `order`. */
  listPublishedTopics(): Promise<QuizTopicRecord[]>;
  /** Assignments of these topics, sorted by topic, then `order`. */
  listAssignmentsByTopicIds(topicIds: readonly string[]): Promise<QuizTopicAssignmentRecord[]>;
  /** Public quizzes among these ids; private or deleted ones are left out. */
  findPublicQuizzesByIds(quizIds: readonly string[]): Promise<QuizTopicHubQuizRecord[]>;
}
