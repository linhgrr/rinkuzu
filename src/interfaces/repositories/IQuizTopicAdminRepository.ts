export type QuizTopicLocale = 'vi';

/** One stored topic (RIN-1248). */
export interface QuizTopicRecord {
  id: string;
  slug: string;
  locale: QuizTopicLocale;
  name: string;
  intro: string;
  order: number;
  published: boolean;
}

export interface QuizTopicInsertInput {
  slug: string;
  locale: QuizTopicLocale;
  name: string;
  intro: string;
  order: number;
  actorId: string;
}

export interface QuizTopicChange {
  id: string;
  slug?: string;
  name?: string;
  intro?: string;
  order?: number;
  published?: boolean;
}

/** One quiz's place in a topic. */
export interface QuizTopicAssignmentRecord {
  id: string;
  quizId: string;
  topicId: string;
  order: number;
}

export interface QuizTopicAssignmentInsertInput {
  quizId: string;
  topicId: string;
  order: number;
  actorId: string;
  /** Re-insert under a known id (undoing an unassign whose audit write failed). */
  id?: string;
}

export interface QuizTopicAssignmentOrderChange {
  id: string;
  order: number;
}

/** Admin reads and writes on `quiztopics` and `quiztopicassignments`. */
export interface IQuizTopicAdminRepository {
  /** Every topic, sorted by `order`. */
  listTopics(): Promise<QuizTopicRecord[]>;
  /** Null when the slug is taken (unique key). */
  insertTopic(input: QuizTopicInsertInput): Promise<QuizTopicRecord | null>;
  /** False when a slug change hit the unique key; nothing is written then. */
  updateTopics(changes: readonly QuizTopicChange[], actorId: string): Promise<boolean>;
  /** Only used to undo a create whose audit write failed. */
  deleteTopic(id: string): Promise<boolean>;
  /** Assignment counts keyed by topic id. */
  countAssignmentsByTopic(): Promise<Map<string, number>>;
  /** A topic's assignments, sorted by `order`. */
  listAssignments(topicId: string): Promise<QuizTopicAssignmentRecord[]>;
  findAssignmentByQuiz(quizId: string): Promise<QuizTopicAssignmentRecord | null>;
  /** Null when the quiz already has a topic (unique key on the quiz id). */
  insertAssignment(
    input: QuizTopicAssignmentInsertInput,
  ): Promise<QuizTopicAssignmentRecord | null>;
  updateAssignmentOrders(changes: readonly QuizTopicAssignmentOrderChange[]): Promise<void>;
  deleteAssignment(id: string): Promise<boolean>;
}
